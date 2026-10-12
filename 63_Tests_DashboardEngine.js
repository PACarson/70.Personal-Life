/**
 * 63_Tests_DashboardEngine.gs
 * Personal Life OS —— 25_DashboardEngine.gs Deterministic Coverage
 * 2026-10-06 新增，Carson 明确授权的 TEST-ONLY 工作项（Testing Coverage，
 * Scope Decision：23/24/25/26 四个纯函数 Engine）。
 *
 * 只覆盖"确定性、无争议"的部分（Scope Decision 第 3 节）：
 *   一、build() 路由与默认回落
 *   二、空 Today 状态
 *   三、单任务渲染（Today / Overdue / Tomorrow 各一条）
 *   四、Statistics 九项输出
 *   五、category 分组
 *   六、category 去重
 *
 * 25_DashboardEngine 的各个 build 函数内部调用 ViewEngine（没有 `now`
 * 参数，读真实当前时间），所以日期相对"运行时真实今天"现算，不写死
 * 日历日期。每个分区只放一个任务，因此不对任何多任务排序做断言
 * （Priority 排序属于 Priority Contract — CLOSED / UNRESOLVED BY DESIGN）。
 *
 * 行为证据（三者一致才测，见 Scope Decision 第 2 节）：
 *   Engine Contract  : 25_DashboardEngine.gs 文件头 Engine Contract
 *   Command Reference: 00_Command_Reference.gs V12 / V13
 *   Production Code  : 25_DashboardEngine.js
 * 说明：Today 分区顺序、category 图标映射、"落不到任何分区的任务看不到"、
 * 去重规则，Command Reference V12 与代码一致。分区之间的分隔线文案、
 * 空 Today 的占位文案、Statistics 每行的标签文字，只在代码里，
 * Command Reference 只列了统计项的含义——这几处是对当前展示文本的
 * 现状记录，不是对展示格式的新批准。
 *
 * 本轮刻意不测（BLOCKED，不是漏测）：
 *   - Weekly Dashboard / Monthly Dashboard 的任何内容：Final Report 已记录
 *     "今日已完成"逻辑疑点和"即将到来 (7天内)"标签与实现不一致。路由用例
 *     只比较 build('weekly'|'monthly') 与直接调用对应函数的输出是否相同，
 *     不对这两个函数产出的任何内容做断言。
 *   - Today 多任务排序（依赖 PriorityEngine.rankByPriority）
 *
 * 单一入口 runDashboardEngineCoverageGate()。
 */

// ============================================================
// 工具（前缀 _db，避免跟全局其他文件重名）
// ============================================================
function _dbCheck_(st, cond, msg) {
  if (!cond) {
    Logger.log('❌ ' + msg);
    st.pass = false;
  }
}
function _dbPad_(n) { return (n < 10 ? '0' : '') + n; }
function _dbRelDate_(offsetDays) {
  var d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' + _dbPad_(d.getMonth() + 1) + '-' + _dbPad_(d.getDate());
}
function _dbTask_(id, title, overrides) {
  var base = { task_id: id, title: title, status: 'PENDING', due_date: '', category: 'GENERAL', priority: 'MEDIUM', recurring: '' };
  Object.keys(overrides || {}).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}
function _dbCount_(text, needle) {
  return text.split(needle).length - 1;
}
function _dbWrap_(name, fn) {
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
// 一、build() 路由与默认回落
// ============================================================
function testDashboardEngine_BuildRoutingAndFallback_() {
  return _dbWrap_('testDashboardEngine_BuildRoutingAndFallback_', function (st) {
    var tasks = [_dbTask_('T1', 'Pay rent', { due_date: _dbRelDate_(0) })];

    _dbCheck_(st, DashboardEngine.build('today', tasks) === DashboardEngine.buildTodayDashboard(tasks),
      "build('today') 应路由到 buildTodayDashboard");
    _dbCheck_(st, DashboardEngine.build('statistics', tasks) === DashboardEngine.buildStatisticsDashboard(tasks),
      "build('statistics') 应路由到 buildStatisticsDashboard");

    // weekly / monthly 只验证"路由到了对应函数"（输出与直接调用相同），
    // 不对这两个函数的内容做任何断言（见文件头 BLOCKED 说明）
    _dbCheck_(st, DashboardEngine.build('weekly', []) === DashboardEngine.buildWeeklyDashboard([]),
      "build('weekly') 应路由到 buildWeeklyDashboard");
    _dbCheck_(st, DashboardEngine.build('monthly', []) === DashboardEngine.buildMonthlyDashboard([]),
      "build('monthly') 应路由到 buildMonthlyDashboard");
    _dbCheck_(st, DashboardEngine.build('weekly', []) !== DashboardEngine.build('monthly', []),
      "weekly 与 monthly 应路由到不同的函数");

    // 默认回落：未知类型 / 缺省类型 → today
    var todayOut = DashboardEngine.buildTodayDashboard(tasks);
    _dbCheck_(st, DashboardEngine.build('no-such-type', tasks) === todayOut, '未知类型应回落到 today');
    _dbCheck_(st, DashboardEngine.build(undefined, tasks) === todayOut, '缺省类型应回落到 today');
    _dbCheck_(st, DashboardEngine.build('no-such-type', tasks) !== DashboardEngine.buildStatisticsDashboard(tasks),
      '回落结果不应等于 statistics 输出（对照，防止两边恰好相同）');
  });
}

// ============================================================
// 二、空 Today 状态
// ============================================================
function testDashboardEngine_EmptyToday_() {
  return _dbWrap_('testDashboardEngine_EmptyToday_', function (st) {
    var out = DashboardEngine.buildTodayDashboard([]);
    _dbCheck_(st, out === '🔥 Today\n（今天没有安排）', '空任务期望只有 Today 标题和占位行，实际 ' + JSON.stringify(out));
    _dbCheck_(st, out.indexOf('⚠ Overdue') === -1, '没有逾期任务时不应出现 Overdue 分区');
    _dbCheck_(st, out.indexOf('📅 Tomorrow') === -1, '没有明天任务时不应出现 Tomorrow 分区');

    // 只有"既不是今天/逾期/明天、也没有 category 图标"的任务 → 仍是空 Today
    var far = [_dbTask_('F1', 'Far away', { due_date: _dbRelDate_(20) })];
    _dbCheck_(st, DashboardEngine.buildTodayDashboard(far) === '🔥 Today\n（今天没有安排）',
      '只有远期、无 category 图标的任务时，输出仍应是空 Today');
  });
}

// ============================================================
// 三、单任务渲染
// ============================================================
function testDashboardEngine_SingleTaskRendering_() {
  return _dbWrap_('testDashboardEngine_SingleTaskRendering_', function (st) {
    // 今天一条：圆圈数字 ① + 标题
    var todayOnly = DashboardEngine.buildTodayDashboard([_dbTask_('T1', 'Pay rent', { due_date: _dbRelDate_(0) })]);
    _dbCheck_(st, todayOnly === '🔥 Today\n① Pay rent', 'Today 单任务期望 "🔥 Today\\n① Pay rent"，实际 ' + JSON.stringify(todayOnly));

    // 逾期一条：Overdue 分区 + 标题（Today 分区仍是空占位）
    var overdueOnly = DashboardEngine.buildTodayDashboard([_dbTask_('T2', 'Renew license', { due_date: _dbRelDate_(-2) })]);
    var oLines = overdueOnly.split('\n');
    _dbCheck_(st, oLines[0] === '🔥 Today' && oLines[1] === '（今天没有安排）', '逾期任务不应出现在 Today 分区');
    var oIdx = oLines.indexOf('⚠ Overdue');
    _dbCheck_(st, oIdx !== -1 && oLines[oIdx + 1] === 'Renew license', 'Overdue 分区应紧跟标题行，实际 ' + JSON.stringify(oLines));

    // 明天一条：Tomorrow 分区 + 标题
    var tmrOnly = DashboardEngine.buildTodayDashboard([_dbTask_('T3', 'Book dentist', { due_date: _dbRelDate_(1) })]);
    var tLines = tmrOnly.split('\n');
    var tIdx = tLines.indexOf('📅 Tomorrow');
    _dbCheck_(st, tIdx !== -1 && tLines[tIdx + 1] === 'Book dentist', 'Tomorrow 分区应紧跟标题行，实际 ' + JSON.stringify(tLines));

    // 三个分区同时出现：顺序 Today → Overdue → Tomorrow（Command Reference V12）
    var all = DashboardEngine.buildTodayDashboard([
      _dbTask_('A', 'task-today',    { due_date: _dbRelDate_(0) }),
      _dbTask_('B', 'task-overdue',  { due_date: _dbRelDate_(-1) }),
      _dbTask_('C', 'task-tomorrow', { due_date: _dbRelDate_(1) })
    ]);
    var iToday = all.indexOf('🔥 Today');
    var iOver  = all.indexOf('⚠ Overdue');
    var iTmr   = all.indexOf('📅 Tomorrow');
    _dbCheck_(st, iToday === 0 && iToday < iOver && iOver < iTmr,
      '分区顺序应为 Today → Overdue → Tomorrow，实际位置 ' + [iToday, iOver, iTmr].join(','));
    _dbCheck_(st, all.indexOf('① task-today') !== -1 && all.indexOf('task-overdue') > iOver && all.indexOf('task-tomorrow') > iTmr,
      '每个任务应出现在各自的分区里');

    // 已完成的今日任务不出现在 Today
    var doneToday = DashboardEngine.buildTodayDashboard([_dbTask_('D', 'finished', { due_date: _dbRelDate_(0), status: 'DONE' })]);
    _dbCheck_(st, doneToday === '🔥 Today\n（今天没有安排）', 'DONE 任务不应出现在 Today，实际 ' + JSON.stringify(doneToday));
  });
}

// ============================================================
// 四、Statistics 九项输出
// ============================================================
function testDashboardEngine_StatisticsNineItems_() {
  return _dbWrap_('testDashboardEngine_StatisticsNineItems_', function (st) {
    var tasks = [
      { task_id: 'S1', title: 's1', status: 'DONE', priority: 'HIGH', recurring: 'Daily', reminder_count: 2,
        timestamp: '2026-10-01T00:00:00Z', completed_at: '2026-10-01T06:00:00Z', category: 'GENERAL' },
      { task_id: 'S2', title: 's2', status: 'PENDING', priority: 'CRITICAL', recurring: '', reminder_count: 0,
        timestamp: '', completed_at: '', category: 'GENERAL' },
      { task_id: 'S3', title: 's3', status: 'PENDING', priority: 'LOW', recurring: '', reminder_count: 0,
        timestamp: '', completed_at: '', category: 'GENERAL' },
      { task_id: 'S4', title: 's4', status: 'CANCELLED', priority: 'MEDIUM', recurring: '', reminder_count: 0,
        timestamp: '', completed_at: '', category: 'GENERAL' }
    ];
    var out = DashboardEngine.buildStatisticsDashboard(tasks);
    var expected = [
      '📈 Statistics Dashboard',
      '',
      '任务总数: 4',
      '待办: 2',
      '已完成: 1',
      '已取消: 1',
      '完成率: 25%',
      '平均完成耗时: 6 小时',
      '平均提醒次数: 0.5',
      '高优先级数: 2',
      'Recurring数: 1'
    ].join('\n');
    _dbCheck_(st, out === expected, 'Statistics 输出不符。\n期望:\n' + expected + '\n实际:\n' + out);
    // 九项统计 + 标题 + 空行 = 11 行
    _dbCheck_(st, out.split('\n').length === 11, '期望 11 行（标题 + 空行 + 9 项），实际 ' + out.split('\n').length);

    // 空数组不产生 NaN/undefined
    var empty = DashboardEngine.buildStatisticsDashboard([]);
    _dbCheck_(st, empty.indexOf('NaN') === -1 && empty.indexOf('undefined') === -1, '空数组输出不应含 NaN/undefined，实际 ' + JSON.stringify(empty));
    _dbCheck_(st, empty.indexOf('任务总数: 0') !== -1, '空数组应显示 任务总数: 0');
  });
}

// ============================================================
// 五、category 分组
// ============================================================
function testDashboardEngine_CategoryGrouping_() {
  return _dbWrap_('testDashboardEngine_CategoryGrouping_', function (st) {
    var later = _dbRelDate_(10); // 不在 Today/Overdue/Tomorrow 里，只能落到 category 分区
    var tasks = [
      _dbTask_('C1', 'buy-eggs',   { due_date: later, category: 'SHOPPING' }),
      _dbTask_('C2', 'oil-change', { due_date: later, category: 'MAINTENANCE' }),
      _dbTask_('C3', 'checkup',    { due_date: later, category: 'HEALTH' }),
      _dbTask_('C4', 'renew-id',   { due_date: later, category: 'ADMIN' }),
      _dbTask_('C5', 'plain-one',  { due_date: later, category: 'GENERAL' }),
      _dbTask_('C6', 'proj-one',   { due_date: later, category: 'PROJECT' })
    ];
    var out = DashboardEngine.buildTodayDashboard(tasks);
    var lines = out.split('\n');
    var map = [
      ['📦 Shopping', 'buy-eggs'],
      ['🚗 Vehicle',  'oil-change'],
      ['💊 Health',   'checkup'],
      ['📋 Admin',    'renew-id']
    ];
    map.forEach(function (m) {
      var idx = lines.indexOf(m[0]);
      _dbCheck_(st, idx !== -1 && lines[idx + 1] === m[1],
        m[0] + ' 分区应紧跟 ' + m[1] + '，实际 ' + JSON.stringify(lines));
    });
    // GENERAL / PROJECT 没有图标分区，仪表盘里看不到（Command Reference V12）
    _dbCheck_(st, out.indexOf('plain-one') === -1, 'GENERAL 任务不应出现在仪表盘');
    _dbCheck_(st, out.indexOf('proj-one') === -1, 'PROJECT 任务不应出现在仪表盘');

    // 同一个 category 的任务出现在同一个分区下
    var two = DashboardEngine.buildTodayDashboard([
      _dbTask_('X1', 'shop-a', { due_date: later, category: 'SHOPPING' }),
      _dbTask_('X2', 'shop-b', { due_date: later, category: 'SHOPPING' })
    ]);
    _dbCheck_(st, _dbCount_(two, '📦 Shopping') === 1, '同一 category 只应有一个分区标题');
    _dbCheck_(st, two.indexOf('shop-a') !== -1 && two.indexOf('shop-b') !== -1, '两个 SHOPPING 任务都应出现');
  });
}

// ============================================================
// 六、category 去重（已经出现在 Today/Overdue/Tomorrow 的任务不在 category 分区重复）
// ============================================================
function testDashboardEngine_CategoryDeduplication_() {
  return _dbWrap_('testDashboardEngine_CategoryDeduplication_', function (st) {
    // 今天到期的 SHOPPING：只在 Today 出现一次，且没有 Shopping 分区
    var todayShop = DashboardEngine.buildTodayDashboard([
      _dbTask_('D1', 'milk-today', { due_date: _dbRelDate_(0), category: 'SHOPPING' })
    ]);
    _dbCheck_(st, _dbCount_(todayShop, 'milk-today') === 1, '今天到期的 SHOPPING 任务只应出现 1 次，实际 ' + _dbCount_(todayShop, 'milk-today'));
    _dbCheck_(st, todayShop.indexOf('📦 Shopping') === -1, '该任务已在 Today，不应再生成 Shopping 分区');

    // 明天到期
    var tmrShop = DashboardEngine.buildTodayDashboard([
      _dbTask_('D2', 'milk-tomorrow', { due_date: _dbRelDate_(1), category: 'SHOPPING' })
    ]);
    _dbCheck_(st, _dbCount_(tmrShop, 'milk-tomorrow') === 1 && tmrShop.indexOf('📦 Shopping') === -1,
      '明天到期的 SHOPPING 任务只应在 Tomorrow 出现 1 次，且无 Shopping 分区');

    // 已逾期
    var overdueShop = DashboardEngine.buildTodayDashboard([
      _dbTask_('D3', 'milk-overdue', { due_date: _dbRelDate_(-3), category: 'SHOPPING' })
    ]);
    _dbCheck_(st, _dbCount_(overdueShop, 'milk-overdue') === 1 && overdueShop.indexOf('📦 Shopping') === -1,
      '已逾期的 SHOPPING 任务只应在 Overdue 出现 1 次，且无 Shopping 分区');

    // 混合：已在上面分区的不重复，其余的仍进入 category 分区
    var mixed = DashboardEngine.buildTodayDashboard([
      _dbTask_('M1', 'in-today',  { due_date: _dbRelDate_(0),  category: 'SHOPPING' }),
      _dbTask_('M2', 'in-future', { due_date: _dbRelDate_(15), category: 'SHOPPING' })
    ]);
    var lines = mixed.split('\n');
    var idx = lines.indexOf('📦 Shopping');
    _dbCheck_(st, idx !== -1 && lines[idx + 1] === 'in-future' && lines.length === idx + 2,
      'Shopping 分区应只含 in-future，实际 ' + JSON.stringify(lines));
    _dbCheck_(st, _dbCount_(mixed, 'in-today') === 1, 'in-today 只应出现 1 次，实际 ' + _dbCount_(mixed, 'in-today'));
  });
}

// ============================================================
// 聚合入口
// ============================================================
function runDashboardEngineCoverageGate() {
  var results = [
    testDashboardEngine_BuildRoutingAndFallback_(),
    testDashboardEngine_EmptyToday_(),
    testDashboardEngine_SingleTaskRendering_(),
    testDashboardEngine_StatisticsNineItems_(),
    testDashboardEngine_CategoryGrouping_(),
    testDashboardEngine_CategoryDeduplication_()
  ];
  var passCount = results.filter(function (r) { return r; }).length;
  Logger.log('========== runDashboardEngineCoverageGate: ' + passCount + '/' + results.length + ' PASS ==========');
  return passCount === results.length;
}
