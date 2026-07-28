/**
 * 40_ReviewEngine.gs
 * Personal Life OS v5.2 — Review Engine（Sprint 3）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「五」、
 * 00_Business_Rules.gs「五」（时间窗口定义）。
 *
 * 职责：生成 Daily/Weekly/Monthly Review（完成数/延期数/AI 建议
 * 文案），只读汇总，不修改任何 Task/Project 状态。
 *
 * 范围边界：本 Review 只回顾本 Domain 自己的数据，不聚合任何其它
 * Domain（那是 Life Execution OS 的 Execution Review 的事，见
 * 00_Domain_Boundary.gs「五」的辨析）。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 生成 Daily/Weekly/Monthly Review
 *   Owns                  : review_type 枚举；每种 Review 的统计口径
 *                           （时间窗口定义）
 *   Reads                 : TaskQueryEngine（完成率原始数据）+
 *                           ProjectQueryEngine（Project 层面进展）
 *   Writes                : Events（REVIEW_GENERATED）
 *   Public API            : generateDailyReview, generateWeeklyReview,
 *                           generateMonthlyReview
 *   Dependencies           : 12_TaskQueryEngine.gs、
 *                           14_ProjectQueryEngine.gs、
 *                           26_AnalyticsEngine.gs
 *   Forbidden Dependencies  : Sheet 直接读写、Task/Project 的任何写操作
 *   Pure Function            : 部分（统计部分是纯函数；AI Review Hook
 *                           部分本版本恒为空字符串，见 Notes）
 *   Side Effects              : YES（发布 Event）
 */

var LifeReviewConfig = Object.freeze({
  REVIEWS_SHEET_NAME: 'Reviews',
  REVIEW_TYPES: ['DAILY', 'WEEKLY', 'MONTHLY']
});

var ReviewEngine = (function () {

  var CFG = LifeReviewConfig;

  function _formatDate_(date) {
    var tz = Session.getScriptTimeZone();
    return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  }

  /**
   * 计算某个 review_type 的时间窗口 [periodStart, periodEnd]（均为
   * 'yyyy-MM-dd' 字符串），定义见 00_Business_Rules.gs「五」：
   *   DAILY   — 昨天一整天
   *   WEEKLY  — 过去 7 个自然日（滚动窗口，不对齐周一）
   *   MONTHLY — 过去一个完整自然月（滚动窗口，不是自然月 1 号到月底）
   */
  function _computeWindow_(reviewType) {
    var now = new Date();
    var end, start;

    if (reviewType === 'DAILY') {
      end = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      start = end;
    } else if (reviewType === 'WEEKLY') {
      end = now;
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else { // MONTHLY
      end = now;
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
    }

    return { periodStart: _formatDate_(start), periodEnd: _formatDate_(end) };
  }

  /**
   * 在给定窗口内统计完成/延期数量。只统计有 due_date 落在窗口内、或
   * completed_at 落在窗口内的 Task——避免把整个历史 Tasks 表都算进
   * "本次 Review"的完成数里。
   */
  function _summarizeTasksInWindow_(tasks, periodStart, periodEnd) {
    var completed = 0;
    var deferred = 0; // 有 due_date 但还没完成、且 due_date 已经过了窗口终点（逾期未完成）

    tasks.forEach(function (t) {
      var status = String(t.status || '').toUpperCase();
      if (status === 'DONE' && t.completed_at) {
        var completedDate = t.completed_at.slice(0, 10);
        if (completedDate >= periodStart && completedDate <= periodEnd) {
          completed++;
        }
      } else if (t.due_date && t.due_date < periodEnd &&
                 ['PENDING', 'BLOCKED', 'WAITING'].indexOf(status) !== -1) {
        deferred++;
      }
    });

    return { completed: completed, deferred: deferred };
  }

  function _generate_(reviewType, chatId) {
    var window = _computeWindow_(reviewType);
    var tasks = TaskQueryEngine.getTasks(chatId, {});
    var summary = _summarizeTasksInWindow_(tasks, window.periodStart, window.periodEnd);

    var activeProjects = ProjectQueryEngine.getActiveProjects(chatId);

    var summaryStats = {
      completed: summary.completed,
      deferred:  summary.deferred,
      active_projects: activeProjects.length
    };

    var review = {
      review_id:        generateReviewId_(),
      review_type:      reviewType,
      period_start:     window.periodStart,
      period_end:       window.periodEnd,
      summary_stats:    JSON.stringify(summaryStats),
      ai_review_notes:  '', // 预留，本版本恒为空，见 Notes
      created_time:     new Date().toISOString()
    };

    EventBus.publish('REVIEW_GENERATED', review, chatId, 'ReviewEngine');

    return review;
  }

  function generateDailyReview(chatId)   { return _generate_('DAILY', chatId); }
  function generateWeeklyReview(chatId)  { return _generate_('WEEKLY', chatId); }
  function generateMonthlyReview(chatId) { return _generate_('MONTHLY', chatId); }

  // ============ 派生引擎 ============

  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    if (event.type === 'REVIEW_GENERATED') {
      stateMap[p.review_id] = shallowCopy_(p);
    }
    return stateMap;
  }

  function materializeReviewRow_(reviewId, knownReview) {
    if (!knownReview) return;
    upsertRowByKey_(CFG.REVIEWS_SHEET_NAME, 'review_id', reviewId, knownReview);
  }

  // ============ 内部工具 ============

  function generateReviewId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'REV-' + today + '-' + uniqueSuffix;
  }

  return {
    generateDailyReview:    generateDailyReview,
    generateWeeklyReview:   generateWeeklyReview,
    generateMonthlyReview:  generateMonthlyReview,
    deriveFromEvent:        deriveFromEvent,
    materializeReviewRow_:  materializeReviewRow_
  };
})();

/**
 * Notes: "AI Review Hook" 是预留接口，不是已实现能力——
 * ai_review_notes 本版本恒为空字符串。等真正接入 AI 生成建议时
 * （Sprint 4 AI 范围），在 _generate_ 内部这一行填入真正调用 AI 的
 * 结果即可，本文件其它部分不需要改动。
 */
