/**
 * 08_DeduplicationEngine.gs
 * Personal Life OS v5.2 — 去重引擎
 *
 * 【Sprint 1 新增】findExistingProject() / findExistingWorkflow()，跟
 * 既有 findExistingTask() 同一套"只有非终态才算已存在"的判定规则，
 * 只是终态集合从 Task 的 DONE/CANCELLED 换成各自实体的终态集合（见
 * 各函数注释）。
 *
 * 职责：检查某个业务对象是否已存在于 Read Model（Tasks / Projects /
 * Workflows）。只读 Sheet，不读 Events，不写任何东西。
 *
 * 依赖：07_IdentityEngine（外部调用方生成 identity），05_SheetUtils（Sheet 工具）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 判断某个 identity 对应的业务对象是否已存在于
 *                           Read Model
 *   Owns                  : "已存在"的判定规则（只有非终态状态算重复）
 *   Reads                 : Tasks / Projects / Workflows Sheet
 *   Writes                : none
 *   Public API            : findExistingTask, findExistingProject
 *                           （Sprint 1 新增）, findExistingWorkflow
 *                           （Sprint 1 新增）, exists
 *   Dependencies           : 05_SheetUtils.gs（getSheet_/getHeaderMap_）
 *   Forbidden Dependencies  : Events, Telegram/Output，Application 层以上
 *   Pure Function            : NO（直接读 Sheet）
 *   Thread Safety             : 由调用方 09_IdempotencyManager 的锁保证串行
 *   Side Effects              : NO
 */

var DeduplicationEngine = (function () {

  var TASKS_SHEET         = 'Tasks';
  var PROJECTS_SHEET      = 'Projects';
  var WORKFLOWS_SHEET     = 'Workflows';
  var NOTES_SHEET         = 'Notes';
  var BUSINESS_RULES_SHEET = 'BusinessRules';

  // Task 的非终态集合（沿用既有定义：只有 PENDING 算"已存在"，跟
  // Sprint 1 新增的 WAITING/BLOCKED 状态一样，本来就不是 CREATE 路径
  // 会遇到的初始状态，不需要扩大这个集合）。
  var TASK_NON_TERMINAL = ['PENDING'];

  // Project 的非终态集合（v5.2 Canonical Lifecycle，见 ADR-2026-07-24-017）。
  var PROJECT_NON_TERMINAL = ['DRAFT', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED'];

  // Workflow 的非终态集合（Workflow 不原生使用 WAITING/BLOCKED，见
  // 00_Sheets_Structure.gs「四」）。
  var WORKFLOW_NON_TERMINAL = ['DRAFT', 'READY', 'IN_PROGRESS'];

  // ============ 内部：按 identity 列扫 Sheet ============

  /**
   * 在指定 Sheet 里找第一行 identity 值匹配的行，返回对象或 null。
   * @param {string} sheetName
   * @param {string} identity   SHA-256 hex
   * @returns {object|null}
   */
  function _findRowByIdentity_(sheetName, identity) {
    var sheet;
    try {
      sheet = getSheet_(sheetName); // 05_SheetUtils
    } catch (e) {
      Logger.log('[DeduplicationEngine] Sheet 不存在: ' + sheetName);
      return null;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;

    var headerMap = getHeaderMap_(sheet); // 05_SheetUtils
    if (!headerMap.hasOwnProperty('identity')) {
      Logger.log('[DeduplicationEngine] ⚠️ ' + sheetName + ' 没有 identity 列，跳过去重');
      return null;
    }

    var identityColIdx = headerMap['identity'];
    var numCols = sheet.getLastColumn();

    var identityValues = sheet.getRange(2, identityColIdx + 1, lastRow - 1, 1).getValues();

    for (var i = 0; i < identityValues.length; i++) {
      if (String(identityValues[i][0]) === String(identity)) {
        var rowData = sheet.getRange(i + 2, 1, 1, numCols).getValues()[0];
        var obj = {};
        for (var h in headerMap) {
          obj[h] = rowData[headerMap[h]];
        }
        return obj;
      }
    }
    return null;
  }

  // ============ 对外接口 ============

  /**
   * 查找匹配 identity 且状态为 PENDING 的任务。
   * @param {string} identity
   * @returns {object|null}
   */
  function findExistingTask(identity) {
    var row = _findRowByIdentity_(TASKS_SHEET, identity);
    if (!row) return null;
    if (TASK_NON_TERMINAL.indexOf(String(row.status || '').toUpperCase()) === -1) return null;
    return row;
  }

  /** findPendingTask 是 findExistingTask 的语义别名（既有别名，保留） */
  function findPendingTask(identity) {
    return findExistingTask(identity);
  }

  /**
   * 【Sprint 1 新增】查找匹配 identity 且处于非终态的 Project。
   * 已 COMPLETED/CANCELLED/ARCHIVED/CONVERTED_TO_TASK 的历史 Project
   * 不会拦截新建同名 Project（例如去年 archive 过的"搬家"不会阻止
   * 今年再建一个新的"搬家" Project）。
   * @param {string} identity
   * @returns {object|null}
   */
  function findExistingProject(identity) {
    var row = _findRowByIdentity_(PROJECTS_SHEET, identity);
    if (!row) return null;
    if (PROJECT_NON_TERMINAL.indexOf(String(row.status || '').toUpperCase()) === -1) return null;
    return row;
  }

  /**
   * 【Sprint 1 新增】查找匹配 identity 且处于非终态的 Workflow。
   * @param {string} identity
   * @returns {object|null}
   */
  function findExistingWorkflow(identity) {
    var row = _findRowByIdentity_(WORKFLOWS_SHEET, identity);
    if (!row) return null;
    if (WORKFLOW_NON_TERMINAL.indexOf(String(row.status || '').toUpperCase()) === -1) return null;
    return row;
  }

  /**
   * 查找匹配 identity 的库存物品（既有函数，原样保留，本项目 Task 域
   * 不使用，不属于 Sprint 1 改动范围，移除风险见 07_IdentityEngine.gs
   * 同类保守判断标准）。
   */
  function findExistingInventory(identity) {
    var row = _findRowByIdentity_('Inventory', identity);
    if (!row) return null;
    if (String(row.status || '') === 'CONSUMED') return null;
    return row;
  }

  /**
   * 通用 exists 检查
   * @param {string} identity
   * @param {string} sheetName
   * @returns {boolean}
   */
  function exists(identity, sheetName) {
    if (sheetName === TASKS_SHEET) return findExistingTask(identity) !== null;
    if (sheetName === PROJECTS_SHEET) return findExistingProject(identity) !== null;
    if (sheetName === WORKFLOWS_SHEET) return findExistingWorkflow(identity) !== null;
    if (sheetName === NOTES_SHEET) return findExistingNote(identity) !== null;
    if (sheetName === BUSINESS_RULES_SHEET) return findExistingBusinessRule(identity) !== null;
    return _findRowByIdentity_(sheetName, identity) !== null;
  }

  /**
   * 【Sprint 3 新增】查找匹配 identity 且处于 OPEN 状态的 Note。已
   * CONVERTED/ARCHIVED 的 Note 不会拦截新建同样内容的 Note——一条
   * Note 转化过之后，再记一条完全一样的内容不算重复，是用户又想起
   * 同一件事、值得再记一次。
   */
  function findExistingNote(identity) {
    var row = _findRowByIdentity_(NOTES_SHEET, identity);
    if (!row) return null;
    if (String(row.status || '').toUpperCase() !== 'OPEN') return null;
    return row;
  }

  /**
   * 【Sprint 3 新增】查找匹配 identity 且状态为 ACTIVE 的 BusinessRule
   * （顶层分类）。已 DEPRECATED 的分类不拦截重建同名分类——理由同
   * Project/Workflow 的非终态判断。
   */
  function findExistingBusinessRule(identity) {
    var row = _findRowByIdentity_(BUSINESS_RULES_SHEET, identity);
    if (!row) return null;
    if (String(row.status || '').toUpperCase() !== 'ACTIVE') return null;
    return row;
  }

  // ============ 开发者测试 ============

  function testDuplicateTask() {
    Logger.log('=== DeduplicationEngine.testDuplicateTask ===');
    var identity = IdentityEngine.generateTaskIdentity('test', '测试去重任务', '', '', 'MEDIUM', 'GENERAL');
    var existing = findExistingTask(identity);
    Logger.log('findExistingTask result: ' + (existing ? '找到了: ' + existing.task_id : 'null'));
    Logger.log('=== testDuplicateTask DONE ===');
  }

  function testDuplicateProject() {
    Logger.log('=== DeduplicationEngine.testDuplicateProject ===');
    var identity = IdentityEngine.generateProjectIdentity('test', '测试去重项目', '');
    var existing = findExistingProject(identity);
    Logger.log('findExistingProject result: ' + (existing ? '找到了: ' + existing.project_id : 'null'));
    Logger.log('=== testDuplicateProject DONE ===');
  }

  return {
    findExistingTask:      findExistingTask,
    findPendingTask:       findPendingTask,
    findExistingProject:   findExistingProject,
    findExistingWorkflow:  findExistingWorkflow,
    findExistingNote:      findExistingNote,
    findExistingBusinessRule: findExistingBusinessRule,
    findExistingInventory: findExistingInventory,
    exists:                exists,
    testDuplicateTask:     testDuplicateTask,
    testDuplicateProject:  testDuplicateProject
  };
})();
