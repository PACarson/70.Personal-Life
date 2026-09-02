/**
 * 24_ViewEngine.gs
 * Productivity OS v4.3 — View Engine（V4 新增）
 *
 * 职责：对一批已经在内存里的 task 对象做"这属于哪个视图"的过滤。纯函数——
 * 不读 Sheet，不读 Events。输入永远是 12_TaskQueryEngine.gs 已经批量读出
 * 来的 task 数组。
 *
 * 支持视图（规格书 View Engine 小节全覆盖）：
 *   Today / Tomorrow / This Week / This Month / Upcoming / Overdue /
 *   Recurring / High Priority / Completed / Cancelled / Archived
 *
 * "今天/本周/本月/逾期/即将到来"全都是"以查询发生的这一刻为参照点"的日历
 * 相对计算——跟 05_SheetUtils.isOverdue_ 的判断逻辑同源（同样要处理"纯日期
 * 字符串按本地时区午夜算"的时区坑）。
 */

/**
 * ── Engine Contract（V4.3，按 00_Project_Constitution.gs 零之三标准补全）──
 *   Responsibilities      : 十一种"这个任务属于哪个视图"的过滤规则
 *   Owns                  : Today/Tomorrow/This Week/This Month 等日历相对
 *                           边界的计算方式（_startOfDay_/_endOfDay_/
 *                           _addDays_）
 *   Reads                 : task[]（由调用方传入）
 *   Writes                : none
 *   Public API            : today, tomorrow, thisWeek, thisMonth, upcoming,
 *                           overdue, recurring, highPriority, completed,
 *                           cancelled, archived（均为 (tasks, now?) 签名，
 *                           archived 除外只需 tasks）
 *   Dependencies          : 05_SheetUtils.gs（parseDueDate_/isOverdue_，
 *                           纯计算工具）
 *   Forbidden Dependencies: Sheet, Events, Telegram/Output
 *   Pure Function         : YES（除依赖 `now` 参数默认值为 `new Date()`
 *                           外，不依赖任何隐藏的全局可变状态；传入固定
 *                           `now` 时结果完全确定，可测试）
 *   Replay Events         : NO
 *   Projection            : NO
 *   Thread Safety         : 不需要（无共享可变状态）
 *   Side Effects          : NO
 *   Notes                 : 本 Engine 是 00_ADR.gs ADR-2026-07-06 定义的
 *                           "View/Presentation Layer"的一部分，不落盘，
 *                           永远按需生成（Architecture Principles 第6条）。
 */

var ViewEngine = (function () {

  function _startOfDay_(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function _endOfDay_(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }
  function _addDays_(d, n) {
    var r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function _dueDateOf_(task) {
    if (!task.due_date) return null;
    var d = parseDueDate_(String(task.due_date)); // 05_SheetUtils.gs
    return (d && !isNaN(d.getTime())) ? d : null;
  }

  /**
   * 【Slice 2,2026-09-02 收紧】原来只排除 DONE/CANCELLED 两种状态，跟
   * 20_TaskEngine.gs 别处使用的终态集合（markTaskConverted_ 的
   * terminalStatuses 含 NOT_SELECTED；CONVERTED 单独处理但同样是终态）
   * 不一致。重新核对 10_ProjectionEngine.gs 后确认：目前这【不是】一个
   * 会实际触发的 bug——projectTaskConvertedToProject_/
   * projectTaskNotSelected_ 已经会把这两种状态的 Task 从 ActiveTasks
   * 物理删除，而这个文件的七个高频视图（today/tomorrow/thisWeek/
   * thisMonth/upcoming/overdue/recurring）全部读 ActiveTasks（V4.8 修复），
   * 所以在现有调用路径下不会实际出现 CONVERTED/NOT_SELECTED 任务泄漏进
   * 这些视图的情况。收紧这里纯粹是防御性的：Slice 2 新增的
   * getTaskDashboard() 直接构建在这个函数之上，让它的判定跟真实终态集合
   * 保持一致，不依赖"上游 Sheet 恰好已经把它们删掉了"这个隐藏前提。
   */
  function _isNonTerminal_(task) {
    var s = String(task.status || '').toUpperCase();
    return s !== 'DONE' && s !== 'CANCELLED' && s !== 'CONVERTED' && s !== 'NOT_SELECTED';
  }

  /** Today：due_date 落在今天（不看时间，只看日期部分），且未终结 */
  function today(tasks, now) {
    now = now || new Date();
    var start = _startOfDay_(now).getTime();
    var end   = _endOfDay_(now).getTime();
    return tasks.filter(function (t) {
      if (!_isNonTerminal_(t)) return false;
      var d = _dueDateOf_(t);
      return d && d.getTime() >= start && d.getTime() <= end;
    });
  }

  /** Tomorrow */
  function tomorrow(tasks, now) {
    now = now || new Date();
    var tmr = _addDays_(now, 1);
    var start = _startOfDay_(tmr).getTime();
    var end   = _endOfDay_(tmr).getTime();
    return tasks.filter(function (t) {
      if (!_isNonTerminal_(t)) return false;
      var d = _dueDateOf_(t);
      return d && d.getTime() >= start && d.getTime() <= end;
    });
  }

  /** This Week：从今天到本周日（含），未终结。本周日 = 今天 + (7 - 今天星期数)%7
   *  （今天星期数用 JS Date.getDay()，0=周日；今天正好是周日时 offset=0，当天就是周末）*/
  function thisWeek(tasks, now) {
    now = now || new Date();
    var start = _startOfDay_(now).getTime();
    var offsetToSunday = (7 - now.getDay()) % 7;
    var end = _endOfDay_(_addDays_(now, offsetToSunday)).getTime();
    return tasks.filter(function (t) {
      if (!_isNonTerminal_(t)) return false;
      var d = _dueDateOf_(t);
      return d && d.getTime() >= start && d.getTime() <= end;
    });
  }

  /** This Month：从今天到本月最后一天（含），未终结 */
  function thisMonth(tasks, now) {
    now = now || new Date();
    var start = _startOfDay_(now).getTime();
    var lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0); // 下月第0天=本月最后一天
    var end = _endOfDay_(lastDay).getTime();
    return tasks.filter(function (t) {
      if (!_isNonTerminal_(t)) return false;
      var d = _dueDateOf_(t);
      return d && d.getTime() >= start && d.getTime() <= end;
    });
  }

  /** Upcoming：今天之后（不含今天）、未终结、有 due_date，按 due_date 升序 */
  function upcoming(tasks, now) {
    now = now || new Date();
    var todayEnd = _endOfDay_(now).getTime();
    return tasks
      .filter(function (t) {
        if (!_isNonTerminal_(t)) return false;
        var d = _dueDateOf_(t);
        return d && d.getTime() > todayEnd;
      })
      .sort(function (a, b) { return _dueDateOf_(a).getTime() - _dueDateOf_(b).getTime(); });
  }

  /** Overdue：due_date 已过、未终结（跟 05_SheetUtils.isOverdue_ 语义一致） */
  function overdue(tasks) {
    return tasks.filter(function (t) {
      if (!_isNonTerminal_(t)) return false;
      return isOverdue_(t.due_date); // 05_SheetUtils.gs
    });
  }

  /** Recurring：recurring 字段非空、未终结 */
  function recurring(tasks) {
    return tasks.filter(function (t) {
      return _isNonTerminal_(t) && !!t.recurring;
    });
  }

  /** High Priority：manual priority 是 HIGH 或 CRITICAL、未终结 */
  function highPriority(tasks) {
    var highSet = { 'HIGH': true, 'CRITICAL': true };
    return tasks.filter(function (t) {
      return _isNonTerminal_(t) && highSet[String(t.priority || '').toUpperCase()];
    });
  }

  function completed(tasks) {
    return tasks.filter(function (t) { return String(t.status || '').toUpperCase() === 'DONE'; });
  }

  function cancelled(tasks) {
    return tasks.filter(function (t) { return String(t.status || '').toUpperCase() === 'CANCELLED'; });
  }

  /**
   * Archived：Tasks Sheet 里 archived=true 的行（不是 ArchiveTasks 表本身——
   * 那张表的读取由 13_ActiveTasksEngine.getArchivedTasks 负责，是独立的
   * 冷存储读取路径，跟这里"在 Tasks 全量结果里筛出已归档标记"是两条不同
   * 的路，供 12_TaskQueryEngine 按需选择）。
   */
  function archived(tasks) {
    return tasks.filter(function (t) {
      var v = t.archived;
      return v === true || v === 'TRUE' || v === 'true';
    });
  }

  return {
    today:        today,
    tomorrow:     tomorrow,
    thisWeek:     thisWeek,
    thisMonth:    thisMonth,
    upcoming:     upcoming,
    overdue:      overdue,
    recurring:    recurring,
    highPriority: highPriority,
    completed:    completed,
    cancelled:    cancelled,
    archived:     archived
  };
})();
