/**
 * 64_Tests_AnalyticsEngine.gs
 * Personal Life OS —— 26_AnalyticsEngine.gs computeStatistics Deterministic Coverage
 * 2026-10-06 新增，Carson 明确授权的 TEST-ONLY 工作项（Testing Coverage，
 * Scope Decision：23/24/25/26 四个纯函数 Engine）。
 *
 * 命名说明：Scope Decision 里写的是"26_StatisticsEngine.js"，仓库里实际
 * 存在的文件是 26_AnalyticsEngine.js（公开函数 computeStatistics），按
 * Scope Decision 列出的覆盖点判断指的是同一个 Engine，所以这份测试文件
 * 命名为 64_Tests_AnalyticsEngine，没有创建任何 StatisticsEngine 文件。
 *
 * 只覆盖 computeStatistics(tasks)（Pure Function: YES）。
 * replayCompletionTrend_ 依赖 EventBus/Events，不在授权范围内，不测。
 *
 * 全部是纯内存数据。时间戳一律用带 Z 的 ISO 字符串，耗时计算不依赖
 * 运行环境的时区。overdue 相关用例的日期相对"运行时真实今天"现算
 * （isOverdue_ 读真实当前时间）。
 *
 * 行为证据（三者一致才测，见 Scope Decision 第 2 节）：
 *   Engine Contract  : 26_AnalyticsEngine.gs 文件头 Engine Contract
 *   Command Reference: 00_Command_Reference.gs V13
 *   Production Code  : 26_AnalyticsEngine.js computeStatistics
 * 各项证据强度不同，逐项标注：
 *   - completion_rate 2 位小数 / overdue_rate 相对 pending / avg_completion_hours
 *     含跳过异常样本规则 / avg_reminder_count 1 位小数 / high_priority /
 *     recurring：三个来源一致。
 *   - 空数组全零：代码里的除零保护 + 00_Architecture_Review.gs 对这几处
 *     防护的回归测试建议；Command Reference 没有单独写空数组行为。
 *   - missing category → GENERAL：代码 + Command Reference（category 缺省按
 *     'GENERAL'）；Engine Contract 没写。
 *   - workload 排除 DONE/CANCELLED：Command Reference V13 写的是"待办任务数"，
 *     代码一致。
 *
 * 单一入口 runAnalyticsEngineCoverageGate()。
 */

// ============================================================
// 工具（前缀 _an，避免跟全局其他文件重名）
// ============================================================
function _anCheck_(st, cond, msg) {
  if (!cond) {
    Logger.log('❌ ' + msg);
    st.pass = false;
  }
}
function _anPad_(n) { return (n < 10 ? '0' : '') + n; }
function _anRelDate_(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + _anPad_(d.getMonth() + 1) + '-' + _anPad_(d.getDate());
}
function _anTask_(overrides) {
  var base = {
    task_id: '', status: 'PENDING', due_date: '', recurring: '', priority: 'MEDIUM',
    category: 'GENERAL', reminder_count: 0, timestamp: '', completed_at: ''
  };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}
function _anDoneTask_(createdIso, completedIso) {
  return _anTask_({ status: 'DONE', timestamp: createdIso, completed_at: completedIso });
}
function _anWrap_(name, fn) {
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

// ============================================================
// 一、空数组 → 全部为零
// ============================================================
function testAnalytics_EmptyArrayAllZero_() {
  return _anWrap_('testAnalytics_EmptyArrayAllZero_', function (st) {
    var s = AnalyticsEngine.computeStatistics([]);
    ['total_count', 'pending_count', 'done_count', 'cancelled_count', 'overdue_count',
     'recurring_count', 'high_priority_count', 'completion_rate', 'overdue_rate',
     'avg_reminder_count', 'avg_completion_hours'].forEach(function (k) {
      _anCheck_(st, s[k] === 0, k + ' 期望 0，实际 ' + JSON.stringify(s[k]));
    });
    _anCheck_(st, JSON.stringify(s.workload_by_category) === '{}',
      'workload_by_category 期望空对象，实际 ' + JSON.stringify(s.workload_by_category));
    // 不产生 NaN / Infinity（除零保护）
    Object.keys(s).forEach(function (k) {
      if (typeof s[k] === 'number' && !isFinite(s[k])) {
        _anCheck_(st, false, k + ' 不应是 NaN/Infinity，实际 ' + s[k]);
      }
    });
  });
}

// ============================================================
// 二、completion_rate 保留 2 位小数
// ============================================================
function testAnalytics_CompletionRateTwoDecimals_() {
  return _anWrap_('testAnalytics_CompletionRateTwoDecimals_', function (st) {
    var t1 = _anTask_({ status: 'DONE' });
    var t2 = _anTask_({ status: 'PENDING' });
    var t3 = _anTask_({ status: 'PENDING' });
    var s = AnalyticsEngine.computeStatistics([t1, t2, t3]);
    _anCheck_(st, s.completion_rate === 33.33, '1/3 完成率期望 33.33，实际 ' + s.completion_rate);
    var s2 = AnalyticsEngine.computeStatistics([t1, t1]);
    _anCheck_(st, s2.completion_rate === 100, '全部完成期望 100，实际 ' + s2.completion_rate);
    var s3 = AnalyticsEngine.computeStatistics([t2, t3]);
    _anCheck_(st, s3.completion_rate === 0, '全部未完成期望 0，实际 ' + s3.completion_rate);
    // 状态计数
    _anCheck_(st, s.total_count === 3 && s.done_count === 1 && s.pending_count === 2 && s.cancelled_count === 0,
      '计数不对：' + JSON.stringify(s));
  });
}

// ============================================================
// 三、overdue_rate 相对 pending（不是相对 total）
// ============================================================
function testAnalytics_OverdueRateRelativeToPending_() {
  return _anWrap_('testAnalytics_OverdueRateRelativeToPending_', function (st) {
    var tasks = [
      _anTask_({ task_id: 'P_OVERDUE', status: 'PENDING', due_date: _anRelDate_(-2) }),
      _anTask_({ task_id: 'P_FUTURE',  status: 'PENDING', due_date: _anRelDate_(5) }),
      _anTask_({ task_id: 'D_OLD',     status: 'DONE',      due_date: _anRelDate_(-10) }),
      _anTask_({ task_id: 'C_OLD',     status: 'CANCELLED', due_date: _anRelDate_(-10) })
    ];
    var s = AnalyticsEngine.computeStatistics(tasks);
    _anCheck_(st, s.pending_count === 2, 'pending_count 期望 2，实际 ' + s.pending_count);
    _anCheck_(st, s.overdue_count === 1,
      'overdue_count 期望 1（DONE/CANCELLED 不计入逾期），实际 ' + s.overdue_count);
    // 相对 pending = 1/2 = 50；如果错误地相对 total 会是 25
    _anCheck_(st, s.overdue_rate === 50, 'overdue_rate 期望 50（相对 pending），实际 ' + s.overdue_rate);

    // 今天到期不算逾期
    var s2 = AnalyticsEngine.computeStatistics([_anTask_({ status: 'PENDING', due_date: _anRelDate_(0) })]);
    _anCheck_(st, s2.overdue_count === 0 && s2.overdue_rate === 0,
      '今天到期不算逾期，实际 count=' + s2.overdue_count + ' rate=' + s2.overdue_rate);

    // 没有 pending 任务：overdue_rate 为 0（不除零）
    var s3 = AnalyticsEngine.computeStatistics([_anTask_({ status: 'DONE' })]);
    _anCheck_(st, s3.overdue_rate === 0, '没有 pending 时 overdue_rate 期望 0，实际 ' + s3.overdue_rate);
  });
}

// ============================================================
// 四、avg_completion_hours（1 位小数）
// ============================================================
function testAnalytics_AvgCompletionHours_() {
  return _anWrap_('testAnalytics_AvgCompletionHours_', function (st) {
    // 2 小时 和 4 小时 → 平均 3.0
    var two  = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T02:00:00Z');
    var four = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T04:00:00Z');
    var s = AnalyticsEngine.computeStatistics([two, four]);
    _anCheck_(st, s.avg_completion_hours === 3, '平均耗时期望 3，实际 ' + s.avg_completion_hours);

    // 100 分钟 = 1.6666…小时 → 保留 1 位小数 = 1.7
    var hundredMin = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T01:40:00Z');
    var s2 = AnalyticsEngine.computeStatistics([hundredMin]);
    _anCheck_(st, s2.avg_completion_hours === 1.7, '100 分钟期望 1.7 小时，实际 ' + s2.avg_completion_hours);

    // 没有任何可统计样本 → 0
    var s3 = AnalyticsEngine.computeStatistics([_anTask_({ status: 'PENDING' })]);
    _anCheck_(st, s3.avg_completion_hours === 0, '没有完成样本期望 0，实际 ' + s3.avg_completion_hours);
  });
}

// ============================================================
// 五、负值 / 无效样本被跳过，不计入平均
// ============================================================
function testAnalytics_InvalidCompletionSamplesSkipped_() {
  return _anWrap_('testAnalytics_InvalidCompletionSamplesSkipped_', function (st) {
    var good2  = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T02:00:00Z'); // 2h
    var good4  = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T04:00:00Z'); // 4h
    var negative = _anDoneTask_('2026-10-01T10:00:00Z', '2026-10-01T07:00:00Z'); // completed_at 早于 timestamp
    var badDate  = _anDoneTask_('2026-10-01T00:00:00Z', 'not-a-date');
    var badStart = _anDoneTask_('not-a-date', '2026-10-01T05:00:00Z');
    var noCompleted = _anTask_({ status: 'DONE', timestamp: '2026-10-01T00:00:00Z', completed_at: '' });
    var noTimestamp = _anTask_({ status: 'DONE', timestamp: '', completed_at: '2026-10-01T09:00:00Z' });
    // 非 DONE 即使带了 completed_at 也不统计
    var pendingWithCompleted = _anTask_({ status: 'PENDING', timestamp: '2026-10-01T00:00:00Z', completed_at: '2026-10-01T20:00:00Z' });

    var s = AnalyticsEngine.computeStatistics([good2, good4, negative, badDate, badStart, noCompleted, noTimestamp, pendingWithCompleted]);
    _anCheck_(st, s.avg_completion_hours === 3,
      '只有 2h 和 4h 两个有效样本，平均期望 3，实际 ' + s.avg_completion_hours);
    // 跳过的样本仍然计入 done_count（只是不进耗时平均）
    _anCheck_(st, s.done_count === 7, 'done_count 期望 7（含被跳过耗时的 DONE 任务），实际 ' + s.done_count);

    // 只有负值样本 → 没有有效样本 → 0
    var s2 = AnalyticsEngine.computeStatistics([negative]);
    _anCheck_(st, s2.avg_completion_hours === 0, '只有负值样本期望 0，实际 ' + s2.avg_completion_hours);

    // 耗时恰好为 0（completed_at == timestamp）不是负值，属于有效样本
    var zero = _anDoneTask_('2026-10-01T00:00:00Z', '2026-10-01T00:00:00Z');
    var s3 = AnalyticsEngine.computeStatistics([zero, good4]);
    _anCheck_(st, s3.avg_completion_hours === 2, '0h 与 4h 的平均期望 2，实际 ' + s3.avg_completion_hours);
  });
}

// ============================================================
// 六、high_priority（HIGH / CRITICAL）
// ============================================================
function testAnalytics_HighPriorityCount_() {
  return _anWrap_('testAnalytics_HighPriorityCount_', function (st) {
    var tasks = [
      _anTask_({ priority: 'CRITICAL' }),
      _anTask_({ priority: 'HIGH' }),
      _anTask_({ priority: 'HIGH' }),
      _anTask_({ priority: 'MEDIUM' }),
      _anTask_({ priority: 'LOW' })
    ];
    var s = AnalyticsEngine.computeStatistics(tasks);
    _anCheck_(st, s.high_priority_count === 3, 'high_priority_count 期望 3，实际 ' + s.high_priority_count);
  });
}

// ============================================================
// 七、recurring（recurring 字段非空）
// ============================================================
function testAnalytics_RecurringCount_() {
  return _anWrap_('testAnalytics_RecurringCount_', function (st) {
    var noField = _anTask_({});
    delete noField.recurring;
    var tasks = [
      _anTask_({ recurring: 'Daily' }),
      _anTask_({ recurring: 'Monthly' }),
      _anTask_({ recurring: '' }),
      _anTask_({ recurring: null }),
      noField
    ];
    var s = AnalyticsEngine.computeStatistics(tasks);
    _anCheck_(st, s.recurring_count === 2, 'recurring_count 期望 2，实际 ' + s.recurring_count);
  });
}

// ============================================================
// 八、avg_reminder_count（总提醒次数 / 总任务数，1 位小数）
// ============================================================
function testAnalytics_AvgReminderCount_() {
  return _anWrap_('testAnalytics_AvgReminderCount_', function (st) {
    // 1 / 3 = 0.333… → 0.3
    var s = AnalyticsEngine.computeStatistics([
      _anTask_({ reminder_count: 1 }),
      _anTask_({ reminder_count: 0 }),
      _anTask_({ reminder_count: 0 })
    ]);
    _anCheck_(st, s.avg_reminder_count === 0.3, '1/3 期望 0.3，实际 ' + s.avg_reminder_count);
    // 分母是全部任务（含 DONE/CANCELLED）：2 / 4 = 0.5
    var s2 = AnalyticsEngine.computeStatistics([
      _anTask_({ reminder_count: 2, status: 'DONE' }),
      _anTask_({ reminder_count: 0, status: 'PENDING' }),
      _anTask_({ reminder_count: 0, status: 'CANCELLED' }),
      _anTask_({ reminder_count: 0, status: 'PENDING' })
    ]);
    _anCheck_(st, s2.avg_reminder_count === 0.5, '2/4 期望 0.5，实际 ' + s2.avg_reminder_count);
  });
}

// ============================================================
// 九、workload：排除 DONE/CANCELLED；缺省 category → GENERAL
// ============================================================
function testAnalytics_WorkloadByCategory_() {
  return _anWrap_('testAnalytics_WorkloadByCategory_', function (st) {
    var noCategory = _anTask_({ status: 'PENDING' });
    delete noCategory.category;
    var emptyCategory = _anTask_({ status: 'PENDING', category: '' });
    var tasks = [
      _anTask_({ status: 'PENDING', category: 'SHOPPING' }),
      _anTask_({ status: 'PENDING', category: 'SHOPPING' }),
      _anTask_({ status: 'PENDING', category: 'HEALTH' }),
      _anTask_({ status: 'DONE',      category: 'SHOPPING' }),
      _anTask_({ status: 'CANCELLED', category: 'HEALTH' }),
      _anTask_({ status: 'DONE',      category: 'ADMIN' }),
      noCategory,
      emptyCategory
    ];
    var w = AnalyticsEngine.computeStatistics(tasks).workload_by_category;
    _anCheck_(st, w.SHOPPING === 2, 'SHOPPING 期望 2（DONE 不计），实际 ' + w.SHOPPING);
    _anCheck_(st, w.HEALTH === 1, 'HEALTH 期望 1（CANCELLED 不计），实际 ' + w.HEALTH);
    _anCheck_(st, w.ADMIN === undefined, '只有 DONE 任务的 ADMIN 不应出现在 workload，实际 ' + w.ADMIN);
    _anCheck_(st, w.GENERAL === 2, '缺省/空 category 应归入 GENERAL，期望 2，实际 ' + w.GENERAL);
  });
}

// ============================================================
// 聚合入口
// ============================================================
function runAnalyticsEngineCoverageGate() {
  var results = [
    testAnalytics_EmptyArrayAllZero_(),
    testAnalytics_CompletionRateTwoDecimals_(),
    testAnalytics_OverdueRateRelativeToPending_(),
    testAnalytics_AvgCompletionHours_(),
    testAnalytics_InvalidCompletionSamplesSkipped_(),
    testAnalytics_HighPriorityCount_(),
    testAnalytics_RecurringCount_(),
    testAnalytics_AvgReminderCount_(),
    testAnalytics_WorkloadByCategory_()
  ];
  var passCount = results.filter(function (r) { return r; }).length;
  Logger.log('========== runAnalyticsEngineCoverageGate: ' + passCount + '/' + results.length + ' PASS ==========');
  return passCount === results.length;
}
