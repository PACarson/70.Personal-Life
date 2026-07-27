/**
 * 11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs
 *
 * ⚠️ 这不是一个完整文件——这是要插入到你现有 11_ProjectionRebuilder.gs
 * 里的三个新函数。我没有你这个文件的完整内容（既有的
 * migrateSchemaV4/migrateSchemaDueTime/migrateSchemaReminderPolicy/
 * rebuildAllProjections/recomputeStatisticsFromTasks_ 等），所以不重新
 * 生成整个文件（那样风险是我凭印象编出根本不存在、或跟你实际实现不一致
 * 的内容）。请把下面三个函数原样粘贴进你现有文件（放在其它 migrateSchemaXxx
 * 函数附近即可，任意位置都行，函数之间没有顺序依赖），并把
 * rebuildAllProjections() 里追加两行调用（见文件底部说明）。
 *
 * ============================================================
 * migrateSchemaPersonalLifeOS()
 * ============================================================
 *
 * 【为什么必须跑这个，不能只跑 setupSheets()】15_Setup.gs 的
 * _ensureSheet_() 只在 sheet.getLastRow()===0（表完全是空的）时才写
 * 表头——这是既有、正确的设计（保护已有数据不被覆盖）。但也意味着：
 * 如果你的 Tasks/ActiveTasks/ArchiveTasks 已经有真实数据（不是空表），
 * 重跑 setupSheets() 不会给它们新增 v5.1/v5.2 的 21 个新列。
 * migrateSchemaPersonalLifeOS() 专门处理这个场景：对已有数据的表，只
 * 在现有表头最后追加缺失的列，不触碰任何现有数据单元格。
 *
 * 幂等：可以放心重复运行——已经有的列不会被重复添加。
 */
function migrateSchemaPersonalLifeOS() {
  Logger.log('=== migrateSchemaPersonalLifeOS 开始 ===');

  ['Tasks', 'ActiveTasks', 'ArchiveTasks'].forEach(function (sheetName) {
    _appendMissingColumns_(sheetName, LIFE_TASK_NEW_COLUMNS);
  });

  // LIFE_ 开头的七张新表全部是全新表（不存在旧数据问题），直接调用既有
  // setupSheets() 里的建表逻辑就够了——这里额外调用一次 setupSheets()
  // 本身是幂等的（_ensureSheet_ 对已存在的表不会重复处理），不会有副作用。
  setupSheets();

  Logger.log('=== migrateSchemaPersonalLifeOS 完成 ===');
}

/**
 * 内部工具：对某个已存在的 Sheet，比较当前表头 vs 目标新增列，把缺失的
 * 列追加到现有表头最后一列之后。不触碰任何已有列或已有数据行。
 * @param {string} sheetName
 * @param {string[]} newColumns  希望存在的新列名列表
 */
function _appendMissingColumns_(sheetName, newColumns) {
  var id = SecureConfig.getKey('SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('⚠️ ' + sheetName + ' 不存在，跳过迁移（应该先跑 setupSheets() 建好基础表）');
    return;
  }

  var lastCol = sheet.getLastColumn();
  var currentHeaders = lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) { return String(v).trim(); })
    : [];

  var missing = newColumns.filter(function (col) { return currentHeaders.indexOf(col) === -1; });

  if (missing.length === 0) {
    Logger.log('✅ ' + sheetName + '：新列已全部存在，跳过');
    return;
  }

  sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  Logger.log('✅ ' + sheetName + '：追加了 ' + missing.length + ' 个新列: ' + JSON.stringify(missing));
}

/**
 * ============================================================
 * rebuildProjectsProjection() / rebuildWorkflowsProjection()
 * ============================================================
 *
 * 【Everything Rebuildable，见既有 Architecture Principle】跟既有
 * rebuildTasksSheet_ 同一个模式——从 Events 表全量重放，重建
 * LIFE_PROJECTS / LIFE_WORKFLOWS。用于灾难恢复或怀疑 Read Model 跟
 * Events 不一致时手动执行。
 *
 * 请在你既有的 rebuildAllProjections() 函数体里追加这两行调用（放在
 * 既有 rebuildTasksSheet_() 等调用旁边即可）：
 *   rebuildProjectsProjection();
 *   rebuildWorkflowsProjection();
 */
function rebuildProjectsProjection() {
  var events = EventBus.getAllEvents();
  var state = {};
  events.forEach(function (e) {
    ProjectEngine.deriveFromEvent(e, state);
  });

  Object.keys(state).forEach(function (projectId) {
    ProjectEngine.materializeProjectRow_(projectId, state[projectId]);
  });

  Logger.log('✅ rebuildProjectsProjection 完成，共重建 ' + Object.keys(state).length + ' 个 Project');
}

function rebuildWorkflowsProjection() {
  var events = EventBus.getAllEvents();
  var state = {};
  events.forEach(function (e) {
    WorkflowEngine.deriveFromEvent(e, state);
  });

  Object.keys(state).forEach(function (workflowId) {
    WorkflowEngine.materializeWorkflowRow_(workflowId, state[workflowId]);
  });

  Logger.log('✅ rebuildWorkflowsProjection 完成，共重建 ' + Object.keys(state).length + ' 个 Workflow');
}
