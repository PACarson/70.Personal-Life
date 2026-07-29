/**
 * 15_Setup.gs
 * Personal Life OS v5.2 — 一键初始化
 *
 * 【新增 runPreflightCheck()，2026-07-29】起因：真实环境报过
 * "NEW_TASK_COLUMNS is not defined"/"markTaskConverted_ is not a
 * function" 这类"部分文件没同步到最新版本"的错误，报错信息本身很
 * 难一眼看出是哪个文件没更新。runPreflightCheck() 一次性检查全部
 * 24 个文件各自应该存在的关键函数/变量，在跑任何迁移/测试之前先跑
 * 这个，全部 ✅ 才继续。
 *
 * 【Sprint 1 新增】
 *  - setupSheets()：Tasks/ActiveTasks/ArchiveTasks 表头追加 21 个 v5.1/
 *    v5.2 新列（project_id 起，见下方数组，完整定义见设计包
 *    00_Sheets_Structure.gs「一」）；新增 Projects/Workflows/
 *    Timeline 三张表（Sprint 1 实际使用）+ Notes/Reviews/
 *    BusinessRules/WorkflowTemplates 四张表（Sprint 3 才会
 *    有 Engine 写入，这里提前建表——Schema 先行于代码，零风险，见设计包
 *    00_Sheets_Structure.gs「十」迁移说明）
 *  - repairSheetHeaders()：同步新增 7 张新表 + Tasks 系三表新列的检查
 *  - runDiagnostics()：新增 Project/Workflow 冒烟测试
 *  - 全部 Library Identifier 引用从 "ProductivityOS" 改为
 *    "PersonalLifeOS"（见 00_ADR.gs ADR-2026-07-24-018）
 *
 * 已有部署（跑过 v4.9 或更早版本 setupSheets() 的 Spreadsheet）需要迁移，
 * 走 11_ProjectionRebuilder.gs 的 migrateSchemaPersonalLifeOS()（Sprint 1
 * 新增，幂等，只新增列/新增表，不动现有数据），不需要重跑本文件的
 * setupSheets()——全新建表才会用到这里的改动。
 *
 * 【历史变更】v4.2~v4.9 各轮修复（Events 表补建、表头完整性比对、
 * TaskStatistics 改批量重算、Due Time/Reminder Policy 列迁移等）逻辑
 * 全部原样保留，未改动，完整历史见既有文件头注释。
 */

// ============ 1. 建表 ============

// 【Sprint 1 新增】Tasks/ActiveTasks/ArchiveTasks 共用的新增列（21个），
// 追加在各自既有表头最后。三张表结构本来就高度一致（ActiveTasks 没有
// 'archived'，ArchiveTasks 用 'archived_at' 取代 'archived'），新列
// 三张表保持完全一致，方便以后维护。
var NEW_TASK_COLUMNS = [
  'project_id', 'workflow_id', 'sequence_index', 'parent_task_id',
  'depends_on_task_ids', 'branch_group', 'branch_resolution_policy',
  'converted_to_project_id', 'source_project_id', 'priority_ai_recommended',
  'creator', 'suggested_by', 'source_domain', 'source_module',
  'source_event_id', 'source_task_id', 'created_method', 'created_time',
  'updated_time', 'decision_owner', 'approval_status'
];

function setupSheets() {
  var id = SecureConfig.getKey('SPREADSHEET_ID');
  if (!id) {
    Logger.log('❌ 先设置 SPREADSHEET_ID: SecureConfig.setKey("SPREADSHEET_ID", "跟Core项目一样的Spreadsheet ID")');
    return;
  }
  var ss = SpreadsheetApp.openById(id);

  // Events 表：本项目/Core 项目/Reminder OS 三方共享，表头须跟
  // 02_EventBus.gs 的 COLS 数组逐字一致。
  _ensureSheet_(ss, 'Events', [
    'event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source'
  ]);

  _ensureSheet_(ss, 'Tasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity', 'archived'
  ].concat(NEW_TASK_COLUMNS));

  _ensureSheet_(ss, 'ActiveTasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity'
  ].concat(NEW_TASK_COLUMNS));

  _ensureSheet_(ss, 'ArchiveTasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity', 'archived_at'
  ].concat(NEW_TASK_COLUMNS));

  _ensureSheet_(ss, 'TaskStatistics', [
    'chat_id', 'total_count', 'pending_count', 'done_count', 'cancelled_count',
    'recurring_count', 'reminder_count_total', 'last_updated_at'
  ]);

  _ensureSheet_(ss, 'TaskFilters', [
    'task_id', 'chat_id', 'searchable_text', 'tags_csv'
  ]);

  // ============ 【Sprint 1 新增】Personal Life OS 新表 ============

  _ensureSheet_(ss, 'Projects', [
    'project_id', 'identity', 'title', 'description', 'status',
    'execution_mode', 'parent_project_id', 'depends_on_project_ids',
    'source_task_id', 'converted_to_task_id', 'instantiated_from_template_id',
    'archived_at', 'chat_id',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'created_method', 'created_time', 'updated_time',
    'decision_owner', 'approval_status'
  ]);

  _ensureSheet_(ss, 'Workflows', [
    'workflow_id', 'identity', 'project_id', 'title', 'workflow_type',
    'status', 'recurrence_rule', 'loop_max_iterations', 'chat_id',
    'instantiated_from_template_id', 'template_version_at_instantiation',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'created_method', 'created_time', 'updated_time',
    'decision_owner', 'approval_status'
  ]);

  _ensureSheet_(ss, 'Timeline', [
    'timeline_id', 'entity_type', 'entity_id', 'event_type', 'timestamp',
    'actor', 'detail', 'source_event_id'
  ]);

  // 以下三张表 Sprint 1 只建表（Schema 先行），实际写入要等 Sprint 3 的
  // 29_NoteEngine.gs / 40_ReviewEngine.gs / 41_BusinessRuleEngine.gs 落地。
  _ensureSheet_(ss, 'Notes', [
    'note_id', 'identity', 'content', 'category', 'status',
    'converted_to_type', 'converted_to_id', 'chat_id',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);

  _ensureSheet_(ss, 'Reviews', [
    'review_id', 'review_type', 'period_start', 'period_end',
    'summary_stats', 'ai_review_notes', 'created_time'
  ]);

  _ensureSheet_(ss, 'BusinessRules', [
    'rule_id', 'name', 'tags', 'status',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);

  _ensureSheet_(ss, 'WorkflowTemplates', [
    'template_id', 'business_rule_id', 'version', 'status', 'workflow_shape',
    'captured_from_project_id', 'usage_count', 'last_used_at',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);

  Logger.log('✅ Sheets 就位: Events, Tasks, ActiveTasks, ArchiveTasks, TaskStatistics, TaskFilters,');
  Logger.log('   Projects, Workflows, Timeline, Notes, Reviews,');
  Logger.log('   BusinessRules, WorkflowTemplates');
  Logger.log('   （Events 表如果 Core 项目已经建过，上面这行只是确认存在，不会动它的数据）');
  Logger.log('下一步: 如果 Tasks 已有旧数据（v5.1 之前的部署）→ migrateSchemaPersonalLifeOS()（11_ProjectionRebuilder.gs）；然后 createTriggers()');
}

function _ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length).setNumberFormat('@');
  }
  return sheet;
}

// ============ 2. 定时触发器（既有，不变） ============

function createTriggers() {
  var handlerNames = ['triggerDailyArchive', 'triggerDailyStatisticsRecompute'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (handlerNames.indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('triggerDailyArchive').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('triggerDailyStatisticsRecompute').timeBased().everyDays(1).atHour(3).create();

  Logger.log('✅ Personal Life OS 自己的触发器挂好了:');
  Logger.log('  triggerDailyArchive — 每天 02:00 左右（冷归档）');
  Logger.log('  triggerDailyStatisticsRecompute — 每天 03:00 左右（TaskStatistics 批量重算）');
}

// ============ 修复：表头被污染 ============

function repairSheetHeaders() {
  _repairOneSheetHeader_('Events', [
    'event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source'
  ]);
  _repairOneSheetHeader_('Tasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity', 'archived'
  ].concat(NEW_TASK_COLUMNS));
  _repairOneSheetHeader_('ActiveTasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity'
  ].concat(NEW_TASK_COLUMNS));
  _repairOneSheetHeader_('ArchiveTasks', [
    'task_id', 'timestamp', 'title', 'category', 'status', 'due_date',
    'due_time', 'due_datetime', 'recurring', 'reminder_policy', 'priority',
    'context', 'budget', 'notes', 'description', 'tags', 'chat_id',
    'completed_at', 'reminder_count', 'identity', 'archived_at'
  ].concat(NEW_TASK_COLUMNS));
  _repairOneSheetHeader_('TaskStatistics', [
    'chat_id', 'total_count', 'pending_count', 'done_count', 'cancelled_count',
    'recurring_count', 'reminder_count_total', 'last_updated_at'
  ]);
  _repairOneSheetHeader_('TaskFilters', [
    'task_id', 'chat_id', 'searchable_text', 'tags_csv'
  ]);

  // 【Sprint 1 新增】
  _repairOneSheetHeader_('Projects', [
    'project_id', 'identity', 'title', 'description', 'status',
    'execution_mode', 'parent_project_id', 'depends_on_project_ids',
    'source_task_id', 'converted_to_task_id', 'instantiated_from_template_id',
    'archived_at', 'chat_id',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'created_method', 'created_time', 'updated_time',
    'decision_owner', 'approval_status'
  ]);
  _repairOneSheetHeader_('Workflows', [
    'workflow_id', 'identity', 'project_id', 'title', 'workflow_type',
    'status', 'recurrence_rule', 'loop_max_iterations', 'chat_id',
    'instantiated_from_template_id', 'template_version_at_instantiation',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'created_method', 'created_time', 'updated_time',
    'decision_owner', 'approval_status'
  ]);
  _repairOneSheetHeader_('Timeline', [
    'timeline_id', 'entity_type', 'entity_id', 'event_type', 'timestamp',
    'actor', 'detail', 'source_event_id'
  ]);
  _repairOneSheetHeader_('Notes', [
    'note_id', 'identity', 'content', 'category', 'status',
    'converted_to_type', 'converted_to_id', 'chat_id',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);
  _repairOneSheetHeader_('Reviews', [
    'review_id', 'review_type', 'period_start', 'period_end',
    'summary_stats', 'ai_review_notes', 'created_time'
  ]);
  _repairOneSheetHeader_('BusinessRules', [
    'rule_id', 'name', 'tags', 'status',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);
  _repairOneSheetHeader_('WorkflowTemplates', [
    'template_id', 'business_rule_id', 'version', 'status', 'workflow_shape',
    'captured_from_project_id', 'usage_count', 'last_used_at',
    'creator', 'suggested_by', 'source_domain', 'source_module',
    'source_event_id', 'source_task_id', 'created_method', 'created_time',
    'updated_time', 'decision_owner', 'approval_status'
  ]);
}

/**
 * 对第一行整行做逐个元素+顺序的完全比对，只有完全一致才跳过；否则按
 * "表头行还在但列不全/顺序错"或"表头行本身被删掉了"两种情况分别修复。
 * （既有逻辑，不变，完整说明见 v4.2 审计修复记录。）
 */
function _repairOneSheetHeader_(name, headers) {
  var id = SecureConfig.getKey('SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    Logger.log('❌ ' + name + ' 不存在，先跑 setupSheets()');
    return;
  }

  var currentWidth = Math.max(sheet.getLastColumn(), headers.length);
  var currentRow = (currentWidth > 0)
    ? sheet.getRange(1, 1, 1, currentWidth).getValues()[0].map(function (v) { return String(v).trim(); })
    : [];

  var isExactMatch = headers.every(function (h, idx) { return currentRow[idx] === h; }) &&
    currentRow.slice(headers.length).every(function (v) { return v === ''; });

  if (isExactMatch) {
    Logger.log('✅ ' + name + ' 表头完整且顺序正确（全部 ' + headers.length + ' 列核对通过），跳过');
    return;
  }

  var firstCell = currentRow[0] || '';
  var looksLikeHeaderRow = (firstCell === headers[0]);

  if (looksLikeHeaderRow) {
    var missing = headers.filter(function (h) { return currentRow.indexOf(h) === -1; });
    Logger.log('⚠️ ' + name + ' 表头列不完整或顺序不对（当前第一行: ' + JSON.stringify(currentRow) +
      '），缺失/需修正的列: ' + JSON.stringify(missing) + '。原地覆写第一行为标准表头（不触碰数据行）。');
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    Logger.log('✅ ' + name + ' 表头列已修复');
    return;
  }

  Logger.log('⚠️ ' + name + ' 第一行不像表头（第一格="' + firstCell + '"，应为"' + headers[0] +
    '"），说明表头行本身被删掉了。插入新的表头行，原有数据整体往下挪一行');
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, Math.max(sheet.getMaxRows() - 1, 1), headers.length).setNumberFormat('@');
  Logger.log('✅ ' + name + ' 表头已修复（插入新行）');
}

// ============ 一键跑完第一步 ============

function setupAll() {
  setupSheets();
  Logger.log('=== 第一步完成 ===');
  Logger.log('接下来: 1) migrateSchemaPersonalLifeOS()（如有 v5.1 之前的旧数据）  2) Deploy as Library  ' +
    '3) 去 Core 项目 Editor→Libraries 加上本项目当 "PersonalLifeOS"（见 00_ADR.gs ADR-2026-07-24-018，' +
    '注意跟旧 Identifier "ProductivityOS" 不同，Core 项目 04_Main.gs 的调用点需要同步改名）  4) createTriggers()');
}

// ============ 诊断：不碰 Telegram，直接看本项目状态 ============

function runDiagnostics() {
  Logger.log('========== Personal Life OS v5.2 诊断开始 ==========');

  var id = SecureConfig.getKey('SPREADSHEET_ID');
  if (!id) {
    Logger.log('❌ SPREADSHEET_ID 没设置，下面的检查会全部失败');
  }
  var ss = id ? SpreadsheetApp.openById(id) : null;

  [
    'Events', 'Tasks', 'ActiveTasks', 'ArchiveTasks', 'TaskStatistics', 'TaskFilters',
    'Projects', 'Workflows', 'Timeline',
    'Notes', 'Reviews', 'BusinessRules', 'WorkflowTemplates'
  ].forEach(function (name) {
    if (!ss) return;
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      Logger.log('❌ Sheet "' + name + '" 不存在！先跑 setupSheets()');
    } else {
      Logger.log('✅ Sheet "' + name + '" 存在，表头: ' + JSON.stringify(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]));
      Logger.log('   当前行数（含表头）: ' + sheet.getLastRow());
    }
  });

  var testChatId = 'diagnostic_test_chat';

  try {
    var parsed = parseTaskIntent('提醒我明天3点交房租');
    Logger.log('✅ parseTaskIntent 测试结果: ' + JSON.stringify(parsed));
  } catch (e) {
    Logger.log('❌ parseTaskIntent 本身就报错: ' + e.message + '\n' + e.stack);
  }

  var testTaskId = null;
  try {
    var task = createTask('诊断测试任务-可以删除', { category: 'GENERAL', notes: 'DIAGNOSTIC_TEST_TEMP' }, testChatId);
    testTaskId = task.task_id;
    Logger.log('✅ createTask 测试结果: ' + JSON.stringify(task));
  } catch (e) {
    Logger.log('❌ createTask 报错: ' + e.message + '\n' + e.stack);
  }

  if (testTaskId) {
    try {
      var updated = updateTask(testTaskId, { notes: 'DIAGNOSTIC_TEST_TEMP_UPDATED' }, testChatId);
      Logger.log('✅ updateTask 测试结果: ' + JSON.stringify(updated));
    } catch (e) {
      Logger.log('❌ updateTask 报错: ' + e.message + '\n' + e.stack);
    }

    try {
      var pending = TaskQueryEngine.getPendingTasks(testChatId);
      Logger.log('✅ TaskQueryEngine.getPendingTasks 测试结果，共 ' + pending.length + ' 条');
    } catch (e) {
      Logger.log('❌ TaskQueryEngine.getPendingTasks 报错: ' + e.message + '\n' + e.stack);
    }

    try {
      var dash = TaskQueryEngine.getDashboard('today', testChatId);
      Logger.log('✅ TaskQueryEngine.getDashboard 测试结果:\n' + dash);
    } catch (e) {
      Logger.log('❌ TaskQueryEngine.getDashboard 报错: ' + e.message + '\n' + e.stack);
    }

    try {
      cancelTask(testTaskId, testChatId);
      Logger.log('✅ 已自动取消诊断测试任务');
    } catch (e) {
      Logger.log('❌ cancelTask 报错: ' + e.message + '\n' + e.stack);
    }
  }

  // 【Sprint 1 新增】Project/Workflow 冒烟测试
  var testProjectId = null;
  try {
    var project = ProjectEngine.createProject('诊断测试项目-可以删除', {}, testChatId);
    testProjectId = project.project_id;
    Logger.log('✅ ProjectEngine.createProject 测试结果: ' + JSON.stringify(project));
  } catch (e) {
    Logger.log('❌ ProjectEngine.createProject 报错: ' + e.message + '\n' + e.stack);
  }

  if (testProjectId) {
    try {
      var workflow = WorkflowEngine.startWorkflow('诊断测试工作流-可以删除',
        { project_id: testProjectId, workflow_type: 'SEQUENTIAL' }, testChatId);
      Logger.log('✅ WorkflowEngine.startWorkflow 测试结果: ' + JSON.stringify(workflow));
      WorkflowEngine.cancelWorkflow(workflow.workflow_id, testChatId);
      Logger.log('✅ 已自动取消诊断测试工作流');
    } catch (e) {
      Logger.log('❌ WorkflowEngine.startWorkflow 报错: ' + e.message + '\n' + e.stack);
    }

    try {
      var timeline = TimelineQueryEngine.getTimelineForEntity('PROJECT', testProjectId);
      Logger.log('✅ TimelineQueryEngine.getTimelineForEntity 测试结果，共 ' + timeline.length + ' 条');
    } catch (e) {
      Logger.log('❌ TimelineQueryEngine.getTimelineForEntity 报错: ' + e.message + '\n' + e.stack);
    }

    try {
      ProjectEngine.cancelProject(testProjectId, testChatId);
      Logger.log('✅ 已自动取消诊断测试项目');
    } catch (e) {
      Logger.log('❌ ProjectEngine.cancelProject 报错: ' + e.message + '\n' + e.stack);
    }
  }

  Logger.log('⚠️ 这些是本项目内部测试，不代表 Core 项目能成功调用本项目（Library 引入是否');
  Logger.log('   配置正确要去 Core 项目那边测：PersonalLifeOS.handleTaskIntent(...)——注意 Library');
  Logger.log('   Identifier 已从 ProductivityOS 改名，见 00_ADR.gs ADR-2026-07-24-018）。');
  Logger.log('========== 诊断结束 ==========');
}

// ============ Preflight Check：全部文件是否都是最新版本 ============

/**
 * 【新增，起因见 2026-07-29 的真实报错】runDiagnostics()/
 * migrateSchemaPersonalLifeOS() 等一旦某个文件不是最新版本，报错信息
 * 是"某某函数不是 function"或"某某表不存在"这类间接线索，需要连蒙带
 * 猜才能定位到底哪个文件没同步。本函数直接检查全部 24 个 Sprint 1 +
 * Sprint 3 文件各自应该存在的关键函数/变量，一次性列出所有过期/缺失
 * 的文件，不用再看报错信息猜。
 *
 * 使用方式：**在跑 renameSheetsToPascalCase()/setupSheets()/
 * migrateSchemaPersonalLifeOS() 之前，先跑这个**。全部 ✅ 才继续。
 */
function runPreflightCheck() {
  Logger.log('========== Preflight Check 开始 ==========');
  Logger.log('检查 24 个 Sprint 1 + Sprint 3 文件是否都已粘贴/更新为最新版本');
  Logger.log('');

  var checks = [
    { file: '02_EventBus.gs',      test: function () { return typeof EventBus !== 'undefined' && typeof EventBus.publish === 'function'; } },
    { file: '05_SheetUtils.gs',     test: function () { return typeof getSheet_ === 'function' && typeof getHeaderMap_ === 'function' && typeof upsertRowByKey_ === 'function'; } },
    { file: '07_IdentityEngine.gs（需含 Sprint 3 的 generateNoteIdentity）', test: function () { return typeof IdentityEngine !== 'undefined' && typeof IdentityEngine.generateNoteIdentity === 'function' && typeof IdentityEngine.generateProjectIdentity === 'function'; } },
    { file: '08_DeduplicationEngine.gs（需含 Sprint 3 的 findExistingNote）', test: function () { return typeof DeduplicationEngine !== 'undefined' && typeof DeduplicationEngine.findExistingNote === 'function'; } },
    { file: '09_IdempotencyManager.gs（需含 Sprint 3 的 createNoteIfNotExists）', test: function () { return typeof IdempotencyManager !== 'undefined' && typeof IdempotencyManager.createNoteIfNotExists === 'function' && typeof IdempotencyManager.createBusinessRuleIfNotExists === 'function'; } },
    { file: '10_ProjectionEngine.gs（需含 Sprint 3 dispatch，含 Projects/Workflows 等新表名）', test: function () { return typeof ProjectionEngine !== 'undefined' && typeof ProjectionEngine.dispatch === 'function'; } },
    { file: '11_ProjectionRebuilder.gs 追加的函数（含 renameSheetsToPascalCase）', test: function () { return typeof migrateSchemaPersonalLifeOS === 'function' && typeof renameSheetsToPascalCase === 'function' && typeof rebuildProjectsProjection === 'function' && typeof rebuildWorkflowsProjection === 'function'; } },
    { file: '12_TaskQueryEngine.gs（需含 getTasksByProject/getTasksByWorkflow）', test: function () { return typeof TaskQueryEngine !== 'undefined' && typeof TaskQueryEngine.getTasksByProject === 'function' && typeof TaskQueryEngine.getTasksByWorkflow === 'function'; } },
    { file: '14_ProjectQueryEngine.gs', test: function () { return typeof ProjectQueryEngine !== 'undefined' && typeof ProjectQueryEngine.getProject === 'function'; } },
    { file: '15_Setup.gs（本文件自己，需含 NEW_TASK_COLUMNS）', test: function () { return typeof NEW_TASK_COLUMNS !== 'undefined' && NEW_TASK_COLUMNS.length > 0; } },
    { file: '16_WorkflowQueryEngine.gs', test: function () { return typeof WorkflowQueryEngine !== 'undefined' && typeof WorkflowQueryEngine.getWorkflow === 'function'; } },
    { file: '17_NoteQueryEngine.gs', test: function () { return typeof NoteQueryEngine !== 'undefined'; } },
    { file: '18_ReviewQueryEngine.gs', test: function () { return typeof ReviewQueryEngine !== 'undefined'; } },
    { file: '19_BusinessRuleQueryEngine.gs', test: function () { return typeof BusinessRuleQueryEngine !== 'undefined'; } },
    { file: '20_TaskEngine.gs（需含 Sprint 3 的 markTaskConverted_）', test: function () { return typeof TaskEngine !== 'undefined' && typeof TaskEngine.markTaskConverted_ === 'function' && typeof TaskEngine.markTaskNotSelected_ === 'function' && typeof TaskEngine.createTaskFromConversion_ === 'function'; } },
    { file: '27_ProjectEngine.gs（需含 Sprint 3 的 checkEligibleForTaskDemotion_）', test: function () { return typeof ProjectEngine !== 'undefined' && typeof ProjectEngine.checkEligibleForTaskDemotion_ === 'function' && typeof ProjectEngine.markProjectConvertedToTask_ === 'function'; } },
    { file: '28_WorkflowEngine.gs', test: function () { return typeof WorkflowEngine !== 'undefined' && typeof WorkflowEngine.handleBranchResolution_ === 'function'; } },
    { file: '29_NoteEngine.gs', test: function () { return typeof NoteEngine !== 'undefined'; } },
    { file: '40_ReviewEngine.gs', test: function () { return typeof ReviewEngine !== 'undefined'; } },
    { file: '41_BusinessRuleEngine.gs', test: function () { return typeof BusinessRuleEngine !== 'undefined'; } },
    { file: '42_ConversionEngine.gs', test: function () { return typeof ConversionEngine !== 'undefined'; } },
    { file: '43_ReminderConnector.gs', test: function () { return typeof ReminderConnector !== 'undefined'; } },
    { file: '44_TimelineQueryEngine.gs', test: function () { return typeof TimelineQueryEngine !== 'undefined'; } },
    { file: '45_CanonicalRepresentation.gs', test: function () { return typeof CanonicalRepresentation !== 'undefined' && typeof CanonicalRepresentation.composeCanonicalIdentity_ === 'function'; } }
  ];

  var allOk = true;
  checks.forEach(function (c) {
    var ok = false;
    try { ok = !!c.test(); } catch (e) { ok = false; }
    Logger.log((ok ? '✅ ' : '❌ 过期/缺失: ') + c.file);
    if (!ok) allOk = false;
  });

  Logger.log('');
  if (allOk) {
    Logger.log('✅✅✅ 全部文件都是最新版本，可以继续跑 renameSheetsToPascalCase() 等');
  } else {
    Logger.log('❌ 上面标"过期/缺失"的文件，请用最新交付的内容整份替换（不是追加），');
    Logger.log('   替换完重新跑一次本函数（runPreflightCheck），全部 ✅ 才继续下一步。');
  }
  Logger.log('========== Preflight Check 结束 ==========');

  return allOk;
}
