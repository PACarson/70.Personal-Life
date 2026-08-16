/**
 * 50_UIBridge.gs
 * Personal Life OS v5.2 — UI Bridge Layer（Sprint: UI Phase 0 → Slice 1）
 *
 * 完整背景见 UI_Architecture_Audit_Phase0.md「五」「六」「七」，以及
 * 2026-08-16 的部署位置/身份决定（Option A：UI 归属并部署在 Personal
 * Life OS 自己项目里；不复用 Telegram chatId 当 Web Identity）。
 *
 * 职责：把 google.script.run 调进来的请求路由到既有 QueryEngine/Command，
 * 做字段清洗和错误包装。本文件不实现任何业务逻辑，不直接碰 Sheet/Events
 * ——跟 06_TaskIntentParser.gs 是同一种角色，只是输入方式从 Telegram
 * 指令文本换成 HTML 表单/按钮。
 *
 * 【身份设计，见 UI_Architecture_Audit_Phase0.md 及 2026-08-16 讨论】
 * 07_IdentityEngine.gs 核实过——它只是内容去重哈希生成器，没有 Actor/
 * User Identity 概念，不能直接复用。本文件用 Session.getEffectiveUser()
 * .getEmail() 作为 decision_owner（Web Identity，跟 Telegram chatId
 * 概念上分开）；chat_id 参数位仍然传真实的 SecureConfig 'TELEGRAM_
 * CHAT_ID'——这不是"假装是 Telegram"，是因为 chat_id 这个字段在现有代码
 * 里是双重角色：(a) 每个实体的 owner/tenant key，(b) 03_Output.
 * sendMessage / 43_ReminderConnector 用来真的发 Telegram 消息的投递地址。
 * 如果 Web UI 创建的 Task 的 chat_id 不是一个真实、能收到消息的 Telegram
 * chat，这个 Task 未来的提醒会静默送不出去——这是本文件核实过的真实
 * 风险，不是猜测（见 Audit 报告「九、Risks」应该补一条，这里先在代码里
 * 处理掉）。decision_owner（"这是谁的决定"）用 Web Identity；chat_id
 * （"提醒该送到哪"）继续用真实 Telegram chat——两个字段本来就允许分开
 * 传，不需要新增字段、不需要改任何既有 Engine。
 *
 * 【错误处理】既有 Engine 抛的是 `throw new Error('CODE: 人话说明')`，
 * google.script.run 的失败回调只能拿到裸 message 字符串、拿不到结构化
 * 对象——所以这里统一 catch 住，转成 {ok:false, code, message} 再
 * return（不是 throw），前端一律用返回值判断成功/失败，不依赖
 * withFailureHandler。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 路由 UI 请求到 QueryEngine/Command，字段
 *                           清洗，错误包装，解析 Web Identity
 *   Owns                  : {ok,code,message} 错误信封格式；Web Identity
 *                           解析规则
 *   Reads                 : 17_NoteQueryEngine
 *   Writes                : none（自己不发 Event，全部通过既有 Command）
 *   Public API            : ui_getOpenNotes(), ui_createNote(content),
 *                           ui_convertNoteToTask(noteId)
 *                           （均有第二个 _testOverrides 参数，仅测试用，
 *                           前端永远不传）
 *   Dependencies           : 29_NoteEngine.gs、42_ConversionEngine.gs、
 *                           17_NoteQueryEngine.gs、01_SecureConfig.gs
 *   Forbidden Dependencies  : Sheet 直接读写、Events 直接发布
 *   Pure Function            : NO
 *   Side Effects              : YES（间接，通过调用既有 Command）
 */

/**
 * 解析当前 Web 请求的 Actor Identity。跟 Telegram chatId 是两个概念，
 * 只用于 decision_owner，不用于 chat_id（提醒投递地址）。
 * @returns {string}
 */
function _resolveWebIdentity_() {
  try {
    var email = Session.getEffectiveUser().getEmail();
    return email || 'WEB_UI_UNKNOWN_USER';
  } catch (e) {
    return 'WEB_UI_UNKNOWN_USER';
  }
}

/**
 * 真实 Telegram chat（用于 chat_id 参数位——owner key + 提醒投递地址）。
 * 测试时用 _testOverrides.chatId 覆盖，避免污染真实数据。
 * @param {object} [_testOverrides]
 * @returns {string}
 */
function _resolveChatId_(_testOverrides) {
  if (_testOverrides && _testOverrides.chatId) return _testOverrides.chatId;
  return SecureConfig.getKey('TELEGRAM_CHAT_ID');
}

function _resolveDecisionOwner_(_testOverrides) {
  if (_testOverrides && _testOverrides.decisionOwner) return _testOverrides.decisionOwner;
  return _resolveWebIdentity_();
}

/**
 * 把 Engine 抛出的 `Error('CODE: message')` 转成 {ok:false, code, message}。
 * 没有 CODE 前缀的异常（不应该发生，既有 Engine 目前都遵守这个约定）
 * 归为 UNKNOWN_ERROR，不静默吞掉、不裸抛给前端。
 * @param {Error} e
 * @returns {{ok:false, code:string, message:string}}
 */
function _wrapError_(e) {
  var raw = (e && e.message) || String(e);
  var m = /^([A-Z_]+):\s*(.*)$/.exec(raw);
  if (m) {
    return { ok: false, code: m[1], message: m[2] };
  }
  return { ok: false, code: 'UNKNOWN_ERROR', message: raw };
}

/**
 * Web App 入口。部署方式：Deploy → New deployment → Web app，
 * Execute as: Me，Who has access: Only myself（见 UI_Architecture_
 * Audit_Phase0.md「五」身份建议——单用户场景下不需要另外写登录逻辑，
 * GAS 平台层面就保证了只有 Carson 自己能访问）。
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('ui_index')
    .evaluate()
    .setTitle('Personal Life OS')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// Public API
// ============================================================

/**
 * @param {object} [_testOverrides]  仅测试使用
 * @returns {{ok:true, notes:Array}|{ok:false, code, message}}
 */
function ui_getOpenNotes(_testOverrides) {
  try {
    var chatId = _resolveChatId_(_testOverrides);
    var notes = NoteQueryEngine.getOpenNotes(chatId);
    return { ok: true, notes: notes };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * @param {string} content
 * @param {object} [_testOverrides]  仅测试使用：{chatId, decisionOwner}
 * @returns {{ok:true, note:object}|{ok:false, code, message}}
 */
function ui_createNote(content, _testOverrides) {
  try {
    if (!content || !String(content).trim()) {
      return { ok: false, code: 'EMPTY_CONTENT', message: '内容不能为空' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var decisionOwner = _resolveDecisionOwner_(_testOverrides);

    var note = NoteEngine.createNote(String(content).trim(), {
      source_module:  'UIBridge.ui_createNote',
      decision_owner: decisionOwner
      // created_method 不传——NoteEngine 默认落到 'Manual'，Web 输入框
      // 打字创建，语义上跟既有 Telegram 手动创建的 'Manual' 完全一致，
      // 不需要新增一个 'Web' 之类的值制造不必要的分裂
    }, chatId);

    return { ok: true, note: note };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * @param {string} noteId
 * @param {object} [_testOverrides]  仅测试使用：{chatId, decisionOwner}
 * @returns {{ok:true, task:object, already_converted?:boolean}|
 *           {ok:false, code:'NOT_FOUND'|string, message}}
 */
function ui_convertNoteToTask(noteId, _testOverrides) {
  try {
    if (!noteId) {
      return { ok: false, code: 'MISSING_NOTE_ID', message: '缺少 noteId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var decisionOwner = _resolveDecisionOwner_(_testOverrides);

    // decision_owner 显式传入，让转换出来的 Task 跟源 Note 保持同一个
    // owner——ConversionEngine.convertNoteToTask 本身不会自动带这个字段
    // 过去（见 42_ConversionEngine.js 里 taskMeta 的字段列表，不含
    // decision_owner），不显式传的话会静默 fallback 成 chat_id。
    var result = ConversionEngine.convertNoteToTask(noteId, {
      decision_owner: decisionOwner
    }, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这条 Note（可能已经被删除或转换过）' };
    }
    return { ok: true, task: result.task, already_converted: !!result.already_converted };
  } catch (e) {
    return _wrapError_(e);
  }
}
