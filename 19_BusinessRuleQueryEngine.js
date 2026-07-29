/**
 * 19_BusinessRuleQueryEngine.gs
 * Personal Life OS v5.2 — BusinessRule Query Engine（Sprint 3）
 *
 * 覆盖三层模型里的两张表：BusinessRules（顶层分类）+
 * WorkflowTemplates（具体版本），见设计包 00_ADR.gs
 * ADR-2026-07-24-011。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : BusinessRule + WorkflowTemplate 的唯一
 *                           对外查询入口
 *   Reads                 : BusinessRules Sheet + WorkflowTemplates Sheet
 *   Writes                : none
 *   Public API            : getBusinessRule, findByTags,
 *                           getWorkflowTemplate, getTemplatesForRule,
 *                           getActiveTemplateForRule
 *   Dependencies           : 05_SheetUtils.gs
 *   Pure Function            : NO（读 Sheet）
 *   Side Effects              : NO
 */

var BusinessRuleQueryEngine = (function () {

  var BUSINESS_RULES_SHEET = 'BusinessRules';
  var WORKFLOW_TEMPLATES_SHEET = 'WorkflowTemplates';

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
      Logger.log('[BusinessRuleQueryEngine] _readAllRows_ error (' + sheetName + '): ' + e.message);
      return [];
    }
  }

  function _getByKey_(sheetName, keyField, keyValue) {
    var rows = _readAllRows_(sheetName);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][keyField]) === String(keyValue)) return rows[i];
    }
    return null;
  }

  // ============ BusinessRule（顶层分类） ============

  function getBusinessRule(ruleId) {
    return _getByKey_(BUSINESS_RULES_SHEET, 'rule_id', ruleId);
  }

  /**
   * V1 匹配算法（见 00_Business_Rules.gs「三」）：标签交集 + 名称
   * 关键词包含，两者按固定权重排序，只返回 status='ACTIVE' 的规则。
   * @param {string[]} queryTags
   * @returns {object[]}  按匹配度降序，每个元素附带 _match_score 和
   *                       _matched_tags
   */
  function findByTags(queryTags) {
    queryTags = (queryTags || []).map(function (t) { return String(t).toLowerCase().trim(); });

    var rules = _readAllRows_(BUSINESS_RULES_SHEET).filter(function (r) {
      return String(r.status || '').toUpperCase() === 'ACTIVE';
    });

    var scored = rules.map(function (rule) {
      var ruleTags = String(rule.tags || '').toLowerCase().split(',').map(function (t) { return t.trim(); }).filter(Boolean);
      var matchedTags = ruleTags.filter(function (t) { return queryTags.indexOf(t) !== -1; });
      var nameMatch = queryTags.some(function (t) { return String(rule.name || '').toLowerCase().indexOf(t) !== -1; });

      // 交集数量权重更高（每个 +10），标题关键词命中权重较低（+1）——
      // 见 00_Business_Rules.gs「三」"交集数量权重高于子串匹配"
      var score = matchedTags.length * 10 + (nameMatch ? 1 : 0);

      return { rule: rule, score: score, matchedTags: matchedTags };
    }).filter(function (s) { return s.score > 0; });

    scored.sort(function (a, b) { return b.score - a.score; });

    return scored.map(function (s) {
      var result = shallowCopy_(s.rule);
      result._match_score = s.score;
      result._matched_tags = s.matchedTags;
      return result;
    });
  }

  // ============ WorkflowTemplate（具体版本） ============

  function getWorkflowTemplate(templateId) {
    return _getByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', templateId);
  }

  function getTemplatesForRule(ruleId) {
    return _readAllRows_(WORKFLOW_TEMPLATES_SHEET).filter(function (t) {
      return String(t.business_rule_id) === String(ruleId);
    });
  }

  /**
   * 返回某个 BusinessRule 下 status='ACTIVE' 的那一个版本。正常情况下
   * 同一 business_rule_id 下恰好只有一行是 ACTIVE；若查询到多于一行，
   * 属于数据不一致，记录告警而不是随便返回其中一个（见设计包
   * 00_Module_Responsibility.gs「九」）。
   * @param {string} ruleId
   * @returns {object|null}
   */
  function getActiveTemplateForRule(ruleId) {
    var activeOnes = getTemplatesForRule(ruleId).filter(function (t) {
      return String(t.status || '').toUpperCase() === 'ACTIVE';
    });

    if (activeOnes.length > 1) {
      Logger.log('[BusinessRuleQueryEngine] ⚠️ 数据不一致：business_rule_id=' + ruleId +
        ' 下有 ' + activeOnes.length + ' 个 ACTIVE 版本（应该恰好 1 个）。返回其中版本号最大的一个，' +
        '但这个情况本身需要人工核查——可能是某次 capture 的 FROZEN 转换没有正确执行。');
      activeOnes.sort(function (a, b) { return Number(b.version) - Number(a.version); });
    }

    return activeOnes.length > 0 ? activeOnes[0] : null;
  }

  return {
    getBusinessRule:         getBusinessRule,
    findByTags:              findByTags,
    getWorkflowTemplate:     getWorkflowTemplate,
    getTemplatesForRule:     getTemplatesForRule,
    getActiveTemplateForRule: getActiveTemplateForRule
  };
})();
