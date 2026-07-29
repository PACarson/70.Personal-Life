/**
 * 17_NoteQueryEngine.gs
 * Personal Life OS v5.2 — Note Query Engine（Sprint 3）
 *
 * 本模块是本 OS 里 Notes 表唯一允许直接读取的模块。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Note 的唯一对外查询入口
 *   Reads                 : Notes Sheet
 *   Writes                : none
 *   Public API            : getNote, getNotes, getOpenNotes
 *   Dependencies           : 05_SheetUtils.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var NoteQueryEngine = (function () {

  var NOTES_SHEET = 'Notes';

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
      Logger.log('[NoteQueryEngine] _readAllRows_ error (' + sheetName + '): ' + e.message);
      return [];
    }
  }

  function getNote(noteId, chatId) {
    try {
      var sheet = getSheet_(NOTES_SHEET);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var headerMap = getHeaderMap_(sheet);
      var idCol = headerMap['note_id'];
      if (idCol === undefined) return null;

      var idColumnValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
      var matchedRowIndex = -1;
      for (var i = 0; i < idColumnValues.length; i++) {
        if (String(idColumnValues[i][0]) === String(noteId)) {
          matchedRowIndex = i;
          break;
        }
      }
      if (matchedRowIndex === -1) return null;

      var numCols = sheet.getLastColumn();
      var rowValues = sheet.getRange(matchedRowIndex + 2, 1, 1, numCols).getValues()[0];
      var note = {};
      for (var h in headerMap) note[h] = rowValues[headerMap[h]];

      if (chatId && String(note.chat_id) !== String(chatId)) return null;
      return note;
    } catch (e) {
      Logger.log('[NoteQueryEngine] getNote error (' + noteId + '): ' + e.message);
      return null;
    }
  }

  function getNotes(chatId, filters) {
    var rows = _readAllRows_(NOTES_SHEET);
    if (chatId) rows = rows.filter(function (n) { return String(n.chat_id) === String(chatId); });
    if (!filters) return rows;
    return rows.filter(function (n) {
      for (var k in filters) {
        if (String(n[k] || '').toUpperCase() !== String(filters[k]).toUpperCase()) return false;
      }
      return true;
    });
  }

  function getOpenNotes(chatId) {
    return getNotes(chatId, { status: 'OPEN' });
  }

  return {
    getNote:      getNote,
    getNotes:     getNotes,
    getOpenNotes: getOpenNotes
  };
})();
