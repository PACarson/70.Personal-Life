/**
 * 07_IdentityEngine.gs
 * Personal Life OS v5.2 — 业务身份引擎
 *
 * 【Sprint 1 新增】generateProjectIdentity() / generateWorkflowIdentity()，
 * 跟既有 generateTaskIdentity() 同一套确定性哈希设计，不改动原有函数的
 * 签名或算法。完整设计见设计包 00_Architecture.gs「三」P4 落地映射。
 *
 * 职责：为每个业务对象生成确定性的 SHA-256 身份标识符（Identity）。
 * Identity 是「这个业务对象是否已经存在」的判断依据，与存储 ID（task_id /
 * project_id / workflow_id）无关。
 *
 * 架构铁律：
 *  - 本模块不读写任何 Sheet，不调用 EventBus
 *  - 纯函数：输入相同 → 输出必然相同
 *  - 不依赖时间戳、随机数、UUID
 *
 * 依赖：无（最底层工具模块，零外部依赖）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 为业务对象生成确定性 SHA-256 身份标识（Identity）
 *   Owns                  : Identity 哈希算法本身（字段拼接顺序 + SHA-256）
 *   Reads                 : 若干原始字段（按调用方传入的参数）
 *   Writes                : none
 *   Public API            : generateTaskIdentity, resolveIdentityDueValue,
 *                           generateProjectIdentity（Sprint 1 新增）,
 *                           generateWorkflowIdentity（Sprint 1 新增）
 *   Dependencies          : 无（GAS 内建 Utilities.computeDigest 除外）
 *   Forbidden Dependencies: Sheet, Events, Telegram/Output，任何其他 Engine
 *   Pure Function         : YES
 *   Thread Safety         : 天然安全（纯函数，无共享可变状态）
 *   Side Effects          : NO
 */

var IdentityEngine = (function () {

  // ============ SHA-256 ============

  function sha256_(input) {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(input),
      Utilities.Charset.UTF_8
    );
    return bytes.map(function (b) {
      return ('0' + (b & 0xFF).toString(16)).slice(-2);
    }).join('');
  }

  // ============ 文本标准化 ============

  function normalizeWhitespace(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeCase(text) {
    return String(text || '').toLowerCase();
  }

  /**
   * 全角 ASCII → 半角。GAS 不支持 String.prototype.normalize()，用简化替代。
   */
  function normalizeUnicode(text) {
    return String(text || '').replace(/[\uFF01-\uFF5E]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    });
  }

  /**
   * 标准化标题：全角转半角 → 转小写 → 移除标点（只保留中英文字母/数字/
   * 空格）→ 折叠空白。
   */
  function normalizeTitle(title) {
    var s = normalizeUnicode(title);
    s = normalizeCase(s);
    s = s.replace(/[^\w\u4e00-\u9fa5\u0020]/g, ' ');
    s = normalizeWhitespace(s);
    return s;
  }

  // ============ 业务 Identity 生成 ============

  /**
   * 任务 Identity。组合字段：
   * chat_id | normalized_title | due_date | repeat_rule | priority | category
   * [ | scopeKey ]（可选第 7 段，见下）
   *
   * 【2026-08-20 新增 scopeKey，见 Identity_Impact_Audit.md Track 1】
   * scopeKey 缺省/空字符串时，拼出来的字符串、算出来的哈希跟加这个
   * 参数之前逐字节相同——现存全部调用路径（聊天捕获 06_TaskIntentParser /
   * 周期任务续期 21_RecurringEngine / Note→Task 42_ConversionEngine.
   * convertNoteToTask）都不传这个参数，哈希不受影响；Project→Task
   * 转换 42_ConversionEngine.convertProjectToTask 只传 project_id，
   * 不传 workflow_id，同样不受影响。
   *
   * 只有 09_IdempotencyManager.createTaskIfNotExists() 在 meta.workflow_id
   * 非空时才会传非空 scopeKey 进来（当前只有 41_BusinessRuleEngine.
   * instantiateFromTemplate 和 28_WorkflowEngine.spawnNextWorkflowIfNeeded
   * 这两条路径会带 workflow_id），用来区分"同一个 workflow_shape 反复
   * instantiate / 续期"产生的、title/due_date/priority/category 都可能
   * 相同、但分属不同 Workflow 实例的 Task——不这样区分，
   * 会被 IdempotencyManager 误判成同一请求的重复提交而复用旧 Task。
   */
  function generateTaskIdentity(chatId, title, dueDate, repeatRule, priority, category, scopeKey) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(title),
      String(dueDate || ''),
      String(repeatRule || ''),
      String(priority || 'MEDIUM'),
      String(category || 'GENERAL')
    ];
    if (scopeKey) {
      parts.push(String(scopeKey));
    }
    return sha256_(parts.join('|'));
  }

  /**
   * 为 generateTaskIdentity() 的 dueDate 参数位解析出正确的传入值——有
   * due_datetime 用 due_datetime，否则回退 due_date。
   * @param {Object} task
   * @returns {string}
   */
  function resolveIdentityDueValue(task) {
    return ((task && task.due_datetime) || (task && task.due_date) || '');
  }

  /**
   * 【Sprint 1 新增】Project Identity。组合字段：
   * chat_id | normalized_title | parent_project_id
   *
   * 不把 status/execution_mode 纳入 identity——这些是会随时间自然变化
   * 的字段（跟 Task 的 due_date/priority/category 属于"定义这个对象
   * 是什么"不同，Project 的身份不应该因为它从 DRAFT 变成 IN_PROGRESS
   * 就被判定成"另一个不同的 Project"）。
   *
   * parent_project_id 纳入 identity 是为了允许"同名 Sub-Project 挂在
   * 不同父 Project 下"这种合理场景不被误判重复（比如"清洁"作为
   * Sub-Project 同时出现在"厨房翻新"和"浴室翻新"两个不同父 Project
   * 下，应该是两个不同的 Project，不是重复）。
   */
  function generateProjectIdentity(chatId, title, parentProjectId) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(title),
      String(parentProjectId || '')
    ];
    return sha256_(parts.join('|'));
  }

  /**
   * 【Sprint 1 新增】Workflow Identity。组合字段：
   * chat_id | normalized_title | project_id | workflow_type
   *
   * project_id 纳入 identity，理由同 Project 的 parent_project_id——
   * 允许同名 Workflow 挂在不同 Project 下不被误判重复。workflow_type
   * 纳入是因为"洗衣流程"设计成 SEQUENTIAL 和设计成 PARALLEL 是两个
   * 不同的编排定义，不应该共享同一个去重 identity。
   */
  function generateWorkflowIdentity(chatId, title, projectId, workflowType) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(title),
      String(projectId || ''),
      String(workflowType || '')
    ];
    return sha256_(parts.join('|'));
  }

  /**
   * 库存物品 Identity（既有函数，原样保留，不属于本次 Sprint 1 改动——
   * 移除它有静默破坏未知调用方的风险，见 05_SheetUtils.gs 同类保守
   * 判断标准）。
   */
  function generateInventoryIdentity(chatId, itemName, unit) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(itemName),
      String(unit || '')
    ];
    return sha256_(parts.join('|'));
  }

  /**
   * 提醒 Identity（既有函数，原样保留，理由同上）。
   */
  function generateReminderIdentity(chatId, taskId, scheduledAt) {
    var parts = [
      String(chatId || ''),
      String(taskId || ''),
      String(scheduledAt || '')
    ];
    return sha256_(parts.join('|'));
  }

  // ============ 开发者测试 ============

  function testIdentity() {
    Logger.log('=== IdentityEngine Test ===');

    var t1 = generateTaskIdentity('123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING');
    var t2 = generateTaskIdentity('123', '去买菜！', '2026-07-01', '', 'MEDIUM', 'SHOPPING');
    Logger.log('t1 === t2 (不同说法)? ' + (t1 === t2) + '  (expected: true)');

    // 【2026-08-20 新增】scopeKey 向后兼容 + 区分能力测试
    var t3 = generateTaskIdentity('123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING');
    Logger.log('t1 === t3 (不传 scopeKey，向后兼容)? ' + (t1 === t3) + '  (expected: true)');

    var t4 = generateTaskIdentity('123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING', 'WKF-A');
    var t5 = generateTaskIdentity('123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING', 'WKF-B');
    var t6 = generateTaskIdentity('123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING', 'WKF-A');
    Logger.log('t1 === t4 (传了 scopeKey，跟不传结果不同)? ' + (t1 === t4) + '  (expected: false)');
    Logger.log('t4 === t5 (不同 workflow scopeKey，identity 不同)? ' + (t4 === t5) + '  (expected: false)');
    Logger.log('t4 === t6 (相同 workflow scopeKey，identity 相同)? ' + (t4 === t6) + '  (expected: true)');

    var p1 = generateProjectIdentity('123', '厨房翻新', '');
    var p2 = generateProjectIdentity('123', '清洁', 'PRJ-A');
    var p3 = generateProjectIdentity('123', '清洁', 'PRJ-B');
    Logger.log('p2 === p3 (同名不同父级)? ' + (p2 === p3) + '  (expected: false)');
    Logger.log('p1 是否生成成功? ' + (!!p1) + '  (expected: true)');

    var w1 = generateWorkflowIdentity('123', '洗衣流程', 'PRJ-A', 'SEQUENTIAL');
    var w2 = generateWorkflowIdentity('123', '洗衣流程', 'PRJ-A', 'PARALLEL');
    Logger.log('w1 === w2 (同名不同编排类型)? ' + (w1 === w2) + '  (expected: false)');

    Logger.log('=== IdentityEngine Test DONE ===');
  }

  /**
   * 【Sprint 3 新增】Note Identity。组合字段：chat_id | normalized_content
   * | category——Note 没有"标题"，用内容本身（标准化后）参与去重，
   * category 纳入是因为同样的文字内容标成"Idea"还是"Reference"，
   * 语义不同，不该被去重系统认成同一条。
   */
  function generateNoteIdentity(chatId, content, category) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(content),
      String(category || '')
    ];
    return sha256_(parts.join('|'));
  }

  /**
   * 【Sprint 3 新增】BusinessRule（顶层分类）Identity。组合字段：
   * chat_id | normalized_name——不含 tags（tags 会变化，不应该影响
   * "这是不是同一个规则类别"的判断）。
   */
  function generateBusinessRuleIdentity(chatId, name) {
    var parts = [
      String(chatId || ''),
      normalizeTitle(name)
    ];
    return sha256_(parts.join('|'));
  }

  /**
   * 【Sprint 3 新增】WorkflowTemplate（具体版本）Identity。组合字段：
   * business_rule_id | version——同一个 BusinessRule 下，version 号
   * 本身就唯一标识一个版本，不需要再纳入其它字段；business_rule_id
   * 纳入是为了让不同 BusinessRule 下"版本 1"不会被误判成同一个
   * identity（版本号本身在不同 BusinessRule 之间是可以重复的）。
   */
  function generateWorkflowTemplateIdentity(businessRuleId, version) {
    var parts = [
      String(businessRuleId || ''),
      String(version || '')
    ];
    return sha256_(parts.join('|'));
  }

  return {
    sha256: sha256_,
    normalizeTitle: normalizeTitle,
    normalizeWhitespace: normalizeWhitespace,
    normalizeCase: normalizeCase,
    normalizeUnicode: normalizeUnicode,
    generateTaskIdentity: generateTaskIdentity,
    resolveIdentityDueValue: resolveIdentityDueValue,
    generateProjectIdentity: generateProjectIdentity,
    generateWorkflowIdentity: generateWorkflowIdentity,
    generateNoteIdentity: generateNoteIdentity,
    generateBusinessRuleIdentity: generateBusinessRuleIdentity,
    generateWorkflowTemplateIdentity: generateWorkflowTemplateIdentity,
    testIdentity: testIdentity
  };
})();
