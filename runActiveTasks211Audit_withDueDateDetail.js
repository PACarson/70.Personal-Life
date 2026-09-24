/**
 * 在 Carson 原本的 runActiveTasks211Audit() 基础上，只加了"把 due_date
 * 被误判成 Date 的行也推进 anomalies 列表"这一处——原脚本统计了
 * dueDateIsDate 的数量，但没有像 due_time/due_datetime 一样把具体是
 * 哪几行推进 anomalies，所以看不到明细，也导致最后的"完美通过"判断
 * 没有把 due_date 算进去（原脚本这个总结分支只看 anomalies.length，
 * due_date 的 14 个 Date 对象一直没被放进这个数组）。
 *
 * 除了这一处小改动，逻辑跟原脚本完全一样：依然是 100% 只读，不写任何
 * 单元格，不删任何数据。这不是这个仓库的一部分，是纯粹的诊断脚本。
 */
function runActiveTasks211Audit_withDueDateDetail() {
  Logger.log('========== ActiveTasks 全量只读类型审计开始（含 due_date 明细） ==========');
  var ss = SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID'));
  var sheet = ss.getSheetByName('ActiveTasks');
  if (!sheet) {
    Logger.log('❌ ActiveTasks 表不存在');
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    Logger.log('⚠️ 表中无数据行');
    return;
  }

  var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var taskIdIdx = header.indexOf('task_id');
  var titleIdx = header.indexOf('title');
  var dueDateIdx = header.indexOf('due_date');

  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var dueDateAnomalies = [];
  dataRows.forEach(function (row, idx) {
    var rowNum = idx + 2;
    var dueDate = row[dueDateIdx];
    if (dueDate instanceof Date) {
      dueDateAnomalies.push({
        row: rowNum,
        taskId: String(row[taskIdIdx] || ''),
        title: String(row[titleIdx] || ''),
        val: String(dueDate)
      });
    }
  });

  Logger.log('due_date 被误判成 Date 对象的行，共 ' + dueDateAnomalies.length + ' 条：');
  dueDateAnomalies.forEach(function (a) {
    Logger.log('  [行' + a.row + '] ' + a.taskId + ' (' + a.title + ') due_date = ' + a.val);
  });
  Logger.log('========== 结束 ==========');
}
