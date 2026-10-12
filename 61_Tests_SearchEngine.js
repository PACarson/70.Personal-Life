/**
 * 61_Tests_SearchEngine.gs
 * Personal Life OS —— 23_SearchEngine.gs Deterministic Coverage
 * 2026-10-06 新增，Carson 明确授权的 TEST-ONLY 工作项（Testing Coverage，
 * Scope Decision：23/24/25/26 四个纯函数 Engine）。
 *
 * 全部是纯内存数据：不读 Sheet、不调外部 API、不写任何东西。日期全部用
 * 固定的 'yyyy-MM-dd' 字符串，不依赖运行当天是哪天（SearchEngine 本身
 * 不读当前时间）。
 *
 * 行为证据（三者一致才测，见 Scope Decision 第 2 节）：
 *   Engine Contract  : 23_SearchEngine.gs 文件头 Engine Contract + query 参数说明
 *   Command Reference: 00_Command_Reference.gs V11 + G2(d)
 *   Production Code  : 23_SearchEngine.js search()/searchByKeyword()
 *
 * 覆盖：
 *   一、五字段全文搜索（title/description/notes/tags/category）
 *   二、全文搜索大小写不敏感
 *   三、title 专项过滤
 *   四、category / priority / status 过滤
 *   五、recurring true / false
 *   六、tag 精确匹配
 *   七、dateFrom / dateTo 包含边界
 *   八、空 query 返回全部
 *   九、searchByKeyword 与 search({text}) 等价
 *   十、DONE / CANCELLED 不被搜索逻辑自动排除
 *
 * 本轮刻意不测（不是漏测）：
 *   - 带具体时间的 due_date 与 dateTo 的比较（'yyyy-MM-ddTHH:mm' 晚于
 *     dateTo 当天零点，会被排除）——文件头/Command Reference 没有写这条
 *     规则，测它等于新增 contract
 *   - category/priority/status/tag 的大小写与空白处理细节——文件头只写了
 *     "tag 精确匹配"，没写大小写/trim，这里只测"完整值匹配"，不测这些细节
 *   - 多个维度同时给出时的组合语义
 *
 * 单一入口 runSearchEngineCoverageGate()。
 */

// ============================================================
// 工具（前缀 _se，避免跟全局其他文件重名）
// ============================================================
function _seCheck_(st, cond, msg) {
  if (!cond) {
    Logger.log('❌ ' + msg);
    st.pass = false;
  }
}
function _seIds_(arr) {
  return arr.map(function (t) { return t.task_id; });
}
function _seSame_(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function _seTask_(overrides) {
  var base = {
    task_id: '', title: '', description: '', notes: '', tags: '',
    category: 'GENERAL', priority: 'MEDIUM', status: 'PENDING',
    recurring: '', due_date: ''
  };
  Object.keys(overrides).forEach(function (k) { base[k] = overrides[k]; });
  return base;
}
function _seWrap_(name, fn) {
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
// 一、五字段全文搜索
// ============================================================
function testSearchEngine_FullTextFiveFields_() {
  return _seWrap_('testSearchEngine_FullTextFiveFields_', function (st) {
    // 每个关键字只出现在一个任务的一个字段里
    var tasks = [
      _seTask_({ task_id: 'T_TITLE', title: 'alpha errand' }),
      _seTask_({ task_id: 'T_DESC',  title: 'x1', description: 'bravo details' }),
      _seTask_({ task_id: 'T_NOTES', title: 'x2', notes: 'charlie memo' }),
      _seTask_({ task_id: 'T_TAGS',  title: 'x3', tags: 'delta,echo' }),
      _seTask_({ task_id: 'T_CAT',   title: 'x4', category: 'MAINTENANCE' })
    ];
    var cases = [
      ['alpha', 'T_TITLE'], ['bravo', 'T_DESC'], ['charlie', 'T_NOTES'],
      ['delta', 'T_TAGS'],  ['maintenance', 'T_CAT']
    ];
    cases.forEach(function (c) {
      var got = _seIds_(SearchEngine.search(tasks, { text: c[0] }));
      _seCheck_(st, _seSame_(got, [c[1]]),
        'text=' + c[0] + ' 期望只命中 ' + c[1] + '，实际 ' + JSON.stringify(got));
    });
    // 包含匹配（不是整词匹配）
    var partial = _seIds_(SearchEngine.search(tasks, { text: 'rran' }));
    _seCheck_(st, _seSame_(partial, ['T_TITLE']),
      'text=rran（子串）期望命中 T_TITLE，实际 ' + JSON.stringify(partial));
    // 没有任何字段包含 → 空
    var none = SearchEngine.search(tasks, { text: 'zzz-not-present' });
    _seCheck_(st, none.length === 0, '无匹配关键字应返回空数组，实际 ' + none.length + ' 条');
  });
}

// ============================================================
// 二、全文搜索大小写不敏感
// ============================================================
function testSearchEngine_FullTextCaseInsensitive_() {
  return _seWrap_('testSearchEngine_FullTextCaseInsensitive_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'T1', title: 'Buy MiLk' }),
      _seTask_({ task_id: 'T2', title: 'other', description: 'LOWER and UPPER' })
    ];
    ['milk', 'MILK', 'mIlK'].forEach(function (q) {
      var got = _seIds_(SearchEngine.search(tasks, { text: q }));
      _seCheck_(st, _seSame_(got, ['T1']), 'text=' + q + ' 期望 [T1]，实际 ' + JSON.stringify(got));
    });
    ['lower', 'UPPER', 'Lower And'].forEach(function (q) {
      var got = _seIds_(SearchEngine.search(tasks, { text: q }));
      _seCheck_(st, _seSame_(got, ['T2']), 'text=' + q + ' 期望 [T2]，实际 ' + JSON.stringify(got));
    });
  });
}

// ============================================================
// 三、title 专项过滤（只搜 title）
// ============================================================
function testSearchEngine_TitleFilter_() {
  return _seWrap_('testSearchEngine_TitleFilter_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'T_IN_TITLE',  title: 'Renew passport' }),
      _seTask_({ task_id: 'T_IN_DESC',   title: 'Errand', description: 'passport photo' }),
      _seTask_({ task_id: 'T_IN_NOTES',  title: 'Errand 2', notes: 'passport' })
    ];
    var got = _seIds_(SearchEngine.search(tasks, { title: 'passport' }));
    _seCheck_(st, _seSame_(got, ['T_IN_TITLE']),
      'title=passport 只应命中 title 字段，期望 [T_IN_TITLE]，实际 ' + JSON.stringify(got));
    // 对照：同一个词用 text 会命中三个（证明 title 过滤确实更窄）
    var viaText = _seIds_(SearchEngine.search(tasks, { text: 'passport' }));
    _seCheck_(st, viaText.length === 3, 'text=passport 对照应命中 3 条，实际 ' + viaText.length);
  });
}

// ============================================================
// 四、category / priority / status 过滤
// ============================================================
function testSearchEngine_CategoryPriorityStatus_() {
  return _seWrap_('testSearchEngine_CategoryPriorityStatus_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'A', category: 'SHOPPING',    priority: 'HIGH',   status: 'PENDING' }),
      _seTask_({ task_id: 'B', category: 'MAINTENANCE', priority: 'LOW',    status: 'DONE' }),
      _seTask_({ task_id: 'C', category: 'SHOPPING',    priority: 'MEDIUM', status: 'CANCELLED' })
    ];
    var byCat = _seIds_(SearchEngine.search(tasks, { category: 'SHOPPING' }));
    _seCheck_(st, _seSame_(byCat, ['A', 'C']), 'category=SHOPPING 期望 [A,C]，实际 ' + JSON.stringify(byCat));
    var byPri = _seIds_(SearchEngine.search(tasks, { priority: 'HIGH' }));
    _seCheck_(st, _seSame_(byPri, ['A']), 'priority=HIGH 期望 [A]，实际 ' + JSON.stringify(byPri));
    var byStatus = _seIds_(SearchEngine.search(tasks, { status: 'DONE' }));
    _seCheck_(st, _seSame_(byStatus, ['B']), 'status=DONE 期望 [B]，实际 ' + JSON.stringify(byStatus));
    var noHit = SearchEngine.search(tasks, { category: 'HEALTH' });
    _seCheck_(st, noHit.length === 0, 'category=HEALTH 应无命中，实际 ' + noHit.length);
  });
}

// ============================================================
// 五、recurring true / false
// ============================================================
function testSearchEngine_RecurringTrueFalse_() {
  return _seWrap_('testSearchEngine_RecurringTrueFalse_', function (st) {
    var noRecurringField = _seTask_({ task_id: 'R_NONE' });
    delete noRecurringField.recurring;
    var tasks = [
      _seTask_({ task_id: 'R_DAILY',  recurring: 'Daily' }),
      _seTask_({ task_id: 'R_MONTHLY', recurring: 'Monthly' }),
      _seTask_({ task_id: 'R_EMPTY',  recurring: '' }),
      noRecurringField
    ];
    var only = _seIds_(SearchEngine.search(tasks, { recurring: true }));
    _seCheck_(st, _seSame_(only, ['R_DAILY', 'R_MONTHLY']),
      'recurring=true 期望只要 recurring 非空的，实际 ' + JSON.stringify(only));
    var without = _seIds_(SearchEngine.search(tasks, { recurring: false }));
    _seCheck_(st, _seSame_(without, ['R_EMPTY', 'R_NONE']),
      'recurring=false 期望只要没有 recurring 的，实际 ' + JSON.stringify(without));
    // 不传 recurring → 不按这一维过滤
    var all = SearchEngine.search(tasks, {});
    _seCheck_(st, all.length === 4, '不传 recurring 应不过滤，期望 4 条，实际 ' + all.length);
  });
}

// ============================================================
// 六、tag 精确匹配
// ============================================================
function testSearchEngine_TagExactMatch_() {
  return _seWrap_('testSearchEngine_TagExactMatch_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'G1', tags: 'work,urgent' }),
      _seTask_({ task_id: 'G2', tags: 'urgently,home' }),
      _seTask_({ task_id: 'G3', tags: 'home' }),
      _seTask_({ task_id: 'G4', tags: '' })
    ];
    var hit = _seIds_(SearchEngine.search(tasks, { tag: 'urgent' }));
    _seCheck_(st, _seSame_(hit, ['G1']),
      'tag=urgent 是精确匹配，不应命中 urgently，期望 [G1]，实际 ' + JSON.stringify(hit));
    var prefix = SearchEngine.search(tasks, { tag: 'urg' });
    _seCheck_(st, prefix.length === 0, 'tag=urg（只是前缀）不应命中，实际 ' + prefix.length + ' 条');
    var home = _seIds_(SearchEngine.search(tasks, { tag: 'home' }));
    _seCheck_(st, _seSame_(home, ['G2', 'G3']), 'tag=home 期望 [G2,G3]，实际 ' + JSON.stringify(home));
  });
}

// ============================================================
// 七、dateFrom / dateTo 包含边界（只用纯日期字符串）
// ============================================================
function testSearchEngine_DateRangeInclusive_() {
  return _seWrap_('testSearchEngine_DateRangeInclusive_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'D09', due_date: '2026-10-09' }),
      _seTask_({ task_id: 'D10', due_date: '2026-10-10' }),
      _seTask_({ task_id: 'D11', due_date: '2026-10-11' }),
      _seTask_({ task_id: 'D12', due_date: '2026-10-12' })
    ];
    var range = _seIds_(SearchEngine.search(tasks, { dateFrom: '2026-10-10', dateTo: '2026-10-11' }));
    _seCheck_(st, _seSame_(range, ['D10', 'D11']),
      '[10-10, 10-11] 两端都应包含，期望 [D10,D11]，实际 ' + JSON.stringify(range));
    var fromOnly = _seIds_(SearchEngine.search(tasks, { dateFrom: '2026-10-11' }));
    _seCheck_(st, _seSame_(fromOnly, ['D11', 'D12']),
      'dateFrom=10-11 应包含当天，期望 [D11,D12]，实际 ' + JSON.stringify(fromOnly));
    var toOnly = _seIds_(SearchEngine.search(tasks, { dateTo: '2026-10-10' }));
    _seCheck_(st, _seSame_(toOnly, ['D09', 'D10']),
      'dateTo=10-10 应包含当天，期望 [D09,D10]，实际 ' + JSON.stringify(toOnly));
    var single = _seIds_(SearchEngine.search(tasks, { dateFrom: '2026-10-10', dateTo: '2026-10-10' }));
    _seCheck_(st, _seSame_(single, ['D10']),
      'dateFrom=dateTo=10-10 应只命中当天，期望 [D10]，实际 ' + JSON.stringify(single));
  });
}

// ============================================================
// 八、空 query 返回全部
// ============================================================
function testSearchEngine_EmptyQueryReturnsAll_() {
  return _seWrap_('testSearchEngine_EmptyQueryReturnsAll_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'E1', title: 'a' }),
      _seTask_({ task_id: 'E2', title: 'b', status: 'DONE' }),
      _seTask_({ task_id: 'E3', title: 'c', status: 'CANCELLED' })
    ];
    var got = _seIds_(SearchEngine.search(tasks, {}));
    _seCheck_(st, _seSame_(got, ['E1', 'E2', 'E3']), '空 query 期望返回全部 3 条，实际 ' + JSON.stringify(got));
    var empty = SearchEngine.search([], {});
    _seCheck_(st, empty.length === 0, '空任务数组 + 空 query 应返回空数组，实际 ' + empty.length);
  });
}

// ============================================================
// 九、searchByKeyword 与 search({text}) 等价
// ============================================================
function testSearchEngine_KeywordEquivalence_() {
  return _seWrap_('testSearchEngine_KeywordEquivalence_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'K1', title: 'Buy milk', tags: 'food' }),
      _seTask_({ task_id: 'K2', title: 'Call plumber', description: 'about MILK delivery' }),
      _seTask_({ task_id: 'K3', title: 'Other', category: 'SHOPPING' })
    ];
    ['milk', 'MILK', 'shopping', 'food', 'nothing-matches'].forEach(function (k) {
      var viaKeyword = _seIds_(SearchEngine.searchByKeyword(tasks, k));
      var viaSearch  = _seIds_(SearchEngine.search(tasks, { text: k }));
      _seCheck_(st, _seSame_(viaKeyword, viaSearch),
        'keyword=' + k + ' 两条路径应等价：' + JSON.stringify(viaKeyword) + ' vs ' + JSON.stringify(viaSearch));
    });
  });
}

// ============================================================
// 十、DONE / CANCELLED 不被搜索逻辑自动排除（Command Reference G2(d)：刻意设计）
// ============================================================
function testSearchEngine_DoesNotExcludeTerminalStates_() {
  return _seWrap_('testSearchEngine_DoesNotExcludeTerminalStates_', function (st) {
    var tasks = [
      _seTask_({ task_id: 'S_PENDING',   title: 'report draft', status: 'PENDING' }),
      _seTask_({ task_id: 'S_DONE',      title: 'report final', status: 'DONE' }),
      _seTask_({ task_id: 'S_CANCELLED', title: 'report old',   status: 'CANCELLED' })
    ];
    // Telegram /search 固定只传 {text: keyword}，不带 status
    var got = _seIds_(SearchEngine.search(tasks, { text: 'report' }));
    _seCheck_(st, _seSame_(got, ['S_PENDING', 'S_DONE', 'S_CANCELLED']),
      '不传 status 时 DONE/CANCELLED 也应被搜出来，实际 ' + JSON.stringify(got));
    var viaKeyword = _seIds_(SearchEngine.searchByKeyword(tasks, 'report'));
    _seCheck_(st, viaKeyword.length === 3, 'searchByKeyword 同样不排除终态，期望 3 条，实际 ' + viaKeyword.length);
    // 显式传 status 时才按 status 过滤
    var onlyDone = _seIds_(SearchEngine.search(tasks, { text: 'report', status: 'DONE' }));
    _seCheck_(st, _seSame_(onlyDone, ['S_DONE']), '显式 status=DONE 期望 [S_DONE]，实际 ' + JSON.stringify(onlyDone));
  });
}

// ============================================================
// 聚合入口
// ============================================================
function runSearchEngineCoverageGate() {
  var results = [
    testSearchEngine_FullTextFiveFields_(),
    testSearchEngine_FullTextCaseInsensitive_(),
    testSearchEngine_TitleFilter_(),
    testSearchEngine_CategoryPriorityStatus_(),
    testSearchEngine_RecurringTrueFalse_(),
    testSearchEngine_TagExactMatch_(),
    testSearchEngine_DateRangeInclusive_(),
    testSearchEngine_EmptyQueryReturnsAll_(),
    testSearchEngine_KeywordEquivalence_(),
    testSearchEngine_DoesNotExcludeTerminalStates_()
  ];
  var passCount = results.filter(function (r) { return r; }).length;
  Logger.log('========== runSearchEngineCoverageGate: ' + passCount + '/' + results.length + ' PASS ==========');
  return passCount === results.length;
}
