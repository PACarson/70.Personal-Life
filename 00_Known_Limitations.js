/**
 * 00_Known_Limitations.gs
 * Productivity OS v4.7 — Known Limitations & Internal-Only Capabilities
 *
 * 目的：记录"刻意不做，或者已经实现但暂未对外暴露"的能力边界——
 * Universal Domain OS Blueprint「Governance」目录里的 Not Yet 一类。
 * 跟其它治理文件的分工：
 *   00_Command_Reference.gs → 记录"已经对外生效的行为规则"
 *   00_Known_Limitations.gs（本文件）→ 记录"刻意不做 / 暂未暴露"的边界
 *   00_Roadmap.gs           → 记录"打算做但还没排期"的未来计划
 * 三者的区别：Command Reference 是"现状"，Known Limitations 是"现状的
 * 边界（而且这个边界是有意的，不是没写完）"，Roadmap 是"将来"。本文件
 * 存在的直接目的是让 Claude/外部审计在做 Architecture Review 时，看到
 * 这里列出的行为，不要当成 bug 或遗漏去提修复建议。
 *
 * LAST_UPDATED: 2026-09-07 — 新增「九、ProjectionEngine.dispatch()
 * 内部异常被吞掉，导致 EventBus.publish() 的 projection_ok 不可靠」，
 * 见该节，Carson 实测 Task→Note Conversion Gate 时的现象倒查代码
 * 发现，未修复，仅记录。
 *
 * 2026-09-05 — 新增「八、convertTaskToProject"先建后查"
 * 顺序的潜在孤儿 Project 风险」，见该节，Slice 4 Part B 收尾复核时
 * 发现，未修复，仅记录。
 *
 * 2026-09-04 — 新增「七、updateNote() Internal API」，
 * 见该节，同时借此机会修正 Implementation Plan Slice 3 文档里一处
 * 跟本文件头「目的」段落自相矛盾的指向（详见该节末尾说明）。
 *
 * 2026-09-02 — 新增「六、getTaskDashboard()」。【2026-09-04 补记：该节
 * 内容确实是 2026-09-02 那次加入的，但当时漏了同步这里的
 * LAST_UPDATED 历史——这是补记遗漏，不是编造时间】
 *
 * 2026-08-21 — 「二、updateTask() Internal API」补充
 * scopeKey 修复说明，见该节末尾【2026-08-21 补充】，以及
 * 00_Project_State.gs「十四」。
 *
 * 2026-08-14 — 新增「四、Sprint 4 AI 建议函数」，记录
 * Recovery Audit 后确认的三个 AI 函数 Not Yet Exposed 状态，见
 * 00_ADR.gs ADR-2026-07-24-021。
 *
 * 2026-07-17 — Reminder Policy Override 落地后同步措辞：
 * Natural Language Parser Scope 补充 reminder_policy（ADR-2026-07-17-009，
 * Carson 批准，判断标准沿用 V4.7 那次的同一套测试——确定性时间表达式
 * 解析 vs. 语义/领域判断——不是新引入一条）。
 *
 * 2026-07-13 — V4.7 Due Time Support 落地后同步措辞：
 * Natural Language Parser Scope 补充 due_time/due_datetime（同一类"时间
 * 解析"能力的延伸，边界本身未变，category/priority 仍不参与自然语言
 * 解析）；updateTask() Internal API 一节的 IDENTITY_AFFECTING_FIELDS
 * 引用同步补充 due_time。完整设计见 00_Architecture_Review.gs「七、
 * Review #3」。
 *
 * 2026-07-11 — 首次创建，收录三类：Natural Language Parser
 * Scope、updateTask() Internal API、Weekly/Monthly Dashboard +
 * suggestPriority() Internal Capability。全部由 Carson 在 2026-07-11
 * 当面确认，不是 Claude 单方面推测的"这应该是有意的吧"。
 */

// ============================================================
// 一、Natural Language Parser Scope（Known Limitation）
// ============================================================

/**
 * Known Limitation: Natural language parser intentionally extracts only:
 *   - due_date / due_time / due_datetime（V4.7 起，同一类"时间解析"
 *     能力的延伸——此前时间偶尔折叠进 due_date 字符串本身，现在拆成
 *     显式字段，解析范围本身没有扩大）
 *   - recurring
 *   - reminder_policy（2026-07-17 起，ADR-2026-07-17-009——"提前N分钟/
 *     小时/天提醒"这类短语，同样是确定性时间表达式解析，不是语义/领域
 *     判断，理由见下方【2026-07-17 补充】）
 *
 * Category and Priority are assigned by caller or default values
 * (category → 'GENERAL', priority → 'MEDIUM'; see 00_Command_Reference.gs
 * C5 / 20_TaskEngine.createTaskDirect_).
 *
 * Future AI callers may enrich these fields before createTask().
 *
 * ── 中文说明（架构理由）──────────────────────────────────────────────
 * 实现位置：06_TaskIntentParser.gs 的 TASK_CREATE 分支把
 * `{due_date, due_time, due_datetime, recurring, reminder_policy}` 传给
 * IdempotencyManager.createTaskIfNotExists，09_TemporalParser.gs 也只
 * 解析时间、重复规则、提醒偏移量，不解析"这句话在说什么类型的事、有多急"。
 *
 * 这是刻意的 Clean Architecture 边界，不是没写完：Productivity OS 的
 * 职责到"解析时间/重复规则、生成 identity、去重落库"为止，理解任务
 * 语义（"下周找律师"该归 ADMIN 还是 GENERAL、该给 HIGH 还是 MEDIUM）
 * 不是这一层该做的事——那需要自然语言理解/领域知识，属于上层调用方
 * （比如 Personal AI Core 这类 AI Agent）的职责。分层如下：
 *
 *   Personal AI Core（理解"下周找律师"是什么、该多急）
 *     ↓ 决定好 category/priority 之后调用
 *   Productivity OS.createTask(title, { due_date, due_time, recurring,
 *                                        category, priority })
 *     ↓
 *   （Productivity OS 自己永远不需要知道"找律师"是什么意思）
 *
 * 好处：Productivity OS 保持"傻瓜式"API，不掺业务语义判断，未来任何
 * 调用方（新的 AI Agent、批量导入脚本、另一个前端）想要更聪明的分类，
 * 只需要在调用 createTask() 之前自己算好 category/priority 传进来，
 * 不需要修改 Productivity OS 内部任何一行代码。
 *
 * 【V4.7 补充】Reminder OS（如果/当它开始消费本项目数据）同样适用这条
 * 边界——它能读到 due_time/due_datetime（本项目现在会存这两个字段），
 * 但"什么时候该提醒、提醒几次、怎么发通知"完全是 Reminder OS 自己的
 * 职责，不会因为本项目新增了这两个字段而产生任何反向依赖。
 *
 * 【2026-07-17 补充，ADR-2026-07-17-009】上面这条预判应验了——Reminder OS
 * 现在确实开始消费本项目数据了，具体是新增的 reminder_policy 字段（见
 * 26_ReminderOffsetEngine.gs 的 _ensureRulesFromPolicy_ 和该项目
 * 00_ADR_006）。判断"提前N分钟/小时/天提醒"这类短语是否属于本文件开头
 * 说的"解析范围"，用的是跟 due_time 那次完全一样的测试：这是不是需要
 * 语义/领域判断？不是——"提前30分钟"和"tomorrow 3pm"是同一类可枚举、
 * 可正则匹配的确定性时间表达式，不需要判断"这件事有多急、算哪个分类"。
 * 具体识别逻辑见 09_TemporalParser.gs 的 _extractReminderOffsets_()。
 * reminder_policy 是"提醒该怎么发"这件事的输入信号，不是"提醒该怎么发"
 * 这件事本身——后者仍然完全是 Reminder OS 的职责，本项目只负责把用户
 * 说的话转换成结构化数据存在 Task 上，跟 due_date/due_time 的角色完全
 * 一样。
 *
 * 如果以后 Telegram 自身想支持"关键词猜分类"这种轻量能力，那是一个新的
 * 、独立的功能决策（要不要在 Productivity OS 内部做，还是应该由
 * Personal AI Core 做），不属于"修复现有行为"，请另开 ADR 讨论，不要
 * 当成本条限制的延伸。
 */

// ============================================================
// 二、updateTask() — Internal API
// ============================================================

/**
 * updateTask() — Internal API
 *
 * 实现：20_TaskEngine.updateTask(taskId, changes, chatId)。
 * Status: Implemented, fully functional, not yet routed through any
 *         Telegram command.
 *
 * Current callers: none via Telegram（06_TaskIntentParser.gs 的指令
 *   列表里没有任何 intent 路由到 updateTask；目前只有 completeTask/
 *   cancelTask 两个状态转换有对应指令）。
 *
 * Anticipated future callers:
 *   - Future Telegram command（比如 /edit TSK-xxx category=SHOPPING）
 *   - Future AI（Personal AI Core 之类的 Agent 直接调用，不经过
 *     Telegram 指令解析这一层）
 *   - Future Batch（比如批量重新分类脚本）
 *
 * 保留原因：updateTask 已经处理好了 identity 重算（改到
 * IDENTITY_AFFECTING_FIELDS = ['title','due_date','due_time','recurring',
 * 'priority','category'] 里任一个字段都会重算 identity，避免"改了标题但
 * identity 还是旧的"这种不一致），是一个可以直接安全复用的 Internal API，
 * 不需要现在为了"没有 Telegram 指令用它"而删掉或标记成 dead code——它
 * 本来就是设计成给"未来调用方"用的引擎层能力，不是每个 Engine 函数都
 * 必须马上对应一个 Telegram 指令才算数。
 *
 * 【2026-07-17 补充，ADR-2026-07-17-009】reminder_policy 刻意不在
 * IDENTITY_AFFECTING_FIELDS 里——跟 budget/notes/description/tags 同类，
 * 是提醒相关的元信息，不是任务本身的身份特征，改一次提醒策略不应该触发
 * identity 重算。同样刻意不在 UPDATABLE_FIELDS 里——本次改动范围只覆盖
 * Task 创建流程（Carson 2026-07-17 决定 #2），"创建后修改提醒策略"是
 * 独立能力，未来需要时另开 ADR/Phase 评估，不是这次遗漏。
 *
 * 【2026-08-21 补充，Identity Impact Audit Track 1 Implementation
 * Preflight 发现，见 00_Project_State.gs「十四」】上面"identity 重算
 * 已经处理好"这句话，是在 generateTaskIdentity() 还没有 scopeKey 参数
 * 的年代写的，当时成立。2026-08-20 该函数加了向后兼容的第 7 个可选
 * 参数 scopeKey（context-aware Task 的 identity 纳入 workflow_id）之后，
 * 这里的重算调用一度漏传了这个参数——不影响本节上面记录的"至今没有
 * Telegram 调用方"这一事实（那句话仍然成立），但意味着"identity 重算
 * 已经处理好"这个结论本身，在 scopeKey 引入之后曾经短暂失真：一旦
 * updateTask() 有了第一个真实调用方（Track 2 UI-I2 Edit Task 即将
 * 成为第一个），context-aware Task 被编辑 identity-affecting 字段时会
 * 静默丢失 scope，退化成 legacy 公式。已修复（重算调用补上
 * merged.workflow_id || ''，行为完全对齐创建路径的既有约定），现在
 * "identity 重算已经处理好"这句话对 scopeKey 机制同样成立。本条不改变
 * 本节其余结论（Anticipated future callers 列表、保留原因均不变）。
 */

// ============================================================
// 三、Weekly/Monthly Dashboard & suggestPriority() — Internal Capability
// ============================================================

/**
 * Internal capability. Not yet exposed to users.
 *
 * 1. 25_DashboardEngine.buildWeeklyDashboard() / buildMonthlyDashboard()
 *    Status: Implemented（今日完成数/本周剩余/即将到来/逾期/完成率——或
 *    本月待办/已完成/已取消/Recurring/提醒次数/完成率），06_TaskIntent
 *    Parser.gs 目前只把 /dashboard 接到 'today'（→
 *    12_TaskQueryEngine.getDashboard('today', chatId)），没有 /weekly、
 *    /monthly 这类指令去调用它们。
 *
 * 2. 22_PriorityEngine.suggestPriority(task)
 *    Status: Implemented（按 Priority Score ≥80→CRITICAL / ≥55→HIGH /
 *    ≥25→MEDIUM / 否则 LOW 给建议标签），/priority 指令的回复文案
 *    （06_TaskIntentParser._buildPriorityReply_）目前只展示原始
 *    Priority Score 和任务自己已有的 manual priority，不调用
 *    suggestPriority，也就不会把"建议标签"显示给用户。
 *
 * 【2026-08-21 补充，UI-I3 已知非阻塞缺口，Carson 提出】同一个文件里
 * 走 AI 的那条（22_PriorityEngine.suggestPriorityWithAI_，见「四」）
 * 目前只能回 HIGH/MEDIUM/LOW 三档——prompt 里显式把合法值写死成
 * '"priority": "HIGH"|"MEDIUM"|"LOW"'，校验也只认这三个（validPriorities
 * 数组不含 CRITICAL），意味着不管任务多紧急，AI 建议永远够不到
 * CRITICAL，跟本条上面 suggestPriority() 纯公式那条（能给到 CRITICAL）
 * 不对称。已跟 Carson 确认是已知、非阻塞的小缺口，暂不在本次改动范围内
 * 修——真要修，改的是 22_PriorityEngine.gs 的 prompt 文案 + 校验数组，
 * 不是 UIBridge/前端能修的（UI-I3 只是如实展示 Engine 给出的建议，不
 * 应该在 Bridge 层悄悄给 AI 的合法值范围打补丁）。
 *
 * 两者共同点：函数本身已经写好、能正常工作、有对应的单元测试覆盖（如果
 * 有的话请在对应 Engine 文件里确认），只是还没有一个 Telegram 指令把它
 * 路由出去。如果外部审计/Architecture Review 报告"这个功能缺失"或
 * "这里应该加个 suggestPriority 调用"，先来这里核对——这不是遗漏，是
 * 有意暂缓（可能是想等 /edit 或 /weekly 这类指令一起设计的时候再接，
 * 避免为了接一个函数临时拍板一套指令格式）。真正要接的时候，在
 * 00_Roadmap.gs 排期，接完之后把对应条目从本文件挪到
 * 00_Command_Reference.gs 第二/六节。
 */

// ============================================================
// 四、Sprint 4 AI 建议函数——Internal Capability, Not Yet Exposed
//    （2026-08-14 新增，见 00_ADR.gs ADR-2026-07-24-021）
// ============================================================

/**
 * Internal capability. Not yet exposed to users.
 *
 * 1. 22_PriorityEngine.suggestPriorityWithAI_(task, relatedContext)
 * 2. 47_AIPlanningEngine.suggestNewProject_(chatId)
 * 3. 47_AIPlanningEngine.generateWorkflowSuggestion_(description)
 *
 * Status: Implemented（Sprint 4 开发中途会话崩溃，三个函数所在的文件
 * 成功从会话记录救回，2026-08-14 Recovery Audit 核实语法/依赖/契约均
 * 通过），06_TaskIntentParser.gs 里没有任何 intent 路由到这三个函数，
 * 00_Command_Reference.gs 也没有对应指令记录。
 *
 * 跟本节「三」的 suggestPriority() 是完全同一类处境，处理方式沿用同一条
 * 先例：暂缓设计 Telegram 指令，不是遗漏。额外理由（比「三」更进一步）：
 * 目前 Personal Life OS V2 整个 Domain 层——Note/Project/Workflow/
 * Review/BusinessRule——都还没有任何 Telegram 指令，06_TaskIntentParser.gs
 * 至今仍然只处理 Task 域（V1-V12/D1-D2 全部是 Task 相关，见
 * 00_Command_Reference.gs）。也就是说，这三个 AI 函数不是"AI 功能比同层
 * 其它功能慢一步"，而是"整层都还没有指令化"——如果现在单独为这三个 AI
 * 函数设计指令格式，会变成整个 Domain 层第一批指令只服务 AI 建议、
 * 不服务 Note/Project/Workflow 本身的创建/查询，形状会很奇怪。指令层
 * 什么时候设计、按什么顺序（Note/Project/Workflow 先，还是 AI 建议先，
 * 还是一起设计）留给 00_Roadmap.gs 排期决定，本文件只负责如实记录"现在
 * 还没有"，不预先替未来的指令设计做决定。
 *
 * 三个函数各自的失败模式（供未来设计指令时参考，也是当前测试覆盖的
 * 依据，见 48_Tests_AIEngines.gs）：
 *   - AI 未配置 / API 报错 / 回复不是合法 JSON：三个函数都不吞掉这些
 *     错误，原样从 46_AIConnector.gs 抛出（AI_NOT_CONFIGURED /
 *     AI_API_ERROR / AI_RESPONSE_NOT_JSON 前缀），调用方（未来的指令
 *     处理层）需要自己 catch 并转成用户可读的回复，参考
 *     06_TaskIntentParser.gs 现有 TASK_CREATE 分支处理 SYSTEM_BUSY 前缀
 *     错误的方式。
 *   - JSON 合法但关键字段缺失/类型不对：suggestPriorityWithAI_ 和
 *     generateWorkflowSuggestion_ 会显式校验并抛
 *     AI_RESPONSE_INVALID；suggestNewProject_ 对次要字段（title/
 *     reasoning/related_note_ids）容错为默认值，不抛错。
 *   - 三个函数都不创建/修改任何实体，所以不存在"中途失败留下 orphan
 *     entity"的风险——这个风险只会出现在未来"人类确认后，调用方拿着
 *     建议去调 27/28/20 走创建流程"那一步的编排逻辑里，那部分逻辑目前
 *     还不存在（属于 Telegram 指令层的一部分，见上）。
 *
 * 【2026-08-21 补充，UI-I3】上面"Not yet exposed to users"这句话，对
 * 第 1 个函数（suggestPriorityWithAI_）现在不完全准确了——50_UIBridge.gs
 * 新增的 ui_suggestPriority() 把它接给了 Web UI（不是 Telegram，是
 * 完全独立的暴露渠道），本节其余关于"整层没有 Telegram 指令"的推理
 * 不受影响、仍然成立（没有新增任何 Telegram 指令，UI 和 Telegram 是
 * 两条独立的入口）。第 2、3 个函数（suggestNewProject_ /
 * generateWorkflowSuggestion_）仍然完全没有接出去，这条限制原样不变。
 *
 * 上面"三个函数都不创建/修改任何实体"这条也需要精确一下：
 * suggestPriorityWithAI_ 本身仍然不创建/修改任何实体（没有改
 * 22_PriorityEngine.gs）；但它现在有了第一个"人类确认后写回"的调用方——
 * ui_suggestPriority() 会把这次生成的建议写进 priority_ai_recommended
 * （单条已有 Task 的一个字段，通过既有 TaskEngine.updateTask 写，见
 * ADR-2026-07-24-009），用户点"采纳"后同一个 updateTask 再把 priority
 * 也改掉。这不构成本段原本担心的"orphan entity"风险——那个风险专指
 * "建议要创建多个互相关联的新实体，创建到一半失败"（suggestNewProject_/
 * generateWorkflowSuggestion_ 未来接的时候才会遇到），Priority 这条
 * 从头到尾只碰一个已存在 Task 的字段，每次都是单个原子 updateTask 调用，
 * 不存在"创建一半"的中间状态。suggestNewProject_/
 * generateWorkflowSuggestion_ 未来真正接编排逻辑时，这段关于 orphan
 * entity 风险的推理需要重新评估，不能直接套用 Priority 这条的结论。
 */

// ============================================================
// 五、UI-I1 Sort 目前是前端方案——明确记录为过渡决定，不是最终架构
//    （2026-08-21 新增，Carson 在批准 UI-I1~I5 时明确要求记录这条）
// ============================================================

/**
 * 12_TaskQueryEngine.getTasks() / 14_ProjectQueryEngine.getProjects()
 * 目前只支持 filters 的单值精确匹配（见两者函数体），不支持排序。
 * UI-I1 的 Sort（Newest/Priority/Due date/Title，Task；Newest/Title/
 * Status，Project）改在 ui_index.html 的浏览器端 JS 里做
 * （sortTasks/sortProjects，纯函数，拿到 Bridge 返回的数组后本地排序，
 * 不产生任何请求、不碰 Sheet）。
 *
 * 这是 Carson 明确批准的 V1 方案，理由是 QueryEngine 目前没有排序能力，
 * 不想为了 Sort 现在就去改两个 QueryEngine 的契约——但明确要求把这一点
 * 记成"过渡决定"，不是"这就是最终架构"。如果外部审计/Architecture
 * Review 报告"排序逻辑应该在 QueryEngine 层，不应该在 UI 层"，先来这里
 * 核对：这不是架构判断错误，是已经被记录、被接受的临时状态，真正要挪到
 * 服务端的时候（比如数据量大到前端排序开始有感知延迟，或者其它调用方
 * 也需要同样的排序能力），在 00_Roadmap.gs 排期，不是这次顺手做。
 *
 * 一个直接后果：Sort 逻辑跑在浏览器里，51_Tests_UIBridge_Interactions.gs
 * 这类 GAS 测试函数没有办法执行或断言它（GAS 测试跑在 Apps Script
 * 服务端，看不到浏览器里的 JS）——这不是测试覆盖的缺口，是这套测试体系
 * 的既有边界，四个排序选项的正确性需要人工在浏览器里点一遍验证。
 */

// ============================================================
// 六、getTaskDashboard() — 只给 Web UI 用，Telegram 侧没有对应指令
//    （2026-09-02 新增，Implementation Plan Slice 2）
// ============================================================

/**
 * `12_TaskQueryEngine.getTaskDashboard(chatId)` / `50_UIBridge.
 * ui_getTaskDashboard` 是全新增加的能力（不是把既有能力换个包装），
 * 只给 Web UI 的 Dashboard 面板用——目前没有任何 Telegram 指令调用它，
 * 也没有计划加一个。这跟本文件其它几节"内部能力做好了但没接指令"不是
 * 同一种情况：这次的原因不是"暂缓"，是"这个能力的产出形态（结构化
 * JSON，含跨 bucket 去重、OS 分组）本来就是为 Web UI 设计的，Telegram
 * 端已有的 `25_DashboardEngine.buildTodayDashboard`/`buildWeeklyDashboard`
 * 才是给 Telegram 用的对应能力，两者故意保持独立（见
 * 00_ADR.gs ADR-2026-09-02-029），不是"少做了一半"。
 *
 * 内部复用 `24_ViewEngine.gs` 现有的 today/overdue/thisWeek/upcoming/
 * recurring/highPriority 纯函数过滤器，没有新写任何过滤逻辑；
 * `_readActiveTasks_` 只读一次，避免每个 bucket 各自重新读表。完整设计
 * 记录见 00_Project_State.gs「二十六」。
 */

// ============================================================
// 七、updateNote() — Internal API，同样没有 Telegram 指令
//    （2026-09-04 新增，Implementation Plan Slice 3）
// ============================================================

/**
 * updateNote() — Internal API
 *
 * 实现：29_NoteEngine.updateNote(noteId, changes, chatId)。
 * Status: Implemented, fully functional, not yet routed through any
 *         Telegram command.
 *
 * Current callers: 50_UIBridge.ui_updateNote()，只服务 Web UI 的 Notes
 *   面板内联 Edit 表单。06_TaskIntentParser.gs 没有 Note 域的任何
 *   intent——呼应本文件「四」已经记录过的事实：Note/Project/Workflow/
 *   Review/BusinessRule 整层至今都没有 Telegram 指令，不是 updateNote
 *   一个函数单独落后于同层其它能力。
 *
 * Anticipated future callers: 跟「二」updateTask() 同一类——未来如果这一
 *   层被指令化、未来 AI Agent 直接调用、未来批量脚本。
 *
 * 保留原因：跟「二」同一套逻辑，Engine 层能力不需要等 Telegram 指令
 * 出现才算数。identity 重算已处理（content/category 任一变化都调用
 * IdentityEngine.generateNoteIdentity 重新计算，完整设计记录见
 * 00_Project_State.gs「三十一」），FORBIDDEN_FIELDS 校验复用 createNote
 * 同一套，没有为了 Edit 开后门。
 *
 * 【文档归属说明，非"新限制"，是本条记录本身的落脚点澄清】
 * Personal_Life_OS_UIV2_Implementation_Plan_2026-09-01.md「Slice 3」
 * 原文写"完成后需要更新 00_Command_Reference.gs"——但本文件头「目的」
 * 段落已经明确：00_Command_Reference.gs 只记录"已经对外生效"的规则，
 * "已实现但暂未通过 Telegram 暴露的能力"（该文件头原文点名 updateTask()
 * 举例）明确不放在那份文件，放这里。updateNote 是 updateTask 同一条
 * 排除规则下的同类项，此前 updateTask()/updateProject() 也都没有被加进
 * Command Reference（可 grep 该文件确认），这次不例外，记在这里而不是
 * Command Reference，不是漏做 Implementation Plan 那一步，是那一步的
 * 指向本身跟治理文件自己的分工规则不一致，按治理文件的规则走。
 */

// ============================================================
// 八、convertTaskToProject（42_ConversionEngine.gs）"先建目标、后查源
//    状态"的顺序——潜在孤儿 Project 风险，本次审计发现，未修复
//    （2026-09-05 记录，Slice 4 Part B 收尾复核时发现）
// ============================================================
//
// 【STATUS UPDATE，最初 2026-09-08 记为代码层面 RESOLVED，
//  2026-09-09 真实 regression 全过后正式收尾：RESOLVED — LIVE
//  VERIFIED，见本节末尾单独记录，不改动下面 2026-09-05 写的原始分析，
//  那部分保留作为问题本身的历史记录】
//

/**
 * 现状（已核实，不是猜测）：`convertTaskToProject`的顺序是——幂等检查
 * →（Slice 4 Part A 新增的）due_date 系列 BLOCKED 检查 → **直接调用
 * `ProjectEngine.createProject`** → 之后才调用
 * `TaskEngine.markTaskConverted_`标记源。而"只有非终态 Task 才能
 * 转换"这条前置条件，只在 `markTaskConverted_`**内部**检查（见该
 * 函数 `terminalStatuses`判断），不在 `convertTaskToProject`自己
 * 创建 Project 之前检查。
 *
 * 风险：如果一个已经是终态（DONE/CANCELLED/NOT_SELECTED）的 Task 被
 * 传进 `convertTaskToProject`（正常 UI 流程下不应该发生——终态 Task
 * 的卡片理论上不会展示"Convert to Project"这个可交互状态，但这是 UI
 * 层的隐性假设，不是 Engine 层自己的强制保证），Project 会先被建出来，
 * 然后 `markTaskConverted_`才发现 Task 是终态、返回
 * `{invalid_state:true}`——而 `convertTaskToProject`**没有检查
 * 这个返回值**，会直接把已经建好的 Project 当作成功结果返回。结果：
 * 一个孤儿 Project 被创建，源 Task 没有被正确标记为 CONVERTED，两者
 * 关联关系没有建立。
 *
 * 发现时机与范围说明：这不是本窗口任何一次改动引入的新问题——
 * `convertTaskToProject`这部分代码从 Sprint 3 就是这个顺序，Slice 4
 * Part A 只在它前面加了一段 BLOCKED 检查，没有改动这个既有顺序。
 * 发现于 Slice 4 Part B 设计 ADR-2026-09-02-030 时的代码审计（为了
 * 确保 `convertTaskToNote`不复制同一个顺序缺陷），记在这里是因为
 * 它本身独立于 Task→Note 存在，不应该只夹在 ADR-030 的 Context 里
 * 让人不容易查到。
 *
 * 本次未修复的原因：Carson 在 Slice 4 Part A/Part B 期间多次明确
 * 要求"不要做无关重构""不要预防性修改既有代码"，这条修复会改动
 * `convertTaskToProject`的既有执行顺序，超出当时每一轮被明确授权的
 * 范围，所以只记录、不动手。
 *
 * 建议的修复方向（仅供参考，不是已批准的方案）：把"非终态"检查提到
 * `convertTaskToProject`创建 Project 之前（跟 Slice 4 Part B 的
 * `convertTaskToNote`现在的顺序一致），并且在调用
 * `markTaskConverted_`之后检查其返回值，如果是 `invalid_state`应该
 * 视为一种需要处理的异常情况，而不是忽略。这个修复需要独立评估
 * 是否会影响任何依赖现有顺序的既有测试或行为，不应该在其它任务
 * 的顺带改动里完成。
 *
 * ── RESOLUTION, 2026-09-08（Carson 明确授权的独立修复窗口，不是
 *    顺带完成）──────────────────────────────────────────────────
 * Known Limitation 8
 * Status: **RESOLVED — LIVE VERIFIED**（2026-09-09 真实 regression
 *   execution 后正式收尾，不是静态代码审查）
 * Change: `convertTaskToProject`按上面"建议的修复方向"原样实施——
 *   已转换成 Note 的 Task、终态 Task，现在都在创建 Project 之前就被
 *   挡下来（照抄 `convertTaskToNote` 的 pre-check 结构），并接住
 *   `markTaskConverted_`的返回值作为防御性兜底。完整 Before/After
 *   分析、逐条 regression 核对见 `00_Project_State.gs` 对应交付章节，
 *   不在这里重复。
 * Reason: 消除本节上面描述的孤儿 Project / 重复创建风险（含分析阶段
 *   另外发现的"已转 Note 又被转 Project"这一同根同构场景）。
 * Verification:
 *   Static: PASS（node --check 通过）
 *   LIVE: **PASS**（Carson 真实执行，2026-09-09）——
 *     `runTaskToProjectPrecheckGate()`新 pre-check 3/3 PASS（上一轮）；
 *     本轮 `testBidirectionalConversion_`（经
 *     `runSprint3AcceptanceGate()`）PASS；`38_Tests_UIBridge.gs`的
 *     `testUIBridge_ConvertTaskToProject_Success_`/
 *     `_InvalidOrMissingId_`/`_NoDuplicateOnRetry_`三个（经
 *     `runUIBridgeSlice2Gate()`）PASS；`runTaskToProjectBlockedGate()`
 *     PASS；额外的 `runUIBridgeSlice1Gate()`/`runUIBridgeSlice3Gate()`
 *     也全部 PASS（不在 Carson 要求的三组以内，作为额外回归信号）。
 *     没有观察到新的 Task→Project regression，没有观察到孤儿 Project。
 * `convertTaskToProject`/Known Limitation 8 整体状态：**LIVE
 * VERIFIED**。
 */

// ============================================================
// 九、ProjectionEngine.dispatch() 内部异常被吞掉，
//    导致 EventBus.publish() 返回的 projection_ok 不可靠
// ============================================================

/**
 * 发现契机：Carson 实测运行 `runTaskToNoteConversionGate()`，
 * `testTaskToNote_BlockedFields_`因为一条无关的测试数据错误（见
 * `54_Tests_TaskToNoteConversion.gs`「due_datetime」用例，本次已修复，
 * 详见 00_Project_State.gs 本次交付章节）意外走到了真正创建 Note + 标记
 * 源 Task 的路径，暴露出：Carson 手工核对时发现源 Task 行没有被写入
 * `converted_to_note_id`，Timeline 里也没有对应这个 Task 的 entry。
 * 倒查 `02_EventBus.gs`/`10_ProjectionEngine.gs`代码发现的结构性问题，
 * 独立于那条测试数据错误，如实记录：
 *
 * `10_ProjectionEngine.gs`的 `dispatch(event)`：
 *   1. 外层有一个 try/catch（约第 120~171 行）。
 *   2. try 内部先跑 switch，按 event.type 分派到具体的
 *      `projectXxx_(event)`处理函数（比如
 *      `projectTaskConvertedToNote_`），然后（不论上面 switch 走了哪个
 *      case）无条件调用 `_appendTimelineEntry_(event)`——这一行在
 *      switch **之后**、catch **之前**，本意是"两者要么都成功要么都不
 *      发生，不会出现 Timeline 记了但主 Read Model 没写的不一致"（见
 *      代码里 2026-07 的注释）。
 *   3. 问题在于：如果具体的 `projectXxx_(event)`函数内部抛出异常，会
 *      直接跳到外层 catch（约第 168~170 行），而这个 catch 只是
 *      `Logger.log(...)`记录一行，**没有重新抛出**，`dispatch()`本身
 *      没有返回值，调用方完全看不出这次 dispatch 内部其实失败了。
 *   4. `02_EventBus.gs`的 `publish()`（约第 201~209 行）调用
 *      `ProjectionEngine.dispatch(event)`时也包了一层 try/catch，本意
 *      是"如果 dispatch 抛错，把 event.projection_ok 设成 false，让
 *      调用方（比如 `20_TaskEngine.gs`的
 *      `markTaskConvertedToNote_`/`markTaskConverted_`）做兜底直写"。
 *      但因为上面第 3 点，`dispatch()`内部的异常从来不会真正传到
 *      `publish()`这层的 try/catch——`event.projection_ok`永远保持
 *      默认值 `true`，**不论具体 projector 内部是否真的抛了异常**。
 *   5. 净效果：具体 projector（不只是
 *      `projectTaskConvertedToNote_`，switch 里列出的每一个 case 都是
 *      同样的风险）一旦内部抛错，(a) 对应的 Read Model 那次更新丢失，
 *      (b) Timeline 那一行也不会出现（同一个 try 块，异常发生在
 *      `_appendTimelineEntry_`之前），(c) 调用方以为
 *      `projection_ok===true`、认为"没问题，不需要兜底"，`20_TaskEngine.
 *      gs`里那些"projection_ok===false 就走 materializeTaskRow_ 兜底"
 *      的安全网**不会被触发**——三重后果叠加在一起，且完全静默（只有
 *      Logger.log 里一行不显眼的 ERROR，没有任何返回值/异常告诉最外层
 *      调用方"这次操作其实不完整"）。
 *
 * 跟当前这次具体现象的关系（【2026-09-07 更新】Carson 重跑
 * `runTaskToNoteConversionGate()`后，`testTaskToNote_
 * SuccessfulConversion_`/`_EventEmittedAndProjected_`/
 * `_ReplayConsistency_`/`_Idempotent_`四项全部 FAIL，`_
 * EventEmittedAndProjected_`打印出的 Task 行 JSON 里连
 * `converted_to_note_id`这个 key 都不存在——已经找到了更简单、更确定
 * 的根因，见 00_Project_State.gs 对应章节和
 * `15_Setup.gs`的`NEW_TASK_COLUMNS`修复：真正原因是`NEW_TASK_COLUMNS`
 * 数组漏加了`converted_to_note_id`，导致真实 Spreadsheet 的 Tasks 表
 * 压根没有这一列。**这个更简单的根因已经确认，不再需要下面这段假设
 * 里说的"翻 Execution Log 找 ERROR dispatching 那一行"这个验证步骤
 * 了**——保留下面这段是因为 (a) 上面 1-5 点描述的`dispatch()`吞异常
 * 这件事本身仍然是真实、独立存在的代码事实，跟这次症状的真正原因
 * 无关，但不代表它不存在；(b) `upsertRowByKey_`对一个不存在的列名
 * 是**静默跳过、不抛异常**的（`05_SheetUtils.gs`的
 * `if (headerMap.hasOwnProperty(key))`判断没有 else 分支）——所以这次
 * 具体症状根本不会走到`dispatch()`的 catch 那一步，下面"已用代码证实"
 * 那一条依然成立，但"最有解释力的假设"那一条对**这次**症状来说其实
 * 不是真正机制，只是尚未找到真根因之前最合理的猜测。如实保留原文，
 * 避免看起来像事后删掉了错误的推理）：
 *   - **已用代码证实**：上面 1-5 点是`dispatch`/`publish`现在的真实
 *     实现，不是猜测——即，"projection_ok 在 projector 内部抛错时不会
 *     变成 false"这件事本身是确定的代码事实，跟这次症状是否是它导致的
 *     无关，独立成立。
 *   - **（已被更简单的根因取代，不再是活跃假设）**：`projectTaskConvertedToNote_`
 *     内部的 `upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {...})`
 *     这次具体调用是否真的抛了异常——现在已知答案是"不会"，因为该函数
 *     对不存在的列名是静默跳过，不是抛异常，所以`dispatch()`那层的
 *     catch 根本没有被触发的机会，`event.projection_ok`保持`true`是
 *     "正常路径下的正确结果"，不是这次 bug 的成因。
 *
 * 本次未修复的原因：这不是 Task→Note 转换自己的问题，是
 * `dispatch()`的通用错误处理结构性缺口，switch 里列出的每一种事件类型
 * 理论上都有同样风险（这个缺口本身仍然真实存在，只是不是这次症状的
 * 成因——某个 projector 未来真的抛异常时，这个缺口会让`projection_ok`
 * 误报成功，那是另一个独立的、依然待处理的风险），修复涉及改动
 * `02_EventBus.gs`/`10_ProjectionEngine.gs`这两个被全项目所有
 * Create/Update/Convert 路径共用的核心文件，影响面远超本次 Task→Note
 * 的验收范围，按 Carson 本轮"不做无关重构""独立发现不能顺手改"的一贯
 * 要求，只记录、不动手，等 Carson 看到这条之后单独决定优先级和排期。
 *
 * 建议的修复方向（仅供参考，不是已批准的方案）：`dispatch()`的 catch
 * 块除了 Logger.log，还应该把这次 dispatch 是否成功的信息真正传出去
 * ——比如 `dispatch()`改成有返回值（成功/失败 + 错误信息），
 * `publish()`根据这个返回值而不是"有没有异常逃逸到自己这层"来设置
 * `projection_ok`。这个改动需要过一遍全部 event type 的既有测试
 * （尤其是任何依赖"projection 失败时静默、不影响主流程"这个当前行为
 * 的既有代码/测试），不应该在其它任务的顺带改动里完成。
 */

// 十、rebuildAllProjections() Recovery Coverage — 六张表没有任何 rebuild
//     实现（2026-09-15，Decision 3 审计发现，记录不修）

/**
 * 背景：`rebuildAllProjections()` 曾经只调用 Tasks 相关四个 rebuild*
 * 函数，漏掉了已经存在的 `rebuildProjectsProjection`/
 * `rebuildWorkflowsProjection`（Sprint 1）和
 * `rebuildTaskViewOrderProjection`（UI-I6）——这个具体缺口已经在
 * 2026-09-15 修复（三个函数迁移进 `11_ProjectionRebuilder.gs` 本体，
 * `rebuildAllProjections()` 现在正确调用全部七个，见
 * `00_Project_State.gs`「四十八」）。
 *
 * 但同一次审计（"Phase 1 Recovery Completeness Audit"，逐表核对
 * Projection → Rebuild Function → 顶层调用覆盖）还发现，以下六张
 * Read Model 表**完全没有对应的 rebuild 函数**（不是"存在但没被调用"，
 * 是"压根没写过"）：
 *
 *   - ArchiveTasks（只有 schema 迁移逻辑，从未出现在任何
 *     rebuild*Projection 里）
 *   - Timeline（`10_ProjectionEngine.gs` 的 `_appendTimelineEntry_`
 *     只在事件发生的当下追加一条，没有对应的"从 Events 全量重放重建
 *     Timeline"能力）
 *   - Notes、Reviews、BusinessRules、WorkflowTemplates（Sprint 3
 *     新增的四张表，创建时只写了 Engine/Query/Projection 三层，没有
 *     配套写 rebuild 函数）
 *
 * 这六张表如果 Read Model 跟 Events 出现不一致（比如某次
 * `ProjectionEngine.dispatch` 因为「九」描述的异常吞掉问题静默失败），
 * 目前没有任何"重放 Events 修复它"的手段——只能手动订正 Sheet 数据，
 * 跟"Everything Rebuildable"这条既有原则不符。
 *
 * 这次任务的范围明确是"让已有 rebuild 函数被正确调用"，不是"给还没有
 * rebuild 函数的表设计新的 rebuild 架构"（Carson 本轮任务说明原话），
 * 所以这六个只记录、不动手实现。如果未来要补，Timeline 需要额外想清楚
 * "重放时要不要先清空已有 Timeline 记录再重建"这个问题（Timeline 是
 * 面向用户的历史记录展示，跟 Projects/Workflows 那种"每个 entity 一行"
 * 的重放形状不完全一样，直接照抄可能会产生重复记录）；Notes/Reviews/
 * BusinessRules/WorkflowTemplates 大概率可以照抄
 * `rebuildProjectsProjection` 的模式（各自的 Engine 应该已经有
 * `deriveFromEvent`/`materializeXxxRow_`，需要逐个核实，本次未核实）。
 */


// ============================================================
// 十一、_setPlainTextFormatForNewColumns_ 的纯文本保护有生命周期上限
//     （2026-09-20 新增，Real GAS Verification Gate 修复过程中发现，
//     修复本身不能、也不需要消除这条残留风险）
// ============================================================

/**
 * `11_ProjectionRebuilder.gs` 的 `_setPlainTextFormatForNewColumns_`
 * 这次修复（见 ADR-2026-09-18-031 追记）把格式化范围从 `getLastRow()`
 * 改成了 `getMaxRows()`——跟 `_ensureSheet_` 对全新表的处理方式对齐，
 * 把当前物理网格里还没有数据的预留行也提前格式化好。
 *
 * 但这个 range 是"迁移那一刻的 getMaxRows()"，不是"永远"。如果这张
 * 表将来的数据行数增长超过当前 `getMaxRows()`，Google Sheets 会自动
 * 扩容网格——扩容出来的全新行不在这次格式化的 range 里，会重新暴露
 * 同一个"日期/时间形状的字符串被自动识别成 Date/Time 类型"问题。
 *
 * 这不是这次修复的缺陷，是跟 `_ensureSheet_` 自己对全新表的保护方式
 * 完全同一等级的残留风险——`_ensureSheet_` 也只格式化创建时刻的
 * `getMaxRows()`，同样不会自动跟着未来的网格扩容延伸保护范围。这次
 * 修复只是把 `_setPlainTextFormatForNewColumns_` 提升到跟
 * `_ensureSheet_` 同一个保护水平，不是消灭这类风险本身。
 *
 * 真正杜绝需要在写入路径本身加保护（比如每次 appendRow/upsertRowByKey_
 * 写入 due_date 这类字段时显式 setNumberFormat 那一格），这是更大的
 * 改动，不在这次授权范围内，故记录为 Known Limitation，不是这次顺手
 * 解决的范围。
 *
 * 触发条件：Projects/Tasks/ActiveTasks/ArchiveTasks 任意一张表的行数
 * 增长到超过它们各自当前的 `getMaxRows()`（Google Sheets 新建 Sheet
 * 默认一般是 1000 行，具体数字取决于每张表各自的创建历史，这次修复
 * 没有、也无法从代码里确认每张真实表当前实际的 getMaxRows() 是多少）。
 * 以 Carson 真实环境当前的数据量（Projects 67 行、Tasks 157 行，见
 * 00_Project_State.gs「四十八」）来看，短期内触发的概率很低，但不是
 * 零，值得记录，不假设"不会发生"。
 *
 * 【2026-09-23 追记——"真正杜绝"的写入路径修复已实现，STATIC VERIFIED，
 * LIVE GAS 待验证】上面这段一直悬着的"真正杜绝需要在写入路径本身加
 * 保护"这次做了：`05_SheetUtils.js` 的 `upsertRowByKey_` /
 * `batchUpsertRowsByKey_` 新增可选的 `plainTextColumns` 参数，写值
 * 之前对指定列显式 `setNumberFormat('@')`，不依赖任何提前占位的 range，
 * 不受这条 Known Limitation 描述的"表长大就会用完"这个上限影响。已经
 * 排查并接上这个参数的真实写入点：`10_ProjectionEngine.js` 的
 * `projectProjectCreated_`/`projectProjectUpdated_`/`projectTaskCreated_`/
 * `projectTaskUpdated_`，`27_ProjectEngine.js` 的
 * `materializeProjectRow_`（同时覆盖 update 兜底和
 * `11_ProjectionRebuilder.js` 的 Projects 全量重建），
 * `20_TaskEngine.js` 的 `materializeTaskRow_`，
 * `11_ProjectionRebuilder.js` 的 `rebuildTasksProjection`/
 * `rebuildActiveTasksProjection`。这次的 write-path audit（逐一核对
 * 全仓库每一处 `upsertRowByKey_`/`batchUpsertRowsByKey_`/直接
 * `appendRow`/`setValues` 调用）额外发现一处这条 Known Limitation
 * 本身列出过、但之前实际没有检查过的缺口——`13_ActiveTasksEngine.js`
 * 的 `runDailyArchive`（Tasks→ArchiveTasks 的每日归档）是手写批量
 * `setValues()`，完全不经过上面两个函数，之前零保护——这次同一个
 * 原则补上了。上面 node --check 之外没有、也不可能在 Node 环境验证
 * "Sheets 是否真的不再自动识别类型"这个平台行为本身，仍然是 LIVE
 * GAS PENDING，需要 Carson 回到真实环境后用
 * `59_Tests_DueTimePlainTextProtection.js` 验证。
 */

// ============================================================
// 十二、Tasks 表 due_time 是否已经存在历史性静默损坏 —— 范围未知，
//     需要真实环境核实（2026-09-20 新增，同上背景发现）
// ============================================================

/**
 * `migrateSchemaDueTime()`（给 Tasks/ActiveTasks/ArchiveTasks 追加
 * due_time/due_datetime 两列）用的是同一个（这次已修复）
 * `_setPlainTextFormatForNewColumns_`。这次在真实环境证实的 bug
 * （Project Deadline Real GAS Verification Gate，2026-09-19/20）
 * 证明：**在这次修复之前**，任何一张表在"迁移那一刻"之后新增的行，
 * due_time/due_datetime 列都没有纯文本保护，会被 Sheets 自动识别成
 * Date/Time 类型。
 *
 * 这次修复之前，`migrateSchemaDueTime()` 是什么时候在 Carson 真实
 * 环境跑的、当时 Tasks 有多少行、之后又新增了多少行——这些都无法从
 * 代码本身确认。如果 `migrateSchemaDueTime()` 运行得比较早、Tasks
 * 之后又持续新增了大量带 due_time 的真实 Task，这些真实 Task 的
 * due_time（进而 due_datetime、进而 Task Identity 的计算）**可能已经
 * 在真实 Spreadsheet 里静默损坏了一段时间**——不是假设一定发生，是
 * "无法排除，需要真实环境核实"。
 *
 * 核实方法（真实环境执行，不在这次修复范围内自动完成）：在 Apps
 * Script 编辑器里挑一个真实存在、带 due_time 的较早的 Task，直接读它
 * 的 due_time 单元格值，看是字符串（比如 "18:00"）还是 Date 对象
 * （类似 "Sat Dec 30 1899 09:00:00 GMT+xxxx" 这种形状）。如果发现真的
 * 有历史性损坏，修复已损坏的既有行需要一次数据层面的批量修复（把这些
 * 单元格重新格式化成纯文本、再重写回正确的字符串值），这是比这次
 * 授权范围（"修复共用 helper"）更大的一次操作，需要 Carson 另行决定
 * 是否要做、怎么做，不在这次任务范围内自动展开。
 *
 * 补充：Tasks 的 `due_date`（不同于 due_time/due_datetime）大概率不受
 * 影响——它是 Tasks 建表时就有的历史列，从 `_ensureSheet_`
 * 建表那一刻起就已经被整块设成纯文本（见 15_Setup.gs 对 Tasks 的
 * `_ensureSheet_` 调用），只要 Tasks 至今的行数没有超过它建表时的
 * `getMaxRows()`（大概率没有，参照「十一」的分析），due_date 应该
 * 一直是安全的——但这是推理，不是已经在真实环境验证过的事实，如实
 * 标注为推理而不是结论。
 *
 * 【2026-09-23 追记——只解决了"以后会不会继续损坏"，没有解决"过去是不是
 * 已经损坏"】这次任务范围明确是 write-time protection（防止未来再发生），
 * 不是这段一直说的历史数据核实/修复——两者是两件独立的事，不要混为一谈：
 *   - 已经做的：Tasks 的 due_time/due_datetime 在 create/update/
 *     materialize 兜底/projection 全量重建这几条真实写入路径上，跟
 *     Known Limitation「十一」同一个机制（`upsertRowByKey_`/
 *     `batchUpsertRowsByKey_` 的 `plainTextColumns` 参数）接上了防护，
 *     STATIC VERIFIED（node --check + Node shim 断言 `upsertRowByKey_`/
 *     `batchUpsertRowsByKey_` 本身逻辑），LIVE GAS 待验证。due_date 这次
 *     没有加（上面"补充"段的推理没有变化，也没有新证据推翻它，按 Carson
 *     的明确指示不扩大这次的字段范围）。
 *   - 完全没有做、也不允许在这次任务里做：这段最前面提到的"核实方法"
 *     （去真实环境挑一个真实存在的旧 Task 直接看 due_time 单元格的真实
 *     类型）——一次都没有执行过，这条 Known Limitation 描述的不确定性
 *     原样保留，没有被这次修复解决或改变。是否要做这个核实、要不要对
 *     已经损坏的历史行做批量修复，仍然是需要 Carson 另行决定的独立
 *     Decision Gate，不因为这次的 write-time 修复而自动变成"已处理"。
 */

// ============================================================
// 十三、due_time 一旦在真实 Sheets 里被误判成 Date 类型，读回来做
//     canonicalize 恢复的值可能有分钟级偏差（新加坡/马来西亚历史
//     时区偏移，2026-09-20 新增，边界修复过程中发现）
// ============================================================

/**
 * `42_ConversionEngine.js`（`convertTaskToProject` 边界修复，
 * ADR-2026-09-18-031）新增的 `_canonicalizeDueTimeForConversion_`
 * 能正确处理"字符串原样通过"、"Invalid Date 显式抛错"这两种情况，
 * 但对"due_time 已经被 Sheets 误判成 Date 对象、需要读回来恢复"这
 * 一种情况，存在一个无法用这层代码修好的精度问题：
 *
 * Google Sheets 内部把"纯时间"值锚定在 1899-12-30 这个历史日期上
 * （Lotus 1-2-3 / Excel 兼容的序列日期 epoch）。新加坡/马来西亚在
 * 1899 年的历史 UTC 偏移量**不是**今天的 +8:00（今天的 +8:00 是
 * 1982 年之后才固定的），IANA 时区数据库对 1899-12-30 这一天记录的
 * 是历史上真实使用过的偏移（+6:55 附近，不是整点）。这意味着：
 * 如果一个 due_time 单元格已经被 Sheets 误判成 Date 对象，
 * `Utilities.formatDate(value, 'Asia/Singapore', 'HH:mm')`
 * 读出来的时间，跟用户原本输入的时间会有大约 65 分钟的系统性偏差
 * ——不是随机误差，是历史时区数据库本身的真实记录，任何遵守 IANA
 * 时区规则的实现（包括 Google Apps Script 自己）都会得到同样的
 * 偏差。这不是这次新写的代码的 bug，是"试图用读时校正来恢复一个已经
 * 经过 1899-12-30 锚点序列化的时间值"这件事本身在新加坡/马来西亚
 * 时区下天生做不到精确的——信息在 Sheets 内部转换那一步已经失真，
 * 不是本次代码能在读的时候补救回来的。
 *
 * 已用真实数字交叉验证：本次 Node.js 环境用 Intl.DateTimeFormat 独立
 * 算出 09:15 经 1899-12-30 锚点、Asia/Singapore 时区还原成
 * 08:10（差 65 分钟）——跟 Carson 2026-09-19/20 真实 GAS 环境日志里
 * 看到的 `GMT+0655`（跟标准 +08:00 正好也差 65 分钟）完全对得上，
 * 两个独立来源交叉确认，不是巧合或者环境特有的假象。
 *
 * 影响范围：只影响"due_time 已经被误判成 Date 对象、需要靠读时
 * canonicalize 补救"这一种情况——不影响 due_date（现代日期的
 * UTC 偏移是标准 +8:00，没有这个历史偏移问题）；也不影响"due_time
 * 从头到尾一直是干净字符串、从来没被误判"这种正常路径。真正杜绝
 * 这个问题需要防止 due_time 一开始就被 Sheets 误判成 Date 类型
 * （见 Known Limitation「十一」「十二」讨论的纯文本格式化防护那一层，
 * 那一层做对了，这一层的读时补救就永远不会被真正用到）——本条不是
 * 要另外重新设计一套"读时精确恢复"方案，是记录"读时恢复这条路径
 * 本身对这个时区有精度上限"这个事实，决定要不要处理、怎么处理，
 * 留给 Carson。
 */
