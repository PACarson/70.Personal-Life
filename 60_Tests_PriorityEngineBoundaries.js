/**
 * 60_Tests_PriorityEngineBoundaries.gs
 * Personal Life OS —— 22_PriorityEngine.gs Boundary Test Coverage
 * 2026-09-30 新增，Carson 明确授权的 TEST-ONLY 工作项。
 *
 * 覆盖范围（本轮只做这两类，理由见下面"本轮不覆盖"）：
 *   一、No due_date —— computeUrgencyScore 对缺失/null/空字符串/
 *      不可解析字符串四种输入的真实行为
 *   二、Boundary day count —— computeUrgencyScore 真实存在的四个分段
 *      转折点（diffDays = 0 / 1 / 2 / 8），每个转折点覆盖
 *      "转折点-1 / 转折点 / 转折点+1"三个值；附带一个
 *      computePriorityScore 的加权组合校验点（0.6/0.4 权重）
 *
 * 全部日期都用 Session.getScriptTimeZone()（跟生产代码同一个 API）
 * 相对"运行时真实今天"现算，不写死任何日历日期——这样这份测试不管哪
 * 一天运行结果都一样，不依赖"今天恰好是哪天"。
 *
 * 本轮不覆盖（Scope Firewall，故意不测，不是漏测——三者都是
 * CONTRACT / IMPLEMENTATION DISCREPANCY，已经单独报告，等待新的
 * authorization，这里不擅自决定用哪个版本的"预期"）：
 *   - Overdue clamp（"just overdue vs materially overdue 是否有最小值
 *     clamp"）—— 00_Architecture_Review.gs 209 行声称"逾期天数有
 *     clamp(30)上限"，但 22_PriorityEngine.js 里 OVERDUE 分支是
 *     `diffDays < 0 → 固定返回 100`，不看具体逾期多少天，代码里也没有
 *     数字 30、没有 clamp() 调用。全仓库搜索"clamp"，唯一命中是
 *     09_TemporalParser.js 的 `_clampInterval_`（recurrence间隔用的，
 *     跟这里完全无关）。
 *   - Recurring discount —— 00_Architecture_Review.gs 246 行把它列为
 *     22_PriorityEngine 的五类边界之一，但 22_PriorityEngine.js 全文
 *     没有一处出现"recurring"字样，全仓库搜索"recurring折扣/discount"
 *     唯一命中就是 Architecture Review 自己那一行描述。
 *   - Math.min(100) upper bound —— 同一段声称的第五类边界，但全仓库
 *     搜索"Math.min"零命中。当前分数结构性地不会超过100（urgency/
 *     importance 两张权重表各自封顶100，权重0.6+0.4=1.0），但这是
 *     "现有固定权重表的数学结果"，不是"代码里存在一道显式 clamp"——
 *     两者不是同一件事，不应该混着测。
 *
 * 状态：SIM VERIFIED——通过一个不属于本仓库、只提供
 * Session.getScriptTimeZone/Utilities.formatDate 两个真实平台 API 的
 * 最小 Node shim，对真实、未修改的 22_PriorityEngine.js 完整执行过一次，
 * 全部通过（见本次报告 C 项）。不是 LIVE GAS VERIFIED——没有在真实
 * Google Sheet/Apps Script 环境跑过，这两个函数本身也不需要（纯函数，
 * 不读写 Sheet）。
 *
 * 单一入口 runPriorityEngineBoundaryGate()。
 */

// ============================================================
// 工具：相对"运行时真实今天"生成 yyyy-MM-dd 字符串，不写死日历日期
// ============================================================
function _pebToday_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function _pebDatePlusDays_(n) {
  var d = new Date(_pebToday_());
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================================
// 一、No due_date
// ============================================================

function testUrgencyScore_NoDueDate_() {
  Logger.log('--- testUrgencyScore_NoDueDate_ 开始 ---');
  var pass = true;
  try {
    var cases = [
      { label: 'undefined', input: undefined },
      { label: 'null',      input: null },
      { label: 'empty string', input: '' }
    ];
    cases.forEach(function (c) {
      var got = PriorityEngine.computeUrgencyScore(c.input);
      if (got !== 0) {
        Logger.log('❌ due_date=' + c.label + ' 期望 0（NO_DUE_DATE），实际 ' + got);
        pass = false;
      }
    });

    // 不可解析的非空字符串——验证"不产生未定义的错误计算"（不抛异常，
    // 不返回 NaN）；真实观察到的行为是落到 DUE_LATER(20)，这是现状记录，
    // 不是断言"这就该是设计"
    var gotGarbage = PriorityEngine.computeUrgencyScore('not-a-real-date');
    if (typeof gotGarbage !== 'number' || isNaN(gotGarbage)) {
      Logger.log('❌ 不可解析字符串产生了 NaN 或非数字: ' + gotGarbage);
      pass = false;
    } else if (gotGarbage !== 20) {
      Logger.log('❌ 不可解析字符串现状应为 20（DUE_LATER，落到最后一个分支），实际 ' + gotGarbage);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testUrgencyScore_NoDueDate_ PASS' : '❌ testUrgencyScore_NoDueDate_ FAIL');
  return pass;
}

// ============================================================
// 二、Boundary day count（四个真实转折点，各 -1/该点/+1）
// ============================================================

function testUrgencyScore_BoundaryDayCount_() {
  Logger.log('--- testUrgencyScore_BoundaryDayCount_ 开始 ---');
  var pass = true;
  try {
    // [diffDays, 期望值, 说明]
    var cases = [
      [-1, 100, 'transition@0 的 boundary-1：昨天，OVERDUE'],
      [ 0,  80, 'transition@0 的 boundary：今天，DUE_TODAY'],
      [ 1,  60, 'transition@0 的 boundary+1 == transition@1 的 boundary：明天，DUE_TOMORROW'],
      [ 2,  40, 'transition@1 的 boundary+1 == transition@2 的 boundary：后天，DUE_THIS_WEEK 起点'],
      [ 3,  40, 'transition@2 的 boundary+1：仍在本周内'],
      [ 7,  40, 'transition@8 的 boundary-1：本周内最后一天'],
      [ 8,  20, 'transition@8 的 boundary：DUE_LATER 起点'],
      [ 9,  20, 'transition@8 的 boundary+1：仍是 DUE_LATER']
    ];
    cases.forEach(function (c) {
      var dueDate = _pebDatePlusDays_(c[0]);
      var got = PriorityEngine.computeUrgencyScore(dueDate);
      if (got !== c[1]) {
        Logger.log('❌ diffDays=' + c[0] + '（' + c[2] + '）期望 ' + c[1] + '，实际 ' + got + '（due_date=' + dueDate + '）');
        pass = false;
      }
    });

    // 附带一个 computePriorityScore 的加权组合校验点：
    // due today（urgency=80）+ priority HIGH（importance=70）
    // 期望 80*0.6 + 70*0.4 = 48 + 28 = 76，直接对应代码里的
    // `urgency * 0.6 + importance * 0.4`，不是另设的期望值
    var todayHigh = { due_date: _pebDatePlusDays_(0), priority: 'HIGH' };
    var scoreGot = PriorityEngine.computePriorityScore(todayHigh);
    if (scoreGot !== 76) {
      Logger.log('❌ computePriorityScore(due=今天, priority=HIGH) 期望 76，实际 ' + scoreGot);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testUrgencyScore_BoundaryDayCount_ PASS' : '❌ testUrgencyScore_BoundaryDayCount_ FAIL');
  return pass;
}

// ============================================================
// 聚合入口
// ============================================================
function runPriorityEngineBoundaryGate() {
  var results = [
    testUrgencyScore_NoDueDate_(),
    testUrgencyScore_BoundaryDayCount_()
  ];
  var passCount = results.filter(function (r) { return r; }).length;
  Logger.log('========== runPriorityEngineBoundaryGate: ' + passCount + '/' + results.length + ' PASS ==========');
  return passCount === results.length;
}
