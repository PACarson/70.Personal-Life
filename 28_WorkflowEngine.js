/**
 * 28_WorkflowEngine.gs
 * Personal Life OS v5.2 — Workflow Engine（start / finish / cancel +
 * Branch Resolution + Workflow 级 Recurring）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「三」、
 * 00_Business_Rules.gs「二」「七」、00_ADR.gs ADR-2026-07-24-008。
 *
 * 职责：
 *  - Workflow 定义的生命周期（start/finish/cancel）
 *  - checkAndFinishIfComplete_：20_TaskEngine.completeTask/cancelTask
 *    在处理完一个带 workflow_id 的 Task 后调用，检查该 Workflow 下
 *    全部 Task 是否都已终态，是则自动 finish
 *  - handleBranchResolution_：Branch 类型 Workflow 里，某个分支 Task
 *    被 Complete 时，按该 branch_group 配置的 branch_resolution_policy
 *    处理同组其余 Task（AUTO→NOT_SELECTED / RETURN_TO_QUEUE / WAITING /
 *    KEEP_OPEN / MANUAL，见 00_Business_Rules.gs「七」）
 *  - spawnNextWorkflowIfNeeded：Workflow 级 Recurring（整个 Workflow
 *    按日历重新生成一份新实例，区别于 Task 级 Recurring，见 00_ADR.gs
 *    ADR-2026-07-24-005）
 *
 * LOOP 类型（v5.2）：本版本只接受创建，不实现展开逻辑，见
 * createWorkflowDirect_ 里的 warning 说明，完整论证见设计包
 * 00_Module_Responsibility.gs「三」Notes。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 见文件头
 *   Owns                  : Branch Resolution Policy 的具体执行逻辑、
 *                           "这个 Workflow 算不算 FINISHED"的判断规则
 *   Reads                 : 单个 workflow + 其下全部 Task（通过
 *                           WorkflowQueryEngine.getWorkflowWithTasks）
 *   Writes                : Events；Workflow 级 Recurring 触发时委托
 *                           TaskEngine 批量创建新一批 Task
 *   Dependencies           : 09_TemporalParser.gs、20_TaskEngine.gs、
 *                           07_IdentityEngine.gs、16_WorkflowQueryEngine.gs
 *   Forbidden Dependencies  : Sheet 直接读写、Telegram/Output
 *   Pure Function            : NO
 *   Side Effects              : YES
 */

var LifeWorkflowConfig = Object.freeze({
  WORKFLOWS_SHEET_NAME: 'LIFE_WORKFLOWS',
  WORKFLOW_TYPES: ['SEQUENTIAL', 'PARALLEL', 'BRANCH', 'LOOP', 'RECURRING'],
  // Workflow 本身不原生使用 WAITING/BLOCKED——那是它下面具体 Task 的事，
  // 见 00_Sheets_Structure.gs「四」。
  WORKFLOW_STATUSES: ['DRAFT', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  CREATED_METHODS:  ['Manual', 'AI Suggestion', 'Rule Generated', 'Imported', 'Converted'],
  APPROVAL_STATUSES: ['APPROVED', 'PENDING', 'REJECTED'],
  IDENTITY_AFFECTING_FIELDS: ['title', 'project_id', 'workflow_type']
});

var WorkflowEngine = (function () {

  var CFG = LifeWorkflowConfig;
  var TASK_TERMINAL_STATUSES = ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'];

  function _resolveMetadata_(meta, chatId) {
    var creator = meta.creator === 'AI' ? 'AI' : 'User';
    var isAiCreated = (creator === 'AI');

    return {
      creator:          creator,
      suggested_by:     meta.suggested_by || (isAiCreated ? '' : 'User'),
      source_domain:    meta.source_domain || 'Personal Life',
      source_module:    meta.source_module || '',
      source_event_id:  meta.source_event_id || '',
      created_method:   CFG.CREATED_METHODS.indexOf(meta.created_method) !== -1 ? meta.created_method : 'Manual',
      decision_owner:   meta.decision_owner || String(chatId || ''),
      approval_status:  isAiCreated ? 'PENDING' : 'APPROVED'
    };
  }

  // ============ Create / Start ============

  function createWorkflow(title, meta, chatId) {
    var result = IdempotencyManager.createWorkflowIfNotExists(title, meta || {}, chatId);
    return result.workflow;
  }

  /**
   * 实际创建函数 —— 只由 09_IdempotencyManager.createWorkflowIfNotExists()
   * 调用。外部代码一律调 createWorkflow() 或下面的 startWorkflow()（两者
   * 的区别：createWorkflow 只建记录，状态是 DRAFT；startWorkflow 额外把
   * 状态推进到 IN_PROGRESS，是本 Engine 最常用的入口，多数调用方应该直接
   * 用 startWorkflow）。
   */
  function createWorkflowDirect_(title, meta, chatId, identity) {
    meta = meta || {};

    var workflowType = CFG.WORKFLOW_TYPES.indexOf(meta.workflow_type) !== -1 ? meta.workflow_type : 'SEQUENTIAL';
    var metadata = _resolveMetadata_(meta, chatId);
    var nowIso = new Date().toISOString();

    var workflow = {
      workflow_id:      generateWorkflowId_(),
      identity:         identity || '',
      project_id:       meta.project_id || '',
      title:            title,
      workflow_type:    workflowType,
      status:           'DRAFT',
      // 简单字符串标签（'Daily'|'Weekly'|'Monthly'|'Yearly'），复用既有
      // ProductivityConfig.TASK_RECURRING 同一套词汇，不是 JSON 对象——
      // 见 spawnNextWorkflowIfNeeded 对 09_TemporalParser.
      // computeNextDueDateFromLabel 真实签名的核实说明。
      recurrence_rule:  meta.recurrence_rule || '',
      loop_max_iterations: (meta.loop_max_iterations != null) ? meta.loop_max_iterations : '',
      chat_id:          chatId || '',

      instantiated_from_template_id:    meta.instantiated_from_template_id || '', // Sprint 3
      template_version_at_instantiation:  meta.template_version_at_instantiation || '', // Sprint 3

      creator:          metadata.creator,
      suggested_by:     metadata.suggested_by,
      source_domain:    metadata.source_domain,
      source_module:    metadata.source_module,
      source_event_id:  metadata.source_event_id,
      created_method:   metadata.created_method,
      created_time:     nowIso,
      updated_time:     nowIso,
      decision_owner:   metadata.decision_owner,
      approval_status:  metadata.approval_status
    };

    var event = EventBus.publish('WORKFLOW_STARTED', workflow, chatId, 'WorkflowEngine', identity);

    var warning = null;
    if (workflowType === 'LOOP') {
      warning = 'LOOP_NOT_FULLY_SPECIFIED'; // 见文件头说明，本版本只接受创建，不展开
    }

    workflow._warning = warning; // 不落 Sheet，只是这次调用返回值里的提示
    return workflow;
  }

  /**
   * 大多数调用方应该用这个，而不是 createWorkflow()——直接把状态推进到
   * IN_PROGRESS（DRAFT 状态的存在主要是为了跟 Canonical Lifecycle 的
   * 四段式保持结构一致，见 00_ADR.gs ADR-2026-07-24-017，多数实际使用
   * 场景不需要一个"草稿中"的 Workflow 阶段）。
   */
  function startWorkflow(title, meta, chatId) {
    var workflow = createWorkflow(title, meta, chatId);
    if (workflow && workflow.status === 'DRAFT') {
      var payload = { workflow_id: workflow.workflow_id, status: 'IN_PROGRESS', updated_time: new Date().toISOString() };
      var event = EventBus.publish('WORKFLOW_UPDATED', payload, chatId, 'WorkflowEngine');
      if (event && event.projection_ok === false) {
        materializeWorkflowRow_(workflow.workflow_id, payload);
      }
      workflow.status = 'IN_PROGRESS';
    }
    return workflow;
  }

  // ============ Finish / Cancel ============

  function finishWorkflow(workflowId, chatId) {
    var existing = WorkflowQueryEngine.getWorkflow(workflowId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'COMPLETED') return { already_finished: true };
    if (currentStatus === 'CANCELLED') return { invalid_state: true, current_status: currentStatus };

    var event = EventBus.publish('WORKFLOW_FINISHED', { workflow_id: workflowId }, chatId, 'WorkflowEngine');
    if (event && event.projection_ok === false) {
      materializeWorkflowRow_(workflowId, { status: 'COMPLETED' });
    }

    // Workflow 级 Recurring：全部完成后检查要不要生成下一次实例。
    if (String(existing.workflow_type || '').toUpperCase() === 'RECURRING') {
      try {
        spawnNextWorkflowIfNeeded(existing, chatId);
      } catch (e) {
        Logger.log('[WorkflowEngine] spawnNextWorkflowIfNeeded 失败（不影响本次 finish 已经成功的事实）: ' + e.message);
      }
    }

    return {};
  }

  function cancelWorkflow(workflowId, chatId) {
    var existing = WorkflowQueryEngine.getWorkflow(workflowId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED') return { already_cancelled: true };
    if (currentStatus === 'COMPLETED') return { invalid_state: true, current_status: currentStatus };

    var event = EventBus.publish('WORKFLOW_CANCELLED', { workflow_id: workflowId }, chatId, 'WorkflowEngine');
    if (event && event.projection_ok === false) {
      materializeWorkflowRow_(workflowId, { status: 'CANCELLED' });
    }

    return {};
  }

  /**
   * 【核心联动函数】20_TaskEngine.completeTask/cancelTask 在处理完一个
   * 带 workflow_id 的 Task 后调用——检查该 Workflow 下全部 Task 是否
   * 都已终态（DONE/CANCELLED/CONVERTED/NOT_SELECTED），是则自动
   * finishWorkflow。空 Workflow（还没有任何 Task）不会被误判为已完成
   * ——下面显式检查 tasks.length > 0。
   *
   * @param {string} workflowId
   */
  function checkAndFinishIfComplete_(workflowId) {
    if (!workflowId) return;

    var existing = WorkflowQueryEngine.getWorkflow(workflowId);
    if (!existing) return;
    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') return; // 已经是终态，不重复判断

    var tasks = (typeof TaskQueryEngine !== 'undefined') ? TaskQueryEngine.getTasksByWorkflow(workflowId) : [];
    if (tasks.length === 0) return;

    var allTerminal = tasks.every(function (t) {
      return TASK_TERMINAL_STATUSES.indexOf(String(t.status || '').toUpperCase()) !== -1;
    });

    if (allTerminal) {
      finishWorkflow(workflowId, existing.chat_id);
    }
  }

  /**
   * 【Branch Resolution，见 00_Business_Rules.gs「七」】Branch 类型
   * Workflow 里，某个分支 Task 被 Complete 时由 20_TaskEngine.completeTask
   * 调用。按该 Task 的 branch_group 所在同组配置的
   * branch_resolution_policy，处理同组其余 Task：
   *
   *   AUTO             → 同组其余 Task 调用 TaskEngine.markTaskNotSelected_
   *   RETURN_TO_QUEUE   → 同组其余 Task 保持 PENDING，清除 due_date/due_time
   *   WAITING            → 同组其余 Task 转为 WAITING（走 updateTask，因为
   *                        WAITING 不是终态，允许普通字段更新路径设置）
   *   KEEP_OPEN / MANUAL   → 不做任何自动操作
   *
   * @param {string} workflowId  可为空（Task 也可能不属于任何 Workflow，
   *                             此时函数直接返回，不报错）
   * @param {string} completedTaskId
   */
  function handleBranchResolution_(workflowId, completedTaskId) {
    var completedTask = TaskQueryEngine.getTask(completedTaskId);
    if (!completedTask || !completedTask.branch_group) return;

    var branchGroup = completedTask.branch_group;
    var policy = String(completedTask.branch_resolution_policy || 'MANUAL').toUpperCase();

    var siblingTasks = TaskQueryEngine.getTasks(completedTask.chat_id, {}).filter(function (t) {
      return t.branch_group === branchGroup &&
             t.task_id !== completedTaskId &&
             TASK_TERMINAL_STATUSES.indexOf(String(t.status || '').toUpperCase()) === -1;
    });

    if (siblingTasks.length === 0) return;

    siblingTasks.forEach(function (t) {
      try {
        if (policy === 'AUTO') {
          TaskEngine.markTaskNotSelected_(t.task_id, t.chat_id);
        } else if (policy === 'RETURN_TO_QUEUE') {
          TaskEngine.updateTask(t.task_id, { due_date: '', due_time: '' }, t.chat_id);
        } else if (policy === 'WAITING') {
          // status 不在 UPDATABLE_FIELDS 白名单里（见 20_TaskEngine.gs），
          // WAITING 走跟 completeTask/cancelTask 同一类"专门状态转换"
          // 事件，不是普通字段更新——发布 TASK_UPDATED 但只带 status，
          // 由 ProjectionEngine 直接覆写（Branch 场景下这是唯一一处
          // "普通更新事件里携带 status"的例外，见
          // 10_ProjectionEngine.gs projectTaskUpdated_ 的处理方式）。
          EventBus.publish('TASK_UPDATED', { task_id: t.task_id, status: 'WAITING', updated_time: new Date().toISOString() }, t.chat_id, 'WorkflowEngine');
        }
        // KEEP_OPEN / MANUAL：不做任何操作
      } catch (e) {
        Logger.log('[WorkflowEngine] handleBranchResolution_ 处理 task_id=' + t.task_id + ' 失败: ' + e.message);
      }
    });
  }

  /**
   * 【Workflow 级 Recurring，见 00_ADR.gs ADR-2026-07-24-005】整个
   * Workflow 完成后，按 recurrence_rule 判断"下一次"是否已到期，是则
   * 创建一个新 workflow_id + 一批新 Task（复制原 Task 的 title/
   * sequence_index/branch 结构，due_date 按 recurrence_rule 重新计算）。
   * 新旧 Workflow 之间不建立显式外键关联（跟 Task 级 Recurring 生成新
   * task_id 不关联旧 task_id 是同一个设计取舍）。
   *
   * 【重要】recurrence_rule 是简单字符串标签（'Daily'|'Weekly'|
   * 'Monthly'|'Yearly'），直接复用既有 ProductivityConfig.TASK_RECURRING
   * 同一套词汇——不是一个独立的 JSON 规则对象。这是核实
   * 09_TemporalParser.computeNextDueDateFromLabel(prevDueDateStr,
   * recurringLabel) 的真实签名后做的修正：该函数就是按这个简单标签
   * 计算下一次日期，本模块直接复用，不重新发明一套更复杂的规则格式。
   *
   * 失败恢复：逐个创建，任一失败即停止，已创建部分的 Workflow 状态
   * 标记 warning（不做分布式事务，GAS 环境没有这个能力），见设计包
   * 00_Module_Responsibility.gs「三」Thread Safety。
   *
   * @param {object} finishedWorkflow
   * @param {string} chatId
   * @returns {object|null}  新 workflow 对象，或 null（无需续期/规则
   *                          缺失）
   */
  function spawnNextWorkflowIfNeeded(finishedWorkflow, chatId) {
    if (!finishedWorkflow || !finishedWorkflow.recurrence_rule) return null;

    var recurringLabel = String(finishedWorkflow.recurrence_rule);

    // 日期计算复用既有 09_TemporalParser.gs（跟 21_RecurringEngine.gs
    // 同一份工具），本文件不重新实现日期推算逻辑。
    if (typeof computeNextDueDateFromLabel !== 'function') {
      Logger.log('[WorkflowEngine] spawnNextWorkflowIfNeeded: 09_TemporalParser.gs 的日期计算函数不可用，跳过续期');
      return null;
    }

    var oldTasks = TaskQueryEngine.getTasksByWorkflow(finishedWorkflow.workflow_id);
    if (oldTasks.length === 0) return null;

    var newWorkflow = createWorkflow(finishedWorkflow.title, {
      project_id: finishedWorkflow.project_id,
      workflow_type: 'RECURRING',
      recurrence_rule: recurringLabel,
      creator: 'AI',
      source_module: 'WorkflowEngine.spawnNextWorkflowIfNeeded',
      created_method: 'Rule Generated'
    }, chatId);

    if (!newWorkflow) return null;

    var spawnFailed = false;
    oldTasks.forEach(function (oldTask) {
      if (spawnFailed) return;
      try {
        // 【签名核实】computeNextDueDateFromLabel(prevDueDateStr, recurringLabel)
        // ——参数顺序是"上一次日期在前，标签在后"，跟既有
        // 21_RecurringEngine.computeNextDueDate 包装函数的调用方式一致。
        var newDueDate = computeNextDueDateFromLabel(oldTask.due_date || '', recurringLabel);
        TaskEngine.createTask(oldTask.title, {
          category: oldTask.category,
          priority: oldTask.priority,
          due_date: newDueDate,
          project_id: oldTask.project_id,
          workflow_id: newWorkflow.workflow_id,
          sequence_index: oldTask.sequence_index,
          branch_group: oldTask.branch_group,
          branch_resolution_policy: oldTask.branch_resolution_policy,
          creator: 'AI',
          source_module: 'WorkflowEngine.spawnNextWorkflowIfNeeded',
          created_method: 'Rule Generated'
        }, chatId);
      } catch (e) {
        Logger.log('[WorkflowEngine] spawnNextWorkflowIfNeeded: 复制 task ' + oldTask.task_id + ' 失败，停止本次续期: ' + e.message);
        spawnFailed = true;
      }
    });

    if (spawnFailed) {
      EventBus.publish('WORKFLOW_UPDATED',
        { workflow_id: newWorkflow.workflow_id, status: 'DRAFT' },
        chatId, 'WorkflowEngine');
      Logger.log('[WorkflowEngine] workflow_id=' + newWorkflow.workflow_id + ' 续期未完整创建，标记为 INCOMPLETE_SPAWN（状态仍是 DRAFT，需要人工检查）');
    }

    return newWorkflow;
  }

  // ============ 派生引擎 ============

  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    switch (event.type) {
      case 'WORKFLOW_STARTED':
        stateMap[p.workflow_id] = shallowCopy_(p);
        break;
      case 'WORKFLOW_UPDATED':
        if (stateMap[p.workflow_id]) {
          for (var k in p) if (k !== 'workflow_id') stateMap[p.workflow_id][k] = p[k];
        }
        break;
      case 'WORKFLOW_FINISHED':
        if (stateMap[p.workflow_id]) stateMap[p.workflow_id].status = 'COMPLETED';
        break;
      case 'WORKFLOW_CANCELLED':
        if (stateMap[p.workflow_id]) stateMap[p.workflow_id].status = 'CANCELLED';
        break;
    }
    return stateMap;
  }

  function materializeWorkflowRow_(workflowId, knownWorkflow) {
    if (!knownWorkflow) return;
    upsertRowByKey_(CFG.WORKFLOWS_SHEET_NAME, 'workflow_id', workflowId, knownWorkflow);
  }

  // ============ 内部工具 ============

  function generateWorkflowId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'WKF-' + today + '-' + uniqueSuffix;
  }

  return {
    createWorkflow:              createWorkflow,
    createWorkflowDirect_:       createWorkflowDirect_,
    startWorkflow:               startWorkflow,
    finishWorkflow:              finishWorkflow,
    cancelWorkflow:              cancelWorkflow,
    checkAndFinishIfComplete_:   checkAndFinishIfComplete_,
    handleBranchResolution_:     handleBranchResolution_,
    spawnNextWorkflowIfNeeded:   spawnNextWorkflowIfNeeded,
    deriveFromEvent:             deriveFromEvent,
    materializeWorkflowRow_:     materializeWorkflowRow_
  };
})();
