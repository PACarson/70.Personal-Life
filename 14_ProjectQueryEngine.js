/**
 * 14_ProjectQueryEngine.gs
 * Personal Life OS v5.2 — Project Query Engine
 *
 * 本模块是本 OS 里 Projects 表唯一允许直接读取的模块（跟
 * 12_TaskQueryEngine.gs 之于 Tasks 表是同一条铁律，只是按实体分别
 * 唯一，见设计包 00_Domain_Boundary.gs「二」对这条延伸的论证）。
 *
 * 架构铁律：
 *  - 绝对禁止读 Events 表 / 调 EventBus
 *  - 绝对禁止读其它实体的 Sheet（需要 Task 数据时调用
 *    TaskQueryEngine，不是自己去读 Tasks）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Project 的唯一对外查询入口
 *   Owns                  : Project 的查询过滤/排序逻辑
 *   Reads                 : Projects Sheet
 *   Writes                : none
 *   Public API            : getProject, getProjects, getActiveProjects,
 *                           getProjectsByParent
 *   Dependencies           : 05_SheetUtils.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var ProjectQueryEngine = (function () {

  var PROJECTS_SHEET = 'Projects';
  var NON_TERMINAL = ['DRAFT', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED'];

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
      Logger.log('[ProjectQueryEngine] _readAllRows_ error (' + sheetName + '): ' + e.message);
      return [];
    }
  }

  function _readAllProjects_(chatId) {
    var rows = _readAllRows_(PROJECTS_SHEET);
    if (!chatId) return rows;
    return rows.filter(function (p) { return String(p.chat_id) === String(chatId); });
  }

  /**
   * 按 project_id 查单个项目（两步查找：先定位行号，再读整行，跟
   * 12_TaskQueryEngine.getTask 同一套性能考虑）。
   * @param {string} projectId
   * @param {string} [chatId]  传入时额外校验 chat_id 匹配
   * @returns {object|null}
   */
  function getProject(projectId, chatId) {
    try {
      var sheet = getSheet_(PROJECTS_SHEET);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var headerMap = getHeaderMap_(sheet);
      var idCol = headerMap['project_id'];
      if (idCol === undefined) return null;

      var idColumnValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
      var matchedRowIndex = -1;
      for (var i = 0; i < idColumnValues.length; i++) {
        if (String(idColumnValues[i][0]) === String(projectId)) {
          matchedRowIndex = i;
          break;
        }
      }
      if (matchedRowIndex === -1) return null;

      var numCols = sheet.getLastColumn();
      var rowValues = sheet.getRange(matchedRowIndex + 2, 1, 1, numCols).getValues()[0];
      var project = {};
      for (var h in headerMap) project[h] = rowValues[headerMap[h]];

      if (chatId && String(project.chat_id) !== String(chatId)) return null;
      return project;
    } catch (e) {
      Logger.log('[ProjectQueryEngine] getProject error (' + projectId + '): ' + e.message);
      return null;
    }
  }

  /**
   * 通用查询：按任意字段做简单等值过滤。
   * @param {string} [chatId]
   * @param {object} [filters]
   * @returns {object[]}
   */
  function getProjects(chatId, filters) {
    var projects = _readAllProjects_(chatId);
    if (!filters) return projects;
    return projects.filter(function (p) {
      for (var k in filters) {
        if (String(p[k] || '').toUpperCase() !== String(filters[k]).toUpperCase()) return false;
      }
      return true;
    });
  }

  /**
   * 非终态（DRAFT/READY/IN_PROGRESS/WAITING/BLOCKED）的 Project。
   * @param {string} [chatId]
   * @returns {object[]}
   */
  function getActiveProjects(chatId) {
    return _readAllProjects_(chatId).filter(function (p) {
      return NON_TERMINAL.indexOf(String(p.status || '').toUpperCase()) !== -1;
    });
  }

  /**
   * 某个 Project 下的全部直接 Sub-Project（不递归）。
   * @param {string} parentProjectId
   * @returns {object[]}
   */
  function getProjectsByParent(parentProjectId) {
    return _readAllRows_(PROJECTS_SHEET).filter(function (p) {
      return String(p.parent_project_id || '') === String(parentProjectId);
    });
  }

  return {
    getProject:          getProject,
    getProjects:         getProjects,
    getActiveProjects:   getActiveProjects,
    getProjectsByParent: getProjectsByParent
  };
})();
