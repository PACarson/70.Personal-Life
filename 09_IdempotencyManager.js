/**
 * 09_IdempotencyManager.gs
 * Personal Life OS v5.2 — 幂等性管理器（Task / Project / Workflow /
 * Note / BusinessRule）
 *
 * 【Sprint 3 新增】createNoteIfNotExists() / createBusinessRuleIfNotExists()，
 * 同一套 Gate + per-chatId Soft Lock 方案。
 *
 * 【Sprint 1 新增】createProjectIfNotExists() / createWorkflowIfNotExists()，
 * 跟既有 createTaskIfNotExists() 同一套 Gate + per-chatId Soft Lock 方案，
 * 完整设计动机见该函数注释，这里不重复。
 *
 * 职责：确保每个创建操作恰好执行一次（Exactly-Once Semantics）。
 * 所有模块创建 Task/Project/Workflow 必须经过本层，禁止直接
 * EventBus.publish('..._CREATED')。
 *
 * 依赖：
 *   07_IdentityEngine, 08_DeduplicationEngine, 20_TaskEngine.gs,
 *   27_ProjectEngine.gs, 28_WorkflowEngine.gs
 */

var IdempotencyManager = (function () {

  var GATE_WAIT_MS      = 2000;
  var LOCK_TTL_SECONDS  = 15;

  // ============ 内部：per-chatId Soft Lock ============
  //
  // 【Sprint 1 设计说明】Task/Project/Workflow 三种实体共用同一把
  // per-chatId 锁（不是每种实体分别开一把）。理由：同一个 chatId 在
  // 同一时刻创建 Task 还是 Project 还是 Workflow，本质上都是"这个用户
  // 这一刻在发起一次写请求"，锁的目的是防止同一用户的并发/重试请求
  // 互相踩踏，不是防止"创建 Task 和创建 Project 互相冲突"（这两者
  // 之间从不冲突，各自写不同的表）。用同一把锁反而更简单、更不容易
  // 出现"以为锁住了但其实没锁住"的疏漏。

  function _softLockKey_(chatId) {
    return 'idem_lock:' + (chatId || 'unknown_chat');
  }

  function _acquireSoftLock_(chatId) {
    var cache = CacheService.getScriptCache();
    var key = _softLockKey_(chatId);

    var gate = LockService.getScriptLock();
    try {
      gate.waitLock(GATE_WAIT_MS);
    } catch (gateErr) {
      Logger.log('[IdempotencyManager] Gate 在 ' + GATE_WAIT_MS + 'ms 内没拿到: ' + gateErr.message);
      throw new Error('SYSTEM_BUSY: 系统繁忙（当前并发写入极多），请几秒后重试。');
    }

    try {
      if (cache.get(key)) {
        return false;
      }
      cache.put(key, '1', LOCK_TTL_SECONDS);
      return true;
    } finally {
      gate.releaseLock();
    }
  }

  function _releaseSoftLock_(chatId) {
    try {
      CacheService.getScriptCache().remove(_softLockKey_(chatId));
    } catch (e) {
      Logger.log('[IdempotencyManager] Soft Lock 释放失败（不影响本次结果，会在 ' +
        LOCK_TTL_SECONDS + '秒后自动过期）: ' + e.message);
    }
  }

  // ============ Task（既有，不变） ============

  /**
   * @param {string} title
   * @param {object} meta
   * @param {string} chatId
   * @returns {{ task: object, created: boolean }}
   * @throws {Error}  message 以 "SYSTEM_BUSY" 开头
   */
  function createTaskIfNotExists(title, meta, chatId) {
    meta = meta || {};

    // 【2026-08-20 Identity_Impact_Audit.md Track 1】meta.workflow_id 非空时
    // 传给 scopeKey：目前只有 41_BusinessRuleEngine.instantiateFromTemplate
    // 和 28_WorkflowEngine.spawnNextWorkflowIfNeeded 这两条路径会带
    // workflow_id，其余全部既有调用路径 meta 里都没有这个字段，scopeKey
    // 传空字符串，算出来的 identity 跟这次改动之前逐字节相同。
    var identity = IdentityEngine.generateTaskIdentity(
      chatId,
      title,
      IdentityEngine.resolveIdentityDueValue(meta),
      meta.recurring  || '',
      meta.priority   || 'MEDIUM',
      meta.category   || 'GENERAL',
      meta.workflow_id || ''
    );

    var acquired = _acquireSoftLock_(chatId);
    if (!acquired) {
      throw new Error('SYSTEM_BUSY_RETRY_IN_PROGRESS: 你刚才的请求还在处理中，请稍等几秒再看看，不需要马上重发。');
    }

    try {
      var existing = DeduplicationEngine.findExistingTask(identity);
      if (existing) {
        Logger.log('[IdempotencyManager] 任务已存在（并发安全），跳过创建: identity=' + identity.slice(0, 12) + '... task_id=' + existing.task_id);
        return { task: existing, created: false };
      }

      var task = TaskEngine.createTaskDirect_(title, meta, chatId, identity);
      return { task: task, created: true };

    } finally {
      _releaseSoftLock_(chatId);
    }
  }

  // ============ Project（Sprint 1 新增） ============

  /**
   * 创建 Project（幂等，并发安全）。
   * @param {string} title
   * @param {object} meta   { parent_project_id, depends_on_project_ids,
   *                          execution_mode, description, creator,
   *                          suggested_by, source_domain, source_module,
   *                          source_event_id, source_task_id,
   *                          created_method, decision_owner }
   * @param {string} chatId
   * @returns {{ project: object, created: boolean }}
   * @throws {Error}  message 以 "SYSTEM_BUSY" 开头
   */
  function createProjectIfNotExists(title, meta, chatId) {
    meta = meta || {};

    var identity = IdentityEngine.generateProjectIdentity(
      chatId,
      title,
      meta.parent_project_id || ''
    );

    var acquired = _acquireSoftLock_(chatId);
    if (!acquired) {
      throw new Error('SYSTEM_BUSY_RETRY_IN_PROGRESS: 你刚才的请求还在处理中，请稍等几秒再看看，不需要马上重发。');
    }

    try {
      var existing = DeduplicationEngine.findExistingProject(identity);
      if (existing) {
        Logger.log('[IdempotencyManager] 项目已存在（并发安全），跳过创建: identity=' + identity.slice(0, 12) + '... project_id=' + existing.project_id);
        return { project: existing, created: false };
      }

      var project = ProjectEngine.createProjectDirect_(title, meta, chatId, identity);
      return { project: project, created: true };

    } finally {
      _releaseSoftLock_(chatId);
    }
  }

  // ============ Workflow（Sprint 1 新增） ============

  /**
   * 创建 Workflow（幂等，并发安全）。
   * @param {string} title
   * @param {object} meta   { project_id, workflow_type, recurrence_rule,
   *                          loop_max_iterations, creator, suggested_by,
   *                          source_domain, source_module,
   *                          source_event_id, source_task_id,
   *                          created_method, decision_owner }
   * @param {string} chatId
   * @returns {{ workflow: object, created: boolean }}
   * @throws {Error}  message 以 "SYSTEM_BUSY" 开头
   */
  function createWorkflowIfNotExists(title, meta, chatId) {
    meta = meta || {};

    var identity = IdentityEngine.generateWorkflowIdentity(
      chatId,
      title,
      meta.project_id || '',
      meta.workflow_type || ''
    );

    var acquired = _acquireSoftLock_(chatId);
    if (!acquired) {
      throw new Error('SYSTEM_BUSY_RETRY_IN_PROGRESS: 你刚才的请求还在处理中，请稍等几秒再看看，不需要马上重发。');
    }

    try {
      var existing = DeduplicationEngine.findExistingWorkflow(identity);
      if (existing) {
        Logger.log('[IdempotencyManager] 工作流已存在（并发安全），跳过创建: identity=' + identity.slice(0, 12) + '... workflow_id=' + existing.workflow_id);
        return { workflow: existing, created: false };
      }

      var workflow = WorkflowEngine.createWorkflowDirect_(title, meta, chatId, identity);
      return { workflow: workflow, created: true };

    } finally {
      _releaseSoftLock_(chatId);
    }
  }

  // ============ Note（Sprint 3 新增） ============

  /**
   * 创建 Note（幂等，并发安全）。
   * @param {string} content
   * @param {object} meta   { category, creator, suggested_by,
   *                          source_domain, source_module,
   *                          source_event_id, source_task_id,
   *                          created_method, decision_owner }
   * @param {string} chatId
   * @returns {{ note: object, created: boolean }}
   */
  function createNoteIfNotExists(content, meta, chatId) {
    meta = meta || {};

    var identity = IdentityEngine.generateNoteIdentity(chatId, content, meta.category || '');

    var acquired = _acquireSoftLock_(chatId);
    if (!acquired) {
      throw new Error('SYSTEM_BUSY_RETRY_IN_PROGRESS: 你刚才的请求还在处理中，请稍等几秒再看看，不需要马上重发。');
    }

    try {
      var existing = DeduplicationEngine.findExistingNote(identity);
      if (existing) {
        Logger.log('[IdempotencyManager] Note 已存在（并发安全），跳过创建: identity=' + identity.slice(0, 12) + '... note_id=' + existing.note_id);
        return { note: existing, created: false };
      }

      var note = NoteEngine.createNoteDirect_(content, meta, chatId, identity);
      return { note: note, created: true };

    } finally {
      _releaseSoftLock_(chatId);
    }
  }

  // ============ BusinessRule（顶层分类，Sprint 3 新增） ============

  /**
   * 创建 BusinessRule 顶层分类（幂等，并发安全）。绝大多数情况下不需要
   * 调用方直接调用这个——41_BusinessRuleEngine.captureAsWorkflowTemplate
   * 内部在发现同名分类不存在时会自动调用它，调用方通常只需要调
   * captureAsWorkflowTemplate 一个函数。
   * @param {string} name
   * @param {object} meta   { tags, creator, suggested_by, source_domain,
   *                          source_module, source_event_id,
   *                          created_method, decision_owner }
   * @param {string} chatId
   * @returns {{ businessRule: object, created: boolean }}
   */
  function createBusinessRuleIfNotExists(name, meta, chatId) {
    meta = meta || {};

    var identity = IdentityEngine.generateBusinessRuleIdentity(chatId, name);

    var acquired = _acquireSoftLock_(chatId);
    if (!acquired) {
      throw new Error('SYSTEM_BUSY_RETRY_IN_PROGRESS: 你刚才的请求还在处理中，请稍等几秒再看看，不需要马上重发。');
    }

    try {
      var existing = DeduplicationEngine.findExistingBusinessRule(identity);
      if (existing) {
        Logger.log('[IdempotencyManager] BusinessRule 已存在（并发安全），跳过创建: identity=' + identity.slice(0, 12) + '... rule_id=' + existing.rule_id);
        return { businessRule: existing, created: false };
      }

      var businessRule = BusinessRuleEngine.createBusinessRuleDirect_(name, meta, chatId, identity);
      return { businessRule: businessRule, created: true };

    } finally {
      _releaseSoftLock_(chatId);
    }
  }

  // ============ 开发者测试 ============

  function testWebhookRetry() {
    Logger.log('=== IdempotencyManager.testWebhookRetry ===');
    var chatId = 'test_chat_' + new Date().getTime();
    var title  = '幂等测试任务-' + new Date().getTime();

    var r1 = createTaskIfNotExists(title, { priority: 'LOW', category: 'GENERAL' }, chatId);
    var r2 = createTaskIfNotExists(title, { priority: 'LOW', category: 'GENERAL' }, chatId);

    var ok1 = (r1.task.task_id === r2.task.task_id);
    var ok2 = !r2.created;
    Logger.log('=== testWebhookRetry ' + (ok1 && ok2 ? 'PASS ✅' : 'FAIL ❌') + ' ===');
  }

  function testProjectIdempotency() {
    Logger.log('=== IdempotencyManager.testProjectIdempotency ===');
    var chatId = 'test_chat_' + new Date().getTime();
    var title  = '幂等测试项目-' + new Date().getTime();

    var r1 = createProjectIfNotExists(title, {}, chatId);
    var r2 = createProjectIfNotExists(title, {}, chatId);

    var ok1 = (r1.project.project_id === r2.project.project_id);
    var ok2 = !r2.created;
    Logger.log('=== testProjectIdempotency ' + (ok1 && ok2 ? 'PASS ✅' : 'FAIL ❌') + ' ===');
  }

  return {
    createTaskIfNotExists:       createTaskIfNotExists,
    createProjectIfNotExists:    createProjectIfNotExists,
    createWorkflowIfNotExists:   createWorkflowIfNotExists,
    createNoteIfNotExists:       createNoteIfNotExists,
    createBusinessRuleIfNotExists: createBusinessRuleIfNotExists,
    testWebhookRetry:            testWebhookRetry,
    testProjectIdempotency:      testProjectIdempotency
  };
})();
