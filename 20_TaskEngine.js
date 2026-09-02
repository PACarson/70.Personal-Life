/**
 * 20_TaskEngine.gs
 * Personal Life OS v5.2 — Task Engine（create / update / complete / cancel）
 *
 * 【Sprint 1 新增】在既有 create/update/complete/cancel 四件套基础上：
 *  - createTaskDirect_ 新增字段：project_id/workflow_id/sequence_index/
 *    parent_task_id/depends_on_task_ids/branch_group/
 *    branch_resolution_policy（Project/Workflow 关联 + Branch 支持）、
 *    priority_ai_recommended（双轨 Priority，见 00_ADR.gs
 *    ADR-2026-07-24-009）、source_project_id/converted_to_project_id
 *    （Task↔Project 转换血缘，见 ADR-2026-07-24-015，本 Sprint 只建列，
 *    实际转换逻辑等 42_ConversionEngine.gs 在 Sprint 3 落地）、
 *    creator/suggested_by/source_domain/source_module/source_event_id/
 *    source_task_id/created_method/updated_time/decision_owner/
 *    approval_status（Metadata 十一字段，见 00_Data_Ownership.gs「三」）
 *  - UPDATABLE_FIELDS 新增 project_id/workflow_id/sequence_index/
 *    parent_task_id/depends_on_task_ids/branch_group/
 *    branch_resolution_policy/priority_ai_recommended（这些字段不影响
 *    identity——见 IDENTITY_AFFECTING_FIELDS 不变，只有"定义这个 Task
 *    是什么"的字段才影响 identity，"这个 Task 跟谁关联"不影响）
 *  - 新增 markTaskNotSelected_()（仅供 28_WorkflowEngine.gs 调用，见
 *    00_ADR.gs ADR-2026-07-24-008）+ 对应 TASK_NOT_SELECTED 事件
 *  - status 枚举新增 WAITING（Sprint 1 起可由 updateTask 设置）、
 *    NOT_SELECTED（终态，只能由 markTaskNotSelected_ 设置，不接受
 *    updateTask 直接写入，理由见该函数注释）
 *
 * 架构铁律（不变）：
 *  - 真相来源是 EVENTS 表
 *  - Tasks Sheet 是 Read Model（由 10_ProjectionEngine 维护）
 *  - 只有 EventBus.publish 能写 Events
 *  - createTaskDirect_ 只允许 09_IdempotencyManager 调用，外部代码一律走
 *    createTask()（内部会经过幂等+锁）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Task 业务对象的核心生命周期操作
 *                           （create/update/complete/cancel）+ Sprint 1
 *                           新增的 Project/Workflow 关联维护、Branch
 *                           支持
 *   Owns                  : Task 字段校验规则、identity 何时需要重算的
 *                           判断（IDENTITY_AFFECTING_FIELDS）、
 *                           NOT_SELECTED 只能由 markTaskNotSelected_
 *                           设置这条规则
 *   Reads                 : 单个 task（通过 TaskQueryEngine.getTask）
 *   Writes                : Events（通过 EventBus.publish）；仅在
 *                           event.projection_ok===false 时额外写一次
 *                           Tasks/ActiveTasks（安全兜底）
 *   Public API            : createTask, updateTask, completeTask,
 *                           cancelTask, getPendingTasks,
 *                           markTaskNotSelected_（Sprint 1 新增，仅
 *                           28_WorkflowEngine.gs 调用）
 *   Dependencies           : 09_IdempotencyManager.gs、
 *                           12_TaskQueryEngine.gs、21_RecurringEngine.gs、
 *                           02_EventBus.gs、05_SheetUtils.gs、
 *                           07_IdentityEngine.gs
 *   Forbidden Dependencies  : 06_TaskIntentParser.gs（不得反向依赖呈现层）
 *   Pure Function            : NO
 *   Thread Safety             : 依赖 09_IdempotencyManager 的 Soft Lock
 *                           （仅创建路径需要）
 *   Side Effects              : YES
 */

var ProductivityConfig = Object.freeze({
  TASKS_SHEET_NAME: 'Tasks',
  TASK_CATEGORIES:  ['MAINTENANCE', 'SHOPPING', 'ADMIN', 'HEALTH', 'GENERAL', 'PROJECT'],
  TASK_PRIORITIES:  ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  TASK_RECURRING:   ['', 'Daily', 'Weekly', 'Monthly', 'Yearly'],
  // 【Sprint 1 新增】Task 层面的 Branch Resolution Policy 枚举，见
  // 00_ADR.gs ADR-2026-07-24-008。
  BRANCH_RESOLUTION_POLICIES: ['', 'AUTO', 'KEEP_OPEN', 'RETURN_TO_QUEUE', 'WAITING', 'MANUAL'],
  // 【Sprint 1 新增】Metadata Standard 的 created_method 枚举，见
  // 00_Data_Ownership.gs「三」。
  CREATED_METHODS:  ['Manual', 'AI Suggestion', 'Rule Generated', 'Imported', 'Converted'],
  APPROVAL_STATUSES: ['APPROVED', 'PENDING', 'REJECTED'],
  // 这几个字段任一变化都会让 IdentityEngine 算出不同的 identity 哈希，
  // updateTask 改到其中任一个都必须重新计算 identity。project_id/
  // workflow_id/parent_task_id/depends_on_task_ids/branch_group 等
  // 关联字段【不在】这里——它们描述"这个 Task 跟谁关联"，不描述"这个
  // Task 本身是什么"，改变关联不应该让去重系统认成一个新任务。
  IDENTITY_AFFECTING_FIELDS: ['title', 'due_date', 'due_time', 'recurring', 'priority', 'category']
});

/**
 * 【Slice 1 新增,2026-09-01】OS / Domain 的唯一注册点——跨 Task/Project
 * 共用同一份，UI 下拉框、治理文档也从这里读，不允许在别处另抄一份。
 * 复用既有 source_domain 字段（00_Data_Ownership.gs「三」），语义从
 * "创建时不可变的 provenance" 正式改为"这条记录的业务 OS/Domain 归属"
 * ——见 00_ADR.gs ADR-2026-09-01-027。新增 OS 时只改这一行；'Other' 是
 * 兜底值，不代表任何具体 OS。Workflow/Note 本次不接入这个字段（Carson
 * 2026-09-01 决定：不因为本轮 UI 需求顺手给它们加）。
 *
 * 故意不放在 ProductivityConfig/LifeProjectConfig 里面：这两个 CFG 对象
 * 各自在自己的文件里 Object.freeze() 求值,如果其中一个在字面量里引用
 * 另一个文件的 CFG,就会依赖 GAS 的跨文件加载顺序——这里改成一个独立的
 * 顶层全局量,只在函数体内（真正调用发生时,整个项目早已经加载完毕）读取，
 * 不受加载顺序影响。
 */
var OS_REGISTRY = Object.freeze(['PersonalLifeOS', 'PropertyOS', 'RiderOS', 'InvestmentOS', 'Other']);

var TaskEngine = (function () {

  var CFG = ProductivityConfig;

  function _computeDueDatetime_(dueDate, dueTime) {
    return (dueDate && dueTime) ? (dueDate + 'T' + dueTime + ':00') : '';
  }

  /**
   * 【Sprint 1 新增】Metadata 十一字段的默认值填充。creator='User'（默认，
   * 未显式指定 AI 来源时）→ decision_owner 恒等于该用户自己（这里用
   * chatId 代表——单用户场景下就是"这个人"，approval_status 恒为
   * 'APPROVED'；creator='AI' → decision_owner 是当前配置的批准人（Sprint 1
   * 尚未接入真正的多用户批准人配置，先用 chatId 占位，未来有真正的批准人
   * 概念时再替换），approval_status 初始 'PENDING'。完整规则见
   * 00_Business_Rules.gs「八」。
   */
  function _resolveMetadata_(meta, chatId) {
    var creator = meta.creator === 'AI' ? 'AI' : 'User';
    var isAiCreated = (creator === 'AI');

    return {
      creator:          creator,
      suggested_by:     meta.suggested_by || (isAiCreated ? '' : 'User'),
      source_domain:    OS_REGISTRY.indexOf(meta.source_domain) !== -1 ? meta.source_domain : OS_REGISTRY[0],
      source_module:    meta.source_module || '',
      source_event_id:  meta.source_event_id || '',
      source_task_id:   meta.source_task_id || '',
      created_method:   CFG.CREATED_METHODS.indexOf(meta.created_method) !== -1 ? meta.created_method : 'Manual',
      decision_owner:   meta.decision_owner || String(chatId || ''),
      approval_status:  isAiCreated ? 'PENDING' : 'APPROVED'
    };
  }

  // ============ Create ============

  function createTask(title, meta, chatId) {
    var result = IdempotencyManager.createTaskIfNotExists(title, meta || {}, chatId);
    return result.task;
  }

  /**
   * 实际创建函数 —— 只由 09_IdempotencyManager.createTaskIfNotExists() 调用
   * （已在锁内）。外部代码一律调 createTask()；禁止绕过 IdempotencyManager
   * 直接调本函数。
   */
  function createTaskDirect_(title, meta, chatId, identity) {
    meta = meta || {};

    var category  = CFG.TASK_CATEGORIES.indexOf(meta.category) !== -1 ? meta.category : 'GENERAL';
    var priority   = CFG.TASK_PRIORITIES.indexOf(meta.priority) !== -1 ? meta.priority : 'MEDIUM';
    var recurring  = CFG.TASK_RECURRING.indexOf(meta.recurring) !== -1 ? meta.recurring : '';
    var branchPolicy = CFG.BRANCH_RESOLUTION_POLICIES.indexOf(meta.branch_resolution_policy) !== -1
      ? meta.branch_resolution_policy : '';
    var metadata = _resolveMetadata_(meta, chatId);
    var nowIso = new Date().toISOString();

    var task = {
      task_id:        generateTaskId_(),
      identity:       identity || '',
      timestamp:      nowIso,
      title:          title,
      category:       category,
      status:         'PENDING',
      due_date:       meta.due_date     || '',
      due_time:       meta.due_time     || '',
      due_datetime:   _computeDueDatetime_(meta.due_date || '', meta.due_time || ''),
      recurring:      recurring,
      priority:       priority,
      priority_ai_recommended: '', // Sprint 1: 建列不建值，22_PriorityEngine 尚未接入
      context:        meta.context      || '',
      budget:         (meta.budget != null) ? meta.budget : '',
      notes:          meta.notes        || '',
      description:    meta.description  || '',
      tags:           meta.tags          || '',
      reminder_policy: meta.reminder_policy ? JSON.stringify(meta.reminder_policy) : '',
      chat_id:        chatId             || '',
      completed_at:   '',
      reminder_count: 0,
      archived:       false,

      // ── Sprint 1 新增：Project/Workflow 关联 + Branch ──────────────
      project_id:               meta.project_id || '',
      workflow_id:               meta.workflow_id || '',
      sequence_index:              (meta.sequence_index != null) ? meta.sequence_index : '',
      parent_task_id:                meta.parent_task_id || '',
      depends_on_task_ids:              meta.depends_on_task_ids || '',
      branch_group:                       meta.branch_group || '',
      branch_resolution_policy:              branchPolicy,

      // ── Sprint 1 新增：转换血缘（建列，Sprint 3 由 ConversionEngine 使用）──
      source_project_id:                        meta.source_project_id || '',
      converted_to_project_id:                     '',

      // ── Sprint 1 新增：Metadata 十一字段 ─────────────────────────────
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

    EventBus.publish('TASK_CREATED', task, chatId, 'TaskEngine', identity);

    return task;
  }

  // ============ Update ============

  /**
   * 更新任务的可编辑字段。
   *
   * 【Sprint 1 扩展】UPDATABLE_FIELDS 新增 project_id/workflow_id/
   * sequence_index/parent_task_id/depends_on_task_ids/branch_group/
   * branch_resolution_policy/priority_ai_recommended——这些不触发
   * identity 重算（见 CFG.IDENTITY_AFFECTING_FIELDS 未包含它们）。
   * status 不在 UPDATABLE_FIELDS 里（既有设计——状态变化走专门的事件：
   * completeTask/cancelTask/markTaskNotSelected_，updateTask 不接受
   * 直接覆写 status，防止绕过各自的前置校验，见各函数注释）。
   *
   * @param {string} taskId
   * @param {object} changes
   * @param {string} chatId
   * @returns {object|null}
   */
  var UPDATABLE_FIELDS = [
    'title', 'category', 'priority', 'due_date', 'due_time', 'recurring',
    'context', 'budget', 'notes', 'description', 'tags',
    // Sprint 1 新增：
    'project_id', 'workflow_id', 'sequence_index', 'parent_task_id',
    'depends_on_task_ids', 'branch_group', 'branch_resolution_policy',
    'priority_ai_recommended',
    // 【Slice 1 新增,2026-09-01】OS/Domain 归属——不是 identity-affecting
    // 字段（重新归类不应该产生新的 identity），枚举见顶层全局量 OS_REGISTRY。
    'source_domain'
  ];

  function updateTask(taskId, changes, chatId) {
    var existing = TaskQueryEngine.getTask(taskId, chatId);
    if (!existing) {
      Logger.log('[TaskEngine] updateTask: 找不到任务 ' + taskId + '，拦截（防止产生幽灵行）');
      return null;
    }

    changes = changes || {};
    var payload = { task_id: taskId };
    UPDATABLE_FIELDS.forEach(function (f) {
      if (changes.hasOwnProperty(f)) {
        var v = changes[f];
        if (f === 'category'  && CFG.TASK_CATEGORIES.indexOf(v) === -1) return;
        if (f === 'priority'  && CFG.TASK_PRIORITIES.indexOf(v) === -1) return;
        if (f === 'recurring' && CFG.TASK_RECURRING.indexOf(v) === -1) return;
        if (f === 'branch_resolution_policy' && CFG.BRANCH_RESOLUTION_POLICIES.indexOf(v) === -1) return;
        if (f === 'source_domain' && OS_REGISTRY.indexOf(v) === -1) return;
        payload[f] = v;
      }
    });

    if (Object.keys(payload).length === 1) {
      return null; // 只有 task_id，没有任何合法字段被改——不发空事件
    }

    var merged = shallowCopy_(existing);
    for (var k in payload) merged[k] = payload[k];

    if (payload.hasOwnProperty('due_date') || payload.hasOwnProperty('due_time')) {
      var recomputedDatetime = _computeDueDatetime_(merged.due_date || '', merged.due_time || '');
      payload.due_datetime = recomputedDatetime;
      merged.due_datetime   = recomputedDatetime;
    }

    var identityFieldChanged = CFG.IDENTITY_AFFECTING_FIELDS.some(function (f) {
      return payload.hasOwnProperty(f);
    });
    if (identityFieldChanged) {
      // 【2026-08-20 修复，Identity Impact Audit Track 1 preflight 发现】
      // 07_IdentityEngine/09_IdempotencyManager 在创建路径已经把 workflow_id
      // 接入 generateTaskIdentity 的第 7 个可选 scopeKey 参数（context-aware
      // Task 的 identity 计算里包含 workflow_id）。但这里（更新路径）之前
      // 调用时漏传了这个参数——任何 identity-affecting 字段（title/
      // due_date/due_time/recurring/priority/category）一旦被改动，
      // 重算出来的 identity 会退回不带 scope 的旧公式，导致：
      //   1. 该 Task 编辑前后 identity 不一致（同一个 workflow 内失去
      //      "same workflow → same identity" 的稳定性）；
      //   2. 退化后的 identity 可能跟另一条字段恰好相同的 legacy Task
      //      冲突——正是 Track 1 本来要修的那类碰撞，只是从"创建时"
      //      变成了"编辑时"触发。
      // updateTask() 目前还没有 Telegram 指令调用（见
      // 00_Known_Limitations.gs 二），但 UI-I2（Edit Task）马上要把它
      // 接到 UI 上，这条路径届时会第一次被真实调用到，所以在此一并
      // 修复，保持跟创建路径同一个约定：沿用该 Task 自己当前的
      // workflow_id（legacy Task 该字段为空字符串，转成 scopeKey 空值，
      // 结果跟改之前逐字节一致，不影响任何存量 Task）。
      var newIdentity = IdentityEngine.generateTaskIdentity(
        merged.chat_id || chatId || existing.chat_id,
        merged.title,
        IdentityEngine.resolveIdentityDueValue(merged),
        merged.recurring || '',
        merged.priority  || 'MEDIUM',
        merged.category  || 'GENERAL',
        merged.workflow_id || ''
      );
      payload.identity = newIdentity;
      merged.identity   = newIdentity;
    }

    // 【Sprint 1 新增】Metadata Standard 要求 updated_time 每次 update
    // 类操作重写。
    payload.updated_time = new Date().toISOString();
    merged.updated_time  = payload.updated_time;

    var event = EventBus.publish('TASK_UPDATED', payload, chatId || existing.chat_id, 'TaskEngine');

    if (event && event.projection_ok === false) {
      materializeTaskRow_(taskId, merged);
    }

    return payload;
  }

  // ============ Complete ============

  function completeTask(taskId, chatId) {
    var taskBeforeComplete = TaskQueryEngine.getTask(taskId, chatId);
    if (!taskBeforeComplete) {
      Logger.log('[TaskEngine] completeTask: 找不到任务 ' + taskId + '，拦截（防止产生幽灵行）');
      return { next_task: null, not_found: true };
    }

    var currentStatus = String(taskBeforeComplete.status || '').toUpperCase();
    if (currentStatus === 'DONE') {
      Logger.log('[TaskEngine] completeTask: 任务 ' + taskId + ' 已经是 DONE，拦截重复调用');
      return { next_task: null, already_done: true };
    }
    if (currentStatus === 'CANCELLED' || currentStatus === 'CONVERTED' || currentStatus === 'NOT_SELECTED') {
      Logger.log('[TaskEngine] completeTask: 任务 ' + taskId + ' 已经是终态 ' + currentStatus + '，拒绝标记完成');
      return { next_task: null, invalid_state: true, current_status: currentStatus };
    }

    var event = EventBus.publish('TASK_COMPLETED', { task_id: taskId }, chatId, 'TaskEngine');

    if (event && event.projection_ok === false) {
      materializeTaskRow_(taskId, { status: 'DONE', completed_at: event.timestamp });
    }

    // 【Sprint 1 新增】如果这个 Task 属于某个 Branch 类型 Workflow 的
    // branch_group，通知 WorkflowEngine 按该 branch_group 配置的 Policy
    // 处理同组其余 Task（见 00_Business_Rules.gs「二」）。只有真正
    // 属于某个 branch_group 的 Task 才会触发，普通 Task 完全不受影响。
    if (taskBeforeComplete.branch_group && typeof WorkflowEngine !== 'undefined') {
      try {
        WorkflowEngine.handleBranchResolution_(taskBeforeComplete.workflow_id, taskId);
      } catch (branchErr) {
        Logger.log('[TaskEngine] handleBranchResolution_ 失败（不影响本次 Complete 已经成功的事实）: ' + branchErr.message);
      }
    }

    // 【Sprint 1 新增】如果这个 Task 属于某个 Workflow，通知 WorkflowEngine
    // 检查该 Workflow 是否所有 Task 都已终态（FINISHED 判定，见
    // 00_Business_Rules.gs「二」）。
    if (taskBeforeComplete.workflow_id && typeof WorkflowEngine !== 'undefined') {
      try {
        WorkflowEngine.checkAndFinishIfComplete_(taskBeforeComplete.workflow_id);
      } catch (wfErr) {
        Logger.log('[TaskEngine] checkAndFinishIfComplete_ 失败（不影响本次 Complete 已经成功的事实）: ' + wfErr.message);
      }
    }

    var nextTask = RecurringEngine.spawnNextIfNeeded(taskBeforeComplete, chatId);
    return { next_task: nextTask };
  }

  // ============ Cancel ============

  function cancelTask(taskId, chatId) {
    var existing = TaskQueryEngine.getTask(taskId, chatId);
    if (!existing) {
      Logger.log('[TaskEngine] cancelTask: 找不到任务 ' + taskId + '，拦截（防止产生幽灵行）');
      return { not_found: true };
    }

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED') {
      Logger.log('[TaskEngine] cancelTask: 任务 ' + taskId + ' 已经是 CANCELLED，拦截重复调用');
      return { already_cancelled: true };
    }
    if (currentStatus === 'DONE' || currentStatus === 'CONVERTED' || currentStatus === 'NOT_SELECTED') {
      Logger.log('[TaskEngine] cancelTask: 任务 ' + taskId + ' 已经是终态 ' + currentStatus + '，拒绝取消');
      return { invalid_state: true, current_status: currentStatus };
    }

    var event = EventBus.publish('TASK_CANCELLED', { task_id: taskId }, chatId, 'TaskEngine');

    if (event && event.projection_ok === false) {
      materializeTaskRow_(taskId, { status: 'CANCELLED' });
    }

    if (existing.workflow_id && typeof WorkflowEngine !== 'undefined') {
      try {
        WorkflowEngine.checkAndFinishIfComplete_(existing.workflow_id);
      } catch (wfErr) {
        Logger.log('[TaskEngine] checkAndFinishIfComplete_ 失败: ' + wfErr.message);
      }
    }

    return {};
  }

  // ============ Not Selected（Sprint 1 新增，仅供 WorkflowEngine 调用）=====

  /**
   * 【Sprint 1 新增】把一个 Task 标记为 NOT_SELECTED——Branch 类型
   * Workflow 里，某个分支被选中后，同组其余 Task 若 Policy=AUTO，
   * 由 28_WorkflowEngine.handleBranchResolution_ 调用本函数。
   *
   * 只允许从非终态转为 NOT_SELECTED；已经是任何终态（包括 NOT_SELECTED
   * 本身）的 Task 拦截重复调用。不接受 updateTask 直接把 status 改成
   * NOT_SELECTED——这条状态只能通过本函数产生，保证它的语义
   * （"从一开始就没有被选中执行的资格"）不会被其它路径误用，完整论证
   * 见 00_ADR.gs ADR-2026-07-24-008。
   *
   * @param {string} taskId
   * @param {string} chatId
   * @returns {{not_found:(boolean|undefined), already_terminal:(boolean|undefined)}}
   */
  function markTaskNotSelected_(taskId, chatId) {
    var existing = TaskQueryEngine.getTask(taskId, chatId);
    if (!existing) {
      Logger.log('[TaskEngine] markTaskNotSelected_: 找不到任务 ' + taskId);
      return { not_found: true };
    }

    var currentStatus = String(existing.status || '').toUpperCase();
    var terminalStatuses = ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'];
    if (terminalStatuses.indexOf(currentStatus) !== -1) {
      Logger.log('[TaskEngine] markTaskNotSelected_: 任务 ' + taskId + ' 已经是终态 ' + currentStatus + '，拦截');
      return { already_terminal: true, current_status: currentStatus };
    }

    var event = EventBus.publish('TASK_NOT_SELECTED', { task_id: taskId }, chatId || existing.chat_id, 'TaskEngine');

    if (event && event.projection_ok === false) {
      materializeTaskRow_(taskId, { status: 'NOT_SELECTED' });
    }

    return {};
  }

  // ============ Conversion（Sprint 3，仅供 42_ConversionEngine.gs 调用）====

  /**
   * 【Sprint 3 落地，Sprint 1 时已预留字段】把一个 Task 标记为
   * CONVERTED（终态）——Task→Project 转换的源侧收尾。只允许从非终态
   * 转换；已是任何终态的 Task 拒绝重复转换，但如果已经转换到*同一个*
   * 目标 Project，返回既有结果而不是报错（幂等，见
   * 00_Business_Rules.gs「一」）。
   *
   * @param {string} taskId
   * @param {string} newProjectId
   * @param {string} chatId
   */
  function markTaskConverted_(taskId, newProjectId, chatId) {
    var existing = TaskQueryEngine.getTask(taskId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CONVERTED') {
      if (existing.converted_to_project_id === newProjectId) {
        return { already_converted: true, task: existing }; // 幂等
      }
      return { invalid_state: true, current_status: currentStatus,
        reason: 'Task 已经转换到另一个 Project（' + existing.converted_to_project_id + '），不能再转换一次' };
    }
    var terminalStatuses = ['DONE', 'CANCELLED', 'NOT_SELECTED'];
    if (terminalStatuses.indexOf(currentStatus) !== -1) {
      return { invalid_state: true, current_status: currentStatus,
        reason: '只有非终态的 Task 才能转换为 Project' };
    }

    var payload = { task_id: taskId, status: 'CONVERTED', converted_to_project_id: newProjectId,
      updated_time: new Date().toISOString() };
    var event = EventBus.publish('TASK_CONVERTED_TO_PROJECT', payload, chatId || existing.chat_id, 'TaskEngine');

    if (event && event.projection_ok === false) {
      materializeTaskRow_(taskId, { status: 'CONVERTED', converted_to_project_id: newProjectId });
    }

    return {};
  }

  /**
   * 【Sprint 3 落地】Project→Task 转换时，创建目标侧的新 Task——仅供
   * 42_ConversionEngine.gs 调用。字段映射规则见
   * 00_Business_Rules.gs「一」：Project.title → Task.title，
   * Project.description → Task.notes，新 Task.project_id = 源
   * Project.parent_project_id（新 Task"接替"源 Project 在其父级下的
   * 位置）。
   *
   * @param {object} sourceProject
   * @param {string} chatId
   * @returns {object}  新 Task
   */
  function createTaskFromConversion_(sourceProject, chatId) {
    return createTask(sourceProject.title, {
      notes:              sourceProject.description || '',
      project_id:         sourceProject.parent_project_id || '',
      source_project_id:  sourceProject.project_id,
      creator:            'User',
      source_module:      'ConversionEngine.convertProjectToTask',
      created_method:      'Converted'
    }, chatId);
  }

  function getPendingTasks(chatId) {
    return TaskQueryEngine.getTasks(chatId, { status: 'PENDING' });
  }

  // ============ 派生引擎（保留供 11_ProjectionRebuilder 使用） ============

  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    switch (event.type) {
      case 'TASK_CREATED':
        stateMap[p.task_id] = shallowCopy_(p);
        if (!stateMap[p.task_id].chat_id) stateMap[p.task_id].chat_id = event.chat_id;
        break;

      case 'TASK_UPDATED':
        if (stateMap[p.task_id]) {
          for (var k in p) {
            if (k !== 'task_id') stateMap[p.task_id][k] = p[k];
          }
        }
        break;

      case 'TASK_COMPLETED':
        if (stateMap[p.task_id]) {
          stateMap[p.task_id].status       = 'DONE';
          stateMap[p.task_id].completed_at = event.timestamp;
        }
        break;

      case 'TASK_CANCELLED':
        if (stateMap[p.task_id]) {
          stateMap[p.task_id].status = 'CANCELLED';
        }
        break;

      // 【Sprint 1 新增】
      case 'TASK_NOT_SELECTED':
        if (stateMap[p.task_id]) {
          stateMap[p.task_id].status = 'NOT_SELECTED';
        }
        break;

      // 【Sprint 3 新增】
      case 'TASK_CONVERTED_TO_PROJECT':
        if (stateMap[p.task_id]) {
          stateMap[p.task_id].status = 'CONVERTED';
          stateMap[p.task_id].converted_to_project_id = p.converted_to_project_id;
        }
        break;

      case 'REMINDER_SENT':
        if (stateMap[p.task_id]) {
          stateMap[p.task_id].reminder_count = (stateMap[p.task_id].reminder_count || 0) + 1;
          stateMap[p.task_id].last_reminder_at = p.sent_at || event.timestamp;
        }
        break;
    }

    return stateMap;
  }

  function deriveTaskState_() {
    var events = EventBus.getAllEvents();
    var state = {};
    events.forEach(function (e) {
      deriveFromEvent(e, state);
    });
    return state;
  }

  // ============ 派生视图维护（Read Model 辅助） ============

  function materializeTaskRow_(taskId, knownTask) {
    var task = knownTask;
    if (!task) {
      task = deriveTaskState_()[taskId];
    }
    if (!task) return;

    upsertRowByKey_(CFG.TASKS_SHEET_NAME, 'task_id', taskId, task);

    // 【Sprint 1 扩展】终态集合新增 CONVERTED/NOT_SELECTED。
    var finalStatus = String(task.status || '').toUpperCase();
    var terminalStatuses = ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'];
    if (terminalStatuses.indexOf(finalStatus) !== -1) {
      try {
        deleteRowByKey_('ActiveTasks', 'task_id', taskId);
      } catch (e) {
        Logger.log('[TaskEngine] ActiveTasks 安全网清理失败: ' + e.message);
      }
    } else {
      try {
        upsertRowByKey_('ActiveTasks', 'task_id', taskId, task);
      } catch (e) {
        Logger.log('[TaskEngine] ActiveTasks 安全网写入失败: ' + e.message);
      }
    }
  }

  function rebuildTasksSheet_() {
    rebuildTasksProjection(); // 11_ProjectionRebuilder.gs
  }

  // ============ 内部工具 ============

  function generateTaskId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'TSK-' + today + '-' + uniqueSuffix;
  }

  return {
    createTask:           createTask,
    createTaskDirect_:    createTaskDirect_,
    updateTask:           updateTask,
    completeTask:          completeTask,
    cancelTask:            cancelTask,
    markTaskNotSelected_:   markTaskNotSelected_,
    markTaskConverted_:      markTaskConverted_,
    createTaskFromConversion_: createTaskFromConversion_,
    getPendingTasks:         getPendingTasks,
    deriveFromEvent:          deriveFromEvent,
    deriveTaskState_:          deriveTaskState_,
    materializeTaskRow_:        materializeTaskRow_,
    rebuildTasksSheet_:          rebuildTasksSheet_
  };
})();

// ============ 向后兼容全局 wrapper（Core 项目 04_Main.gs 既有调用不用改） ============
//
// 【原 V4.4 审计 LOW RISK 2 结论，原样保留】外部审计指出 createTask/
// updateTask/completeTask/cancelTask/getPendingTasks 这几个裸全局函数
// 名字足够通用，在复杂的 Library 依赖链里存在被消费端自定义同名函数
// 覆盖的风险，建议"未来版本逐步废弃，引导消费端改用带命名空间的调用
// 方式"——审计原文本身就是"建议未来逐步废弃"，不是"现在立刻改"：不删除
// 任何一个 wrapper（删除会破坏 Core 项目 04_Main.gs 现有调用，违反本
// 项目"维持向后兼容"的既定原则），只在每个 wrapper 上加 @deprecated
// 风格的 JSDoc 标注。是否/何时真的移除，属于跨项目协调的决定。
//
// 【Sprint 1 命名更新】JSDoc 里的命名空间指向从 "ProductivityOS.xxx"
// 改为 "PersonalLifeOS.xxx"，对应 00_ADR.gs ADR-2026-07-24-018 的
// 改名决定——wrapper 函数本身的行为不变，只是文档指向的推荐路径名字
// 更新了。

/** @deprecated 请改用 PersonalLifeOS.TaskEngine.createTask（本 wrapper 仍然完全可用，只是不再是推荐路径） */
function createTask(title, meta, chatId) {
  return TaskEngine.createTask(title, meta, chatId);
}

/** @deprecated 请改用 PersonalLifeOS.TaskEngine.updateTask */
function updateTask(taskId, changes, chatId) {
  return TaskEngine.updateTask(taskId, changes, chatId);
}

/** @deprecated 请改用 PersonalLifeOS.TaskEngine.completeTask */
function completeTask(taskId, chatId) {
  return TaskEngine.completeTask(taskId, chatId);
}

/** @deprecated 请改用 PersonalLifeOS.TaskEngine.cancelTask */
function cancelTask(taskId, chatId) {
  return TaskEngine.cancelTask(taskId, chatId);
}

/** @deprecated 请改用 PersonalLifeOS.TaskEngine.getPendingTasks */
function getPendingTasks(chatId) {
  return TaskEngine.getPendingTasks(chatId);
}

/** @deprecated 内部/调试用途，请改用 PersonalLifeOS.TaskEngine.deriveFromEvent */
function deriveFromEvent(event, stateMap) {
  return TaskEngine.deriveFromEvent(event, stateMap);
}

/** @deprecated 内部/调试用途，请改用 PersonalLifeOS.TaskEngine.deriveTaskState_ */
function deriveTaskState_() {
  return TaskEngine.deriveTaskState_();
}

/** @deprecated 内部/调试用途，请改用 PersonalLifeOS.TaskEngine.rebuildTasksSheet_ */
function rebuildTasksSheet_() {
  return TaskEngine.rebuildTasksSheet_();
}
