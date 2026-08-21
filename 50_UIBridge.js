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
 *   Reads                 : 17_NoteQueryEngine, 12_TaskQueryEngine（非
 *                           终态过滤）, 14_ProjectQueryEngine, 22_PriorityEngine
 *                           （UI-I3，只读 suggestPriorityWithAI_，不产生
 *                           独立 Event——见「UI-I1~I5」一节）
 *   Writes                : none（自己不发 Event，全部通过既有 Command）
 *   Public API            : ui_getOpenNotes(), ui_createNote(content),
 *                           ui_convertNoteToTask(noteId)，
 *                           ui_getConvertibleTasks(filters), ui_getActiveProjects(filters),
 *                           ui_convertTaskToProject(taskId),
 *                           ui_convertProjectToTask(projectId)，
 *                           ui_captureProjectAsTemplate(projectId, ruleName),
 *                           ui_instantiateTemplate(templateId)，
 *                           ui_updateTask(taskId, changes),
 *                           ui_updateProject(projectId, changes),
 *                           ui_suggestPriority(taskId),
 *                           ui_completeTask(taskId), ui_cancelTask(taskId),
 *                           ui_completeProject(projectId), ui_cancelProject(projectId)
 *                           （除 ui_captureProjectAsTemplate 外都带一个
 *                           仅测试用的 _testOverrides 参数，永远是最后一个
 *                           参数，前端永远不传；capture 不需要，见该函数
 *                           注释。ui_getConvertibleTasks/ui_getActiveProjects
 *                           2026-08-21 新增的 filters 是前端会传的真实参数，
 *                           排在 _testOverrides 之前，不受这条限制）
 *   Dependencies           : 29_NoteEngine.gs、42_ConversionEngine.gs、
 *                           41_BusinessRuleEngine.gs、20_TaskEngine.gs、
 *                           27_ProjectEngine.gs、22_PriorityEngine.gs、
 *                           17_NoteQueryEngine.gs、12_TaskQueryEngine.gs、
 *                           14_ProjectQueryEngine.gs、01_SecureConfig.gs
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

// ============================================================
// Slice 2（Task ↔ Project，2026-08-16，见 00_ADR.gs ADR-2026-07-24-015、
// 00_Business_Rules.gs「一」）
// ============================================================

/**
 * 只返回非终态 Task（PENDING/BLOCKED/WAITING）——跟 Business_Rules「一」
 * 里 Task→Project 的前置校验对齐（终态 Task 转 Project 没有意义）。
 * TaskQueryEngine.getTasks 只支持单值精确匹配，多状态过滤在这里做。
 *
 * 【UI-I1，2026-08-21 新增 filters】只接受 category / priority 两个
 * 精确匹配键，透传给 TaskQueryEngine.getTasks 的既有 filters 参数
 * （单值精确匹配，大小写不敏感），再叠加上面的非终态过滤——顺序不能
 * 反过来（先精确过滤再非终态，效果一样，但保持跟原实现同样的"先拿
 * 精确匹配结果、非终态用 Array.filter 兜底"结构，改动面最小）。
 * 不接受 status 作为 filters 键——面板本身的定义就是"非终态"，允许
 * 调用方传 status 会跟这条已有约束混淆语义，真要看终态 Task 应该是
 * 另一个独立视图，不是这个面板加一个参数就能兼顾的。
 * @param {object} [filters]  {category, priority}，均可省略
 * @param {object} [_testOverrides]
 */
function ui_getConvertibleTasks(filters, _testOverrides) {
  try {
    var chatId = _resolveChatId_(_testOverrides);
    var NONTERMINAL = ['PENDING', 'BLOCKED', 'WAITING'];
    var queryFilters = null;
    if (filters && (filters.category || filters.priority)) {
      queryFilters = {};
      if (filters.category) queryFilters.category = filters.category;
      if (filters.priority) queryFilters.priority = filters.priority; // priority_user，见 ADR-2026-07-24-009
    }
    var tasks = TaskQueryEngine.getTasks(chatId, queryFilters).filter(function (t) {
      return NONTERMINAL.indexOf(String(t.status || '').toUpperCase()) !== -1;
    });
    return { ok: true, tasks: tasks };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * 【UI-I1，2026-08-21 新增 filters】ProjectQueryEngine.getActiveProjects
 * 本身不接受 filters 参数（固定非终态），改用它的姐妹函数 getProjects
 * （通用精确匹配）+ 这里本地做同一份非终态过滤，效果对无 filters 的
 * 调用完全不变。filters.status 只用来在"非终态"这个大集合内部再收窄
 * （比如只看 BLOCKED 的），不接受终态值——传了也会被下面的非终态
 * .filter() 兜底吞掉，不会意外泄漏已完成/已取消的 Project。
 * @param {object} [filters]  {status}，可省略
 * @param {object} [_testOverrides]
 */
function ui_getActiveProjects(filters, _testOverrides) {
  try {
    var chatId = _resolveChatId_(_testOverrides);
    var NONTERMINAL = ['DRAFT', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED'];
    var queryFilters = (filters && filters.status) ? { status: filters.status } : null;
    var projects = ProjectQueryEngine.getProjects(chatId, queryFilters).filter(function (p) {
      return NONTERMINAL.indexOf(String(p.status || '').toUpperCase()) !== -1;
    });
    return { ok: true, projects: projects };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * @param {string} taskId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, project:object, already_converted?:boolean}|
 *           {ok:false, code:'NOT_FOUND'|string, message}}
 */
function ui_convertTaskToProject(taskId, _testOverrides) {
  try {
    if (!taskId) {
      return { ok: false, code: 'MISSING_TASK_ID', message: '缺少 taskId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var decisionOwner = _resolveDecisionOwner_(_testOverrides);

    var result = ConversionEngine.convertTaskToProject(taskId, {
      decision_owner: decisionOwner
    }, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Task（可能已经被删除或转换过）' };
    }
    return { ok: true, project: result.project, already_converted: !!result.already_converted };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * Project→Task 有 Task→Project 没有的第三种结果：{blocked:true, reason}
 * ——ADR-015 的前置校验没通过（还有 Sub-Project 或未完成 Task），不是
 * 异常，是一个正常、预期内的"暂时不能转换"结果，转成 code:'BLOCKED'
 * 而不是裸错误，前端应该用不同于"出错了"的方式呈现（说明原因，不是
 * 报红）。
 *
 * 已知限制（不是这次引入的，是 TaskEngine.createTaskFromConversion_
 * 本身的既有设计——见该函数 JSDoc"预留，不接受调用方覆盖映射规则"）：
 * 这个方向转换出来的 Task，decision_owner 固定 fallback 成 chat_id，
 * 拿不到 Web Identity——跟 Task→Project、Note→Task 两个方向不对称。
 * 这不是本文件能修的（改 createTaskFromConversion_ 的映射规则不在
 * Slice 2 范围内，那是它自己文档明确保留到以后再决定的行为），如果
 * 需要修，应该是一次独立、带着"到底要不要开放覆盖"这个问题一起决定的
 * 改动，不是顺手就改。
 *
 * @param {string} projectId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, task:object, already_converted?:boolean}|
 *           {ok:false, code:'NOT_FOUND'|'BLOCKED'|string, message}}
 */
function ui_convertProjectToTask(projectId, _testOverrides) {
  try {
    if (!projectId) {
      return { ok: false, code: 'MISSING_PROJECT_ID', message: '缺少 projectId' };
    }
    var chatId = _resolveChatId_(_testOverrides);

    var result = ConversionEngine.convertProjectToTask(projectId, null, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Project（可能已经被删除或转换过）' };
    }
    if (result.blocked) {
      return { ok: false, code: 'BLOCKED', message: result.reason };
    }
    return { ok: true, task: result.task, already_converted: !!result.already_converted };
  } catch (e) {
    return _wrapError_(e);
  }
}

// ============================================================
// Slice 3（Project → Workflow → Task，2026-08-18，见
// 41_BusinessRuleEngine.gs、00_ADR.gs ADR-2026-07-24-010/011）
// ============================================================

/**
 * 三层模型：BusinessRule（顶层分类）1-N WorkflowTemplate（版本）1-N
 * Workflow（Instance）。"Project → Workflow" 不是一次直接转换，是两个
 * 独立动作：
 *   (a) Capture：把一个现有 Project 的结构"拍照"存成 WorkflowTemplate
 *       （不产生 Workflow，只产生模板）
 *   (b) Instantiate：拿一个 WorkflowTemplate 生成全新的
 *       Project + Workflow + 一批 Task（复用既有三个 Command，本函数
 *       不重新实现创建逻辑）
 * 前端把这两步串在一起（Capture 成功后立刻展示 Instantiate 按钮），
 * 但它们在 Engine 层是两个独立、可以分开调用的能力。
 *
 * 已知缺口，这次没有解决：19_BusinessRuleQueryEngine.gs 没有"列出全部
 * Template"的读接口（Public API 只有单个查询 + 按 Rule 查询），没法做
 * 一个"浏览我所有模板"的面板。这次的 Bridge 函数够用（capture 直接
 * 返回 templateId，前端立刻能用），但如果以后要做"过几天回来找某个
 * 旧模板重新实例化"，需要先在 19_BusinessRuleQueryEngine.gs 加一个
 * 列表查询函数——不在本次范围内，先记下来。
 */

/**
 * @param {string} projectId
 * @param {string} ruleName
 * @returns {{ok:true, template:object}|{ok:false, code, message}}
 */
function ui_captureProjectAsTemplate(projectId, ruleName) {
  try {
    if (!projectId) {
      return { ok: false, code: 'MISSING_PROJECT_ID', message: '缺少 projectId' };
    }
    if (!ruleName || !String(ruleName).trim()) {
      return { ok: false, code: 'MISSING_RULE_NAME', message: '需要给这个模板起一个名字' };
    }

    // captureAsWorkflowTemplate 内部直接用 project.chat_id，不接受
    // chatId 参数——这里没有 _testOverrides，测试用真实创建出来的
    // Project 天然带着正确的（命名空间化）chat_id，不需要额外传递。
    var template = BusinessRuleEngine.captureAsWorkflowTemplate(projectId, String(ruleName).trim(), []);
    if (template.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Project' };
    }
    return { ok: true, template: template };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * @param {string} templateId
 * @param {object} [_testOverrides]  仅测试使用：{chatId}
 * @returns {{ok:true, project:object, workflow:object, tasks:object[]}|
 *           {ok:false, code, message}}
 */
function ui_instantiateTemplate(templateId, _testOverrides) {
  try {
    if (!templateId) {
      return { ok: false, code: 'MISSING_TEMPLATE_ID', message: '缺少 templateId' };
    }
    var chatId = _resolveChatId_(_testOverrides);

    var result = BusinessRuleEngine.instantiateFromTemplate(templateId, {}, chatId);
    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Template（可能已经被删除）' };
    }
    return { ok: true, project: result.project, workflow: result.workflow, tasks: result.tasks };
  } catch (e) {
    return _wrapError_(e);
  }
}

// ============================================================
// UI-I1~I5（2026-08-21，Carson 批准消息「Track 2」——独立于 Track 1
// Identity 那条线，见 00_Project_State.gs「十四」）
//
// UI-I1 Sort+Filter：Sort 全部前端做（QueryEngine 目前没有排序能力，
// 见 00_Project_State.gs 记录的既有决定，本次不新增）；Filter 用
// TaskQueryEngine/ProjectQueryEngine 本来就有的精确匹配 filters 参数，
// 已经在上面 ui_getConvertibleTasks/ui_getActiveProjects 里加好。
// UI-I2 Edit：ui_updateTask/ui_updateProject。
// UI-I3 Priority：ui_suggestPriority——"AI Suggests, Human Confirms"
// 落到 Priority 字段的具体实现，见 00_Data_Ownership.gs「一」/
// ADR-2026-07-24-009：排序/筛选/展示只读 priority（=ADR 里的
// priority_user），不读 priority_ai_recommended；后者只作为"建议"
// 单独展示，采纳需要用户显式发起一次 ui_updateTask，不会自动生效。
// UI-I4/I5 Done/Cancel：ui_completeTask/ui_cancelTask/
// ui_completeProject/ui_cancelProject，直接复用既有 Command，本文件
// 只做 not_found/already_X/invalid_state → {ok,code,message} 的翻译。
// ============================================================

/**
 * updateTask(null) 同时代表"任务不存在"和"没有任何合法字段被改动"两种
 * 不同情况，无法从返回值本身区分——这里用 TaskQueryEngine.getTask
 * （本文件已声明的既有 Reads 依赖）自己先判断一次是不是"不存在"，
 * 不是新增 Domain 逻辑，只是让 Bridge 层的错误信息准确。
 * changes 直接透传给 TaskEngine.updateTask，字段白名单/合法值校验
 * 完全由既有 UPDATABLE_FIELDS + CFG 枚举负责，本函数不重复这层校验
 * （不引入 UI-only 的校验逻辑）。
 * @param {string} taskId
 * @param {object} changes  透传给 TaskEngine.updateTask 的 changes
 * @param {object} [_testOverrides]
 * @returns {{ok:true, task:object}|
 *           {ok:false, code:'MISSING_TASK_ID'|'NOT_FOUND'|'NO_CHANGES'|string, message}}
 */
function ui_updateTask(taskId, changes, _testOverrides) {
  try {
    if (!taskId) {
      return { ok: false, code: 'MISSING_TASK_ID', message: '缺少 taskId' };
    }
    var chatId = _resolveChatId_(_testOverrides);

    var existing = TaskQueryEngine.getTask(taskId, chatId);
    if (!existing) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Task（可能已经被删除）' };
    }

    var updated = TaskEngine.updateTask(taskId, changes || {}, chatId);
    if (!updated) {
      // 已经排除了"不存在"，走到这里只可能是 changes 里没有任何一个
      // UPDATABLE_FIELDS 认得的合法字段/合法值——不是错误，是"提交了但
      // 没有可保存的改动"，跟 ADR-015 的 BLOCKED 同一种处理方式：明确
      // 的 code，不是笼统报错。
      return { ok: false, code: 'NO_CHANGES', message: '没有识别出任何可以保存的改动' };
    }
    return { ok: true, task: updated };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * 跟 ui_updateTask 同一套理由：先用 ProjectQueryEngine.getProject 自己
 * 判断一次"不存在"，让 NOT_FOUND / NO_CHANGES 两种情况在 Bridge 层
 * 就区分清楚。
 * @param {string} projectId
 * @param {object} changes  透传给 ProjectEngine.updateProject 的 changes
 * @param {object} [_testOverrides]
 * @returns {{ok:true, project:object}|
 *           {ok:false, code:'MISSING_PROJECT_ID'|'NOT_FOUND'|'NO_CHANGES'|string, message}}
 */
function ui_updateProject(projectId, changes, _testOverrides) {
  try {
    if (!projectId) {
      return { ok: false, code: 'MISSING_PROJECT_ID', message: '缺少 projectId' };
    }
    var chatId = _resolveChatId_(_testOverrides);

    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Project（可能已经被删除）' };
    }

    var updated = ProjectEngine.updateProject(projectId, changes || {}, chatId);
    if (!updated) {
      return { ok: false, code: 'NO_CHANGES', message: '没有识别出任何可以保存的改动' };
    }
    return { ok: true, project: updated };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * UI-I3。只产出"建议"，绝不直接改 priority（= priority_user）——
 * 见本节头部注释引用的 ADR-2026-07-24-009。唯一的写操作是把这次生成
 * 的建议本身记到 priority_ai_recommended（22_PriorityEngine 生成建议
 * 这件事本身要落盘，ADR 原文"用户未采纳前不影响任何排序/展示逻辑"
 * 隐含的前提就是这个字段在"生成时"已经有值，不是只在"采纳时"才写）
 * ——通过既有 TaskEngine.updateTask 写，不是本文件直接发 Event。
 * priority_ai_recommended 不在 IDENTITY_AFFECTING_FIELDS 里，这次写入
 * 不触发 identity 重算。
 *
 * relatedContext 只补一个 project_title（如果这个 Task 挂在某个
 * Project 下）——sibling_task_titles 需要再多一次查询换来的边际帮助
 * 有限，这次不做，PriorityEngine.suggestPriorityWithAI_ 本身也把它
 * 设计成可选。
 *
 * @param {string} taskId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, priority:string, reasoning:string, current_priority:string}|
 *           {ok:false, code:'MISSING_TASK_ID'|'NOT_FOUND'|'AI_RESPONSE_INVALID'|string, message}}
 */
function ui_suggestPriority(taskId, _testOverrides) {
  try {
    if (!taskId) {
      return { ok: false, code: 'MISSING_TASK_ID', message: '缺少 taskId' };
    }
    var chatId = _resolveChatId_(_testOverrides);

    var task = TaskQueryEngine.getTask(taskId, chatId);
    if (!task) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Task（可能已经被删除）' };
    }

    var relatedContext = {};
    if (task.project_id) {
      var project = ProjectQueryEngine.getProject(task.project_id, chatId);
      if (project) relatedContext.project_title = project.title;
    }

    var suggestion = PriorityEngine.suggestPriorityWithAI_(task, relatedContext);

    TaskEngine.updateTask(taskId, { priority_ai_recommended: suggestion.priority }, chatId);

    return {
      ok: true,
      priority: suggestion.priority,
      reasoning: suggestion.reasoning || '',
      current_priority: task.priority || 'MEDIUM'
    };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * UI-I4（Task）。not_found → NOT_FOUND；already_done → 视为成功（用户
 * 想要的最终状态本来就是"完成"，重复点击不应该报错）；invalid_state
 * （已经是 CANCELLED/CONVERTED/NOT_SELECTED 等终态）→ 明确 code + 说明
 * 当前状态，不是笼统报错。
 * @param {string} taskId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, already_done:boolean, next_task:(object|null)}|
 *           {ok:false, code:'MISSING_TASK_ID'|'NOT_FOUND'|'INVALID_STATE'|string, message}}
 */
function ui_completeTask(taskId, _testOverrides) {
  try {
    if (!taskId) {
      return { ok: false, code: 'MISSING_TASK_ID', message: '缺少 taskId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var result = TaskEngine.completeTask(taskId, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Task（可能已经被删除）' };
    }
    if (result.invalid_state) {
      return { ok: false, code: 'INVALID_STATE', message: '这个 Task 已经是 ' + result.current_status + '，没法标记完成' };
    }
    return { ok: true, already_done: !!result.already_done, next_task: result.next_task || null };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * UI-I5（Task）。同 ui_completeTask 的三段式翻译，already_cancelled
 * 同样视为成功（幂等）。
 * @param {string} taskId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, already_cancelled:boolean}|
 *           {ok:false, code:'MISSING_TASK_ID'|'NOT_FOUND'|'INVALID_STATE'|string, message}}
 */
function ui_cancelTask(taskId, _testOverrides) {
  try {
    if (!taskId) {
      return { ok: false, code: 'MISSING_TASK_ID', message: '缺少 taskId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var result = TaskEngine.cancelTask(taskId, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Task（可能已经被删除）' };
    }
    if (result.invalid_state) {
      return { ok: false, code: 'INVALID_STATE', message: '这个 Task 已经是 ' + result.current_status + '，没法取消' };
    }
    return { ok: true, already_cancelled: !!result.already_cancelled };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * UI-I4（Project）。跟 ui_completeTask 同一套翻译规则，already_completed
 * 视为成功。ProjectEngine.completeProject 目前不检查子 Task/子 Project
 * 是否都已完成（不是本次改动引入的行为，既有 Engine 就是这样设计的，
 * Track 2 不改 Domain 逻辑，照既有契约调用）。
 * @param {string} projectId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, already_completed:boolean}|
 *           {ok:false, code:'MISSING_PROJECT_ID'|'NOT_FOUND'|'INVALID_STATE'|string, message}}
 */
function ui_completeProject(projectId, _testOverrides) {
  try {
    if (!projectId) {
      return { ok: false, code: 'MISSING_PROJECT_ID', message: '缺少 projectId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var result = ProjectEngine.completeProject(projectId, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Project（可能已经被删除）' };
    }
    if (result.invalid_state) {
      return { ok: false, code: 'INVALID_STATE', message: '这个 Project 已经是 ' + result.current_status + '，没法标记完成' };
    }
    return { ok: true, already_completed: !!result.already_completed };
  } catch (e) {
    return _wrapError_(e);
  }
}

/**
 * UI-I5（Project）。
 * @param {string} projectId
 * @param {object} [_testOverrides]
 * @returns {{ok:true, already_cancelled:boolean}|
 *           {ok:false, code:'MISSING_PROJECT_ID'|'NOT_FOUND'|'INVALID_STATE'|string, message}}
 */
function ui_cancelProject(projectId, _testOverrides) {
  try {
    if (!projectId) {
      return { ok: false, code: 'MISSING_PROJECT_ID', message: '缺少 projectId' };
    }
    var chatId = _resolveChatId_(_testOverrides);
    var result = ProjectEngine.cancelProject(projectId, chatId);

    if (result.not_found) {
      return { ok: false, code: 'NOT_FOUND', message: '找不到这个 Project（可能已经被删除）' };
    }
    if (result.invalid_state) {
      return { ok: false, code: 'INVALID_STATE', message: '这个 Project 已经是 ' + result.current_status + '，没法取消' };
    }
    return { ok: true, already_cancelled: !!result.already_cancelled };
  } catch (e) {
    return _wrapError_(e);
  }
}
