/**
 * 62_Tests_ViewEngine.gs
 * Personal Life OS —— 24_ViewEngine.gs Deterministic Coverage
 * 2026-10-06 新增，Carson 明确授权的 TEST-ONLY 工作项（Testing Coverage，
 * Scope Decision：23/24/25/26 四个纯函数 Engine）。
 *
 * 全部是纯内存数据，不读 Sheet、不调外部 API。today/tomorrow/thisWeek/
 * thisMonth/upcoming 都传入固定的 `now`（Engine Contract 明确写了"传入
 * 固定 now 时结果完全确定，可测试"），日期全部是写死的日历日期，不依赖
 * 运行当天。
 *
 * 唯一例外：overdue(tasks) 没有 `now` 参数，内部走 05_SheetUtils.isOverdue_
 * （读真实当前时间），所以 overdue 相关用例的日期相对"运行时真实今天"
 * 现算（跟 60_Tests_PriorityEngineBoundaries 同样的处理方式）。
 *
 * 行为证据（三者一致才测，见 Scope Decision 第 2 节）：
 *   Engine Contract  : 24_ViewEngine.gs 文件头 Engine Contract
 *   Command Reference: 00_Command_Reference.gs G2(a) + V1/V2/V3/V4/V5/V7
 *   Production Code  : 24_ViewEngine.js
 *
 * 覆盖：today / tomorrow / thisWeek / 周日窗口边界 / thisMonth / 月末边界 /
 *       upcoming / 终结态排除（DONE、CANCELLED）/ recurring / highPriority /
 *       completed / cancelled / archived / overdue
 *
 * 状态说明（逐项按这三类证据标注，不是统一口径）：
 *   - today/tomorrow/thisWeek/thisMonth/upcoming/overdue/recurring：
 *     三个来源一致。
 *   - highPriority：Engine Contract + 代码一致；Command Reference 的
 *     /priority 走 12_TaskQueryEngine.getPriorityTasks，不经过
 *     ViewEngine.highPriority，没有对应条目（不冲突，但这一项只有两个来源）。
 *   - completed/cancelled/archived：Engine Contract Public API + 代码一致；
 *     Command Reference 没有映射到 ViewEngine 这三个函数（V9/V10 走
 *     12_TaskQueryEngine/13_ActiveTasksEngine），同样只有两个来源。
 *
 * BLOCKED（本轮没有实现，原因见 Final Report D 项）：
 *   - CONVERTED / NOT_SELECTED 的终态排除：_isNonTerminal_ 代码和文件内
 *     注释把这两个状态也算终态（2026-09-02 Slice 2 收紧），但
 *     00_Command_Reference.gs G2(a) 写的是"一律排除 DONE 或 CANCELLED"，
 *     没有包含这两个状态——Command Reference 与代码/Engine 注释之间有
 *     出入，按 Scope Decision 第 7 节，这一条单独 BLOCKED，不自行选版本。
 *
 * 单一入口 runViewEngineCoverageGate()。
 */

// ============================================================
// 工具（前缀 _vw，避免跟全局其他文件重名）
// ============================================================
function _vwCheck_(st, cond, msg) {
  if (!cond) {
    Logger.log('❌ ' + msg);
    st.pass = false;
  }
}
function _vwIds_(arr) {
  return arr.map(function (t) { return t.task_id; });
}
function _vwSame_(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function _vwTask_(id, overrides) {
  var base = { task_id: id, title: id, status: 'PENDING', due_date: '', recurring: '', priority: 'MEDIUM' };
  if (overrides) {
    Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
  }
  return base;
}
// 固定的"现在"：本地时区的某年某月某日 12:00（月份是 1-12）
function _vwNow_(y, m, d) {
  return new Date(y, m - 1, d, 12, 0, 0);
}
function _vwPad_(n) { return (n < 10 ? '0' : '') + n; }
// 相对"运行时真实今天"的 yyyy-MM-dd（只给 overdue 用例用）
function _vwRelDate_(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + _vwPad_(d.getMonth() + 1) + '-' + _vwPad_(d.getDate());
}
function _vwWrap_(name, fn) {
  Logger.log('--- ' + name + ' 开始 ---');
  var st = { pass: true };
  try {
    fn(st);
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    st.pass = false;
  }
  Logger.log(st.pass ? '✅ ' + name + ' PASS' : '❌ ' + name + ' FAIL');
  return st.pass;
}

// 固定日历：2026-10-06 周二 / 10-07 周三 / 10-11 周日 / 10-12 周一
// ============================================================
// 一、today
// ============================================================
function testViewEngine_Today_() {
  return _vwWrap_('testViewEngine_Today_', function (st) {
    var now = _vwNow_(2026, 10, 7); // 周三
    var tasks = [
      _vwTask_('YESTERDAY',  { due_date: '2026-10-06' }),
      _vwTask_('TODAY_PLAIN', { due_date: '2026-10-07' }),
      _vwTask_('TODAY_START', { due_date: '2026-10-07T00:00:00' }),
      _vwTask_('TODAY_END',   { due_date: '2026-10-07T23:59:59' }),
      _vwTask_('TOMORROW',   { due_date: '2026-10-08' }),
      _vwTask_('NO_DUE',     { due_date: '' })
    ];
    var got = _vwIds_(ViewEngine.today(tasks, now));
    _vwCheck_(st, _vwSame_(got, ['TODAY_PLAIN', 'TODAY_START', 'TODAY_END']),
      'today 只应含当天（不管带不带具体时间），实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 二、tomorrow
// ============================================================
function testViewEngine_Tomorrow_() {
  return _vwWrap_('testViewEngine_Tomorrow_', function (st) {
    var now = _vwNow_(2026, 10, 7);
    var tasks = [
      _vwTask_('TODAY',       { due_date: '2026-10-07' }),
      _vwTask_('TMR_PLAIN',   { due_date: '2026-10-08' }),
      _vwTask_('TMR_TIMED',   { due_date: '2026-10-08T09:30:00' }),
      _vwTask_('DAY_AFTER',   { due_date: '2026-10-09' })
    ];
    var got = _vwIds_(ViewEngine.tomorrow(tasks, now));
    _vwCheck_(st, _vwSame_(got, ['TMR_PLAIN', 'TMR_TIMED']),
      'tomorrow 只应含明天，实际 ' + JSON.stringify(got));
    // 月末跨月：10-31 的"明天"是 11-01
    var tasks2 = [
      _vwTask_('OCT31', { due_date: '2026-10-31' }),
      _vwTask_('NOV01', { due_date: '2026-11-01' })
    ];
    var got2 = _vwIds_(ViewEngine.tomorrow(tasks2, _vwNow_(2026, 10, 31)));
    _vwCheck_(st, _vwSame_(got2, ['NOV01']),
      '10-31 的 tomorrow 应跨月到 11-01，实际 ' + JSON.stringify(got2));
  });
}

// ============================================================
// 三、thisWeek（从今天到本周日，含；前瞻窗口，已过去的日子不含）
// ============================================================
function testViewEngine_ThisWeek_() {
  return _vwWrap_('testViewEngine_ThisWeek_', function (st) {
    var now = _vwNow_(2026, 10, 7); // 周三，本周日 = 10-11
    var tasks = [
      _vwTask_('PAST_MON', { due_date: '2026-10-05' }),
      _vwTask_('PAST_TUE', { due_date: '2026-10-06' }),
      _vwTask_('WED',      { due_date: '2026-10-07' }),
      _vwTask_('FRI',      { due_date: '2026-10-09' }),
      _vwTask_('SUN',      { due_date: '2026-10-11' }),
      _vwTask_('SUN_LATE', { due_date: '2026-10-11T23:59:59' }),
      _vwTask_('NEXT_MON', { due_date: '2026-10-12' })
    ];
    var got = _vwIds_(ViewEngine.thisWeek(tasks, now));
    _vwCheck_(st, _vwSame_(got, ['WED', 'FRI', 'SUN', 'SUN_LATE']),
      'thisWeek（周三）应含 周三~周日（含），不含已过去的周一二和下周一，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 四、周日窗口边界
// ============================================================
function testViewEngine_ThisWeekSundayBoundary_() {
  return _vwWrap_('testViewEngine_ThisWeekSundayBoundary_', function (st) {
    // 今天正好是周日：offset=0，窗口只有当天
    var sunday = _vwNow_(2026, 10, 11);
    var tasksSun = [
      _vwTask_('SAT',      { due_date: '2026-10-10' }),
      _vwTask_('SUN',      { due_date: '2026-10-11' }),
      _vwTask_('NEXT_MON', { due_date: '2026-10-12' })
    ];
    var gotSun = _vwIds_(ViewEngine.thisWeek(tasksSun, sunday));
    _vwCheck_(st, _vwSame_(gotSun, ['SUN']),
      '今天是周日时 thisWeek 只含当天，实际 ' + JSON.stringify(gotSun));

    // 今天是周一：窗口到下一个周日（10-18）
    var monday = _vwNow_(2026, 10, 12);
    var tasksMon = [
      _vwTask_('MON',      { due_date: '2026-10-12' }),
      _vwTask_('SUN_NEXT', { due_date: '2026-10-18' }),
      _vwTask_('MON_NEXT', { due_date: '2026-10-19' })
    ];
    var gotMon = _vwIds_(ViewEngine.thisWeek(tasksMon, monday));
    _vwCheck_(st, _vwSame_(gotMon, ['MON', 'SUN_NEXT']),
      '今天是周一时 thisWeek 应到 10-18（周日，含），不含 10-19，实际 ' + JSON.stringify(gotMon));
  });
}

// ============================================================
// 五、thisMonth
// ============================================================
function testViewEngine_ThisMonth_() {
  return _vwWrap_('testViewEngine_ThisMonth_', function (st) {
    var now = _vwNow_(2026, 10, 7);
    var tasks = [
      _vwTask_('PAST',    { due_date: '2026-10-06' }),
      _vwTask_('TODAY',   { due_date: '2026-10-07' }),
      _vwTask_('MID',     { due_date: '2026-10-20' }),
      _vwTask_('LAST_DAY', { due_date: '2026-10-31' }),
      _vwTask_('NEXT_MONTH', { due_date: '2026-11-01' })
    ];
    var got = _vwIds_(ViewEngine.thisMonth(tasks, now));
    _vwCheck_(st, _vwSame_(got, ['TODAY', 'MID', 'LAST_DAY']),
      'thisMonth 应含 今天~月末（含），不含已过去和下月，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 六、月末边界
// ============================================================
function testViewEngine_ThisMonthEndBoundary_() {
  return _vwWrap_('testViewEngine_ThisMonthEndBoundary_', function (st) {
    // 今天就是月末：窗口只有当天
    var tasks = [
      _vwTask_('OCT30', { due_date: '2026-10-30' }),
      _vwTask_('OCT31', { due_date: '2026-10-31' }),
      _vwTask_('OCT31_LATE', { due_date: '2026-10-31T23:59:59' }),
      _vwTask_('NOV01', { due_date: '2026-11-01' })
    ];
    var got = _vwIds_(ViewEngine.thisMonth(tasks, _vwNow_(2026, 10, 31)));
    _vwCheck_(st, _vwSame_(got, ['OCT31', 'OCT31_LATE']),
      '今天是 10-31 时 thisMonth 只含当天，实际 ' + JSON.stringify(got));
    // 30 天的月份：11-30 是最后一天
    var tasksNov = [
      _vwTask_('NOV30', { due_date: '2026-11-30' }),
      _vwTask_('DEC01', { due_date: '2026-12-01' })
    ];
    var gotNov = _vwIds_(ViewEngine.thisMonth(tasksNov, _vwNow_(2026, 11, 15)));
    _vwCheck_(st, _vwSame_(gotNov, ['NOV30']),
      '11 月最后一天是 11-30，12-01 不含，实际 ' + JSON.stringify(gotNov));
  });
}

// ============================================================
// 七、upcoming（严格晚于今天 23:59:59.999，不含今天，按 due_date 升序）
// ============================================================
function testViewEngine_Upcoming_() {
  return _vwWrap_('testViewEngine_Upcoming_', function (st) {
    var now = _vwNow_(2026, 10, 7);
    var tasks = [
      _vwTask_('LATE',      { due_date: '2026-11-20' }),
      _vwTask_('TODAY_END', { due_date: '2026-10-07T23:59:59' }),
      _vwTask_('TODAY_END_MS', { due_date: '2026-10-07T23:59:59.999' }), // 恰好是"今天 23:59:59.999"，严格晚于才算 upcoming，所以不含
      _vwTask_('PAST',      { due_date: '2026-10-06' }),
      _vwTask_('NEAR',      { due_date: '2026-10-08' }),
      _vwTask_('MID',       { due_date: '2026-10-15' }),
      _vwTask_('NO_DUE',    { due_date: '' })
    ];
    var got = _vwIds_(ViewEngine.upcoming(tasks, now));
    _vwCheck_(st, _vwSame_(got, ['NEAR', 'MID', 'LATE']),
      'upcoming 应不含今天及更早，且按 due_date 升序，期望 [NEAR,MID,LATE]，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 八、终结态排除（DONE / CANCELLED）
//     CONVERTED / NOT_SELECTED 见文件头 BLOCKED 说明，本轮不测
// ============================================================
function testViewEngine_TerminalStateExclusion_() {
  return _vwWrap_('testViewEngine_TerminalStateExclusion_', function (st) {
    var now = _vwNow_(2026, 10, 7);
    var yesterday = _vwRelDate_(-1); // overdue 要用真实"今天"
    function trio(extra) {
      return [
        _vwTask_('OK',        extra),
        _vwTask_('IS_DONE',   Object.assign({}, extra, { status: 'DONE' })),
        _vwTask_('IS_CANCEL', Object.assign({}, extra, { status: 'CANCELLED' }))
      ];
    }
    var checks = [
      ['today',        function () { return ViewEngine.today(trio({ due_date: '2026-10-07' }), now); }],
      ['tomorrow',     function () { return ViewEngine.tomorrow(trio({ due_date: '2026-10-08' }), now); }],
      ['thisWeek',     function () { return ViewEngine.thisWeek(trio({ due_date: '2026-10-09' }), now); }],
      ['thisMonth',    function () { return ViewEngine.thisMonth(trio({ due_date: '2026-10-20' }), now); }],
      ['upcoming',     function () { return ViewEngine.upcoming(trio({ due_date: '2026-10-20' }), now); }],
      ['overdue',      function () { return ViewEngine.overdue(trio({ due_date: yesterday })); }],
      ['recurring',    function () { return ViewEngine.recurring(trio({ recurring: 'Daily' })); }],
      ['highPriority', function () { return ViewEngine.highPriority(trio({ priority: 'HIGH' })); }]
    ];
    checks.forEach(function (c) {
      var got = _vwIds_(c[1]());
      _vwCheck_(st, _vwSame_(got, ['OK']),
        c[0] + ' 应排除 DONE 和 CANCELLED，期望 [OK]，实际 ' + JSON.stringify(got));
    });
  });
}

// ============================================================
// 九、recurring
// ============================================================
function testViewEngine_Recurring_() {
  return _vwWrap_('testViewEngine_Recurring_', function (st) {
    var noField = _vwTask_('NO_FIELD');
    delete noField.recurring;
    var tasks = [
      _vwTask_('DAILY',   { recurring: 'Daily' }),
      _vwTask_('MONTHLY', { recurring: 'Monthly' }),
      _vwTask_('EMPTY',   { recurring: '' }),
      _vwTask_('NULLISH', { recurring: null }),
      noField
    ];
    var got = _vwIds_(ViewEngine.recurring(tasks));
    _vwCheck_(st, _vwSame_(got, ['DAILY', 'MONTHLY']),
      'recurring 只应含 recurring 字段非空的，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 十、highPriority（HIGH / CRITICAL）
// ============================================================
function testViewEngine_HighPriority_() {
  return _vwWrap_('testViewEngine_HighPriority_', function (st) {
    var noField = _vwTask_('NO_FIELD');
    delete noField.priority;
    var tasks = [
      _vwTask_('P_CRITICAL', { priority: 'CRITICAL' }),
      _vwTask_('P_HIGH',     { priority: 'HIGH' }),
      _vwTask_('P_MEDIUM',   { priority: 'MEDIUM' }),
      _vwTask_('P_LOW',      { priority: 'LOW' }),
      noField
    ];
    var got = _vwIds_(ViewEngine.highPriority(tasks));
    _vwCheck_(st, _vwSame_(got, ['P_CRITICAL', 'P_HIGH']),
      'highPriority 只应含 HIGH 和 CRITICAL，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 十一、completed / cancelled
// ============================================================
function testViewEngine_CompletedCancelled_() {
  return _vwWrap_('testViewEngine_CompletedCancelled_', function (st) {
    var tasks = [
      _vwTask_('PEND',   { status: 'PENDING' }),
      _vwTask_('DONE_1', { status: 'DONE' }),
      _vwTask_('CANC_1', { status: 'CANCELLED' }),
      _vwTask_('DONE_2', { status: 'DONE' })
    ];
    var done = _vwIds_(ViewEngine.completed(tasks));
    _vwCheck_(st, _vwSame_(done, ['DONE_1', 'DONE_2']),
      'completed 只应含 DONE（不含 CANCELLED），实际 ' + JSON.stringify(done));
    var canc = _vwIds_(ViewEngine.cancelled(tasks));
    _vwCheck_(st, _vwSame_(canc, ['CANC_1']),
      'cancelled 只应含 CANCELLED，实际 ' + JSON.stringify(canc));
  });
}

// ============================================================
// 十二、archived（Tasks 全量结果里 archived=true 的行）
// ============================================================
function testViewEngine_Archived_() {
  return _vwWrap_('testViewEngine_Archived_', function (st) {
    var noField = _vwTask_('A_NO_FIELD');
    var tasks = [
      _vwTask_('A_BOOL_TRUE',  { archived: true }),
      _vwTask_('A_STR_TRUE_U', { archived: 'TRUE' }),
      _vwTask_('A_STR_TRUE_L', { archived: 'true' }),
      _vwTask_('A_BOOL_FALSE', { archived: false }),
      _vwTask_('A_STR_FALSE',  { archived: 'FALSE' }),
      _vwTask_('A_EMPTY',      { archived: '' }),
      noField
    ];
    var got = _vwIds_(ViewEngine.archived(tasks));
    _vwCheck_(st, _vwSame_(got, ['A_BOOL_TRUE', 'A_STR_TRUE_U', 'A_STR_TRUE_L']),
      'archived 只应含 archived 为 true / TRUE / true 的行，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 十三、overdue（走 isOverdue_，日期相对运行时真实今天）
// ============================================================
function testViewEngine_Overdue_() {
  return _vwWrap_('testViewEngine_Overdue_', function (st) {
    var tasks = [
      _vwTask_('OD_1DAY',   { due_date: _vwRelDate_(-1) }),
      _vwTask_('OD_3DAYS',  { due_date: _vwRelDate_(-3) }),
      _vwTask_('DUE_TODAY', { due_date: _vwRelDate_(0) }),
      _vwTask_('DUE_TMR',   { due_date: _vwRelDate_(1) }),
      _vwTask_('NO_DUE',    { due_date: '' }),
      _vwTask_('MILEAGE',   { due_date: '40000km' })
    ];
    var got = _vwIds_(ViewEngine.overdue(tasks));
    _vwCheck_(st, _vwSame_(got, ['OD_1DAY', 'OD_3DAYS']),
      'overdue 应含已过期日期；今天到期不算逾期；里程类（km）不参与；无 due_date 不参与，实际 ' + JSON.stringify(got));
  });
}

// ============================================================
// 聚合入口
// ============================================================
function runViewEngineCoverageGate() {
  var results = [
    testViewEngine_Today_(),
    testViewEngine_Tomorrow_(),
    testViewEngine_ThisWeek_(),
    testViewEngine_ThisWeekSundayBoundary_(),
    testViewEngine_ThisMonth_(),
    testViewEngine_ThisMonthEndBoundary_(),
    testViewEngine_Upcoming_(),
    testViewEngine_TerminalStateExclusion_(),
    testViewEngine_Recurring_(),
    testViewEngine_HighPriority_(),
    testViewEngine_CompletedCancelled_(),
    testViewEngine_Archived_(),
    testViewEngine_Overdue_()
  ];
  var passCount = results.filter(function (r) { return r; }).length;
  Logger.log('========== runViewEngineCoverageGate: ' + passCount + '/' + results.length + ' PASS ==========');
  return passCount === results.length;
}
