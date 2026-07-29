/**
 * 18_ReviewQueryEngine.gs
 * Personal Life OS v5.2 — Review Query Engine（Sprint 3）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Review 的唯一对外查询入口
 *   Reads                 : Reviews Sheet
 *   Writes                : none
 *   Public API            : getLatestReview, getReviewHistory
 *   Dependencies           : 05_SheetUtils.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var ReviewQueryEngine = (function () {

  var REVIEWS_SHEET = 'Reviews';

  function _readAllRows_() {
    try {
      var sheet = getSheet_(REVIEWS_SHEET);
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
      Logger.log('[ReviewQueryEngine] _readAllRows_ error: ' + e.message);
      return [];
    }
  }

  /**
   * 某种类型最近一次生成的 Review。注意：Reviews 表本身没有
   * chat_id 列（见 00_Sheets_Structure.gs「七」——Review 几乎总是
   * 系统批量生成，不追踪"谁的"），单用户场景下不需要按 chat_id 过滤；
   * 如果未来变成多用户，这里需要重新设计。
   * @param {string} reviewType  'DAILY'|'WEEKLY'|'MONTHLY'
   * @returns {object|null}
   */
  function getLatestReview(reviewType) {
    var matches = _readAllRows_().filter(function (r) {
      return String(r.review_type).toUpperCase() === String(reviewType).toUpperCase();
    });
    if (matches.length === 0) return null;

    matches.sort(function (a, b) { return new Date(b.created_time) - new Date(a.created_time); });
    return matches[0];
  }

  /**
   * @param {string} [reviewType]  不传则返回全部类型
   * @param {number} [limit]       不传则不限制
   * @returns {object[]}  按 created_time 降序（最新的在前）
   */
  function getReviewHistory(reviewType, limit) {
    var rows = _readAllRows_();
    if (reviewType) {
      rows = rows.filter(function (r) { return String(r.review_type).toUpperCase() === String(reviewType).toUpperCase(); });
    }
    rows.sort(function (a, b) { return new Date(b.created_time) - new Date(a.created_time); });
    return limit ? rows.slice(0, limit) : rows;
  }

  return {
    getLatestReview:  getLatestReview,
    getReviewHistory: getReviewHistory
  };
})();
