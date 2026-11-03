/**
 * ════════════════════════════════════════════════════════════════════════
 *  F2_ActiveOnly_Investigation_ReadOnly.js
 *  临时核查脚本（TEMPORARY · STANDALONE · READ-ONLY）—— 不是正式项目的一部分
 * ════════════════════════════════════════════════════════════════════════
 *  授权依据：Carson 2026-11-03「调查 ActiveTasks 与 Tasks 的 203 条差异」。
 *  目的：查清「只在 ActiveTasks、不在 Tasks」的任务是什么、来自哪里、有没有实际影响。
 *        只调查，不修复，不清理。
 *
 *  数据范围：只读 Events / Tasks / ActiveTasks / ArchiveTasks 四张表。
 *  不读其他 Sheet，不列出 Sheet 名单，不读 Script Properties
 *  （仅当 SPREADSHEET_ID 留空时，只读 SPREADSHEET_ID 这一个键）。
 *
 *  只读保证（代码层）：
 *   - 全文只有 F2C_readSheet_() 接触 Spreadsheet 数据，只调用
 *     getSheetByName / getLastRow / getLastColumn / getRange().getValues()；
 *     另有 openById、getName、getId、getSpreadsheetTimeZone 用于确认身份。
 *   - 不写任何单元格，不发布事件，不调用正式项目的任何函数，
 *     不创建 Trigger，不访问网络。输出只走 Logger.log。
 *
 *  隐私：不输出完整标题清单，不输出原始 chat_id。
 *   - 标题只输出「匹配到的仓库测试用例原文」或结构指纹（字符集 + 长度档）。
 *   - 聊天只输出分组标签（G1 = 事件最多的聊天）和测试聊天的前缀类别；
 *     仅对事件最多的几个真实形态聊天输出掩码（前 3 后 2 位）。
 *
 *  证据等级：报告里 LIVE = 真实 Spreadsheet 数据；STATIC = 仓库代码与测试文件
 *  （本文件里的常量）；INFERENCE = 由前两者推出。
 *
 *  不要把本文件加入正式项目的版本库，不要部署，不要加 Trigger。
 *  运行步骤见文件末尾 RUNBOOK。
 */

// ───────────────────────── 配置 ─────────────────────────
var F2C_CONFIG = {
  // 真实 Spreadsheet 的 ID（与正式项目 Script Properties 里的 SPREADSHEET_ID 同一个值）。
  // 在正式项目里运行时可留空（只读那一个键）；在独立项目里必须填。
  SPREADSHEET_ID: '',

  // 正式项目 scriptId 的首尾片段（来自 .clasp.json），只用于判断是否在正式项目里运行。
  FORMAL_SCRIPT_ID_PREFIX: '1oIcP-',
  FORMAL_SCRIPT_ID_SUFFIX: 'SDuYPl',

  SHEETS: { EVENTS: 'Events', TASKS: 'Tasks', ACTIVE: 'ActiveTasks', ARCHIVE: 'ArchiveTasks' },
  EVENT_TYPE: 'TASK_CREATED',

  // STATIC：任务状态词表（来自仓库代码：投影代码里对 ActiveTasks 的删除逻辑、
  // 工作流引擎的终态常量、UI 桥接层的非终态常量）。
  // 不在这两个集合里的状态一律视为「未识别」，不做任何含义假设。
  TERMINAL_STATUSES: ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'],
  NONTERMINAL_STATUSES: ['PENDING', 'BLOCKED', 'WAITING'],

  // STATIC：仓库测试文件构造 chat_id 的方式：前缀 + new Date().getTime()，或固定字面量。
  // 没有任何测试使用 7 位以上的纯数字（Telegram 形态）chat_id。
  TEST_CHAT_PREFIXES: ['accept_test_', 'identity_gate_', 'ui_interact_test_', 'due_date_canon_test_'],
  TEST_CHAT_LITERALS: ['123'],

  // STATIC：仓库测试文件里的任务标题特征（仅作辅助证据，单独不足以下结论）。
  TEST_TITLE_PREFIXES: ['验收测试', '身份回归测试', '回归测试', 'canonicalization 回归'],
  TEST_TITLE_LITERALS: [
    '不会被改动的任务', '健康任务', '先取消再尝试完成的任务', '取消的任务', '唯一步骤', '打包物品', '收衣',
    '整理车库', '晾衣', '标记完成的任务', '检查外墙', '检查水电', '洗衣', '测试', '编辑前标题', '编辑后标题',
    '编辑后项目标题', '联系搬家公司', '询问 AI 优先级的任务', '购物任务', '通过 Add Task 创建', '采纳建议的任务',
    'Ctx Task', 'Ctx Task Renamed', 'Legacy Task', 'Errand 2', 'alpha errand', 'report draft', 'report final', 'report old'
  ],

  // LIVE 数据上的辅助信号参数
  BURST_WINDOW_MIN: 5,        // 以某事件为中心 ±5 分钟
  BURST_MIN_EVENTS: 8,        // 窗口内 TASK_CREATED ≥ 8 条（含自身）视为「突发创建」
  ONE_OFF_MAX_EVENTS: 6,      // 单次性聊天：TASK_CREATED ≤ 6 条
  ONE_OFF_MAX_DATES: 2,       //            且分布在 ≤ 2 个日期
  RECURRING_MIN_DATES: 3,     // 持续使用的聊天：分布在 ≥ 3 个不同日期
  CHAT_TS_TOLERANCE_MIN: 120, // chat_id 末尾内嵌的毫秒时间戳与事件时间相差 ≤ 120 分钟视为一致

  FOCUS_DATE: '2026-09-07',   // 重点日期（脚本时区）
  MAX_LIST_IDS: 60            // 各清单最多打印多少个 task_id
};

// ───────────────────────── 纯函数小工具（不接触任何 Google 服务） ─────────────────────────
function F2C_trim_(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function F2C_mask_(s) {
  s = F2C_trim_(s);
  if (!s) return '(none)';
  if (s.length <= 12) return s.slice(0, 2) + '…(len ' + s.length + ')';
  return s.slice(0, 6) + '…' + s.slice(-4);
}

function F2C_maskChat_(s) {
  s = F2C_trim_(s);
  if (s.length <= 6) return s.slice(0, 1) + '…(len ' + s.length + ')';
  return s.slice(0, 3) + '…' + s.slice(-2);
}

function F2C_toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = F2C_trim_(v);
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function F2C_bump_(obj, key, by) {
  obj[key] = (obj[key] || 0) + (by === undefined ? 1 : by);
}

function F2C_sortedKeysByCount_(obj) {
  return Object.keys(obj).sort(function (a, b) {
    return obj[b] - obj[a] || (a < b ? -1 : a > b ? 1 : 0);
  });
}

function F2C_setOf_(arr) {
  var o = Object.create(null);
  arr.forEach(function (x) { o[x] = true; });
  return o;
}

function F2C_resolveCols_(headers, names) {
  var counts = Object.create(null), first = Object.create(null);
  for (var i = 0; i < headers.length; i++) {
    var h = F2C_trim_(headers[i]);
    if (!h) continue;
    counts[h] = (counts[h] || 0) + 1;
    if (first[h] === undefined) first[h] = i;
  }
  var idx = {}, missing = [], ambiguous = [];
  names.forEach(function (n) {
    if (!counts[n]) { idx[n] = -1; missing.push(n); }
    else { idx[n] = first[n]; if (counts[n] > 1) ambiguous.push(n); }
  });
  return { idx: idx, missing: missing, ambiguous: ambiguous };
}

function F2C_parsePayload_(raw) {
  if (raw === null || raw === undefined || raw === '') return { ok: false, reason: 'EMPTY_PAYLOAD' };
  if (typeof raw !== 'string') return { ok: false, reason: 'PAYLOAD_NOT_TEXT' };
  var o;
  try { o = JSON.parse(raw); } catch (e) { return { ok: false, reason: 'PAYLOAD_PARSE_ERROR' }; }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) return { ok: false, reason: 'PAYLOAD_NOT_OBJECT' };
  return { ok: true, obj: o };
}

/** chat_id 的「形态」分类。只返回类别标签，不返回原始值（测试聊天的标签已去掉时间戳后缀）。 */
function F2C_classifyChat_(chat, cfg, evTs) {
  var s = F2C_trim_(chat), i, p;
  if (!s) return { form: 'EMPTY', label: '(empty)', tsOk: null };
  for (i = 0; i < cfg.TEST_CHAT_PREFIXES.length; i++) {
    p = cfg.TEST_CHAT_PREFIXES[i];
    if (s.indexOf(p) === 0) {
      var m = /(\d{13})$/.exec(s), tsOk = null;
      if (m && evTs) tsOk = Math.abs(Number(m[1]) - evTs.getTime()) <= cfg.CHAT_TS_TOLERANCE_MIN * 60000;
      return { form: 'TEST', label: s.replace(/\d{10,}$/, ''), tsOk: tsOk };
    }
  }
  if (cfg.TEST_CHAT_LITERALS.indexOf(s) !== -1) return { form: 'TEST', label: s, tsOk: null };
  if (/^-?\d{7,}$/.test(s)) return { form: 'REAL_FORM', label: 'REAL_FORM', tsOk: null };
  if (/^-?\d{1,6}$/.test(s)) return { form: 'OTHER', label: 'SHORT_NUMERIC', tsOk: null };
  // 未识别形态：只给前 8 个字符的形状（数字一律换成 #），用来识别前缀，不暴露原值。
  return { form: 'OTHER', label: 'OTHER_FORM:' + s.slice(0, 8).replace(/\d/g, '#') + (s.length > 8 ? '…' : ''), tsOk: null };
}

/** 标题特征分类。只返回「仓库测试用例原文」或结构指纹，不返回用户标题本身。 */
function F2C_classifyTitle_(title, cfg) {
  var t = F2C_trim_(title).replace(/\s+/g, ' '), i;
  if (!t) return { cls: 'EMPTY', hit: false, label: '(empty)' };
  for (i = 0; i < cfg.TEST_TITLE_PREFIXES.length; i++) {
    if (t.indexOf(cfg.TEST_TITLE_PREFIXES[i]) === 0) return { cls: 'TEST_PREFIX', hit: true, label: cfg.TEST_TITLE_PREFIXES[i] };
  }
  if (cfg.TEST_TITLE_LITERALS.indexOf(t) !== -1) return { cls: 'TEST_LITERAL', hit: true, label: t };
  if (/(^|[\s#_\-])\d{1,4}$|\(\d+\)$|^\d+[.、)]/.test(t)) return { cls: 'NUMBERED', hit: false, label: 'NUMBERED' };
  var cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length, lat = (t.match(/[A-Za-z]/g) || []).length, len = t.length;
  var cs = cjk && lat ? 'MIXED' : cjk ? 'CJK' : lat ? 'LATIN' : 'OTHER';
  var b = len <= 3 ? '1-3' : len <= 6 ? '4-6' : len <= 12 ? '7-12' : '13+';
  return { cls: 'UNKNOWN', hit: false, label: cs + '/len' + b };
}

/** 与任务引擎里 deriveFromEvent 同一套规则（STATIC）：按事件顺序重放得到「应有状态」。 */
function F2C_replay_(events) {
  var st = null;
  events.forEach(function (e) {
    var p = e.payload || {}, k;
    switch (e.type) {
      case 'TASK_CREATED':
        st = {};
        for (k in p) st[k] = p[k];
        if (!F2C_trim_(st.chat_id)) st.chat_id = e.chat;
        break;
      case 'TASK_UPDATED':
        if (st) { for (k in p) { if (k !== 'task_id') st[k] = p[k]; } }
        break;
      case 'TASK_COMPLETED': if (st) st.status = 'DONE'; break;
      case 'TASK_CANCELLED': if (st) st.status = 'CANCELLED'; break;
      case 'TASK_NOT_SELECTED': if (st) st.status = 'NOT_SELECTED'; break;
      case 'TASK_CONVERTED_TO_PROJECT': if (st) st.status = 'CONVERTED'; break;
      case 'TASK_CONVERTED_TO_NOTE': if (st) st.status = 'CONVERTED'; break;
      default: break;
    }
  });
  return st;
}

/** 以每个事件为中心 ±windowMin 分钟内的 TASK_CREATED 条数 ≥ minEvents 即为「突发创建」。 */
function F2C_markBursts_(created, windowMin, minEvents) {
  var withTs = created.filter(function (e) { return !!e.ts; })
    .sort(function (a, b) { return a.ts.getTime() - b.ts.getTime() || a.row - b.row; });
  var w = windowMin * 60000, lo = 0, hi = 0, n = withTs.length, i;
  for (i = 0; i < n; i++) {
    var t = withTs[i].ts.getTime();
    while (withTs[lo].ts.getTime() < t - w) lo++;
    while (hi < n && withTs[hi].ts.getTime() <= t + w) hi++;
    withTs[i].burst = (hi - lo) >= minEvents;
  }
  created.forEach(function (e) { if (!e.ts) e.burst = null; });
}

// ───────────────────────── 读取（全文唯一接触 Spreadsheet 数据的地方；仅四张表） ─────────────────────────
function F2C_readSheet_(ss, name) {
  var out = { name: name, exists: false, readError: '', lastRow: 0, lastCol: 0, headers: [], rows: [] };
  try {
    var sh = ss.getSheetByName(name);
    if (!sh) return out;
    out.exists = true;
    out.lastRow = sh.getLastRow();
    out.lastCol = sh.getLastColumn();
    if (out.lastRow < 1 || out.lastCol < 1) return out;
    var values = sh.getRange(1, 1, out.lastRow, out.lastCol).getValues();
    out.headers = values[0].map(function (h) { return F2C_trim_(h); });
    out.rows = values.slice(1);
  } catch (e) {
    out.readError = String(e && e.message ? e.message : e);
  }
  return out;
}

// ───────────────────────── 运行环境（真实 Apps Script 运行时） ─────────────────────────
function F2C_buildEnv_() {
  var tz = 'UTC';
  try { tz = Session.getScriptTimeZone() || 'UTC'; } catch (e) {}
  return {
    runtime: 'apps-script',
    tz: tz,
    now: function () { return new Date(); },
    fmt: function (d, pattern) { return Utilities.formatDate(d, tz, pattern); },
    scriptId: function () { try { return ScriptApp.getScriptId(); } catch (e) { return ''; } },
    scriptProp: function (name) {
      try { return PropertiesService.getScriptProperties().getProperty(name); } catch (e) { return null; }
    },
    openById: function (id) { return SpreadsheetApp.openById(id); }
  };
}

function F2C_collectContext_(cfg, env) {
  var now = env.now();
  var sid = F2C_trim_(env.scriptId());
  var formal = !!sid &&
    sid.indexOf(cfg.FORMAL_SCRIPT_ID_PREFIX) === 0 &&
    sid.slice(-cfg.FORMAL_SCRIPT_ID_SUFFIX.length) === cfg.FORMAL_SCRIPT_ID_SUFFIX;
  return {
    runtime: env.runtime,
    runAtUtc: now.toISOString(),
    runAtLocal: env.fmt(now, 'yyyy-MM-dd HH:mm:ss'),
    tz: env.tz,
    scriptIdMasked: F2C_mask_(sid),
    formalScriptIdMatch: formal,
    context: formal
      ? 'FORMAL_PROJECT（scriptId 首尾片段与 .clasp.json 一致）'
      : 'STANDALONE_SCRATCH（scriptId 与正式项目不同或读不到；正式项目身份需手动对照）',
    idSource: ''
  };
}

function F2C_resolveSpreadsheetId_(cfg, env) {
  var id = F2C_trim_(cfg.SPREADSHEET_ID);
  if (id) return { id: id, source: 'F2C_CONFIG.SPREADSHEET_ID' };
  var p = F2C_trim_(env.scriptProp('SPREADSHEET_ID'));
  if (p) return { id: p, source: 'Script Properties[SPREADSHEET_ID]（只读这一个键）' };
  return { id: '', source: '' };
}

// ───────────────────────── 执行（读 → 分析），不输出 ─────────────────────────
function F2C_execute_(cfg, env) {
  var res = {
    stop: null, ctx: F2C_collectContext_(cfg, env), spreadsheet: null,
    reads: {}, analysis: null, liveRead: false
  };
  var idInfo = F2C_resolveSpreadsheetId_(cfg, env);
  res.ctx.idSource = idInfo.source || '(none)';
  if (!idInfo.id) {
    res.stop = { code: 'SPREADSHEET_IDENTITY_UNCONFIRMED', detail: 'SPREADSHEET_ID 为空，且当前环境读不到 Script Properties 里的 SPREADSHEET_ID' };
    return res;
  }
  var ss = null;
  try { ss = env.openById(idInfo.id); }
  catch (e) {
    res.stop = { code: 'SPREADSHEET_IDENTITY_UNCONFIRMED', detail: 'openById 失败：' + String(e && e.message ? e.message : e) };
    return res;
  }
  var ssName = '', ssId = '', ssTz = '';
  try { ssName = ss.getName(); } catch (e1) {}
  try { ssId = ss.getId(); } catch (e2) {}
  try { ssTz = ss.getSpreadsheetTimeZone(); } catch (e3) {}
  res.spreadsheet = {
    name: ssName, idMasked: F2C_mask_(ssId || idInfo.id),
    idEqualsInput: !!ssId && ssId === idInfo.id, timeZone: ssTz
  };

  var data = {
    events: F2C_readSheet_(ss, cfg.SHEETS.EVENTS),
    tasks: F2C_readSheet_(ss, cfg.SHEETS.TASKS),
    active: F2C_readSheet_(ss, cfg.SHEETS.ACTIVE),
    archive: F2C_readSheet_(ss, cfg.SHEETS.ARCHIVE)
  };
  Object.keys(data).forEach(function (k) {
    var d = data[k];
    res.reads[k] = { name: d.name, exists: d.exists, readError: d.readError, lastRow: d.lastRow, lastCol: d.lastCol, headers: d.headers, rowsRead: d.rows.length };
  });
  res.liveRead = data.events.exists && !data.events.readError;
  res.analysis = F2C_analyze_(data, cfg, env);
  if (res.analysis.stop) res.stop = res.analysis.stop;
  return res;
}

// ───────────────────────── 分析（纯函数：只处理内存里的数组） ─────────────────────────
function F2C_indexSheet_(sheet, c, cfg) {
  var byId = Object.create(null), blank = 0, idRows = 0, forms = { TEST: 0, REAL_FORM: 0, OTHER: 0, EMPTY: 0 };
  sheet.rows.forEach(function (r, i) {
    var id = F2C_trim_(r[c.task_id]);
    if (!id) { blank++; return; }
    idRows++;
    var rec = {
      row: i + 2,
      status: c.status >= 0 ? F2C_trim_(r[c.status]).toUpperCase() : '',
      chat: c.chat_id >= 0 ? F2C_trim_(r[c.chat_id]) : '',
      title: c.title >= 0 ? F2C_trim_(r[c.title]) : ''
    };
    forms[F2C_classifyChat_(rec.chat, cfg, null).form]++;
    (byId[id] || (byId[id] = [])).push(rec);
  });
  return { byId: byId, blankRows: blank, idRows: idRows, distinctIds: Object.keys(byId).length, forms: forms };
}

/**
 * 分类规则（每条记录恰好归入一类；证据见 why）
 *  PROJECTION_INCONSISTENCY ：行与 Events 重放结果矛盾——终态却留在 ActiveTasks、状态/聊天漂移、
 *                             ActiveTasks 重复行。事件顺序异常或重复创建时，重放不可信，不据此下结论（转 UNKNOWN）。
 *  CONFIRMED_TEST_RESIDUE   ：chat_id 形态 = 仓库测试构造方式（前缀+毫秒时间戳或固定字面量），
 *                             并且至少有一项独立佐证：chat_id 内嵌时间戳与事件时间一致 / 标题命中测试特征 / 突发创建。
 *  CONFIRMED_VALID_ACTIVE_TASK：真实形态 chat_id（≥7 位纯数字）+ 聊天持续使用（≥3 个日期）+ 无测试特征 + 非突发
 *                             + 事件重放与行状态一致且为非终态 + 有 ActiveTasks 行。
 *  LIFECYCLE_EXPLAINED      ：非测试任务，事件显示已进入终态，且 ActiveTasks 里没有它（生命周期已走完）。
 *                             对「只在 ActiveTasks」的记录不可能成立（STATIC：没有任何代码路径删除 Tasks 行），按构造为 0。
 *  UNKNOWN                  ：其余一切（证据不足、冲突或状态未识别），附原因码。
 */
function F2C_classifyRecord_(r, cfg) {
  if (r.noCreated) return { cls: 'UNKNOWN', why: ['NO_CREATED_EVENT'] };
  var hard = r.hardRow.slice();
  if (!r.anomalies.length) hard = hard.concat(r.hardReplay);
  if (hard.length) return { cls: 'PROJECTION_INCONSISTENCY', why: hard };
  if (r.anomalies.length) return { cls: 'UNKNOWN', why: ['EVENT_ANOMALY:' + r.anomalies.join('+')] };

  if (r.chatForm.form === 'TEST') {
    var corr = [];
    if (r.chatForm.tsOk === true) corr.push('chat_ts');
    if (r.titleCls.hit) corr.push('title');
    if (r.burst === true) corr.push('burst');
    if (corr.length) return { cls: 'CONFIRMED_TEST_RESIDUE', why: ['chat_form_test'].concat(corr) };
    return { cls: 'UNKNOWN', why: ['TEST_CHAT_UNCORROBORATED'] };
  }
  if (!r.inA && r.expectedTerminal) return { cls: 'LIFECYCLE_EXPLAINED', why: ['terminal_events', 'no_active_row'] };

  var real = r.chatForm.form === 'REAL_FORM' && r.chatStat && r.chatStat.recurring && !r.titleCls.hit && r.burst !== true;
  if (r.inA && real && r.statusKnown && !r.rowTerminal && !r.expectedTerminal) {
    return { cls: 'CONFIRMED_VALID_ACTIVE_TASK', why: ['real_form_chat', 'recurring_chat', 'no_test_signals', 'lifecycle_consistent'] };
  }
  var why = [];
  if (!r.statusKnown) why.push('STATUS_UNRECOGNIZED');
  if (r.chatForm.form === 'REAL_FORM') {
    if (r.titleCls.hit || r.burst === true) why.push('REAL_FORM_WITH_TEST_LIKE_SIGNALS');
    if (!(r.chatStat && r.chatStat.recurring)) why.push('REAL_FORM_NOT_RECURRING');
  } else {
    why.push('CHAT_FORM_UNRECOGNIZED');
  }
  if (!r.inA) why.push('NO_ACTIVE_ROW_NOT_TERMINAL');
  if (!why.length) why.push('NO_STRONG_SIGNAL');
  return { cls: 'UNKNOWN', why: why };
}

function F2C_analyze_(data, cfg, env) {
  var A = {
    stop: null, gaps: [], cols: {}, sheetStats: {}, reliability: null,
    scope: null, classCounts: null, whyCombos: Object.create(null),
    chat: null, chatSheetForms: {}, status: null, dates: null, focus: null,
    titles: null, events: null, impact: null, lists: null, rOnly: null
  };
  var TYPE = cfg.EVENT_TYPE;
  var terminal = F2C_setOf_(cfg.TERMINAL_STATUSES);
  var known = F2C_setOf_(cfg.TERMINAL_STATUSES.concat(cfg.NONTERMINAL_STATUSES));

  // ── Events 结构 ──
  var ev = data.events;
  if (!ev.exists || ev.readError || ev.headers.length === 0) {
    A.stop = { code: 'EVENTS_UNREADABLE', detail: !ev.exists ? 'Events 表不存在' : (ev.readError ? '读取失败：' + ev.readError : 'Events 表为空') };
    return A;
  }
  var evc = F2C_resolveCols_(ev.headers, ['event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source']);
  A.cols.events = evc;
  var hardMissing = ['type', 'payload'].filter(function (n) { return evc.idx[n] < 0 || evc.ambiguous.indexOf(n) >= 0; });
  if (hardMissing.length) {
    A.stop = { code: 'EVENTS_STRUCTURE_MISMATCH', detail: '必需列缺失或重名：' + hardMissing.join(',') };
    return A;
  }

  // ── 三张任务表：task_id 必须存在且唯一，否则无法可靠关联 → STOP（ArchiveTasks 例外，仅降级） ──
  var defs = [['T', 'tasks', cfg.SHEETS.TASKS, true], ['A', 'active', cfg.SHEETS.ACTIVE, true], ['R', 'archive', cfg.SHEETS.ARCHIVE, false]];
  var idx = { T: null, A: null, R: null };
  var stopSheet = null;
  defs.forEach(function (d) {
    var sh = data[d[1]], nm = d[2], must = d[3];
    var problem = '';
    if (!sh.exists) problem = nm + ':ABSENT';
    else if (sh.readError) problem = nm + ':READ_ERROR';
    else {
      var c = F2C_resolveCols_(sh.headers, ['task_id', 'status', 'chat_id', 'title']);
      A.cols[d[1]] = c;
      if (c.idx.task_id < 0 || c.ambiguous.indexOf('task_id') >= 0) problem = nm + ':NO_UNIQUE_task_id_COLUMN';
      else {
        idx[d[0]] = F2C_indexSheet_(sh, c.idx, cfg);
        A.sheetStats[d[0]] = { idRows: idx[d[0]].idRows, blankIdRows: idx[d[0]].blankRows, distinctIds: idx[d[0]].distinctIds };
        A.chatSheetForms[d[0]] = idx[d[0]].forms;
      }
    }
    if (problem) { A.gaps.push(problem); if (must && !stopSheet) stopSheet = problem; }
  });
  if (stopSheet) {
    A.stop = { code: 'TASK_ID_ASSOCIATION_UNRELIABLE', detail: '无法可靠关联 task_id：' + A.gaps.join('; ') };
    return A;
  }

  // ── 扫描 Events：TASK_CREATED 与所有带 task_id 的事件 ──
  var typeIdx = evc.idx.type, payloadIdx = evc.idx.payload, tsIdx = evc.idx.timestamp, chatIdx = evc.idx.chat_id;
  var created = [], eventsByTask = Object.create(null), parseFailCreated = 0, parseFailOther = 0, createdNoId = 0;
  ev.rows.forEach(function (r, i) {
    var type = F2C_trim_(r[typeIdx]);
    if (!type) return;
    var raw = r[payloadIdx], isCreated = type === TYPE;
    if (!isCreated && !(typeof raw === 'string' && raw.indexOf('"task_id"') !== -1)) return;
    var p = F2C_parsePayload_(raw);
    if (!p.ok) { if (isCreated) parseFailCreated++; else parseFailOther++; return; }
    var tid = F2C_trim_(p.obj.task_id);
    if (!tid) { if (isCreated) createdNoId++; return; }
    var rec = {
      row: i + 2, type: type, taskId: tid,
      ts: tsIdx >= 0 ? F2C_toDate_(r[tsIdx]) : null,
      chat: chatIdx >= 0 ? F2C_trim_(r[chatIdx]) : '',
      payload: p.obj
    };
    if (!rec.chat) rec.chat = F2C_trim_(p.obj.chat_id);
    (eventsByTask[tid] || (eventsByTask[tid] = [])).push(rec);
    if (isCreated) created.push(rec);
  });
  A.reliability = {
    createdParsedWithId: created.length, createdParseFail: parseFailCreated, createdNoTaskId: createdNoId, otherEventParseFail: parseFailOther
  };
  created.forEach(function (e) {
    e.dkey = e.ts ? env.fmt(e.ts, 'yyyy-MM-dd') : 'n/a';
    e.hm = e.ts ? env.fmt(e.ts, 'HH:mm') : 'n/a';
  });
  F2C_markBursts_(created, cfg.BURST_WINDOW_MIN, cfg.BURST_MIN_EVENTS);

  // ── 聊天分组：G# 与第一次核查同一规则（按 TASK_CREATED 条数降序） ──
  var chatStats = Object.create(null);
  created.forEach(function (e) {
    var k = e.chat || '(empty)';
    var s = chatStats[k] || (chatStats[k] = { events: 0, dates: Object.create(null), form: null });
    s.events++;
    if (e.dkey !== 'n/a') s.dates[e.dkey] = true;
  });
  var chatCounts = Object.create(null);
  Object.keys(chatStats).forEach(function (k) { chatCounts[k] = chatStats[k].events; });
  var groupOf = Object.create(null), rankOrder = F2C_sortedKeysByCount_(chatCounts);
  rankOrder.forEach(function (k, n) {
    var s = chatStats[k];
    s.dateCount = Object.keys(s.dates).length;
    s.recurring = s.dateCount >= cfg.RECURRING_MIN_DATES;
    s.oneOff = s.events <= cfg.ONE_OFF_MAX_EVENTS && s.dateCount <= cfg.ONE_OFF_MAX_DATES;
    s.group = 'G' + (n + 1);
    s.form = F2C_classifyChat_(k === '(empty)' ? '' : k, cfg, null);
    groupOf[k] = s.group;
  });

  // ── 目标集合 ──
  var aOnlyIds = Object.keys(idx.A.byId).filter(function (id) { return !idx.T.byId[id]; });
  var rOnlyIds = idx.R ? Object.keys(idx.R.byId).filter(function (id) { return !idx.T.byId[id] && !idx.A.byId[id]; }) : [];
  var firstRow = function (id) { var e = eventsByTask[id]; return e && e.length ? e[0].row : Infinity; };
  var byEventOrder = function (a, b) { return firstRow(a) - firstRow(b) || (a < b ? -1 : 1); };
  aOnlyIds.sort(byEventOrder); rOnlyIds.sort(byEventOrder);

  // ── 单条记录的证据 ──
  function buildRecord(id) {
    var r = { id: id };
    var tRows = idx.T.byId[id] || [], aRows = idx.A.byId[id] || [], rRows = idx.R ? (idx.R.byId[id] || []) : [];
    r.inT = tRows.length > 0; r.inA = aRows.length > 0; r.inR = rRows.length > 0;
    r.place = [r.inT ? 'T' : '', r.inA ? 'A' : '', r.inR ? 'R' : ''].filter(Boolean).join('+') || 'none';
    r.aRow = aRows[0] || null;
    var evs = eventsByTask[id] || [];
    var cre = evs.filter(function (e) { return e.type === TYPE; });
    r.created = cre[0] || null;
    r.noCreated = !r.created;
    r.later = evs.filter(function (e) { return e.type !== TYPE; });
    r.laterTypes = Object.create(null);
    r.later.forEach(function (e) { F2C_bump_(r.laterTypes, e.type); });
    r.anomalies = [];
    if (cre.length > 1) r.anomalies.push('DUP_CREATED_EVENTS');
    if (r.created) {
      var bad = r.later.some(function (e) {
        return e.row < r.created.row || (e.ts && r.created.ts && e.ts.getTime() < r.created.ts.getTime() - 1000);
      });
      if (bad) r.anomalies.push('EVENT_ORDER');
    }
    var chatRaw = r.created ? r.created.chat : (r.aRow ? r.aRow.chat : '');
    r.chatKey = chatRaw || '(empty)';
    r.group = groupOf[r.chatKey] || 'G?';
    r.chatStat = chatStats[r.chatKey] || null;
    r.chatForm = F2C_classifyChat_(chatRaw, cfg, r.created ? r.created.ts : null);
    var tCreated = r.created ? F2C_classifyTitle_(r.created.payload.title, cfg) : null;
    var tRow = r.aRow ? F2C_classifyTitle_(r.aRow.title, cfg) : null;
    r.titleCls = (tCreated && tCreated.hit) ? tCreated : (tRow && tRow.hit) ? tRow : (tRow || tCreated || { cls: 'EMPTY', hit: false, label: '(empty)' });
    r.titleKey = F2C_trim_(r.aRow ? r.aRow.title : (r.created ? r.created.payload.title : '')).replace(/\s+/g, ' ');
    r.burst = r.created ? r.created.burst : null;
    r.dkey = r.created ? r.created.dkey : 'n/a';
    r.hm = r.created ? r.created.hm : 'n/a';
    r.expected = F2C_replay_(evs);
    r.expStatus = r.expected ? F2C_trim_(r.expected.status).toUpperCase() : '';
    r.expectedTerminal = !!terminal[r.expStatus];
    r.rowStatus = r.aRow ? r.aRow.status : '';
    r.rowTerminal = !!terminal[r.rowStatus];
    r.statusKnown = !r.inA || !!known[r.rowStatus];
    r.hardRow = []; r.hardReplay = [];
    if (r.inA) {
      if (aRows.length > 1) r.hardRow.push('DUP_ACTIVE_ROWS');
      if (r.rowTerminal) r.hardRow.push('ROW_TERMINAL_IN_ACTIVE');
      if (r.expected) {
        if (r.expectedTerminal) r.hardReplay.push('EVENT_TERMINAL_BUT_IN_ACTIVE');
        var ec = F2C_trim_(r.expected.chat_id);
        if (ec && r.aRow.chat && ec !== r.aRow.chat) r.hardReplay.push('CHAT_DRIFT');
        if (!r.expectedTerminal && !r.rowTerminal && known[r.expStatus] && known[r.rowStatus] && r.expStatus !== r.rowStatus) r.hardReplay.push('STATUS_DRIFT');
      }
    }
    var c = F2C_classifyRecord_(r, cfg);
    r.cls = c.cls; r.why = c.why;
    return r;
  }

  // ── 对 ActiveTasks-only 全量分类并聚合 ──
  var CLASSES = ['CONFIRMED_TEST_RESIDUE', 'CONFIRMED_VALID_ACTIVE_TASK', 'PROJECTION_INCONSISTENCY', 'LIFECYCLE_EXPLAINED', 'UNKNOWN'];
  var classCounts = {}; CLASSES.forEach(function (k) { classCounts[k] = 0; });
  var recs = aOnlyIds.map(buildRecord);
  var aOnlyWithR = recs.filter(function (r) { return r.inR; }).length;

  var formClasses = Object.create(null);      // 标签 → {groups:{}, aOnly}
  var aOnlyByGroup = Object.create(null), statusRaw = Object.create(null), statusVocab = { knownNonTerminal: 0, knownTerminal: 0, unrecognized: 0 };
  var expCounts = Object.create(null), mismatchCount = 0;
  var byDate = Object.create(null), titleClass = Object.create(null), literalLabels = Object.create(null), prefixLabels = Object.create(null);
  var fingerprints = Object.create(null), titleMult = Object.create(null);
  var evStats = { noLater: 0, withUpdated: 0, withTerminal: 0, withReminder: 0, laterTypeCounts: Object.create(null), orderAnomalies: 0, dupCreated: 0, noCreated: 0, replayMismatch: 0, expectedTerminal: 0 };
  var lists = { PROJECTION_INCONSISTENCY: [], CONFIRMED_VALID_ACTIVE_TASK: [], UNKNOWN: [] };
  var impact = { realFormAOnly: 0, testFormAOnly: 0, otherFormAOnly: 0, realFormIds: [] };
  var incSub = Object.create(null);

  recs.forEach(function (r) {
    classCounts[r.cls]++;
    F2C_bump_(A.whyCombos, r.cls + ' | ' + r.why.join('+'));
    F2C_bump_(aOnlyByGroup, r.group);
    var fc = formClasses[r.chatForm.label] || (formClasses[r.chatForm.label] = { groups: Object.create(null), aOnly: 0 });
    fc.groups[r.group] = true; fc.aOnly++;
    F2C_bump_(statusRaw, r.rowStatus || '(empty)');
    if (!r.rowStatus || !known[r.rowStatus]) statusVocab.unrecognized++;
    else if (terminal[r.rowStatus]) statusVocab.knownTerminal++;
    else statusVocab.knownNonTerminal++;
    F2C_bump_(expCounts, r.expStatus || '(no replay)');
    if (r.expected && r.rowStatus && r.expStatus && r.expStatus !== r.rowStatus) mismatchCount++;
    F2C_bump_(byDate, r.dkey);
    F2C_bump_(titleClass, r.titleCls.cls);
    if (r.titleCls.cls === 'TEST_LITERAL') F2C_bump_(literalLabels, r.titleCls.label);
    if (r.titleCls.cls === 'TEST_PREFIX') F2C_bump_(prefixLabels, r.titleCls.label);
    if (r.titleCls.cls === 'UNKNOWN') F2C_bump_(fingerprints, r.titleCls.label);
    if (r.titleKey) F2C_bump_(titleMult, r.titleKey);
    if (!r.later.length) evStats.noLater++;
    if (r.laterTypes.TASK_UPDATED) evStats.withUpdated++;
    if (r.laterTypes.TASK_COMPLETED || r.laterTypes.TASK_CANCELLED || r.laterTypes.TASK_NOT_SELECTED || r.laterTypes.TASK_CONVERTED_TO_PROJECT || r.laterTypes.TASK_CONVERTED_TO_NOTE) evStats.withTerminal++;
    if (r.laterTypes.REMINDER_SENT) evStats.withReminder++;
    Object.keys(r.laterTypes).forEach(function (t) { F2C_bump_(evStats.laterTypeCounts, t, r.laterTypes[t]); });
    if (r.anomalies.indexOf('EVENT_ORDER') !== -1) evStats.orderAnomalies++;
    if (r.anomalies.indexOf('DUP_CREATED_EVENTS') !== -1) evStats.dupCreated++;
    if (r.noCreated) evStats.noCreated++;
    if (r.hardReplay.length && !r.anomalies.length) evStats.replayMismatch++;
    if (r.expectedTerminal) evStats.expectedTerminal++;
    if (r.cls === 'PROJECTION_INCONSISTENCY') r.why.forEach(function (w) { F2C_bump_(incSub, w); });
    if (lists[r.cls]) lists[r.cls].push({ id: r.id, why: r.why.join('+'), group: r.group, place: r.place });
    if (r.chatForm.form === 'REAL_FORM') { impact.realFormAOnly++; impact.realFormIds.push({ id: r.id, cls: r.cls, group: r.group }); }
    else if (r.chatForm.form === 'TEST') impact.testFormAOnly++;
    else impact.otherFormAOnly++;
  });

  var dupTitleGroups = 0, maxTitleMult = 0;
  Object.keys(titleMult).forEach(function (k) { if (titleMult[k] > 1) dupTitleGroups++; if (titleMult[k] > maxTitleMult) maxTitleMult = titleMult[k]; });

  var createdByDate = Object.create(null), burstByDate = Object.create(null);
  created.forEach(function (e) { F2C_bump_(createdByDate, e.dkey); if (e.burst === true) F2C_bump_(burstByDate, e.dkey); });

  // ── 重点日期：当天全部 TASK_CREATED 的逐条分类 ──
  var focusSeen = Object.create(null), focusRecs = [];
  created.forEach(function (e) {
    if (e.dkey !== cfg.FOCUS_DATE || focusSeen[e.taskId]) return;
    focusSeen[e.taskId] = true;
    focusRecs.push(buildRecord(e.taskId));
  });
  var focusByPlace = Object.create(null), focusByClass = Object.create(null), focusMinutes = Object.create(null), firstHm = '', lastHm = '';
  focusRecs.forEach(function (r) {
    F2C_bump_(focusByPlace, r.place); F2C_bump_(focusByClass, r.cls);
    if (r.hm !== 'n/a') { focusMinutes[r.hm] = true; if (!firstHm || r.hm < firstHm) firstHm = r.hm; if (!lastHm || r.hm > lastHm) lastHm = r.hm; }
  });

  // ── ArchiveTasks-only（补充，不在 203 之内） ──
  var rRecs = rOnlyIds.map(buildRecord), rClass = Object.create(null);
  rRecs.forEach(function (r) { F2C_bump_(rClass, r.cls); });

  // ── 组装 ──
  A.scope = {
    tasksRows: idx.T.idRows, activeRows: idx.A.idRows, archiveRows: idx.R ? idx.R.idRows : null,
    aOnly: aOnlyIds.length, aOnlyWithArchive: aOnlyWithR, rOnly: rOnlyIds.length, createdEvents: created.length
  };
  A.classCounts = classCounts;
  var groupsSorted = F2C_sortedKeysByCount_(aOnlyByGroup);
  var top3 = groupsSorted.slice(0, 3).reduce(function (s, g) { return s + aOnlyByGroup[g]; }, 0);
  var formAgg = {};
  Object.keys(formClasses).forEach(function (l) { formAgg[l] = { groups: Object.keys(formClasses[l].groups).length, aOnly: formClasses[l].aOnly }; });
  var topGroupInfo = rankOrder.slice(0, 5).map(function (k) {
    var s = chatStats[k], g = s.group;
    return { group: g, created: s.events, dates: s.dateCount, form: s.form.label, mask: s.form.form === 'REAL_FORM' ? F2C_maskChat_(k) : '', aOnly: aOnlyByGroup[g] || 0 };
  });
  A.chat = {
    groupsWithAOnly: groupsSorted.length, aOnlyByGroup: aOnlyByGroup, groupsSorted: groupsSorted,
    top3Share: aOnlyIds.length ? top3 / aOnlyIds.length : 0, formAgg: formAgg, topGroupInfo: topGroupInfo,
    totalGroups: rankOrder.length
  };
  A.status = { rawCounts: statusRaw, vocab: statusVocab, expectedCounts: expCounts, mismatchCount: mismatchCount };
  A.dates = { aOnlyByDate: byDate, createdByDate: createdByDate, burstByDate: burstByDate };
  A.titles = {
    classCounts: titleClass, literalLabels: literalLabels, prefixLabels: prefixLabels, fingerprints: fingerprints,
    distinctTitles: Object.keys(titleMult).length, dupTitleGroups: dupTitleGroups, maxTitleMult: maxTitleMult,
    staticLiteralCount: cfg.TEST_TITLE_LITERALS.length, staticPrefixCount: cfg.TEST_TITLE_PREFIXES.length
  };
  A.events = evStats;
  A.impact = impact;
  A.lists = lists;
  A.inconsistencySubtypes = incSub;
  A.focus = {
    date: cfg.FOCUS_DATE, total: focusRecs.length, byPlace: focusByPlace, byClass: focusByClass,
    firstHm: firstHm, lastHm: lastHm, distinctMinutes: Object.keys(focusMinutes).length,
    burstCount: focusRecs.filter(function (r) { return r.burst === true; }).length,
    rows: focusRecs.map(function (r) {
      return {
        hm: r.hm, id: r.id, place: r.place, rowStatus: r.rowStatus || '-', expStatus: r.expStatus || '-',
        chat: r.chatForm.form === 'TEST' ? r.chatForm.label : r.chatForm.label + '/' + r.group,
        sig: (r.titleCls.hit ? 'T' : '-') + (r.burst === true ? 'B' : '-') + (r.chatForm.tsOk === true ? 'S' : '-') + (r.chatStat && r.chatStat.oneOff ? 'O' : '-'),
        later: Object.keys(r.laterTypes).sort().map(function (k) { return k.replace(/^TASK_/, '') + '×' + r.laterTypes[k]; }).join(',') || '-',
        cls: r.cls
      };
    })
  };
  A.rOnly = { count: rOnlyIds.length, classCounts: rClass };
  return A;
}

// ───────────────────────── 输出（只走 Logger.log） ─────────────────────────
function F2C_pct_(n, d) { return d ? (Math.round(n * 1000 / d) / 10) + '%' : 'n/a'; }

function F2C_pairs_(obj, limit) {
  var keys = F2C_sortedKeysByCount_(obj);
  if (limit) keys = keys.slice(0, limit);
  return keys.map(function (k) { return k + '=' + obj[k]; }).join(', ') || '(none)';
}

function F2C_idList_(items, cfg, withWhy) {
  if (!items.length) return ['  (none)'];
  var out = items.slice(0, cfg.MAX_LIST_IDS).map(function (x) {
    return '  ' + x.id + ' | ' + x.place + ' | ' + x.group + (withWhy ? ' | ' + x.why : '');
  });
  if (items.length > cfg.MAX_LIST_IDS) out.push('  …其余 ' + (items.length - cfg.MAX_LIST_IDS) + ' 个未列出');
  return out;
}

function F2C_formatReport_(res, cfg) {
  var L = [], c = res.ctx, A = res.analysis;
  var inScript = c.runtime === 'apps-script';
  var evidence = inScript
    ? (res.liveRead ? 'LIVE' : 'NOT_LIVE（没有读到真实 Events 数据）')
    : 'SIMULATED（非 Apps Script 运行时）';

  L.push('==================== F2 READ-ONLY INVESTIGATION: ActiveTasks-only ====================');
  L.push('EVIDENCE_LEVEL  : ' + evidence + '   （其中规则/词表/测试特征 = STATIC，由前两者推出的结论 = INFERENCE）');
  L.push('RUN_AT_UTC      : ' + c.runAtUtc);
  L.push('RUN_AT_LOCAL    : ' + c.runAtLocal + '   tz=' + c.tz);
  L.push('RUNTIME         : ' + c.runtime);
  L.push('RUN_CONTEXT     : ' + c.context);
  L.push('SCRIPT_ID(mask) : ' + c.scriptIdMasked);
  L.push('ID_SOURCE       : ' + c.idSource);
  L.push('DATA_SCOPE      : Events / Tasks / ActiveTasks / ArchiveTasks（只读；不读其他 Sheet，不列 Sheet 名单）');

  L.push('');
  L.push('[IDENTITY]');
  if (res.spreadsheet) {
    var byConstruction = c.formalScriptIdMatch && /^Script Properties/.test(c.idSource);
    L.push('Spreadsheet name : ' + res.spreadsheet.name);
    L.push('Spreadsheet id   : ' + res.spreadsheet.idMasked + '   (openById 返回的 id 与输入一致: ' + res.spreadsheet.idEqualsInput + ')');
    L.push('Spreadsheet tz   : ' + (res.spreadsheet.timeZone || 'n/a'));
    L.push('GAS 项目身份     : ' + (c.formalScriptIdMatch ? 'CONFIRMED（scriptId 首尾片段与 .clasp.json 一致）' : 'NOT CONFIRMED BY SCRIPT（独立项目；需手动核对）'));
    L.push('Spreadsheet 身份 : ' + (byConstruction ? 'CONFIRMED BY CONSTRUCTION（ID 取自正式项目自己的 Script Properties）' : 'PENDING MANUAL CHECK（对照正式项目 Script Properties 的 SPREADSHEET_ID）'));
  } else {
    L.push('Spreadsheet      : 未能打开');
  }

  if (Object.keys(res.reads).length) {
    L.push('');
    L.push('[STRUCTURE]');
    ['events', 'tasks', 'active', 'archive'].forEach(function (k) {
      var r = res.reads[k];
      if (!r) return;
      L.push('- ' + r.name + ': exists=' + r.exists + (r.readError ? ' READ_ERROR=' + r.readError : '') +
        ' lastRow=' + r.lastRow + ' lastCol=' + r.lastCol + ' dataRowsRead=' + r.rowsRead + ' headers=' + r.headers.length);
    });
    if (A && A.cols) {
      Object.keys(A.cols).forEach(function (k) {
        L.push('  cols ' + k + ': missing=' + (A.cols[k].missing.join(',') || '-') + ' ambiguous=' + (A.cols[k].ambiguous.join(',') || '-'));
      });
    }
  }

  if (res.stop) {
    L.push('');
    L.push('!!!!! STOP: ' + res.stop.code + ' — ' + res.stop.detail);
    L.push('未做任何分类。这不是调查结论，请把本输出回传。');
    L.push('WRITES_PERFORMED : none（本脚本不含任何写入调用）');
    return L;
  }

  var S = A.scope, K = A.classCounts, R = A.reliability;
  L.push('');
  L.push('[SCOPE & ASSOCIATION RULE]');
  L.push('关联规则：Events.payload.task_id ↔ 各表 task_id（trim 后精确匹配）；分类不单凭标题。');
  L.push('Tasks 行=' + S.tasksRows + '  ActiveTasks 行=' + S.activeRows + '  ArchiveTasks 行=' + (S.archiveRows === null ? 'n/a' : S.archiveRows) + '  表缺口=' + (A.gaps.join('; ') || 'none'));
  L.push('TASK_CREATED（可解析且含 task_id）=' + S.createdEvents + '  解析失败=' + R.createdParseFail + '  无 task_id=' + R.createdNoTaskId);
  L.push('ActiveTasks-only（有 ActiveTasks 行、无 Tasks 行）=' + S.aOnly + '（其中同时在 ArchiveTasks=' + S.aOnlyWithArchive + '）；ArchiveTasks-only（仅在 ArchiveTasks）=' + S.rOnly);

  L.push('');
  L.push('[1. CLASSIFICATION of ActiveTasks-only]  每条恰好一类');
  ['CONFIRMED_TEST_RESIDUE', 'CONFIRMED_VALID_ACTIVE_TASK', 'PROJECTION_INCONSISTENCY', 'LIFECYCLE_EXPLAINED', 'UNKNOWN'].forEach(function (k) {
    L.push('  ' + k + ' = ' + K[k] + '  (' + F2C_pct_(K[k], S.aOnly) + ')');
  });
  L.push('  合计 = ' + (K.CONFIRMED_TEST_RESIDUE + K.CONFIRMED_VALID_ACTIVE_TASK + K.PROJECTION_INCONSISTENCY + K.LIFECYCLE_EXPLAINED + K.UNKNOWN) + '  (应等于 ' + S.aOnly + ')');
  L.push('  证据组合（类别 | 证据/原因）:');
  F2C_sortedKeysByCount_(A.whyCombos).forEach(function (k) { L.push('    ' + k + ' = ' + A.whyCombos[k]); });
  L.push('  LIFECYCLE_EXPLAINED 对本组按构造为 0：STATIC——没有任何代码路径删除 Tasks 行（只有 ActiveTasks 会被删除）。');

  L.push('');
  L.push('[2. BY CHAT]  G# 与第一次核查同一规则（G1 = TASK_CREATED 最多的聊天）；不输出原始 chat_id');
  L.push('出现 ActiveTasks-only 的聊天组数=' + A.chat.groupsWithAOnly + ' / 全部聊天组=' + A.chat.totalGroups + '；前 3 组占比=' + F2C_pct_(A.chat.top3Share * 1000, 1000));
  L.push('聊天形态分类（STATIC 构造规则 × LIVE 数据）:');
  Object.keys(A.chat.formAgg).sort(function (a, b) { return A.chat.formAgg[b].aOnly - A.chat.formAgg[a].aOnly; }).forEach(function (l) {
    L.push('  ' + l + ': 聊天组=' + A.chat.formAgg[l].groups + ' ActiveTasks-only=' + A.chat.formAgg[l].aOnly);
  });
  L.push('事件最多的前 5 个聊天（与第一次核查的 G1…对照；REAL_FORM 仅给掩码）:');
  A.chat.topGroupInfo.forEach(function (g) {
    L.push('  ' + g.group + ': TASK_CREATED=' + g.created + ' 分布日期数=' + g.dates + ' 形态=' + g.form + (g.mask ? ' 掩码=' + g.mask : '') + ' ActiveTasks-only=' + g.aOnly);
  });
  L.push('每个聊天组的 ActiveTasks-only 条数（G#=条数）:');
  L.push(A.chat.groupsSorted.map(function (g) { return g + '=' + A.chat.aOnlyByGroup[g]; }).join(' ') || '(none)');
  L.push('三张表里 chat_id 的形态分布（行数）:');
  ['T', 'A', 'R'].forEach(function (s) {
    if (A.chatSheetForms[s]) {
      var f = A.chatSheetForms[s];
      L.push('  ' + { T: 'Tasks', A: 'ActiveTasks', R: 'ArchiveTasks' }[s] + ': TEST=' + f.TEST + ' REAL_FORM=' + f.REAL_FORM + ' OTHER=' + f.OTHER + ' EMPTY=' + f.EMPTY);
    }
  });

  L.push('');
  L.push('[3. BY STATUS]  原样输出 ActiveTasks 行里的 status 值，不做含义假设');
  L.push('行 status 分布: ' + F2C_pairs_(A.status.rawCounts));
  L.push('对照 STATIC 词表: 已知非终态=' + A.status.vocab.knownNonTerminal + '  已知终态(不应留在 ActiveTasks)=' + A.status.vocab.knownTerminal + '  未识别=' + A.status.vocab.unrecognized);
  L.push('按 Events 重放得到的应有状态分布: ' + F2C_pairs_(A.status.expectedCounts));
  L.push('行 status 与重放状态不一致的条数=' + A.status.mismatchCount);

  L.push('');
  L.push('[4. BY DATE]  创建日期 (' + c.tz + ')：ActiveTasks-only 条数 / 当天 TASK_CREATED 总数 / 其中突发创建数');
  var dts = Object.keys(A.dates.aOnlyByDate).sort();
  L.push(dts.length ? dts.map(function (d) { return d + ': ' + A.dates.aOnlyByDate[d] + '/' + (A.dates.createdByDate[d] || 0) + '/' + (A.dates.burstByDate[d] || 0); }).join(' | ') : '(none)');
  L.push('突发创建判定：以事件为中心 ±' + cfg.BURST_WINDOW_MIN + ' 分钟内 TASK_CREATED ≥ ' + cfg.BURST_MIN_EVENTS + ' 条。');

  var F = A.focus;
  L.push('');
  L.push('[5. FOCUS DAY ' + F.date + ']  当天全部 TASK_CREATED 共 ' + F.total + ' 条');
  L.push('落点分布: ' + F2C_pairs_(F.byPlace) + '   (T=Tasks A=ActiveTasks R=ArchiveTasks none=三表都没有)');
  L.push('分类分布: ' + F2C_pairs_(F.byClass));
  L.push('创建时间跨度 ' + F.firstHm + ' → ' + F.lastHm + '，涉及 ' + F.distinctMinutes + ' 个不同分钟，突发创建=' + F.burstCount + ' 条');
  L.push('逐条: HH:mm | task_id | 落点 | 行status | 重放status | 聊天形态/组 | 信号 | 后续事件 | 分类');
  L.push('信号: T=标题命中测试特征 B=突发创建 S=chat_id 内嵌时间戳与事件一致 O=单次性聊天');
  F.rows.forEach(function (r) {
    L.push(r.hm + ' | ' + r.id + ' | ' + r.place + ' | ' + r.rowStatus + ' | ' + r.expStatus + ' | ' + r.chat + ' | ' + r.sig + ' | ' + r.later + ' | ' + r.cls);
  });

  var T = A.titles;
  L.push('');
  L.push('[6. TITLE FEATURES vs TEST FILES]  不输出完整标题清单');
  L.push('STATIC 对照集：仓库测试文件里的标题前缀 ' + T.staticPrefixCount + ' 个 + 字面量 ' + T.staticLiteralCount + ' 个（见本文件 F2C_CONFIG）');
  L.push('标题类别: ' + F2C_pairs_(T.classCounts));
  L.push('命中的测试前缀: ' + F2C_pairs_(T.prefixLabels));
  L.push('命中的测试字面量（来自仓库测试，非用户数据）: ' + F2C_pairs_(T.literalLabels));
  L.push('无法识别的标题（只给结构指纹，标记 UNKNOWN 模式）: ' + F2C_pairs_(T.fingerprints));
  L.push('不同标题数=' + T.distinctTitles + '；出现 ≥2 次的标题有 ' + T.dupTitleGroups + ' 种，最多重复 ' + T.maxTitleMult + ' 次');

  var E = A.events;
  L.push('');
  L.push('[7. EVENTS LIFECYCLE]  用 task_id 精确关联');
  L.push('无 TASK_CREATED=' + E.noCreated + '；重复 TASK_CREATED=' + E.dupCreated + '；事件顺序/时间异常=' + E.orderAnomalies);
  L.push('创建后没有任何后续事件=' + E.noLater + '；有 TASK_UPDATED=' + E.withUpdated + '；有终态类事件=' + E.withTerminal + '；有 REMINDER_SENT=' + E.withReminder);
  L.push('后续事件类型计数: ' + F2C_pairs_(E.laterTypeCounts));
  L.push('重放得到终态但仍在 ActiveTasks=' + E.expectedTerminal + '；重放与行不一致（可信重放下）=' + E.replayMismatch);

  var I = A.impact;
  L.push('');
  L.push('[8. UI IMPACT]  INFERENCE：UI 列表读 Tasks，Dashboard 与日期视图读 ActiveTasks，两边都按 chat_id 过滤（STATIC）；UI 的 chat_id 来自 TELEGRAM_CHAT_ID（本脚本不读取它）');
  L.push('ActiveTasks-only 中：测试形态聊天=' + I.testFormAOnly + '（测试构造的 chat_id 不可能等于数字形态的真实聊天，故不会出现在真实聊天的视图里）；真实形态聊天=' + I.realFormAOnly + '；其他/未识别形态=' + I.otherFormAOnly);
  L.push('真实形态聊天里的 ActiveTasks-only（可能影响真实视图；它们不在 Tasks，所以不会出现在 UI 列表）:');
  F2C_idList_(I.realFormIds.map(function (x) { return { id: x.id, place: x.cls, group: x.group }; }), cfg, false).forEach(function (s) { L.push(s); });

  L.push('');
  L.push('[9. PROJECTION INCONSISTENCY]  PROJECTION_INCONSISTENCY=' + K.PROJECTION_INCONSISTENCY + '；子类型: ' + F2C_pairs_(A.inconsistencySubtypes));
  F2C_idList_(A.lists.PROJECTION_INCONSISTENCY, cfg, true).forEach(function (s) { L.push(s); });
  L.push('[CONFIRMED_VALID_ACTIVE_TASK] = ' + K.CONFIRMED_VALID_ACTIVE_TASK);
  F2C_idList_(A.lists.CONFIRMED_VALID_ACTIVE_TASK, cfg, true).forEach(function (s) { L.push(s); });
  L.push('[UNKNOWN] = ' + K.UNKNOWN);
  F2C_idList_(A.lists.UNKNOWN, cfg, true).forEach(function (s) { L.push(s); });

  L.push('');
  L.push('[SUPPLEMENT: ArchiveTasks-only]（不在 203 之内）共 ' + A.rOnly.count + ' 条；分类: ' + F2C_pairs_(A.rOnly.classCounts));

  L.push('');
  L.push('[REPORT SKELETON — 12 项]');
  L.push('1. 分类统计            : 见 [1]（TEST_RESIDUE ' + K.CONFIRMED_TEST_RESIDUE + ' / VALID_ACTIVE ' + K.CONFIRMED_VALID_ACTIVE_TASK + ' / INCONSISTENCY ' + K.PROJECTION_INCONSISTENCY + ' / LIFECYCLE ' + K.LIFECYCLE_EXPLAINED + ' / UNKNOWN ' + K.UNKNOWN + '）');
  L.push('2. 按 chat_id 分布     : 见 [2]');
  L.push('3. 按状态分布          : 见 [3]');
  L.push('4. 按日期分布          : 见 [4]');
  L.push('5. 重点日逐条分类      : 见 [5]');
  L.push('6. 标题特征与测试文件  : 见 [6]（对照集 STATIC；命中情况 LIVE）');
  L.push('7. Events 生命周期     : 见 [7]');
  L.push('8. 真实任务被 UI 遗漏  : 见 [8]（真实形态聊天里的 ActiveTasks-only = ' + I.realFormAOnly + '）');
  L.push('9. 投影不一致          : 见 [9]（' + K.PROJECTION_INCONSISTENCY + ' 条）');
  L.push('10. 是否需要修复及最小范围 : PENDING（拿到本输出后由助手给出；本脚本不下结论）');
  L.push('11. 是否发生写入       : 脚本内无写入调用；只用只读 API（清单见文件末尾）');
  L.push('12. 临时脚本清理       : PENDING（你核实后删除正式项目里的临时文件；见 RUNBOOK 第 6 步）');
  L.push('F2C_SUMMARY_JSON=' + JSON.stringify({
    evidence: evidence, runAtUtc: c.runAtUtc, tz: c.tz,
    tasksRows: S.tasksRows, activeRows: S.activeRows, aOnly: S.aOnly, rOnly: S.rOnly,
    classCounts: K, realFormAOnly: I.realFormAOnly, testFormAOnly: I.testFormAOnly, otherFormAOnly: I.otherFormAOnly, gaps: A.gaps
  }));
  return L;
}

function F2C_emit_(lines) {
  for (var i = 0; i < lines.length; i += 40) Logger.log(lines.slice(i, i + 40).join('\n'));
}

// ───────────────────────── 入口：在函数下拉里选这个并运行 ─────────────────────────
function F2C_runReadOnlyInvestigation() {
  var cfg = F2C_CONFIG;
  var env = F2C_buildEnv_();
  var res;
  try {
    res = F2C_execute_(cfg, env);
  } catch (e) {
    F2C_emit_(['F2 READ-ONLY INVESTIGATION 异常中止：' + String(e && e.message ? e.message : e),
      '未产生任何结论；本脚本没有写入调用。请把这行回传。']);
    return;
  }
  F2C_emit_(F2C_formatReport_(res, cfg));
}

/**
 * ════════════════════════ RUNBOOK ════════════════════════
 *  1. 本文件是「临时核查脚本」。放进正式项目编辑器时，作为一个单独的临时文件；
 *     不要 clasp push / pull，不要部署，不要加 Trigger。
 *     （第一次核查的临时文件 F1_ReadOnly_Orphan_Check 若还在，可以先保留或先删除；
 *       两个文件的函数名前缀不同（F1C_ / F2C_），不会冲突。）
 *  2. 在 F2C_CONFIG 里保持 SPREADSHEET_ID 为空即可：在正式项目里运行时，
 *     脚本只读 Script Properties 里的 SPREADSHEET_ID 这一个键。
 *     在独立项目里运行则必须填 SPREADSHEET_ID，并把时区设为 Asia/Singapore。
 *  3. 函数下拉选 F2C_runReadOnlyInvestigation → 运行。
 *  4. 打开「执行日志」，复制全部输出回传。输出只含掩码 ID、聊天组标签和测试特征，
 *     不含凭证，不含完整标题清单，不含原始 chat_id。
 *  5. 核实无业务数据写入：Spreadsheet「文件 → 版本记录」在运行时间前后没有改动记录；
 *     Apps Script「执行」页只有这次运行，无报错。
 *  6. 清理：删除正式项目里的本临时文件（以及已不需要的 F1 临时文件），
 *     确认正式项目文件列表与版本库一致。如果无法确认文件身份，先不要删，回报。
 *
 *  本脚本里出现的全部 Google 服务调用（用于复核只读性）：
 *    SpreadsheetApp.openById
 *    Spreadsheet : getName / getId / getSpreadsheetTimeZone / getSheetByName
 *    Sheet       : getLastRow / getLastColumn / getRange
 *    Range       : getValues
 *    Session.getScriptTimeZone · Utilities.formatDate · ScriptApp.getScriptId
 *    PropertiesService.getScriptProperties().getProperty（只在 SPREADSHEET_ID 留空时读这一个键）
 *    Logger.log
 */
