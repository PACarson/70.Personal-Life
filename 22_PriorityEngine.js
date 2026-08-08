/**
 * 22_PriorityEngine.gs
 * Personal Life OS v5.2 — Priority Engine
 *
 * 【Sprint 4 新增】suggestPriorityWithAI_()——真正调用 AI（经
 * 46_AIConnector.gs）对任务做优先级推理，写入 Task 的
 * priority_ai_recommended 字段（见 00_ADR.gs ADR-2026-07-24-009）。
 * 跟既有 suggestPriority() 是两回事，不是取代关系：
 *   suggestPriority()        — 纯规则/公式（urgency+importance
 *                              加权），瞬时、免费、确定性，任何时候
 *                              都能算
 *   suggestPriorityWithAI_() — 真正调用 LLM，能考虑公式抓不到的
 *                              上下文（"这个任务在堵着老板的项目"这
 *                              类语义信息），但有网络延迟、有调用
 *                              成本、结果不是每次都完全一样
 * 两者都只产出"建议"，都不会自动覆盖 priority_user——见
 * 00_Data_Ownership.gs「四」"User 永远拥有最终 Priority"。
 *
 * 既有 computeUrgencyScore/computePriorityScore/suggestPriority/
 * rankByPriority 逐行核对，原样不变。
 *
 * 架构铁律（不变）：
 *  - 纯函数模块（除新增的 suggestPriorityWithAI_ 外——那个函数发起
 *    真实网络请求，不是纯函数，其余不变）
 *  - 不读写 Sheet，不调 EventBus
 *  - 输入是 12_TaskQueryEngine 返回的任务数组，输出是打了分/排序过的
 *    同一批数据
 */

/**
 * ── Engine Contract（既有部分不变，新增部分见下）──────────────────────
 *   Responsibilities      : 计算任务的优先级评分/建议/排序
 *   Owns                  : 优先级计算公式（urgency + importance 加权）
 *   Reads                 : none（纯函数，接收调用方传入的任务数组）
 *   Writes                : none（纯函数不写任何东西；
 *                           suggestPriorityWithAI_ 也不直接写 Sheet——
 *                           返回建议值，由调用方决定是否要通过
 *                           20_TaskEngine.updateTask 写入
 *                           priority_ai_recommended）
 *   Public API            : computeUrgencyScore, computePriorityScore,
 *                           suggestPriority, rankByPriority,
 *                           suggestPriorityWithAI_（Sprint 4 新增）
 *   Dependencies           : 46_AIConnector.gs（仅
 *                           suggestPriorityWithAI_ 使用）
 *   Forbidden Dependencies  : Sheet, Events
 *   Pure Function            : 既有四个函数 YES；
 *                           suggestPriorityWithAI_ 本身 NO（发起
 *                           真实网络请求）
 *   Side Effects              : 既有四个函数 NO；
 *                           suggestPriorityWithAI_ 有（网络请求）
 */

var PriorityEngine = (function () {

  var URGENCY_WEIGHTS = {
    OVERDUE:       100,
    DUE_TODAY:      80,
    DUE_TOMORROW:   60,
    DUE_THIS_WEEK:  40,
    DUE_LATER:      20,
    NO_DUE_DATE:     0
  };

  var IMPORTANCE_WEIGHTS = {
    CRITICAL: 100,
    HIGH:      70,
    MEDIUM:    40,
    LOW:       10
  };

  /**
   * 根据 due_date（相对今天）算紧急度分数。
   * @param {string} dueDate  'yyyy-MM-dd'，可空
   * @returns {number}
   */
  function computeUrgencyScore(dueDate) {
    if (!dueDate) return URGENCY_WEIGHTS.NO_DUE_DATE;

    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var due = new Date(dueDate);
    var todayDate = new Date(today);
    var diffDays = Math.round((due.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays < 0) return URGENCY_WEIGHTS.OVERDUE;
    if (diffDays === 0) return URGENCY_WEIGHTS.DUE_TODAY;
    if (diffDays === 1) return URGENCY_WEIGHTS.DUE_TOMORROW;
    if (diffDays <= 7) return URGENCY_WEIGHTS.DUE_THIS_WEEK;
    return URGENCY_WEIGHTS.DUE_LATER;
  }

  /**
   * 综合紧急度（due_date）+ 重要度（priority）算总分。
   * @param {object} task
   * @returns {number}
   */
  function computePriorityScore(task) {
    var urgency = computeUrgencyScore(task.due_date);
    var importance = IMPORTANCE_WEIGHTS[String(task.priority || 'MEDIUM').toUpperCase()] || IMPORTANCE_WEIGHTS.MEDIUM;
    return urgency * 0.6 + importance * 0.4;
  }

  /**
   * 单个任务的建议优先级（HIGH/MEDIUM/LOW），基于 computePriorityScore
   * 的分数区间。
   * @param {object} task
   * @returns {string}
   */
  function suggestPriority(task) {
    var score = computePriorityScore(task);
    if (score >= 70) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * 给一批任务打分并按分数降序排列，每个元素附带 _priority_score。
   * @param {object[]} tasks
   * @returns {object[]}
   */
  function rankByPriority(tasks) {
    return tasks
      .map(function (t) {
        var withScore = shallowCopy_(t);
        withScore._priority_score = computePriorityScore(t);
        return withScore;
      })
      .sort(function (a, b) { return b._priority_score - a._priority_score; });
  }

  // ============ Sprint 4 新增：AI 版优先级建议 ============

  /**
   * 真正调用 AI（经 46_AIConnector.gs）对任务做优先级推理。跟
   * suggestPriority() 的区别见文件头。只返回建议值，不写入任何
   * Sheet——调用方（比如 06_TaskIntentParser 或未来的批处理任务）
   * 决定要不要通过 20_TaskEngine.updateTask 把结果写进
   * priority_ai_recommended。
   *
   * @param {object} task              需要建议优先级的任务（至少要有
   *                                   title，due_date/notes/
   *                                   description 有则更准）
   * @param {object} [relatedContext]  可选，{ project_title,
   *                                   sibling_task_titles } 这类额外
   *                                   上下文，帮助 AI 判断"这个任务
   *                                   在更大的事情里处于什么位置"
   * @returns {{priority: string, reasoning: string}}  priority 取值
   *                                   HIGH/MEDIUM/LOW；reasoning 是
   *                                   AI 给出的简短理由，方便展示给
   *                                   用户参考（不只是给一个结论）
   * @throws {Error}  见 46_AIConnector.gs 的 callAIForJSON_ 可能抛出
   *                  的错误（AI_NOT_CONFIGURED/AI_API_ERROR/
   *                  AI_RESPONSE_NOT_JSON 等）
   */
  function suggestPriorityWithAI_(task, relatedContext) {
    relatedContext = relatedContext || {};

    var ruleBasedSuggestion = suggestPriority(task); // 作为 AI 参考的一个输入，不是最终答案

    var prompt =
      '你在帮用户判断一个待办任务的优先级。只回复 JSON，不要任何其它文字，格式：\n' +
      '{"priority": "HIGH"|"MEDIUM"|"LOW", "reasoning": "一句话理由（中文，20字以内）"}\n\n' +
      '任务标题：' + task.title + '\n' +
      (task.due_date ? ('截止日期：' + task.due_date + '\n') : '') +
      (task.notes ? ('备注：' + task.notes + '\n') : '') +
      (task.description ? ('描述：' + task.description + '\n') : '') +
      (relatedContext.project_title ? ('所属项目：' + relatedContext.project_title + '\n') : '') +
      (relatedContext.sibling_task_titles && relatedContext.sibling_task_titles.length
        ? ('同项目下其它任务：' + relatedContext.sibling_task_titles.join('、') + '\n') : '') +
      '仅基于纯公式（到期日+已设优先级）算出的参考值是：' + ruleBasedSuggestion + '（你可以同意，也可以基于上面的上下文给出不同判断）';

    var result = AIConnector.callAIForJSON_(prompt);

    var validPriorities = ['HIGH', 'MEDIUM', 'LOW'];
    if (validPriorities.indexOf(result.priority) === -1) {
      throw new Error('AI_RESPONSE_INVALID: AI 回复的 priority 不是 HIGH/MEDIUM/LOW，原始回复: ' + JSON.stringify(result));
    }

    return { priority: result.priority, reasoning: result.reasoning || '' };
  }

  return {
    computeUrgencyScore:     computeUrgencyScore,
    computePriorityScore:    computePriorityScore,
    suggestPriority:         suggestPriority,
    rankByPriority:          rankByPriority,
    suggestPriorityWithAI_:  suggestPriorityWithAI_
  };
})();