/**
 * 44_TimelineQueryEngine.gs
 * Personal Life OS v5.2 — Timeline Query Engine
 *
 * LIFE_TIMELINE 是 Events 表的投影（Projection），由
 * 10_ProjectionEngine 在处理任何属于本项目的事件时无条件追加一行，
 * 见设计包 00_ADR.gs ADR-2026-07-24-004。本模块只负责读，不负责写。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Timeline 的唯一对外查询入口
 *   Reads                 : LIFE_TIMELINE Sheet
 *   Writes                : none
 *   Public API            : getTimelineForEntity
 *   Dependencies           : 05_SheetUtils.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var TimelineQueryEngine = (function () {

  var TIMELINE_SHEET = 'LIFE_TIMELINE';

  /**
   * 某个实体的完整历史，按时间正序返回。
   * @param {string} entityType  'PROJECT'|'TASK'|'WORKFLOW'|'NOTE'|
   *                              'REVIEW'|'BUSINESS_RULE'|'WORKFLOW_TEMPLATE'
   * @param {string} entityId
   * @returns {object[]}
   */
  function getTimelineForEntity(entityType, entityId) {
    try {
      var sheet = getSheet_(TIMELINE_SHEET);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      var headerMap = getHeaderMap_(sheet);
      var numCols = sheet.getLastColumn();
      var rows = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

      var entries = rows.map(function (row) {
        var obj = {};
        for (var h in headerMap) obj[h] = row[headerMap[h]];
        return obj;
      }).filter(function (obj) {
        return String(obj.entity_type).toUpperCase() === String(entityType).toUpperCase() &&
               String(obj.entity_id) === String(entityId);
      });

      entries.sort(function (a, b) {
        return new Date(a.timestamp) - new Date(b.timestamp);
      });

      return entries;
    } catch (e) {
      Logger.log('[TimelineQueryEngine] getTimelineForEntity error (' + entityType + '/' + entityId + '): ' + e.message);
      return [];
    }
  }

  return {
    getTimelineForEntity: getTimelineForEntity
  };
})();
