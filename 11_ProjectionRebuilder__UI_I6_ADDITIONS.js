/**
 * 11_ProjectionRebuilder__UI_I6_ADDITIONS.gs
 *
 * ⚠️ 这不是一个完整文件——跟既有 11_ProjectionRebuilder__SPRINT1_
 * ADDITIONS.gs / __DUE_DATE_VALUE_MIGRATION.gs 同一种约定（descriptive
 * suffix 命名，见 00_File_Map.gs"附：Track 1B 迁移工具"一节）：这是要
 * 插入到你现有 11_ProjectionRebuilder.gs 里的一个新函数（UI-I6 Drag
 * Ordering，ADR-2026-08-26-026，Verification Discipline 里的 Replay
 * 检查点）。请把下面这个函数原样粘贴进你现有文件（放在
 * rebuildProjectsProjection()/rebuildWorkflowsProjection() 附近即可）。
 *
 * 【如实记录一处观察——不是本次 UI-I6 范围要修的东西，只是做同样的
 * "追加一个 rebuild 函数"操作时顺带核对出来的】对照这次拿到的
 * 11_ProjectionRebuilder.gs，它的 rebuildAllProjections() 目前只调用
 * rebuildTasksProjection/rebuildActiveTasksProjection/
 * rebuildStatisticsProjection/rebuildTaskFiltersProjection 四个——没有看到
 * Sprint 1 新增的 rebuildProjectsProjection()/rebuildWorkflowsProjection()
 * 调用（这两个函数本身存在，见 11_ProjectionRebuilder__SPRINT1_
 * ADDITIONS.gs），跟那份文件头当时"并把 rebuildAllProjections() 里追加
 * 两行调用"的说明对不上。这不是这次三个 Decision Gate 的范围，也不是
 * UI-I6 引入的问题，只是如实记录：如果确实还没追加，Carson 可以考虑
 * 连 Projects/Workflows/TaskViewOrder 三个一起补上，而不是本次自己
 * 顺手改一个跟今天范围无关的共用文件。
 *
 * 【为什么这里是"整表重建"，不是逐 entity_id materialize】
 * rebuildProjectsProjection()/rebuildWorkflowsProjection() 是"每个
 * entity_id 一行、互不相关"的重放形状；TaskViewOrder 的"当前状态"是
 * 按 (chat_id, context_key) 分组、组内多行必须整体替换（跟
 * 10_ProjectionEngine.gs 的 projectViewOrderUpdated_/
 * _replaceTaskViewOrderRows_ 是同一个"整体覆盖式重写"语义），所以按
 * (chat_id, context_key) 分组、每组只保留时间上最后一个
 * VIEW_ORDER_UPDATED 事件的内容，最后一次性重建整张表——不是对每个
 * task_id 分别调用一次 materialize。跟本文件其它 rebuild*Projection
 * 一致，假设 EventBus.getAllEvents() 按时间顺序返回（Events 表只增不删，
 * 新事件永远追加在最后，读出来天然是时间顺序）。
 */
function rebuildTaskViewOrderProjection() {
  var events = EventBus.getAllEvents();
  var groups = {}; // key: chatId + '||' + contextKey → 最后一次事件的 payload（后面覆盖前面）

  events.forEach(function (e) {
    if (e.type !== 'VIEW_ORDER_UPDATED') return;
    var p = e.payload || {};
    if (!p.chat_id || !p.context_key || !p.ordered_task_ids) return;
    groups[p.chat_id + '||' + p.context_key] = p;
  });

  var id = SecureConfig.getKey('SPREADSHEET_ID');
  var ss = SpreadsheetApp.openById(id);
  var sheet = ss.getSheetByName('TaskViewOrder');
  if (!sheet) {
    Logger.log('⚠️ TaskViewOrder 不存在，跳过（应该先跑 setupSheets()）');
    return;
  }

  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var headerMap = {};
  headerRow.forEach(function (h, idx) { headerMap[h] = idx; });

  var nowIso = new Date().toISOString();
  var finalRows = [];
  Object.keys(groups).forEach(function (key) {
    var p = groups[key];
    p.ordered_task_ids.forEach(function (taskId, idx) {
      var row = new Array(lastCol).fill('');
      row[headerMap['chat_id']]      = p.chat_id;
      row[headerMap['context_key']]  = p.context_key;
      row[headerMap['task_id']]      = taskId;
      row[headerMap['order_index']]  = idx;
      row[headerMap['updated_time']] = nowIso;
      finalRows.push(row);
    });
  });

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  if (finalRows.length > 0) {
    sheet.getRange(2, 1, finalRows.length, lastCol).setValues(finalRows);
  }

  Logger.log('✅ rebuildTaskViewOrderProjection 完成，共重建 ' + Object.keys(groups).length +
    ' 个 (chat_id, context_key) 分组，' + finalRows.length + ' 行');
}
