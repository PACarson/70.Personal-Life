/**
 * 16_WorkflowQueryEngine.gs
 * Personal Life OS v5.2 — Workflow Query Engine
 *
 * 本模块是本 OS 里 Workflows 表唯一允许直接读取的模块。需要
 * Task 数据（联查）时调用 TaskQueryEngine，不直接读 Tasks 表。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Workflow 的唯一对外查询入口
 *   Reads                 : Workflows Sheet（+ 联查时经由
 *                           TaskQueryEngine 读 Tasks）
 *   Writes                : none
 *   Public API            : getWorkflow, getWorkflows,
 *                           getWorkflowWithTasks
 *   Dependencies           : 05_SheetUtils.gs, 12_TaskQueryEngine.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var WorkflowQueryEngine = (function () {

  var WORKFLOWS_SHEET = 'Workflows';

  function _readAllRows_(sheetName) {
    try {
      var sheet = getSheet_(sheetName);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      var headerMap = getHeaderMap_(sheet);
      var numCols   = sheet.getLastColumn();
      var rows      = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

      return rows.map(function (row) {
        var obj = {};
        for (var h in headerMap) obj[h] = row[headerMap[h]];
        return obj;
      }).filter(function (obj) {
        return Object.keys(obj).some(function (k) { return obj[k] !== ''; });
      });
    } catch (e) {
      Logger.log('[WorkflowQueryEngine] _readAllRows_ error (' + sheetName + '): ' + e.message);
      return [];
    }
  }

  /**
   * @param {string} workflowId
   * @param {string} [chatId]
   * @returns {object|null}
   */
  function getWorkflow(workflowId, chatId) {
    try {
      var sheet = getSheet_(WORKFLOWS_SHEET);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var headerMap = getHeaderMap_(sheet);
      var idCol = headerMap['workflow_id'];
      if (idCol === undefined) return null;

      var idColumnValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
      var matchedRowIndex = -1;
      for (var i = 0; i < idColumnValues.length; i++) {
        if (String(idColumnValues[i][0]) === String(workflowId)) {
          matchedRowIndex = i;
          break;
        }
      }
      if (matchedRowIndex === -1) return null;

      var numCols = sheet.getLastColumn();
      var rowValues = sheet.getRange(matchedRowIndex + 2, 1, 1, numCols).getValues()[0];
      var workflow = {};
      for (var h in headerMap) workflow[h] = rowValues[headerMap[h]];

      if (chatId && String(workflow.chat_id) !== String(chatId)) return null;
      return workflow;
    } catch (e) {
      Logger.log('[WorkflowQueryEngine] getWorkflow error (' + workflowId + '): ' + e.message);
      return null;
    }
  }

  /**
   * @param {string} [chatId]
   * @param {object} [filters]
   * @returns {object[]}
   */
  function getWorkflows(chatId, filters) {
    var rows = _readAllRows_(WORKFLOWS_SHEET);
    if (chatId) rows = rows.filter(function (w) { return String(w.chat_id) === String(chatId); });
    if (!filters) return rows;
    return rows.filter(function (w) {
      for (var k in filters) {
        if (String(w[k] || '').toUpperCase() !== String(filters[k]).toUpperCase()) return false;
      }
      return true;
    });
  }

  /**
   * Workflow + 它下面全部 Task 的联查（供 WorkflowEngine 的 FINISHED
   * 判定 / Branch 处理使用）。
   * @param {string} workflowId
   * @returns {{workflow:object, tasks:object[]}|null}
   */
  function getWorkflowWithTasks(workflowId) {
    var workflow = getWorkflow(workflowId);
    if (!workflow) return null;
    var tasks = (typeof TaskQueryEngine !== 'undefined')
      ? TaskQueryEngine.getTasksByWorkflow(workflowId)
      : [];
    return { workflow: workflow, tasks: tasks };
  }

  return {
    getWorkflow:          getWorkflow,
    getWorkflows:         getWorkflows,
    getWorkflowWithTasks: getWorkflowWithTasks
  };
})();
