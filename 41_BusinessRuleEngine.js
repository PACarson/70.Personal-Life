/**
 * 41_BusinessRuleEngine.gs
 * Personal Life OS v5.2 — BusinessRule Engine（Sprint 3，三层模型）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「六」、
 * 00_Business_Rules.gs「三」、00_ADR.gs ADR-2026-07-24-010/011。
 *
 * 职责：管理 BusinessRule（顶层分类）+ WorkflowTemplate（具体版本）
 * 两张表——capture（把一个 Project 抽象成某个 BusinessRule 下的新
 * 版本 WorkflowTemplate，必要时先创建 BusinessRule 本身）、deprecate
 * （显式标记某个版本不再推荐）、instantiate（从某个具体版本的
 * WorkflowTemplate 生成新 Workflow Instance，可选同时生成新
 * Project）、suggest（标签/关键词匹配）。
 *
 * 三层关系：BusinessRule 1 - N WorkflowTemplate（版本），
 * WorkflowTemplate 1 - N Workflow（Instance，即既有 Workflows 表）。
 * Workflow Instance 永久绑定创建时的具体版本，模板后续升版不影响
 * 已经生成的 Instance。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 见文件头
 *   Owns                  : 抽象规则（Project 结构 → workflow_shape）、
 *                           版本号递增规则、版本状态流转规则（ACTIVE→
 *                           FROZEN 自动，DEPRECATED 只能显式）
 *   Reads                 : ProjectQueryEngine、TaskQueryEngine、
 *                           WorkflowQueryEngine（capture 时读取源
 *                           Project 结构）、BusinessRuleQueryEngine
 *                           （instantiate/suggest 时读取已有数据）
 *   Writes                : Events（BUSINESS_RULE_CREATED,
 *                           WORKFLOW_TEMPLATE_CAPTURED,
 *                           WORKFLOW_TEMPLATE_FROZEN,
 *                           WORKFLOW_TEMPLATE_DEPRECATED,
 *                           WORKFLOW_INSTANCE_CREATED）
 *   Public API            : captureAsWorkflowTemplate,
 *                           createBusinessRuleDirect_,
 *                           deprecateWorkflowTemplate,
 *                           instantiateFromTemplate, suggestMatchingRules
 *   Dependencies           : 14_ProjectQueryEngine.gs、
 *                           27_ProjectEngine.gs、20_TaskEngine.gs、
 *                           28_WorkflowEngine.gs、
 *                           19_BusinessRuleQueryEngine.gs、
 *                           07_IdentityEngine.gs、09_IdempotencyManager.gs
 *   Forbidden Dependencies  : 自动执行 instantiate（必须显式触发）；
 *                           自动 deprecate（不会因为版本 FROZEN 就
 *                           跟着自动 DEPRECATED）
 *   Pure Function            : NO（capture/instantiate 有副作用；
 *                           suggestMatchingRules 委托给
 *                           BusinessRuleQueryEngine.findByTags，本身
 *                           是纯函数）
 *   Side Effects              : YES
 */

var LifeBusinessRuleConfig = Object.freeze({
  BUSINESS_RULES_SHEET_NAME:     'BusinessRules',
  WORKFLOW_TEMPLATES_SHEET_NAME: 'WorkflowTemplates',
  BUSINESS_RULE_STATUSES:  ['ACTIVE', 'DEPRECATED'],
  TEMPLATE_STATUSES:       ['ACTIVE', 'FROZEN', 'DEPRECATED'],
  CREATED_METHODS:  ['Manual', 'AI Suggestion', 'Rule Generated', 'Imported', 'Converted'],
  APPROVAL_STATUSES: ['APPROVED', 'PENDING', 'REJECTED']
});

var BusinessRuleEngine = (function () {

  var CFG = LifeBusinessRuleConfig;

  function _resolveMetadata_(meta, chatId) {
    var creator = meta.creator === 'AI' ? 'AI' : 'User';
    var isAiCreated = (creator === 'AI');

    return {
      creator:          creator,
      suggested_by:     meta.suggested_by || (isAiCreated ? '' : 'User'),
      source_domain:    meta.source_domain || 'Personal Life',
      source_module:    meta.source_module || '',
      source_event_id:  meta.source_event_id || '',
      source_task_id:   meta.source_task_id || '',
      created_method:   CFG.CREATED_METHODS.indexOf(meta.created_method) !== -1 ? meta.created_method : 'Manual',
      decision_owner:   meta.decision_owner || String(chatId || ''),
      approval_status:  isAiCreated ? 'PENDING' : 'APPROVED'
    };
  }

  // ============ BusinessRule（顶层分类）创建 ============

  /**
   * 实际创建函数 —— 只由
   * 09_IdempotencyManager.createBusinessRuleIfNotExists() 调用。
   * 绝大多数情况下调用方不需要直接用这个，captureAsWorkflowTemplate
   * 内部会在需要时自动调用 IdempotencyManager.createBusinessRuleIfNotExists。
   */
  function createBusinessRuleDirect_(name, meta, chatId, identity) {
    meta = meta || {};
    var metadata = _resolveMetadata_(meta, chatId);
    var nowIso = new Date().toISOString();

    var rule = {
      rule_id:          generateRuleId_(),
      name:             name,
      tags:             meta.tags || '',
      status:           'ACTIVE',
      creator:          metadata.creator,
      suggested_by:     metadata.suggested_by,
      source_domain:    metadata.source_domain,
      source_module:    metadata.source_module,
      source_event_id:  metadata.source_event_id,
      source_task_id:   metadata.source_task_id,
      created_method:   metadata.created_method,
      created_time:     nowIso,
      updated_time:     nowIso,
      decision_owner:   metadata.decision_owner,
      approval_status:  metadata.approval_status
    };

    EventBus.publish('BUSINESS_RULE_CREATED', rule, chatId, 'BusinessRuleEngine', identity);

    return rule;
  }

  // ============ Capture ============

  /**
   * 把一个 Project 的结构抽象、沉淀为 BusinessRule 下的新版本
   * WorkflowTemplate。若 ruleName 对应的 BusinessRule 不存在，先
   * 隐式创建；若该 BusinessRule 下已有 ACTIVE 版本，自动转为 FROZEN
   * （两个事件同一次调用里先后发布）。
   *
   * 抽象规则（见 00_Business_Rules.gs「三」）：Task.title 保留为
   * title_template 原文；due_date 转换成 relative_offset_days
   * （相对 Project.created_time 的天数差）；用模板内部的 local_id
   * （不是真实 task_id）表达 sequence_index/Parent-Child/Branch 结构，
   * 因为真实 task_id 在未来实例化时并不存在。
   *
   * @param {string} projectId
   * @param {string} ruleName
   * @param {string[]} [tags]
   * @returns {object|{not_found:true}}
   */
  function captureAsWorkflowTemplate(projectId, ruleName, tags) {
    var project = ProjectQueryEngine.getProject(projectId);
    if (!project) return { not_found: true };

    var chatId = project.chat_id;
    var tasks = TaskQueryEngine.getTasksByProject(projectId);
    tasks.sort(function (a, b) { return (Number(a.sequence_index) || 0) - (Number(b.sequence_index) || 0); });

    var taskIdToLocalId = {};
    tasks.forEach(function (t, idx) { taskIdToLocalId[t.task_id] = idx + 1; });

    var projectCreatedTime = project.created_time ? new Date(project.created_time) : new Date();

    var shapeTasks = tasks.map(function (t, idx) {
      var offsetDays = 0;
      if (t.due_date) {
        var dueDate = new Date(t.due_date);
        offsetDays = Math.round((dueDate.getTime() - projectCreatedTime.getTime()) / (24 * 60 * 60 * 1000));
      }
      return {
        local_id:             idx + 1,
        title_template:       t.title,
        relative_offset_days: offsetDays,
        sequence_index:       t.sequence_index || '',
        parent_local_id:      t.parent_task_id ? (taskIdToLocalId[t.parent_task_id] || null) : null,
        branch_group_label:   t.branch_group || null,
        branch_resolution_policy: t.branch_resolution_policy || ''
      };
    });

    var relatedWorkflows = (typeof WorkflowQueryEngine !== 'undefined')
      ? WorkflowQueryEngine.getWorkflows(chatId, { project_id: projectId })
      : [];
    var workflowType = relatedWorkflows.length > 0 ? relatedWorkflows[0].workflow_type : 'SEQUENTIAL';

    var workflowShape = { tasks: shapeTasks, workflow_type: workflowType };

    var ruleResult = IdempotencyManager.createBusinessRuleIfNotExists(ruleName, { tags: (tags || []).join(',') }, chatId);
    var rule = ruleResult.businessRule;

    var existingTemplates = BusinessRuleQueryEngine.getTemplatesForRule(rule.rule_id);
    var maxVersion = existingTemplates.reduce(function (max, t) { return Math.max(max, Number(t.version) || 0); }, 0);
    var newVersion = maxVersion + 1;

    var previousActive = existingTemplates.filter(function (t) { return String(t.status || '').toUpperCase() === 'ACTIVE'; })[0];
    if (previousActive) {
      EventBus.publish('WORKFLOW_TEMPLATE_FROZEN', { template_id: previousActive.template_id }, chatId, 'BusinessRuleEngine');
    }

    var templateIdentity = IdentityEngine.generateWorkflowTemplateIdentity(rule.rule_id, newVersion);
    var nowIso = new Date().toISOString();

    var template = {
      template_id:               generateTemplateId_(),
      identity:                  templateIdentity,
      business_rule_id:          rule.rule_id,
      version:                   newVersion,
      status:                    'ACTIVE',
      workflow_shape:            JSON.stringify(workflowShape),
      captured_from_project_id:  projectId,
      usage_count:               0,
      last_used_at:              '',
      creator:          'User',
      suggested_by:     'User',
      source_domain:    'Personal Life',
      source_module:    'BusinessRuleEngine.captureAsWorkflowTemplate',
      source_event_id:  '',
      source_task_id:   '',
      created_method:   'Manual',
      created_time:     nowIso,
      updated_time:     nowIso,
      decision_owner:   String(chatId || ''),
      approval_status:  'APPROVED'
    };

    EventBus.publish('WORKFLOW_TEMPLATE_CAPTURED', template, chatId, 'BusinessRuleEngine', templateIdentity);

    return template;
  }

  // ============ Deprecate ============

  /**
   * 显式标记某个版本"不建议再用"。跟 FROZEN 是两件独立的事——不会
   * 因为版本被 capture 新版本自动 FROZEN 就跟着触发 DEPRECATED，
   * 必须显式调用，任何状态（ACTIVE 或 FROZEN）的版本都可以被
   * Deprecate。
   * @param {string} templateId
   */
  function deprecateWorkflowTemplate(templateId) {
    var template = BusinessRuleQueryEngine.getWorkflowTemplate(templateId);
    if (!template) return { not_found: true };

    if (String(template.status || '').toUpperCase() === 'DEPRECATED') {
      return { already_deprecated: true };
    }

    EventBus.publish('WORKFLOW_TEMPLATE_DEPRECATED', { template_id: templateId }, template.decision_owner, 'BusinessRuleEngine');
    return {};
  }

  // ============ Instantiate ============

  /**
   * 从一个具体版本的 WorkflowTemplate 生成新的 Workflow（Instance），
   * 同时创建新 Project（复用既有 27_ProjectEngine.createProject）+
   * 新 Workflow（复用既有 28_WorkflowEngine.startWorkflow，携带
   * instantiated_from_template_id/template_version_at_instantiation
   * 字段）+ 一批新 Task（复用既有 20_TaskEngine.createTask）——本函数
   * 不重新实现任何实体创建逻辑，只负责编排 + 把模板里的 local_id
   * 引用换算成真实 ID + 最后发布一个专门的 WORKFLOW_INSTANCE_CREATED
   * 事件更新模板的 usage_count。
   *
   * 调用方必须显式传入 templateId（不能只给 ruleId），需要"当前默认
   * 版本"时先调 BusinessRuleQueryEngine.getActiveTemplateForRule(ruleId)
   * 拿 templateId。
   *
   * @param {string} templateId
   * @param {object} newProjectMeta  { title, description,
   *                                   parent_project_id, execution_mode }
   * @param {string} chatId
   * @returns {{project:object, workflow:object, tasks:object[]}|{not_found:true}}
   */
  function instantiateFromTemplate(templateId, newProjectMeta, chatId) {
    var template = BusinessRuleQueryEngine.getWorkflowTemplate(templateId);
    if (!template) return { not_found: true };

    newProjectMeta = newProjectMeta || {};
    var shape = JSON.parse(template.workflow_shape);

    var project = ProjectEngine.createProject(newProjectMeta.title || ('实例化-' + template.template_id), {
      description:        newProjectMeta.description || '',
      parent_project_id:  newProjectMeta.parent_project_id || '',
      execution_mode:     newProjectMeta.execution_mode || '',
      instantiated_from_template_id: templateId,
      creator:          'User',
      source_module:    'BusinessRuleEngine.instantiateFromTemplate'
    }, chatId);

    var workflow = WorkflowEngine.startWorkflow((newProjectMeta.title || project.title) + ' - Workflow', {
      project_id:       project.project_id,
      workflow_type:    shape.workflow_type,
      instantiated_from_template_id:    templateId,
      template_version_at_instantiation: template.version,
      creator:          'AI',
      source_module:    'BusinessRuleEngine.instantiateFromTemplate',
      created_method:   'Rule Generated'
    }, chatId);

    var now = new Date();
    var localIdToTaskId = {};
    var newBranchGroupMap = {};
    var createdTasks = [];

    shape.tasks.forEach(function (shapeTask) {
      var dueDate = new Date(now.getTime() + (Number(shapeTask.relative_offset_days) || 0) * 24 * 60 * 60 * 1000);
      var tz = Session.getScriptTimeZone();
      var dueDateStr = Utilities.formatDate(dueDate, tz, 'yyyy-MM-dd');

      var branchGroup = '';
      if (shapeTask.branch_group_label) {
        if (!newBranchGroupMap[shapeTask.branch_group_label]) {
          newBranchGroupMap[shapeTask.branch_group_label] = 'BG-' + Utilities.getUuid().split('-')[0].toUpperCase();
        }
        branchGroup = newBranchGroupMap[shapeTask.branch_group_label];
      }

      var task = TaskEngine.createTask(shapeTask.title_template, {
        project_id:       project.project_id,
        workflow_id:      workflow.workflow_id,
        sequence_index:   shapeTask.sequence_index,
        due_date:         dueDateStr,
        branch_group:     branchGroup,
        branch_resolution_policy: shapeTask.branch_resolution_policy || '',
        creator:          'AI',
        source_module:    'BusinessRuleEngine.instantiateFromTemplate',
        created_method:   'Rule Generated'
      }, chatId);

      localIdToTaskId[shapeTask.local_id] = task.task_id;
      createdTasks.push(task);
    });

    // 第二遍：补上 Parent/Child（第一遍创建时子任务的父 task_id 可能
    // 还不存在，所以分两遍）
    shape.tasks.forEach(function (shapeTask, idx) {
      if (shapeTask.parent_local_id && localIdToTaskId[shapeTask.parent_local_id]) {
        TaskEngine.updateTask(createdTasks[idx].task_id, { parent_task_id: localIdToTaskId[shapeTask.parent_local_id] }, chatId);
      }
    });

    EventBus.publish('WORKFLOW_INSTANCE_CREATED', {
      template_id:     templateId,
      new_workflow_id: workflow.workflow_id,
      new_project_id:  project.project_id
    }, chatId, 'BusinessRuleEngine');

    return { project: project, workflow: workflow, tasks: createdTasks };
  }

  // ============ Suggest ============

  /**
   * 纯建议，不自动创建任何东西（Decision Never Executes）。
   * @param {string[]} queryTags
   * @returns {object[]}  每条附带 active_template_id，方便调用方直接
   *                       拿去 instantiateFromTemplate
   */
  function suggestMatchingRules(queryTags) {
    var matches = BusinessRuleQueryEngine.findByTags(queryTags);
    return matches.map(function (rule) {
      var activeTemplate = BusinessRuleQueryEngine.getActiveTemplateForRule(rule.rule_id);
      var result = shallowCopy_(rule);
      result.active_template_id = activeTemplate ? activeTemplate.template_id : '';
      return result;
    });
  }

  // ============ 派生引擎 ============

  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    switch (event.type) {
      case 'BUSINESS_RULE_CREATED':
        stateMap['rule:' + p.rule_id] = shallowCopy_(p);
        break;
      case 'WORKFLOW_TEMPLATE_CAPTURED':
        stateMap['template:' + p.template_id] = shallowCopy_(p);
        break;
      case 'WORKFLOW_TEMPLATE_FROZEN':
        if (stateMap['template:' + p.template_id]) stateMap['template:' + p.template_id].status = 'FROZEN';
        break;
      case 'WORKFLOW_TEMPLATE_DEPRECATED':
        if (stateMap['template:' + p.template_id]) stateMap['template:' + p.template_id].status = 'DEPRECATED';
        break;
      case 'WORKFLOW_INSTANCE_CREATED':
        if (stateMap['template:' + p.template_id]) {
          var t = stateMap['template:' + p.template_id];
          t.usage_count = (Number(t.usage_count) || 0) + 1;
          t.last_used_at = event.timestamp;
        }
        break;
    }
    return stateMap;
  }

  function materializeBusinessRuleRow_(ruleId, knownRule) {
    if (!knownRule) return;
    upsertRowByKey_(CFG.BUSINESS_RULES_SHEET_NAME, 'rule_id', ruleId, knownRule);
  }

  function materializeWorkflowTemplateRow_(templateId, knownTemplate) {
    if (!knownTemplate) return;
    upsertRowByKey_(CFG.WORKFLOW_TEMPLATES_SHEET_NAME, 'template_id', templateId, knownTemplate);
  }

  // ============ 内部工具 ============

  function generateRuleId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    return 'RULE-' + today + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  function generateTemplateId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    return 'TPL-' + today + '-' + Utilities.getUuid().split('-')[0].toUpperCase();
  }

  return {
    captureAsWorkflowTemplate:    captureAsWorkflowTemplate,
    createBusinessRuleDirect_:    createBusinessRuleDirect_,
    deprecateWorkflowTemplate:    deprecateWorkflowTemplate,
    instantiateFromTemplate:      instantiateFromTemplate,
    suggestMatchingRules:         suggestMatchingRules,
    deriveFromEvent:              deriveFromEvent,
    materializeBusinessRuleRow_:      materializeBusinessRuleRow_,
    materializeWorkflowTemplateRow_:  materializeWorkflowTemplateRow_
  };
})();
