/**
 * 00_Architecture_Review.gs
 * Productivity OS — Architecture Review #1（UEF v1.0 Domain Profile）
 *
 * 目的：Universal Engineering Framework（UEF）v1.0 于 2026-07-10 ratify 后，
 * 本项目第一次按 UEF 正式流程（00_Review_Framework.md）跑 Architecture
 * Review——此前 5 轮"外部审计"走的是本项目自己的 ad hoc 流程，跟 UEF
 * Domain Profile 的 checklist 不是同一套东西，UEF Constitution §6.3
 * 要求每个项目在其 Release Gate 之前至少有一次匹配 Profile 的正式 Review，
 * 本项目已经在生产环境跑了 V4~V4.6，属于"补跑"（retroactive），跟
 * UEF Review History 里 Investment OS 2026-07-10 那条的性质一样。
 *
 * 本文件是本项目 Governance 层新增的第 8 份文件（Constitution/State/
 * File Map/ADR/Roadmap/Known Limitations/Command Reference/本文件）。
 *
 * LAST_UPDATED: 2026-07-13（同日第二次更新）— Carson review 后两处措辞
 * 调整：「七」的「八、Open Decisions」改名为「Pending Design
 * Decisions」，绑定角色 Decision Authority（Architecture Owner）而非
 * 人名 Carson，四项各补 Decision Type（Semantic/Migration/UX/
 * Governance）标签；「九」Review Summary 同步措辞。均为纯文档措辞
 * 调整，不改变四项决策本身的内容或任何已完成的设计判断。
 *
 * 2026-08-29 — 新增「八、Review #4」：Project Deadline Contract 的
 * Pre-Implementation Design Review（Feature/Change Review，跟
 * Review #1/#2 的周期性 Domain Profile 合规扫描性质不同，结构沿用
 * Review #3 的 7-Deliverable 模板）。本次只是 Review——不改
 * production 代码、不新增 Project/Workflow 任何字段、不动 Reminder OS、
 * 不跑 migration，「八、Pending Design Decisions」列出的问题写完就停，
 * 等 Architecture Owner 批准。刻意把标题定为"Deadline Contract"而不是
 * "Project Reminder"——Reminder OS 只是这份 contract 未来的一个
 * consumer，不是这次要回答的核心问题；核心问题是"Project 的 deadline
 * 是什么"，这个答案将来同样要服务 Calendar OS/Execution OS/其它
 * Domain OS，不能只从 Reminder 的需要反推 schema。
 *
 * 2026-07-13 — 新增「七、Review #3」：Due Time Support
 * 的 Pre-Implementation Design Review（Feature/Change Review，跟
 * Review #1/#2 的周期性 Domain Profile 合规扫描性质不同）。对应需求方
 * 提出的 7 项 Deliverables（Architecture Review/Proposed Schema
 * Changes/API Impact/Migration Plan/Risk Analysis/Updated File Map/
 * Updated Data Flow）。产出 1 条 MEDIUM Finding（DT-2，
 * _addColumnsIfMissing_ 缺少纯文本格式步骤，修复已设计并包含在本次
 * Migration Plan 内）、3 条 Improvement Opportunity、4 项待 Carson
 * 决定的 Open Decision。**本次只完成设计与审查，未修改任何 .gs 代码
 * 文件，需 Carson 批准后才进入实现**，详见「七」全文。
 *
 * 2026-07-12 — Review #2（六）的 B2-1 经 Carson review 后，由 MEDIUM
 * Architecture Finding 改列为 Improvement Opportunity（按 UEF
 * Evidence-first 原则：现有证据只支持"可以做得更好"，不支持"当前架构
 * 已经出现需要修正的问题"）；C3-1 维持 LOW 不变。详见「六、Review #2」
 * 的 Review Disposition 小节。首次创建于 2026-07-11。
 */

// ============================================================
// 一、Review Request（按 UEF Review Templates §1）
// ============================================================

/**
 * Scope:            Productivity OS（整个项目，21 个可执行文件 + 7 份既有
 *                    治理文档）
 * Review Profile:   Domain
 *                    （判定依据：UEF 01_Review_Profiles.md §2 选择测试——
 *                    本项目"是一个完整的 Domain OS 整体"，命中第5问，选
 *                    Domain，不是 Engine——虽然本项目内部有 5 个 Engine
 *                    Profile 的纯函数模块，但那是"项目内部子模块"的归类，
 *                    不改变"项目整体"这次 Review 的 Profile）
 * Minimum checklist: Separation of Concerns（A1）/ Layering（A3）/
 *                    Governance（D1）/ Testing（C1）/ Doc-Code Drift（D3）
 *                    （UEF 01_Review_Profiles.md §3.2 Domain Profile）
 * Feeds gate:       Testing Gate（补跑——本项目已经部署到生产环境跑了
 *                    V4~V4.6，这次是"回溯性"对照检查，不是新功能走 Gate
 *                    流程，跟 UEF 06_Review_History.md 里 Investment OS
 *                    2026-07-10 那次 Review 性质相同）
 * Trigger:          UEF v1.0 ratify（2026-07-10）后，本项目作为 Universal
 *                    Domain OS Blueprint 的首个完整落地样本，补齐这次
 *                    "正式对齐新流程标准"的 Review
 * Prior review:     无（本项目此前的 5 轮审计不是 UEF Profile-based
 *                    Review，见文件头说明；这是本项目在
 *                    02_Architecture_Review_Standard/06_Review_History.md
 *                    里的第一条记录）
 * Requested by:     Carson
 * Reviewer:         Claude（single-project review——UEF 00_Review_Framework.md
 *                    §4 Roles 对这种情况的要求：不能凭"写过这段代码的印象"
 *                    判断，每一项都要对照本次实际读到的代码核实，而不是
 *                    对照既有治理文档的自我描述）
 * Date:             2026-07-11
 */

// ============================================================
// 一之二、本项目声明的加深 Checklist（UEF 01_Review_Profiles.md §4：
// "A project can require more, never less"）
// ============================================================

/**
 * 【2026-07-11 追加】Domain Profile 的最低 checklist（A1/A3/D1/C1/D3）
 * 不含 Event Flow / Extensibility / Scalability / AI Readiness——这几项
 * 对一个"只管内部数据怎么摆"的 Domain OS 不是必答题，但对本项目不是
 * 这样：本项目明确希望自己的数据未来能被 Personal AI Core 消费
 * （见 00_Roadmap.gs 长期方向），且已经有 recurring/priority 这类"会
 * 越长越复杂"的功能演进历史。因此本项目正式声明比最低要求更深的
 * 子集，往后每次 Review 都必须覆盖：
 *
 *   - A5 Event Flow（每个 Task 生命周期事件是否有清楚定义、是否优雅降级）
 *   - B1 Extensibility（新功能能否不改现有 Engine 边界就加进来）
 *   - B2 Scalability（Sheet 行数增长/GAS 执行时间上限相关的具体阈值）
 *   - C3 AI Readiness（本项目数据未来被 Personal AI Core 读取时是否
 *     需要重新设计——见 02_Review_Checklist_Library.md C3 的 Applies to
 *     说明，本次一并扩展为明确包含"未来有具名 AI 消费者的 Domain OS"
 *     这一种情况）
 *
 * 这条声明本身不需要 ADR（UEF §4："A project can require more, never
 * less"，加深不是缩窄，不算需要走 Decision Matrix 的那类决定），但作为
 * 一个会长期影响"以后每次 Review 该测什么"的事实，记录在这里，跟
 * Profile 选择放在同一份文件里，避免下次 Review 的人重新决定一遍。
 */

// ============================================================
// 二、Checklist Execution（Domain Profile 最低子集，逐项 Pass/Fail/N-A）
// ============================================================

/**
 * ── A1. Separation of Concerns ──────────────────────────────────────────
 * [Pass] 逐条核实（不是复述 00_File_Map.gs 的自我描述，是直接读代码）：
 *   - 22/23/24/25_Engine.gs 四个 Domain 层纯函数 Engine：grep 全文件搜索
 *     getSheet_/getHeaderMap_/EventBus\./SpreadsheetApp\.，零命中——确认
 *     真的不摸 Sheet/Events，不是文档说了算。
 *   - 26_AnalyticsEngine.gs：唯一命中 EventBus.getAllEvents() 的地方是
 *     replayCompletionTrend_()，且该函数文件头 Engine Contract 块明确
 *     标注"Replay Events: YES（本 OS 唯一允许重放 Events 的函数）"，
 *     不在任何 Telegram 指令路径上（06_TaskIntentParser.gs 指令列表核实
 *     确认不存在对应路由）——这是唯一例外，且例外本身有名有姓、边界清楚，
 *     符合"一个模块的职责能用一句话说清楚"的要求。
 *   - 06_TaskIntentParser.gs：grep 命中的一处 getSheet_/getHeaderMap_ 字样
 *     是文件头注释里描述"V4 之前的架构违规"这段历史，本身不是当前代码在
 *     调用——核实当前代码路径（_getActiveTasksForDisplay_ 等）确认已经
 *     全部改经 12_TaskQueryEngine.gs，没有 drift。
 *
 * ── A3. Layering ─────────────────────────────────────────────────────────
 * [Pass] 00_File_Map.gs「三、Architecture Layer Map」宣称 21 个文件each
 *   恰好归类到 Presentation/Application/Domain/Infrastructure 四层之一；
 *   对照「二、模块关系」列出的具体函数级调用关系逐条核对，没有发现箭头
 *   往上指的未记录案例。唯一一处跨层依赖
 *   （21_RecurringEngine.gs → 09_IdempotencyManager.gs，Domain→Application）
 *   在 File Map 和 Constitution 零之四都有一致、清楚的记录——但这处例外
 *   牵出一个 Governance 层面的问题，见下方 Finding D1-1（例外本身没有
 *   越界，越界的是"这个决定该有的正式记录方式"）。
 *
 * ── D1. Governance ───────────────────────────────────────────────────────
 * [Fail — 见 Finding D1-1] ADR log 存在且质量高（00_ADR.gs 五条正式 ADR，
 *   每条都有 Metadata/Context/Decision/Consequences，且 Consequences 部分
 *   老实列了代价，不是只写好处——这部分是真正的 Pass）。Project State
 *   反映真实现状（核对 V4.6 changelog 与实际代码一致，见下方 D3 checklist
 *   的交叉核实）。唯一的 Fail 点：有两处"决定不改"的架构判断符合 UEF 自己
 *   定义的 ADR 触发标准，却没有被记录成正式 ADR 条目——见 Finding D1-1。
 *
 * ── C1. Testing ──────────────────────────────────────────────────────────
 * [Fail — 见 Finding C1-1] 全项目 21 个可执行文件里，只有 07/08/09 三个
 *   文件带手工测试函数（且这三个是"逐字未改"继承自 Core 项目的 V3 遗留
 *   代码，不是本项目 V4 新增部分）。V4 新增的全部 12 个文件（10/11/12/13/
 *   15/20/21/22/23/24/25/26）——包括本项目最核心的 5 个纯函数 Domain
 *   Engine 和整条 Application 层写入/查询路径——零测试覆盖。
 *
 * ── D3. Doc/Code Drift ───────────────────────────────────────────────────
 * [Fail — 见 Finding D3-1，范围仅限 00_Roadmap.gs] 交叉核实过的其余文档
 *   （00_Project_State.gs / 00_File_Map.gs / 00_Known_Limitations.gs /
 *   00_Command_Reference.gs / 00_Project_Constitution.gs）版本号、改动
 *   描述均与实际代码一致——这几份是真正的 Pass，说明本项目治理文档整体
 *   维护得不错，Drift 不是普遍问题。唯一的例外是 00_Roadmap.gs 本身，
 *   见 Finding D3-1。
 */

// ============================================================
// 三、Findings（按 UEF Review Templates §2，每条 Fail 一条）
// ============================================================

// ------------------------------------------------------------
// Finding C1-1
// ------------------------------------------------------------

/**
 * ### Finding: V4 原生的 12 个文件（含全部 5 个 Domain 纯函数 Engine）
 *     没有任何形式的测试覆盖
 *
 * File / Module:  10_ProjectionEngine.gs, 11_ProjectionRebuilder.gs（部分——
 *                 verifyProjection()/_verifyActiveTasksConsistency_() 是
 *                 一致性校验，但 rebuild 系列函数本身无测试）,
 *                 12_TaskQueryEngine.gs, 13_ActiveTasksEngine.gs,
 *                 15_Setup.gs, 20_TaskEngine.gs, 21_RecurringEngine.gs,
 *                 22_PriorityEngine.gs, 23_SearchEngine.gs,
 *                 24_ViewEngine.gs, 25_DashboardEngine.gs,
 *                 26_AnalyticsEngine.gs
 * Function:       上述文件的全部 public API（如
 *                 PriorityEngine.computePriorityScore/computeUrgencyScore/
 *                 suggestPriority，TaskQueryEngine.getTask/getTasks/...，
 *                 TaskEngine.createTask/updateTask/completeTask/cancelTask
 *                 等）
 * Checklist item: C1 Testing
 *
 * Mechanism:
 * 只有 07_IdentityEngine.gs / 08_DeduplicationEngine.gs /
 * 09_IdempotencyManager.gs 带手工测试函数（testIdentity /
 * testDuplicateTask / testDuplicateInventory / testWebhookRetry /
 * testDifferentChatsDontBlock / testConcurrentExecution）——这三个文件
 * 都是"逐字未改"继承自 Core 项目的 V3 遗留代码（见 00_File_Map.gs
 * Foundation 分类），本项目自己在 V4 新增的 12 个文件一个测试函数都没有。
 * 15_Setup.runDiagnostics() 是目前唯一会执行到这些模块的验证路径，但它
 * 只走 happy path（try/catch 只是记日志、不断言预期值），且会在生产
 * Spreadsheet 里真实创建一条任务（标题"诊断测试任务"，notes 里标
 * DIAGNOSTIC_TEST_TEMP）——用真实数据做手工冒烟测试，不是隔离的测试用例。
 *
 * Evidence:
 * 对 21 个 .gs 文件分两轮 grep：一轮找 `function test`（未加锚点，覆盖
 * IIFE 内部缩进的函数定义），一轮找 verify/check/diagnos/validate 命名——
 * 命中只在 07/08/09（test 系列）和 11（verify 系列，但只覆盖一致性校验，
 * 不覆盖 rebuild 逻辑本身）。另外直接读取 22_PriorityEngine.gs 和
 * 26_AnalyticsEngine.gs 全文——两者都是评分/计算类纯函数（UEF Testing
 * Standard §1.7 Boundary Test 明确要求"任何做归一化/打分/除法的 Engine
 * 函数"要有边界测试），确认代码本身实现质量不差（26 的三处除法都有
 * `total > 0 ? ... : 0` 式的零除防护，22 的逾期天数有 clamp(30) 上限），
 * 但这些防护本身完全没有测试锁定——防护存在但没有回归测试，意味着未来
 * 任何一次改动都可能在无声无息中撤掉这层防护而不被发现。
 *
 * Severity:          MEDIUM
 *   Likelihood:      Foreseeable（不是"现在就在发生"的錯誤，而是"这个
 *                    项目会继续按 Roadmap 演进"这件事本身可预见会带来的
 *                    后果——5 轮外部审计期间已经在这一层修过好几个真实
 *                    bug（TaskStatistics 漂移、归档排重、getTask 全表
 *                    扫描），没有一次是靠测试先捕捉到的，全部是外部审计
 *                    人工读代码发现，说明"未来某次改动引入类似问题、且
 *                    没有测试拦截"不是假设性风险）
 *   Impact:          Medium（错误的优先级排序/视图过滤/统计数字会被静默
 *                    地算错，不会崩溃、不会丢数据，但会让用户看到错误的
 *                    结果而不自知——符合 Risk Matrix Impact:Medium 定义
 *                    "a subset of operations produce wrong or degraded
 *                    results"，够不上 High 的"硬失败/数据丢失/安全暴露"）
 *
 * Disposition:       Confirmed
 *   （本次直接读代码核实，不是照抄某份既有文档的自我描述）
 *
 * Recommendation:
 * 这是实现工作，不属于本次 Review 本身范围（UEF 00_Review_Framework.md
 * §6："A review is not a rewrite"），按优先级供下一次专门的测试补齐会话
 * 参考：
 *   1. 先做 5 个 Domain 纯函数 Engine（22-26）——UEF Testing Standard §3
 *      "standalone logic reproduction" 对纯函数最省成本：不需要 mock
 *      Sheet/Event，直接给定输入断言输出。22_PriorityEngine 优先（有
 *      具体边界：无 due_date/临界天数/逾期 clamp/recurring 折扣/最终
 *      Math.min(100) 五类边界），其次 26_AnalyticsEngine（三处已加固的
 *      零除防护，正该补一个回归测试把"防护存在"这件事锁死，而不是留着
 *      "现在没事"）。
 *   2. 再做 12_TaskQueryEngine 的 Contract Test（全项目唯一的查询入口，
 *      被依赖面最广）。
 *   3. Application 层（20_TaskEngine/13_ActiveTasksEngine/
 *      09_IdempotencyManager 的新增部分）由于涉及真实 Sheet/Event I/O，
 *      按 Testing Standard §3 需要"结构化的手工验证流程"而非
 *      standalone reproduction，成本更高，可以晚一步。
 *   4. 这份清单本身建议搬进 00_Roadmap.gs（本次 Review 已经代为补上，
 *      见该文件本次更新）。
 *
 * Gate 影响：
 * 按 UEF 00_Review_Framework.md §9，MEDIUM finding 会 block Testing Gate，
 * 除非有 ADR 明确接受延后。本次 Review 没有替 Carson 做"接受延后"这个
 * 产品判断——是选择现在开一轮测试补齐会话，还是先用 ADR 记录"已知暂缓，
 * 原因和期限"，由 Carson 决定，见本文件末尾「五、待决问题」。
 */

// ------------------------------------------------------------
// Finding D3-1
// ------------------------------------------------------------

/**
 * ### Finding: 00_Roadmap.gs 的版本头与「当前版本」章节停留在 V4.4，
 *     落后实际状态两个版本
 *
 * File / Module:  00_Roadmap.gs
 * Function:       文件头版本号声明 + 「二、Current Version」章节
 * Checklist item: D3 Doc/Code Drift
 *
 * Mechanism:
 * 00_Roadmap.gs 文件头写"Productivity OS v4.4"，「二、Current Version」
 * 章节把 V4.4（第三轮外部审计修复）描述成"本 OS 现状"，其中包括一句
 * "治理文档齐备（Constitution/State/File Map/ADR/Roadmap 五份）"。但
 * 00_Project_State.gs 的文件头写"v4.6"，且记录了 V4.5（第四轮审计：
 * Gate 等待时间/Projection 幂等/归档有界扫描/SecureConfig 缓存/
 * SYSTEM_BUSY 错误细分）和 V4.6（第五轮审计：TaskStatistics 降级为
 * 每日批量重算，ADR-2026-07-06-005）两轮完整的后续变更，Roadmap 完全
 * 没有反映这两轮。另外 00_Project_Constitution.gs 2026-07-11 的
 * changelog 记录了新增 00_Command_Reference.gs 和
 * 00_Known_Limitations.gs 两份治理文档，实际治理文档数量现在是七份，
 * Roadmap 里"五份"这个数字也过期了。Roadmap 文件头自己写的维护规则是
 * "快照，每次更新覆盖旧内容，不是日志"——这次核实到的落后正是这条
 * 自定规则本身没有被遵守，不是一个抽象的"文档可能不准"的泛泛担忧。
 *
 * Evidence:
 * 直接对照 00_Roadmap.gs 第 3 行、第 15-27 行 与 00_Project_State.gs
 * 第 3 行及其 V4.5/V4.6 完整记录，以及 00_Project_Constitution.gs 文件头
 * 2026-07-11 changelog 条目。补记两条新 ADR（见 Finding D1-1）时发现
 * 同一类 drift 的第二个实例：00_ADR.gs 文件头写"v4.5"，但文件内容本身
 * 已经收录 ADR-2026-07-06-005（V4.6 的架构决定），头部版本号没有跟着
 * 内容一起更新。第三个实例：00_File_Map.gs「三、Architecture Layer Map」
 * 开头说"00_ 开头的四份治理文档（Constitution/State/File Map/ADR）以及
 * 本次新增的 00_Roadmap.gs 不参与这个分层"——这句话写于 V4.3，此后
 * 2026-07-11 新增的 00_Known_Limitations.gs / 00_Command_Reference.gs
 * 两份治理文档没有被补进这句话。三个实例都已一并修正，不算三条独立
 * Finding，是同一个"版本头/计数类元数据容易落后于内容"模式的三次出现，
 * 说明这不是 Roadmap 一个文件的孤立问题。
 *
 * Severity:          MEDIUM
 *   Likelihood:      Routine（现在就是这个状态，不是理论风险）
 *   Impact:          Low（不影响运行中的代码；影响的是未来交接/规划——
 *                    按本项目自己的交接约定"新窗口先贴 Constitution +
 *                    ADR + Roadmap"，一个只看 Roadmap 的读者会误以为
 *                    TaskStatistics 相关工作还没做，可能重新提出已经
 *                    做过的方案）
 *
 * Disposition:       Confirmed
 *
 * Recommendation:
 * 本次 Review 已经直接修正（见本次 00_Roadmap.gs 和 00_ADR.gs 文件头
 * 更新），属于纯文档修正，不涉及重新论证任何架构决定本身（UEF
 * 00_Review_Framework.md §6：Review 不重新审判已有 ADR 的决定，只核对
 * 实现是否跟决定一致——这里核对的是"Roadmap/ADR 文件头版本号描述"是否
 * 跟 Project State 记录的实际历史一致）。
 */

// ------------------------------------------------------------
// Finding D1-1
// ------------------------------------------------------------

/**
 * ### Finding: 两处"维持现状/不改"的架构决定符合 UEF 自己定义的 ADR
 *     触发标准，但只以行内注释形式记录，没有正式 ADR 条目
 *
 * File / Module:  00_Project_Constitution.gs「零之四、Dependency Rules」
 *                 已知例外（21_RecurringEngine.gs → 09_IdempotencyManager.gs）；
 *                 05_SheetUtils.gs 文件头（裸全局函数命名冲突风险，V4.5
 *                 LOW RISK 1 / V4.6 MEDIUM RISK 3 两轮评估后维持不变）
 * Function:       N/A（这是治理文档归档位置问题，不是某个函数的行为问题）
 * Checklist item: D1 Governance
 *
 * Mechanism:
 * 两处决定本身论证质量不差——都清楚写了"考虑过的替代方案"和"为什么选
 * 现在这个"（RecurringEngine 例外：重新实现一遍幂等判重 vs 复用现有路径，
 * 选了复用；裸全局函数：包进命名空间需要动十几个函数+项目里几乎所有
 * 调用点 vs 维持现状，两轮评估后都选维持现状）。但两者都只是 Constitution
 * 或文件头里的一段叙述性注释，没有对应的 00_ADR.gs 正式条目。
 * 按 UEF 01_Architecture_Design_Standard.md §6："跨 Blueprint 层边界的
 * 新依赖是一个架构决定，要走 Decision Matrix"——RecurringEngine 例外
 * 正是跨了 Domain→Application 这条边界。按 §8 的 ADR 触发标准（"不易
 * 撤销""存在过认真考虑过的替代方案且被否决""未来的人会问为什么这样做"），
 * 两处都至少命中后两条。按 UEF Constitution §5.2，"Won't fix" 这个
 * disposition 要求"必须引用对应 ADR"——目前两处都没有 ADR 可引用。
 *
 * Evidence:
 * grep 00_ADR.gs 全文搜索"RecurringEngine"和裸全局函数相关字样（如
 * "裸全局""命名冲突"），零命中——确认这两处决定确实不在 ADR 文件里，
 * 只在 Constitution 零之四和 05_SheetUtils.gs 文件头。
 *
 * Severity:          LOW
 *   Likelihood:      Foreseeable（只有当有人专门核对"00_ADR.gs 这一份
 *                    文件"来确认决定清单时才会踩到——本次 Review 过程中
 *                    确实发生了一次：一开始 grep ADR 文件没找到，是后来
 *                    去读 Constitution/文件头才确认原来早有论证，不是
 *                    真的遗漏了推理，只是推理没放在预期的位置）
 *   Impact:          Low（推理内容本身没有缺失，只是没有归档到"预期该
 *                    找到它的地方"，不影响任何运行时行为）
 *
 * Disposition:       Confirmed
 *
 * Recommendation:
 * 补记两条正式 ADR（ADR-2026-07-11-006 / 007），明确标注"这是对已经
 * 做出且已经实现的决定做补充归档，不是重新做一次决定、也不是重新论证
 * 是否应该这样"——本次 Review 已经代为起草并加入 00_ADR.gs（见本次
 * 更新），沿用现有 5 条 ADR 一致的 Metadata/Context/Decision/
 * Consequences 结构。
 */

// ============================================================
// 四、Review Summary（按 UEF Review Templates §4，供
//     Universal Engineering Framework 项目里的
//     02_Architecture_Review_Standard/06_Review_History.md 收录用）
// ============================================================

/**
 * ### 2026-07-11 — Productivity OS — 全项目（Profile: Domain）
 * Reviewer:      Claude（single-project review，逐项对照实际代码核实）
 * Gate feeding:  Testing Gate（补跑——项目已在生产环境运行 V4~V4.6）
 * Findings:      0 HIGH, 2 MEDIUM, 1 LOW
 * Dispositions:  3 confirmed（1 项 MEDIUM——测试覆盖缺口——待 Carson 决定
 *                是开专门的测试补齐会话还是先用 ADR 记录延后；另 1 项
 *                MEDIUM + 1 项 LOW 本次 Review 已直接修正/补记，不需要
 *                额外的实现工作）
 * Notable:       两个后续可能对其它 Domain OS 也适用的观察——(1) 一个
 *                项目可以在"Layering/Separation of Concerns"上做得很干净，
 *                同时在"Testing"上几乎空白，两者是完全独立的健康度轴，
 *                不能因为架构分层做得好就默认测试也补齐了；(2)"决定维持
 *                现状"的论证如果只写在受影响文件的文件头/Constitution
 *                里而不落一条正式 ADR，会在"专门核对 ADR 清单"这个场景
 *                下显得像是遗漏——即使论证本身完全没有缺失。
 * Full record:   本文件（00_Architecture_Review.gs），Productivity OS
 *                项目自己的 Governance 层
 */

// ============================================================
// 五、待决问题（需要 Carson 决定，本次 Review 没有单方面替他决定）
// ============================================================

/**
 * 1. Finding C1-1（测试覆盖缺口，MEDIUM）：是现在就开一轮专门的测试补齐
 *    会话（按上方 Recommendation 的优先级顺序），还是先接受用一条 ADR
 *    记录"已知暂缓，原因是 XXX，暂缓到 YYY"？两种都是合理选择，取决于
 *    接下来的时间/优先级安排，不该由我单方面替 Carson 决定。
 */

// ============================================================
// 六、Review #2（2026-07-11）——项目级增强检查项
// Scope: A5 Event Flow / B1 Extensibility / B2 Scalability / C3 AI
// Readiness（一之二声明的加深子集，Domain 最低要求 A1/A3/D1/C1/D3 已在
// Review #1 覆盖，不重复跑）
// ============================================================

/**
 * ### Executive Summary
 *
 * 本次只跑「一之二」声明的四项加深 checklist，逐项直接读代码找证据，
 * 不假设、不套用经验判断。结论：Event Flow（A5）和 Extensibility（B1）
 * 两项全部通过，证据扎实；AI Readiness（C3）有一条 LOW Finding。
 * Scalability（B2）核实出 ActiveTasks 表已存在且被正确维护，但从未被
 * 查询路径实际读取——不过原始 Evidence 只能证明"这里有优化空间"，不能
 * 证明"当前架构已经出现需要修正的问题"（没有任何实测执行时间、真实
 * 生产数据规模、或接近 GAS quota 上限的证据）。按 UEF Evidence-first
 * 原则复核后（Carson review, 2026-07-12），这一条改列为 Improvement
 * Opportunity / Roadmap Item，不计入本次 Architecture Finding——详见
 * 下方「Review Disposition」及「Improvement Opportunities」小节。
 * **No HIGH Issues Found.**
 * 已有 ADR/Constitution/Governance 明确决定的设计（比如 Dashboard 不落盘
 * 的 ADR-2026-07-06、TaskStatistics 每日批量重算的 ADR-2026-07-06-005）
 * 均未重新拿出来讨论——本次唯一的 Finding（C3-1）和唯一的 Improvement
 * Opportunity（B2-1）都是此前从未被记录过的空白点，不是对已有决定的
 * 重新审判。**All findings are forward-looking improvements rather than
 * corrections to existing architectural decisions.**
 *
 * ### Findings
 *
 * HIGH: 无。**No HIGH Issues Found.**
 *
 * MEDIUM: 无。（原判定为 MEDIUM 的 B2-1，经 Carson review 后按
 * Evidence-first 原则改列为 Improvement Opportunity，不计入 Finding——
 * 原始 Evidence 未变，只是严重度归类被修正，见下方「Review
 * Disposition」及「Improvement Opportunities」小节。）
 *
 * LOW:
 *   - [C3-1] DashboardEngine.build() 返回纯文本字符串（专为 Telegram 人眼
 *     阅读排版），不是结构化数据；本项目已经明确希望这份数据未来给
 *     Personal AI Core 消费（见「一之二」新增的 C3 适用范围扩展），但
 *     Dashboard 这条路径目前的输出形态需要被重新解析文本才能结构化使用。
 *
 * ### Review Disposition — B2-1 Reclassified（Carson review, 2026-07-12）
 *
 * 原始判定（2026-07-11 草稿）：B2-1 列为 MEDIUM Architecture Finding。
 * Carson 复核后指出：草稿自己给出的 Evidence 里已经写明——当前规模通常
 * 只有几百到几千行、getValues() 在此规模下运行没有问题、也没有任何
 * 执行时间实测数据证明当前已经构成瓶颈；"ActiveTasks 已存在但未被利用"
 * 本身只能证明"存在可以做得更好的空间"，不能证明"当前架构已经出现
 * 需要修正的问题"。按 UEF Evidence-first 原则——Finding 应代表有证据
 * 支持的当前问题，没有证据支持的应进入 Roadmap 而不是提高严重度——本条
 * 改列为 Improvement Opportunity / Roadmap Item，不再计入本次
 * Architecture Finding 统计（HIGH/MEDIUM/LOW 计数相应从 0/1/1 更正为
 * 0/0/1）。C3-1 维持 LOW，不受影响。
 * Upgrade trigger：一旦出现具体证据（实测执行时间、真实生产数据规模、
 * 或确认接近 GAS quota 上限），应在下一次 Review 中重新评估是否把本条
 * 升级回正式 Finding。
 *
 * ### Improvement Opportunities（非 Finding — 有证据支持"可以做得更好"，
 * 没有证据支持"当前架构已经出现问题"）
 *
 *   - [B2-1] ActiveTasks（专门为"非终态工作台"设计、且被正确维护的表）
 *     在全部查询路径上都没有被实际读取过；9 个共享同一个全表扫描模式的
 *     查询函数里，只有 1 个（getStatistics）写了"这个数据量级还跑得动"
 *     的假设，且这条假设本身没有实测数据支撑，也没有设定"什么情况下要
 *     重新评估"的触发条件。详见上方 Review Disposition 说明。
 *
 * ### Evidence
 *
 * [B2-1]（Improvement Opportunity——以下证据支持"存在优化空间"，不支持
 * "当前架构已出现问题"，详见上方 Review Disposition）:
 *   - 00_Project_Constitution.gs 零之二：ActiveTasks 被明确定义为"工作台，
 *     只有非终态任务"，且 CQRS 写入链路显示它由 Projection 同步增量维护
 *     （10_ProjectionEngine.gs 的 projectTaskCreated_/projectTaskUpdated_/
 *     projectTaskCompleted_/projectTaskCancelled_ 四个函数都有 ActiveTasks
 *     的 upsert 或 delete 调用，逐条读代码核实过，维护逻辑本身是对的）。
 *   - 12_TaskQueryEngine.gs 文件头 Engine Contract 明确写"Reads: Tasks
 *     Sheet（唯一直接读取方...)"——不含 ActiveTasks。
 *   - 12_TaskQueryEngine.gs 第 105-109 行 _readAllTasks_()：唯一的数据入口，
 *     读的是 TASKS_SHEET 常量（= 'Tasks'），不是 ActiveTasks。
 *   - getTodayTasks/getTomorrowTasks/getWeekTasks/getMonthTasks/
 *     getUpcomingTasks/getOverdueTasks/getRecurringTasks/
 *     getCancelledTasks/getArchivedTasksInline/getPriorityTasks/
 *     searchTasks/getDashboard（12 个函数里的 12 个——即除 getStatistics
 *     外全部走视图/展示类查询的函数）全部经由 _readAllTasks_() 读全量
 *     Tasks，再交给 24_ViewEngine.gs 用 _isNonTerminal_() 在内存里过滤掉
 *     DONE/CANCELLED——用全表扫描 + 内存过滤，达成了跟直接读 ActiveTasks
 *     一样的正确结果，但付出了更高的 I/O 成本。
 *   - 13_ActiveTasksEngine.gs 文件头：归档只对 Tasks 打 archived=true 标记，
 *     "不物理删除"——确认 Tasks 表只会随时间单调增长，没有任何机制让它
 *     变小。
 *   - 12_TaskQueryEngine.gs 第 264-271 行 getStatistics() 注释：唯一一处
 *     写明了规模假设——"数据量在 GAS 场景下（个人任务系统，通常几百到
 *     几千行）现算完全够快"——这是一句断言，不是一次实测记录，且只覆盖
 *     getStatistics 这一个函数，其余 8 个共享同一扫描模式的函数没有任何
 *     等价说明。
 *   - 网络查证（2026-07 数据）：GAS 单次执行硬上限 6 分钟，批量
 *     getRange().getValues() 单次调用处理数万个 cell 量级通常在几秒内
 *     完成——这意味着即使数据量涨到远超"几百到几千行"，大概率也不会
 *     真的撞到 6 分钟上限，风险的性质是"效率随时间线性变差、违背
 *     ActiveTasks 表本来的设计目的"，不是"某天会突然崩溃"。
 *
 * [C3-1]:
 *   - 25_DashboardEngine.gs 文件头 Engine Contract，Forbidden Dependencies
 *     字段原文："返回值是纯文本字符串，不是 Telegram 消息格式，呼应
 *     ADR-2026-07-06 关于'不知道 Telegram 是什么'的正式条款"。
 *   - 00_ADR.gs ADR-2026-07-06 的实际决定范围核实过：只回答了"Dashboard
 *     该不该落盘（该不该做成 Projection）"，没有涉及"build() 的返回值
 *     该是字符串还是结构化对象"这个问题——这是两个不同的设计问题被放在
 *     同一条 Constitution 引用下，本次 Finding 只针对后一个、此前从未被
 *     讨论过的问题，不重新审判 ADR-2026-07-06 本身"不落盘"这个结论。
 *   - 25_DashboardEngine.gs 内部实现：buildTodayDashboard 等函数在拼字符
 *     串之前，实际上是先调用 24_ViewEngine.gs 拿到结构化的 task 数组
 *     （today()/tomorrow()/overdue() 等的返回值本身就是结构化的），
 *     只是最后一步把它们循环拼接成人类可读文本——结构化数据在函数内部
 *     是存在过的中间态，不是从来不存在。
 *
 * ### Recommendation
 *
 * [B2-1]（Improvement Opportunity——以下建议供未来"顺手做"参考，不是本次
 * Review 要求修正的问题）:
 *   WHY：ActiveTasks 已经被正确维护，只是没被读——补上"让高频视图查询读
 *   ActiveTasks 而不是 Tasks"这一步，不需要新建任何东西，是把已经花了
 *   成本维护的表用起来。
 *   Trade-off：getTodayTasks 这类只关心非终态任务的查询改读 ActiveTasks
 *   后，代码分叉成两类数据源（ActiveTasks 给非终态类查询，Tasks 给
 *   Recurring/Cancelled/Archived(inline)/Statistics 这类需要看终态或全量
 *   历史的查询），比现在"所有查询统一读一张表"要多一点分支复杂度——但
 *   这个分叉本身反映的是两类查询真实不同的数据需求，不是无意义的复杂化，
 *   符合"只在有真实收益时增加复杂度"这条本项目一贯坚持的原则。
 *   Expected Benefit：高频查询（today/tomorrow/priority 等大概率是日常
 *   使用里调用最频繁的指令）的 I/O 成本从"正比于全部历史任务数"降到
 *   "正比于当前工作台任务数"，且不会随使用年限增长而变差——这正是
 *   ActiveTasks 当初被设计出来的理由，现在补上让它真正生效。
 *
 * [C3-1]:
 *   WHY：结构化中间态已经在 DashboardEngine 内部存在，暴露它的成本很低
 *   （不需要重新设计，只需要让 build() 除了拼好的文本，也把背后的结构化
 *   数据一并返回或者提供一个单独的入口）。
 *   Trade-off：如果现在就做，是在没有实际调用方（Personal AI Core 目前
 *   不存在）的情况下先做一次接口设计，有"猜错未来需求形状"的风险——
 *   这也是这条只定为 LOW、且本次不建议立刻动手的原因，等真的开始接
 *   Personal AI Core 时再做，形状会更准。
 *   Expected Benefit：真正需要的时候，改动范围小（暴露既有中间态，不是
 *   重新计算一遍），且不影响 06_TaskIntentParser.gs 现在依赖的文本格式，
 *   两者可以并存。
 *
 * ### Follow-up Actions
 *
 *   1. [B2-1，Improvement Opportunity] 建议下次动 Query/View 这块代码时
 *      顺手做：把 getTodayTasks/getTomorrowTasks/getWeekTasks/
 *      getMonthTasks/getUpcomingTasks/getOverdueTasks/getPriorityTasks
 *      这几个只关心非终态任务的查询，数据源从 _readAllTasks_(Tasks) 切到
 *      读 ActiveTasks；getRecurringTasks/getCancelledTasks/
 *      getArchivedTasksInline/getStatistics/searchTasks 因为需要终态或
 *      全量历史数据，继续读 Tasks，保持不变。不是本次 Review 范围内的
 *      实现工作（UEF 00_Review_Framework.md §6），也不是需要修正的
 *      Architecture Finding，已记进 00_Roadmap.gs 的 Improvement
 *      Opportunity 条目。若未来出现具体性能证据（实测执行时间、真实
 *      生产数据规模、或接近 GAS quota 上限），下次 Review 应重新评估
 *      是否升级为正式 Finding。
 *   2. [C3-1，LOW] 暂不动代码，等 Personal AI Core 真的要接 Dashboard
 *      数据时再设计结构化返回形态——记一条 Roadmap 待办，不是现在的
 *      优先级。
 *   3. C3-1（1 项 LOW Finding）与 B2-1（1 项 Improvement Opportunity）
 *      都已经不是"讨论话题"而是有具体证据支持的记录，跟 Review #1 的
 *      三条一样，建议一并同步进 00_Roadmap.gs 的 Architecture Evolution
 *      小节（B2-1 的 Roadmap 条目措辞需同步更正为 Improvement
 *      Opportunity，不再称 Finding——本次已一并更正）。
 *
 * ### Review Summary（供 UEF 06_Review_History.md 收录）
 * Findings:      0 HIGH, 0 MEDIUM, 1 LOW（+ 1 Improvement Opportunity，
 *                不计入 Finding 统计——见上方 Review Disposition）
 * Dispositions:  1 confirmed（C3-1，未修正代码），1 reclassified（B2-1：
 *                Carson review 后由 MEDIUM Finding 改列为 Improvement
 *                Opportunity，Evidence 未变，仅严重度归类修正）。两条均
 *                未修正代码（Review 不等于 Rewrite），已记入 00_Roadmap.gs
 *                供下次实现/重新评估时参考
 */

// ============================================================
// 七、Review #3（2026-07-13）— Feature Architecture Review:
// Due Time Support（Pre-Implementation Design Review）
// ============================================================

/**
 * ### Review Request
 *
 * Scope:            due_date/due_time/due_datetime 三字段的新增支持——
 *                    Sheet Schema、Task Model、Create Task flow、Update
 *                    Task flow、既有 validation、既有 API（Library 导出
 *                    函数）、既有 Connector（Reminder OS 边界）。不含
 *                    Reminder OS 本身（提醒调度、通知发送不属于本项目
 *                    职责，见下方「一、边界确认」）。
 * Review Type:      Feature/Change Review（pre-implementation）——跟
 *                    Review #1/#2 的性质不同：那两次是"补跑"的周期性
 *                    Domain Profile 合规扫描（针对已经在生产环境跑的
 *                    代码），这次是"改动前置审查"，针对一个尚未落地的
 *                    具体增强请求。本次审查没有引用 UEF
 *                    01_Review_Profiles.md 的 Profile 选择流程——那份
 *                    文件本次会话没有被提供，不假装引用具体章节号；
 *                    本次结构改为直接对应需求方给出的 7 项 Deliverables，
 *                    但沿用 Review #1/#2 已经确立的 Finding /
 *                    Improvement Opportunity / Evidence / Disposition
 *                    这套共享词汇和 Evidence-first 判断标准（详见
 *                    02_Review_Checklist_Library.md 引言、
 *                    06_Review_History.md、08_Review_Knowledge_Base.md，
 *                    以及 Review #2 的 Review Disposition 先例）。
 * Requested by:     Carson
 * Reviewer:         Claude
 * Date:             2026-07-13
 * Prior review:     Review #1（2026-07-11）/ Review #2（2026-07-11，
 *                    2026-07-12 Disposition Amendment）——本次不重复跑
 *                    A1/A3/A5/B1/B2/C1/C3/D1/D3，只在触及到相同代码区域
 *                    时交叉引用，不重新下结论。
 * Feeds:            Design Gate（本次结果是"设计是否批准"，不是"是否可以
 *                    上线"——批准后才进入实现，实现完成后如果需要，可以
 *                    再补一次 Testing Gate 性质的 Review）。
 *
 * ── 零、边界确认（复述需求方原文，作为本次审查的硬约束）──────────────────
 *   Productivity OS 拥有：title / project / priority / due_date /
 *   due_time / due_datetime / status。
 *   Productivity OS 不得：计算 reminder time、调度通知、发送 Telegram
 *   提醒、管理 reminder 规则——这些属于 Reminder OS。
 *   本次设计全程遵守这条边界：新增的三个字段止于"任务自己知道自己什么
 *   时候到期"，不涉及"谁在什么时候该被提醒"。
 */

// ------------------------------------------------------------
// 一、现有架构审查（Deliverable 1：Architecture Review）
// ------------------------------------------------------------

/**
 * ### 核心结论（先说答案，再展开证据）
 *
 * 需求方要求"判断现有架构是否已经支持 time 字段"——答案是：**部分支持，
 * 但从未被当作正式字段暴露**。这不是一次"从零设计"，而是一次"把已经
 * 存在、但只活在字符串格式里的能力，提升为显式 Schema 字段"。这个判断
 * 直接决定了下面「二、Proposed Schema Changes」为什么可以做得比表面看
 * 起来更小——具体证据如下。
 *
 * ### 1.1 Sheet Schema（15_Setup.gs，Schema Authority，
 *     00_ADR.gs ADR-2026-07-06-002）
 *
 * Tasks / ActiveTasks / ArchiveTasks 三张表当前表头（setupSheets() 与
 * repairSheetHeaders() 两处字面量数组逐字核对，二者一致）只有单一
 * `due_date` 列，不存在 `due_time` / `due_datetime`。TaskFilters（搜索
 * 扁平投影）/ TaskStatistics（聚合计数器）两张表不含任何到期日相关列，
 * 本次设计维持这个现状（理由见 2.4）。
 *
 * ### 1.2 Task Model / Create Task flow / Update Task flow —— 关键发现
 *
 * 09_TemporalParser.extractDateTime()（06_TaskIntentParser.gs 在
 * TASK_CREATE 分支唯一调用的日期解析函数）**已经在解析时间**：
 *   - `_extractTime_()` / `_buildTimeInfo_()` 已经能从"早上/上午/中午/
 *     下午/晚上/凌晨 + X点X分 或 X:XX"这类中文表达里，正确抽出 hour/
 *     minute（含"下午/晚上"自动 +12、"中午 1 点"按 13:00 算这些细节）。
 *   - `extractDateTime()` 第 149-176 行：如果 `timeInfo` 存在，把
 *     算好的时间通过 `base.setHours(...)` 合并进日期，最终用
 *     `Utilities.formatDate(base, tz, "yyyy-MM-dd'T'HH:mm:ss")` 格式化，
 *     **返回一个已经带时间的 ISO 字符串，塞进唯一的 due_date 字段**；
 *     没有时间时，才返回纯日期字符串 `'yyyy-MM-dd'`。
 *   - 05_SheetUtils.parseDueDate_()（isOverdue_ / 22_PriorityEngine /
 *     23_SearchEngine / 24_ViewEngine 全部共用的唯一日期解析函数）本身
 *     已经能正确区分两种格式：纯日期字符串走"手动按本地时区午夜"分支
 *     （避免 UTC 偏移 bug，见该函数注释），其余（带时间）字符串直接交给
 *     `new Date(raw)`，按 ES2015+ 规范，带 T 无 offset 的日期时间字符串
 *     本身就按本地时区解析——**两种格式都已经被正确处理，不是本次新增
 *     的能力**。
 *   - 09_TemporalParser.computeNextDueDateFromLabel()（21_RecurringEngine.
 *     spawnNextIfNeeded 用来算 recurring 任务下一次到期日的函数）第
 *     421 行：`var hasTime = /T\d{2}:\d{2}:\d{2}/.test(prevDueDateStr);`
 *     ——**已经会侦测输入是否带时间，并在输出时保留同样的格式**（纯日期
 *     → 纯日期，带时间 → 带时间）。也就是说：如果一个 recurring 任务
 *     当前恰好带着时间（比如"每天早上8点"），它的下一次实例**已经会
 *     正确延续这个时间**，不会被重置成 00:00。
 *
 * 结论：日期时间的抽取、解析、跨 recurring 实例的延续，三个环节的底层
 * 计算逻辑**全部已经正确工作**，且不需要为本次改动而修改
 * computeNextDueDateFromLabel() 或 parseDueDate_() 内部任何一行。缺的
 * 只是"这个能力有没有一个正式、显式、可独立查询的字段"——目前它只是
 * 藏在 due_date 字符串的格式差异里（有没有 `T`），没有任何字段告诉
 * 调用方"这个任务是不是真的有一个具体时间点"。
 *
 * ### 1.3 现有 Validation
 *
 * 20_TaskEngine.updateTask() 对 `category`/`priority`/`recurring` 三个
 * 字段做白名单校验（不在 ProductivityConfig 枚举里的值会被静默丢弃，见
 * 该函数 changes.forEach 循环），但对 `due_date` **没有任何格式校验**
 * ——这是现有代码的既有状态，不是本次改动引入的缺口（Telegram 正常路径
 * 下 due_date 永远来自 extractDateTime()，天然格式正确；但 updateTask
 * 本身作为 00_Known_Limitations.gs 记录的 Internal API，理论上可以被
 * 未来的 AI Agent/批量脚本直接传入任意字符串）。本次不新增这类校验
 * ——沿用现有"信任上游解析器，不在 Engine 层重复校验格式"的一贯模式，
 * 但作为 Improvement Opportunity 记录（见「五、Risk Analysis」IO-2），
 * 不因为本次顺便新增两个字段就单方面提高这一处的校验标准。
 *
 * ### 1.4 现有 API（Library 导出函数）与 Connector
 *
 * 00_Project_Constitution.gs P4 第4层 Integration 明确记录本项目当前
 * Bridge/Connectors/APIs/Import-Export/External Systems **全部"暂无"**
 * ——本项目对外只有 Apps Script Library 导出函数（createTask/updateTask/
 * completeTask/cancelTask/getPendingTasks，经 TaskEngine 命名空间或
 * 向后兼容裸全局 wrapper），没有独立 REST API，也没有任何面向 Reminder
 * OS 的现成读取通道。00_Roadmap.gs「四、Future」的 Domain OS Bridge
 * 条目目前只有 Property OS 的假设性例子，没有 Reminder OS 的具体计划。
 * 这一点直接关系到需求方"Reminder OS will consume this information
 * later"这句话——**目前不存在任何机制能让 Reminder OS 消费任何
 * Productivity OS 数据，遑论 due_datetime**。这不是本次要解决的问题
 * （需求方明确排除"计算 reminder time / 调度通知"），但本次设计会
 * 确保 due_datetime 以显式字段（而不是需要正则猜测的字符串）存在，
 * 让未来真正建那条 Bridge 时不需要重新解决"怎么知道这个任务有没有
 * 具体时间"这个问题——这是本次设计的一个自然副产品，不是范围扩大。
 */

// ------------------------------------------------------------
// 二、Proposed Schema Changes（Deliverable 2）
// ------------------------------------------------------------

/**
 * ### 2.1 新增列
 *
 *   Tasks / ActiveTasks / ArchiveTasks 三张表（不含 TaskFilters /
 *   TaskStatistics，理由见 2.4）各新增两列：
 *     due_time      — 'HH:mm'（24小时制，两位数字，如 '10:00'）或 ''
 *     due_datetime  — 'yyyy-MM-ddTHH:mm:ss' 或 ''
 *
 * ### 2.2 三字段的关系（关键设计决策，需 Carson 确认）
 *
 *   due_date      —— 永远是纯日期 'yyyy-MM-dd' 或 ''。语义不变。
 *   due_time      —— 有具体时间点时是 'HH:mm'；**没有时间时是 ''
 *                     （需求方原文的 null，本项目惯例里空字符串等同于
 *                     该字段的"无值"状态，跟其余字段如 context/notes
 *                     的空值约定一致，不单独发明"null"这个字面量）**。
 *   due_datetime  —— **派生字段，不接受外部直接写入**：
 *                     `due_date && due_time` 都有值时 =
 *                     `due_date + 'T' + due_time + ':00'`；
 *                     只要 due_time 为空，due_datetime **也是空
 *                     字符串，不回退成"该日期的 00:00:00"**。
 *
 *   【需要 Carson 明确确认的点】：due_datetime 在"只有日期没有时间"时
 *   到底该是空，还是该默认成当天 00:00:00？本次设计选择"空"，理由：
 *   如果默认成 00:00:00，会让"用户真的说了'凌晨0点'"和"用户根本没说
 *   时间"这两种情况在 due_datetime 这个字段上变得无法区分——而这正是
 *   1.2 节发现的现有系统里已经存在的同一个歧义（due_date 字符串本身
 *   在带时间和不带时间两种情况下的形状差异，虽然可以通过正则区分，
 *   但从未被提升成一个明确字段）。选择"空"能让这个歧义被彻底解决，
 *   而不是从"字符串格式里隐含的歧义"平移成"数值默认值带来的同一个
 *   歧义"。但这确实是一个产品语义决定，不是纯技术判断，本次按此
 *   实现，等 Carson 审阅本文件时确认或改判。
 *
 * ### 2.3 Identity 计算 —— 保持函数签名不变，只改调用方传入的值
 *
 *   07_IdentityEngine.generateTaskIdentity(chatId, title, dueDate,
 *   repeatRule, priority, category) 当前对 dueDate 参数所在位置只接受
 *   一个字符串。00_Command_Reference.gs C4 已经把"标题相同、due_date
 *   不同 → 不同 identity"写成正式生效的行为规则——而 1.2 节已经证明，
 *   现有系统里"due_date 不同"其实已经包含"时间不同"的情况（因为时间
 *   本来就折叠在这个字符串里）。也就是说，**"改时间会产生不同的
 *   identity"是现有系统已经在做的事，不是本次新引入的行为**。
 *
 *   为了不改变这个已经生效的行为、也不改 generateTaskIdentity() 的
 *   函数签名（避免牵动 07_IdentityEngine.gs 本身及其单元测试），本次
 *   建议：**所有调用方在这个参数位置传入"due_datetime 有值则用
 *   due_datetime，否则用 due_date"这个合并值**，而不是裸传 due_date。
 *   对于本次迁移前就存在的历史行（due_time 恒为空，due_datetime 恒
 *   等于 due_date），这个合并值跟原来直接传 due_date 完全相同——
 *   **意味着全部存量任务的 identity 哈希在迁移前后逐字节不变，这是
 *   一条可以在实现阶段直接写单元测试验证的具体不变量，不是一句无法
 *   验证的"应该没问题"**。
 *
 *   为了避免这个"取 due_datetime 或回退 due_date"的合并逻辑被在 4 个
 *   调用点（见「三、API Impact」）各自重复一遍字面量表达式——那正是
 *   08_Review_Knowledge_Base.md KB-2（Duplicated fallback constants）
 *   描述的形状——建议在 07_IdentityEngine.gs 内新增一个与
 *   generateTaskIdentity 同层、职责相邻的小型纯函数：
 *
 *     function resolveIdentityDueValue(task) {
 *       return (task.due_datetime || task.due_date || '');
 *     }
 *
 *   四个调用点统一改成先调用这个函数，再把结果传给
 *   generateTaskIdentity 的 dueDate 参数位。这个函数本身零依赖、
 *   零副作用，符合 07_IdentityEngine.gs 文件头"Pure Function: YES /
 *   Forbidden Dependencies: Sheet, Events, Telegram/Output，任何其他
 *   Engine"的既有 Engine Contract，不需要修改该文件头的 Contract
 *   声明本身（只是新增一个同样满足这份 Contract 的函数）。
 *
 * ### 2.4 为什么 TaskFilters / TaskStatistics 不新增列
 *
 *   TaskFilters 只存 searchable_text（全文拼接字符串）和 tags_csv，
 *   不是按字段单独查询的表——23_SearchEngine 的 dateFrom/dateTo 范围
 *   过滤直接操作 due_date 字段本身（走 TaskQueryEngine.getTasks() 返回
 *   的 task[]，不经过 TaskFilters），不需要 due_time 参与拼字符串。
 *   TaskStatistics 是纯计数器（total_count/pending_count/...），跟
 *   任何单个任务的到期时间无关。两张表维持现状，符合"只在有真实收益
 *   时增加复杂度"的既有原则（00_Project_Constitution.gs Architecture
 *   Principles 关联表述），不是遗漏。
 */

// ------------------------------------------------------------
// 三、API Impact（Deliverable 3）
// ------------------------------------------------------------

/**
 * ### 3.1 需要改动的文件（8 个，全部是新增/扩展，无破坏性变更）
 *
 *   1. 09_TemporalParser.gs
 *      extractDateTime() 返回对象新增 due_time / due_datetime 两个键，
 *      due_date 键保留、语义不变（且从此永远是纯日期——当前偶尔带时间
 *      的行为到此为止，时间改由 due_time/due_datetime 承载）。
 *      computeNextDueDateFromLabel() **不改一行**（1.2 节已证明其
 *      现有逻辑对本次需求完全够用）。
 *
 *   2. 06_TaskIntentParser.gs
 *      TASK_CREATE 分支：`{ due_date: parsed.due_date, recurring:
 *      recurringLabel }` 扩展为同时传 due_time / due_datetime（沿用
 *      00_Known_Limitations.gs"自然语言解析范围止于 due_date/recurring"
 *      这条边界——这里新增的是同一类"时间解析"能力的自然延伸，不是
 *      新增 category/priority 这类语义推断，不违反该 Known
 *      Limitation，建议在该文件"一、Natural Language Parser Scope"
 *      小节补一句说明，见「六」）。展示文案（4 处 `'到期: ' +
 *      task.due_date` 及同类拼接）视是否有 due_time 决定要不要多显示
 *      时间，具体文案本次不预先定稿，留待实现阶段跟 Carson 确认展示
 *      格式（例如"到期: 2026-07-30 10:00"还是"到期: 2026-07-30
 *      （10:00）"）。
 *
 *   3. 07_IdentityEngine.gs
 *      新增 resolveIdentityDueValue()（见 2.3）。generateTaskIdentity()
 *      本身签名和内部逻辑不变。
 *
 *   4. 09_IdempotencyManager.gs
 *      createTaskIfNotExists() 生成 identity 时，第三个参数从
 *      `meta.due_date || ''` 改为 `resolveIdentityDueValue(meta)`。
 *      JSDoc 里的 meta 形状说明同步补上 due_time/due_datetime。
 *
 *   5. 20_TaskEngine.gs（改动点最多，逐条列出）
 *      - createTaskDirect_() 的 task 对象字面量新增
 *        `due_time: meta.due_time || ''` 和
 *        `due_datetime: (meta.due_date && meta.due_time) ?
 *        (meta.due_date + 'T' + meta.due_time + ':00') : ''`。
 *      - `ProductivityConfig.IDENTITY_AFFECTING_FIELDS` 新增
 *        'due_time'（due_date 已在列表里；due_datetime 是派生值，不
 *        需要、也不应该出现在这个"外部传入触发重算"的清单里，见下条）。
 *      - `UPDATABLE_FIELDS` 新增 'due_time'（**不**新增
 *        'due_datetime'——2.2 节已定义它是派生字段，updateTask 不接受
 *        外部直接覆写它，防止调用方传入一个跟 due_date/due_time 自相
 *        矛盾的 due_datetime）。
 *      - updateTask() 内部：当 due_date 或 due_time 任一被改动时，
 *        重新计算 merged.due_datetime（复用 2.2 的合并公式），一并
 *        写进 payload，保证 due_datetime 永远是另外两个字段的正确
 *        派生结果，不会出现三个字段互相矛盾的存储状态。
 *      - identity 重算调用点改用 `resolveIdentityDueValue(merged)`。
 *
 *   6. 21_RecurringEngine.gs
 *      spawnNextIfNeeded()：`computeNextDueDate(task.due_date, ...)`
 *      改为先取 `var prevValue = resolveIdentityDueValue(task);` 再
 *      `computeNextDueDate(prevValue, task.recurring)`；拿到
 *      `nextDueValue` 后，按其中是否含 `T` 拆回 next due_date /
 *      next due_time 两个值，一并放进传给
 *      IdempotencyManager.createTaskIfNotExists 的 meta 对象（当前
 *      这里只传 due_date，需要补 due_time）。
 *
 *   7. 11_ProjectionRebuilder.gs
 *      新增 migrateSchemaDueTime()（见「四、Migration Plan」）；
 *      rebuildTasksProjection() / rebuildActiveTasksProjection() 两处
 *      identity 重算调用改用 resolveIdentityDueValue(task)。
 *
 *   8. 15_Setup.gs
 *      setupSheets() 与 repairSheetHeaders() 两处字面量数组（各 3 张表，
 *      共 6 处）追加 'due_time', 'due_datetime'（**新装机**路径；已有
 *      部署走第 7 项的迁移函数）。
 *
 * ### 3.2 确认零改动的文件（9 个，逐一给出证据，不是"大概不用改"）
 *
 *   - 02_EventBus.gs：publish() 对 payload 不做任何字段级校验，整个
 *     对象 `JSON.stringify` 后原样存进 Events 表（第 155 行函数体逐行
 *     核对过）——新字段自动跟着走，不需要改。
 *   - 10_ProjectionEngine.gs：projectTaskCreated_() /
 *     projectTaskUpdated_() 都是把 `event.payload` 整个对象（或
 *     shallowCopy 后减去 task_id）原样传给 upsertRowByKey_()，不是
 *     逐字段搬运（第 169-231 行核对过）——新字段自动按表头名字写进
 *     对应列，不需要改。
 *   - 05_SheetUtils.gs：parseDueDate_() / isOverdue_() 已经正确处理
 *     两种字符串格式，upsertRowByKey_() 按表头名字通用赋值——都不需要
 *     感知"这是 due_time 还是别的什么字段"。
 *   - 12_TaskQueryEngine.gs：getTask() 第 129-165 行 `for (var h in
 *     headerMap) task[h] = rowValues[headerMap[h]]`——通用按表头读取，
 *     没有任何字段白名单；`_readAllTasks_`/`getTasks` 同理。新列自动
 *     出现在返回的 task 对象里。
 *   - 22_PriorityEngine.gs / 23_SearchEngine.gs / 24_ViewEngine.gs /
 *     25_DashboardEngine.gs / 26_AnalyticsEngine.gs：五个纯函数
 *     Engine 目前全部按"日期粒度"工作（00_Command_Reference.gs V1
 *     原文："只比较日期部分，不管 due_date 里带没带具体时间"——这是
 *     已经生效、已经文档化的行为，不是本次发现的疏漏）。本次不修改
 *     这五个文件的任何逻辑——它们会继续正确工作（多出来的 due_time/
 *     due_datetime 字段对它们不可见，也不需要可见），"让这五个 Engine
 *     开始感知 due_time"是一次独立的、后续的功能决策，见「七」
 *     Improvement Opportunity IO-1。
 *
 * ### 3.3 对外契约
 *
 *   createTask(title, meta, chatId) / updateTask(taskId, changes,
 *   chatId) 两个 Library 导出函数签名不变，`meta`/`changes` 对象新增
 *   一个可选键 `due_time`——现有调用方（Personal AI Core 04_Main.gs 等）
 *   不传这个键完全不受影响，符合 02_Review_Checklist_Library.md A4
 *   "契约变更应该是新增可选字段"的标准。本项目没有独立 REST API，没有
 *   Connector，因此没有需要单独走版本协商的外部契约。
 */

// ------------------------------------------------------------
// 四、Migration Plan（Deliverable 4）
// ------------------------------------------------------------

/**
 * ### 4.1 新装机路径
 *   setupSheets() 已经建好带 due_time/due_datetime 的表头（见 3.1 第
 *   8 项），无需额外步骤。
 *
 * ### 4.2 既有部署路径（Carson 现在这个场景）
 *
 *   在 11_ProjectionRebuilder.gs 新增一个函数，命名和结构直接照抄
 *   已有的 migrateSchemaV4() 先例（同一个文件、同一种"一次性、幂等、
 *   只加列不改数据"的迁移模式，不发明新机制）：
 *
 *     function migrateSchemaDueTime() {
 *       Logger.log('=== migrateSchemaDueTime ===');
 *       _addColumnsIfMissing_('Tasks',        ['due_time', 'due_datetime']);
 *       _addColumnsIfMissing_('ActiveTasks',  ['due_time', 'due_datetime']);
 *       _addColumnsIfMissing_('ArchiveTasks', ['due_time', 'due_datetime']);
 *       _setPlainTextFormatForNewColumns_('Tasks',        ['due_time', 'due_datetime']);
 *       _setPlainTextFormatForNewColumns_('ActiveTasks',  ['due_time', 'due_datetime']);
 *       _setPlainTextFormatForNewColumns_('ArchiveTasks', ['due_time', 'due_datetime']);
 *       Logger.log('✅ due_time/due_datetime 列迁移完成（含纯文本格式修复，见 Finding DT-2）。');
 *     }
 *
 *   其中 `_setPlainTextFormatForNewColumns_` 是本次新增的一个小型
 *   共用辅助函数（原因见「五」Finding DT-2）——定位每一列的位置，对
 *   整列数据区调用 `setNumberFormat('@')`，逻辑上是把
 *   15_Setup._ensureSheet_() 里"新建表时对整个数据区设纯文本格式"这
 *   一步，补给"给既有表追加列"这条路径，两条路径此后行为一致。实现
 *   草案（放在 11_ProjectionRebuilder.gs，跟 `_addColumnsIfMissing_`
 *   同层、供其配套调用）：
 *
 *     function _setPlainTextFormatForNewColumns_(sheetName, columnNames) {
 *       var sheet = getSheet_(sheetName); // 05_SheetUtils.gs
 *       var headerMap = getHeaderMap_(sheet);
 *       var lastRow = sheet.getLastRow();
 *       if (lastRow < 2) return; // 只有表头，没有数据行，不需要设格式
 *       columnNames.forEach(function (col) {
 *         if (!(col in headerMap)) return; // 列不存在（理论上不会，防御性检查）
 *         var colIndex = headerMap[col] + 1; // 转 1-based
 *         sheet.getRange(2, colIndex, lastRow - 1, 1).setNumberFormat('@');
 *       });
 *     }
 *
 *   （只处理"迁移时已存在的行"；迁移之后新建的行走 createTaskDirect_ →
 *   upsertRowByKey_ 正常写入路径，不经过这个函数，不需要它管。）
 *
 * ### 4.3 是否需要回填存量数据
 *
 *   **不需要，也不建议**：现有 Tasks 行的 due_time 迁移后为 ''，
 *   due_datetime 为 ''——这正是需求方"如果只有 due_date，due_time 视
 *   为 null"这条要求本身，不是缺陷。
 *
 *   【需要 Carson 决定的独立问题，不影响本次迁移是否可以先做】：1.2 节
 *   发现，存量数据里可能已经存在"due_date 字符串本身带 T 时间后缀"的
 *   历史行（任何过去用自然语言创建、且说了具体时间的任务）。这些行
 *   迁移后 due_time/due_datetime 仍然是空——**不是错误**（due_date
 *   本身没有丢任何信息，字符串还在），但如果 Carson 希望这些历史行也
 *   能被当作"有 due_time"来查询/展示，需要另外写一个一次性回填脚本
 *   （扫描 Tasks 全表，凡是 due_date 匹配 `T\d{2}:\d{2}:\d{2}` 的行，
 *   拆成新的三字段并覆写）。这不属于"backward compatible 的最小增强"
 *   本身，是一个范围更大、需要单独评估的数据清理决定，本次只提出来
 *   供选择，不预设答案，也不阻塞前面的 Schema 迁移先执行。
 *
 * ### 4.4 执行顺序
 *   Carson 批准设计 → 实现 8 个文件的代码改动 → 运行一次
 *   migrateSchemaDueTime() → 用 15_Setup.runDiagnostics() 里现成的
 *   createTask/updateTask 冒烟测试路径验证新字段能正确写入/读出 → 视
 *   4.3 的决定，选择是否另外跑历史数据回填。全程不需要
 *   rebuildAllProjections()（存量 Events 里没有 due_time 字段，重放
 *   出来的 due_time 天然是空，跟增量路径的迁移结果一致，不会产生
 *   Read Model 与 Events 对不上的问题）。
 */

// ------------------------------------------------------------
// 五、Risk Analysis（Deliverable 5）
// ------------------------------------------------------------

/**
 * ### Findings（本次唯一的正式 Finding）
 *
 * ------------------------------------------------------------
 * Finding DT-2
 * ------------------------------------------------------------
 * Severity:     MEDIUM
 * Category:     对应 Checklist Library C2（Migration）/ B3（Reusability，
 *               "在别处发现相同复制品也要一并处理"这条精神）
 * Statement:    11_ProjectionRebuilder._addColumnsIfMissing_()（既有函数，
 *               本次迁移计划直接复用）只对新增列调用
 *               `sheet.getRange(1, lastCol).setValue(col)`
 *               写表头文字，不对该列的数据区调用
 *               `setNumberFormat('@')`——而 15_Setup._ensureSheet_()
 *               对**全新建表**的数据区是明确调用了 `setNumberFormat('@')`
 *               的（15_Setup.gs 第 113 行）。Google Sheets 对形如
 *               'HH:mm'（如 '10:00'）的单元格内容有文档化的自动类型
 *               识别行为，会在没有显式纯文本格式的列里把它识别成 Time
 *               类型并转换存储形式，而不是保留字面字符串——这会让本项目
 *               所有依赖"due_time 是字符串"的代码（正则匹配、
 *               resolveIdentityDueValue 的字符串拼接等）静默拿到错误
 *               的值，不会抛出任何异常。
 * Evidence:     11_ProjectionRebuilder.gs `_addColumnsIfMissing_()`
 *               函数体（第 75-96 行）逐行核对，函数末尾没有任何
 *               setNumberFormat 调用；对照 15_Setup.gs `_ensureSheet_()`
 *               第 110-114 行确认新建表路径确实做了这一步——两条路径
 *               行为不一致，是可以直接读代码核实的事实，不是推测。
 *               此前 V4 用同一个 `_addColumnsIfMissing_()` 加过
 *               description/tags 两列，没有出现过这个问题——因为自由
 *               文本内容不会被 Sheets 误判成特殊类型，这个既有 gap
 *               此前没有可观测后果，不代表它不存在（这是为什么这条
 *               现在才第一次被发现：due_time 是第一个"值的形状恰好会
 *               触发 Sheets 自动类型识别"的、经由这条迁移路径新增的列）。
 * Why not lower (Improvement Opportunity)：这不是"可以做得更好"，而是
 *               本次迁移如果照抄现有 `_addColumnsIfMissing_()` 原样
 *               使用、不额外处理，**会在第一次有人写入非空 due_time
 *               时就触发**，触发条件不需要等待任何未来证据出现——
 *               跟 Review #2 的 B2-1（需要未来证据才能升级）性质不同，
 *               这条现在就有完整的因果链证据，直接满足 Evidence-first
 *               对 Finding 的要求。
 * Disposition:  Confirmed — Remediation designed within this proposal
 *               （见「四、4.2」的 `_setPlainTextFormatForNewColumns_`）。
 *               这是一个 Review #1/#2 的 Disposition 词表里还没有的
 *               取值——"确认属实，且修复方案已经设计好、随本次改动一并
 *               交付"，跟"confirmed 但推到 Roadmap 以后再修"、
 *               "reclassified"都不一样。建议在下次讨论 UEF Review
 *               Report Standard 时把这个 Disposition 取值正式收进
 *               词表（比如叫 Remediated-in-Proposal），因为
 *               Pre-Implementation Design Review 这种审查类型天然会
 *               产生这一类 Disposition，跟事后审计的场景不同。
 *
 * ### Improvement Opportunities（非本次必须解决，供参考/后续追踪）
 *
 *   - [IO-1] 22/23/24/25/26 五个纯函数 Engine 目前对到期日的判断全部
 *     停在"日期粒度"（见 3.2 说明）。due_time 存在之后，理论上
 *     Urgency Score（22_PriorityEngine.computeUrgencyScore）可以把
 *     "今天但已经过了这个时间点"和"今天但时间还没到"区分对待，
 *     ViewEngine.today() 也可以在同一天内按时间排序。本次不做——需求
 *     方本次的目标明确是"新增字段"，不是"重新设计打分/排序逻辑"，
 *     且这类改动会实质改变现有 Urgency Score 的输出数值，影响面超出
 *     "backward compatible 的最小增强"，应该作为独立的功能决策，
 *     单独评审。已建议同步进 00_Roadmap.gs「三、Next Version」。
 *
 *   - [IO-2] 20_TaskEngine.updateTask() 对 due_date（以及本次新增的
 *     due_time）不做任何格式校验（见 1.3）。这是本次改动之前就存在的
 *     既有状态，不因为新增两个字段而被认为"应该顺带修"——按
 *     Evidence-first 原则，没有证据表明这在当前唯一的调用路径
 *     （Internal API，尚无 Telegram 指令、尚无外部脚本在用）下已经
 *     造成过问题，升级为本次 Finding 理由不足。记录为独立
 *     Improvement Opportunity，供以后 updateTask() 真正对外开放
 *     （00_Known_Limitations.gs 记录的"未来可能场景"）时一并设计校验。
 *
 *   - [IO-3] `_addColumnsIfMissing_()` 本身（不只是本次两个新列）
 *     缺少 DT-2 描述的纯文本格式步骤，是一个通用工具函数级别的缺口，
 *     不只影响 due_time。本次的修复（4.2 的
 *     `_setPlainTextFormatForNewColumns_`）只覆盖本次新增的列；要不要
 *     把纯文本格式步骤直接并入 `_addColumnsIfMissing_()` 本身（让
 *     所有未来调用者自动获得这个保护，不需要每次都记得额外调用一次），
 *     是一个更大范围的重构决定，超出本次"最小增强"范围，记录供未来
 *     参考。
 *
 * ### 其余风险点（不构成 Finding 或 Improvement Opportunity，是需要
 *     Carson 知情/确认的设计影响）
 *
 *   - 09_TemporalParser.gs 是从 Personal AI Core 项目"分叉"维护的
 *     共用文件（00_ADR.gs ADR-2026-07-11-007 明确记录了这个历史，
 *     且该 ADR 的决定范围只限于"要不要包命名空间"，跟本次改动
 *     extractDateTime() 返回值形状是两个不同问题，不冲突）。本次
 *     改动只影响 Productivity OS 自己这一份拷贝，Core 项目的
 *     09_TemporalParser.gs（含 22_InventoryIntentParser.gs 消费的
 *     那一份）不受影响，也不会自动获得 due_time 能力——这是"多项目
 *     分叉共用文件"这个既有架构特征的自然结果，不是本次引入的新
 *     风险，但值得记录，避免以后有人以为"改一份就等于全都改了"。
 *
 *   - 00_ADR.gs ADR-2026-07-06-002（Schema Authority）明确写了触发
 *     拆分 04_Schema.gs 的三个条件之一是"单张表的字段数量频繁变化
 *     （半年内变化 3 次以上）"。本次是继 V4 新增 description/tags
 *     之后，Tasks/ActiveTasks/ArchiveTasks 表头的又一次变更——具体
 *     这是不是"半年内第 3 次"需要对照 00_Project_State.gs 完整
 *     changelog 才能确认次数，本次审查没有做这个计数（不确定的事
 *     不断言），建议 Carson 顺手核对一下，如果确实达到触发条件，
 *     这次改动之后可能就是"该考虑拆 04_Schema.gs"的时间点，而不是
 *     现在就因为"感觉应该拆"而提前拆分。
 */

// ------------------------------------------------------------
// 六、Updated File Map（Deliverable 6，proposed —— 本节是提议内容，
// 尚未写入 00_File_Map.gs 本体，待设计批准、实现完成后再正式同步）
// ------------------------------------------------------------

/**
 * 「一、文件详情」需要更新变更说明的文件（8 个，对应「三、3.1」）：
 *   09_TemporalParser.gs / 06_TaskIntentParser.gs / 07_IdentityEngine.gs /
 *   09_IdempotencyManager.gs / 20_TaskEngine.gs / 21_RecurringEngine.gs /
 *   11_ProjectionRebuilder.gs / 15_Setup.gs——每处按既有格式追加一句
 *   "【Due Time 支持新增】..."的变更说明，不改写这些文件现有的历史
 *   变更记录（沿用"只追加、不覆写历史"的既有惯例，本文件自己也是这样
 *   记录 V4.2/V4.3/.../V4.6 历次变更的）。
 *
 * 「二、模块关系」需要新增的依赖边：
 *   09_IdempotencyManager.gs / 20_TaskEngine.gs / 11_ProjectionRebuilder.gs /
 *   21_RecurringEngine.gs 四者新增对 07_IdentityEngine.resolveIdentityDueValue
 *   的调用——这四条边本身不是新的跨层依赖（这四个文件本来就已经依赖
 *   07_IdentityEngine.generateTaskIdentity，只是多调用同一个文件里的
 *   另一个函数），不影响「三、Architecture Layer Map」的分层结论，
 *   不需要变更任何文件的 Layer 归类。
 *
 * 「三、Architecture Layer Map」：无变更。21 个文件的分层结论不受
 *   本次改动影响（本次没有新增文件，也没有改变任何文件的层间调用
 *   方向）。
 */

// ------------------------------------------------------------
// 七、Updated Data Flow（Deliverable 7，proposed）
// ------------------------------------------------------------

/**
 * ### Create 路径（对照 00_Project_Constitution.gs 零之二·流程B，标注
 *     本次改动落在哪一步）
 *
 *   Request（06_TaskIntentParser.parseTaskIntent，接收原始文字）
 *     ↓
 *   Planner（同文件内 + 09_TemporalParser.extractDateTime —— 【改动】
 *     返回值新增 due_time/due_datetime，due_date 保持纯日期）
 *     ↓
 *   （【改动】06_TaskIntentParser 把三个字段一并放进 meta 对象，原来
 *     只放 due_date）
 *     ↓
 *   Execution 前置（09_IdempotencyManager.createTaskIfNotExists —— 
 *     【改动】用 resolveIdentityDueValue(meta) 取代 meta.due_date 传给
 *     IdentityEngine）
 *     ↓
 *   Execution（20_TaskEngine.createTaskDirect_ —— 【改动】task 对象
 *     字面量新增 due_time / due_datetime 两个字段）
 *     ↓
 *   Event（02_EventBus.publish —— 不改，整个 task 对象原样进 Events）
 *     ↓
 *   Projection（10_ProjectionEngine.projectTaskCreated_ —— 不改，
 *     整个 payload 原样 upsert 进 Tasks/ActiveTasks/TaskFilters）
 *     ↓
 *   Query（12_TaskQueryEngine —— 不改，新列自动出现在返回的 task
 *     对象里）
 *
 * ### Update 路径
 *
 *   20_TaskEngine.updateTask —— 【改动】UPDATABLE_FIELDS 新增
 *   due_time；due_date/due_time 任一变化时重算 merged.due_datetime；
 *   identity 重算改用 resolveIdentityDueValue(merged)。其余步骤
 *   （EventBus.publish → ProjectionEngine.projectTaskUpdated_）不改，
 *   理由同 Create 路径。
 *
 * ### Recurring 续期路径
 *
 *   20_TaskEngine.completeTask
 *     ↓
 *   21_RecurringEngine.spawnNextIfNeeded —— 【改动】取
 *   resolveIdentityDueValue(task) 而不是裸 task.due_date 喂给
 *   computeNextDueDate；拿到结果后拆回 next due_date / next due_time
 *   两个值放进新实例的 meta
 *     ↓
 *   09_TemporalParser.computeNextDueDateFromLabel —— **不改**（1.2
 *   节已证明现有的 hasTime 侦测 + 格式保留逻辑对此已经够用）
 *     ↓
 *   09_IdempotencyManager.createTaskIfNotExists —— 同 Create 路径
 *
 * ### 明确不变的路径
 *
 *   View（Today/Week/Month/Upcoming/Overdue）、Priority（Urgency/
 *   Priority Score）、Search（日期范围过滤）、Dashboard、Analytics
 *   五条只读展示/计算路径——继续按纯日期粒度工作，新字段对它们透明
 *   存在但不影响当前行为，面向未来的可能改动记录在 IO-1，本次不动。
 */

// ------------------------------------------------------------
// 八、Pending Design Decisions（不是 Finding，也不是 Improvement
// Opportunity——这四项是"证据本身无法替你选出答案，需要一个决策角色
// 做判断"的设计分岔点。UEF 惯例：条目绑定角色而非人名，见下方
// Decision Authority；沿用 Review #1「五、待决问题」的既有惯例，只是
// 换成更通用的命名——Carson 2026-07-13 反馈，这个通用化本身也建议
// 沉淀回 UEF，见对话另行讨论）
// ------------------------------------------------------------

/**
 * Decision Authority: Architecture Owner（本项目现由 Carson 担任；这是
 * 一个角色，不是绑定到具体人名——未来其他 Domain OS 项目可以由不同的
 * Architecture Owner 对本项目的 Pending Design Decision 做出判断，
 * 不需要因为换人而修改这份模板本身）。
 *
 * 1. [Decision Type: Semantic] due_datetime 在"只有日期没有时间"时是
 *    空字符串还是默认当天 00:00:00？本次按"空字符串"设计（见 2.2），
 *    需要 Architecture Owner 确认或改判。
 * 2. [Decision Type: Migration] 是否需要对存量 due_date 里已经隐含
 *    时间（字符串带 T 后缀）的历史任务做一次性回填，把时间拆进
 *    due_time/due_datetime（见 4.3）？本次设计不依赖这个决定也能先
 *    落地，属于独立的、范围更大的数据清理决定。
 * 3. [Decision Type: UX] 06_TaskIntentParser 展示到期日文案要不要在有
 *    due_time 时同时显示时间、具体格式是什么（见 3.1 第 2 项）？本次
 *    不预先定稿。
 * 4. [Decision Type: Governance] 本次变更是否让 Schema Authority
 *    （ADR-2026-07-06-002）的拆分触发条件（b）"半年内变化 3 次以上"
 *    成立？需要对照 00_Project_State.gs 完整 changelog 计数确认
 *    （见「五」风险点，本次审查不做这个计数）。
 *
 * 四项 Decision Type 分别对应四种不同性质的判断依据——Semantic 靠
 * 产品语义直觉、Migration 靠数据完整性/清理成本权衡、UX 靠呈现效果、
 * Governance 靠对照既有 ADR 触发条件——列出类型是为了让 Architecture
 * Owner 一眼看出"这条该用什么方式想清楚"，不是为了给决策本身分优先级
 * （四项目前都不阻塞已批准部分先落地）。
 */

// ------------------------------------------------------------
// 九、Review Summary（供 06_Review_History.md 收录用）
// ------------------------------------------------------------

/**
 * Findings:      0 HIGH, 1 MEDIUM（DT-2）, 0 LOW
 * Improvement Opportunities: 3（IO-1/IO-2/IO-3）
 * Pending Design Decisions: 4（见「八」，均待 Architecture Owner 决定，
 *                 不阻塞已获批准部分的实现）
 * Dispositions:  1 confirmed-remediated-in-proposal（DT-2，修复方案
 *                已设计并包含在本提案的 Migration Plan 里，不是推迟到
 *                以后）
 * 核心判断:      现有架构已经在字符串格式层面隐式支持时间解析、跨
 *                recurring 实例延续时间——本次改动的本质是"把已经
 *                正确工作的能力提升为显式字段"，而不是新建一套时间
 *                处理逻辑。8 个文件需要改动（全部是新增字段/新增
 *                调用，无一处需要修改现有函数的对外签名或删除现有
 *                行为），9 个文件被逐一核实确认不需要改动。全部存量
 *                任务的 identity 在迁移前后逐字节不变，是一条可在
 *                实现阶段直接写单元测试验证的具体不变量——2026-07-13
 *                实现阶段已把这条断言写进
 *                07_IdentityEngine.testIdentity()（第5/6组用例），不是
 *                停留在"应该没问题"。
 * Status:        IMPLEMENTED（2026-07-13，Carson 批准设计后同日实现）——
 *                8 个代码文件改动 + Finding DT-2 的修复已随
 *                migrateSchemaDueTime() 一并写入，正式 ADR 记录见
 *                00_ADR.gs ADR-2026-07-13-008。已有部署仍需手动执行一次
 *                migrateSchemaDueTime() 完成迁移（见「四、4.4」执行顺序），
 *                这一步不因为"设计已批准"而自动发生。「八」
 *                Pending Design Decision 的 Semantic/UX 两项已在实现中
 *                拍板（见 2.2/06_TaskIntentParser 的 _formatDueDisplay_
 *                注释），Migration/Governance 两项仍待 Architecture
 *                Owner 决定，不阻塞已完成部分。
 */

// ============================================================
// 八、Review #4（2026-08-29）— Project Deadline Contract:
//     Pre-Implementation Design Review
// ============================================================

/**
 * Review Type:   Feature/Change Review（跟 Review #1/#2 的周期性 Domain
 *                Profile 合规扫描性质不同，结构沿用 Review #3 的
 *                7-Deliverable 模板，见「六」）
 * Trigger:       Reminder OS 侧 ADR-2026-08-27-009（TASK/Workflow-Step
 *                REMINDER_REQUESTED 消费层）落地后，entity_type:
 *                'PROJECT' 路径被 explicitly deferred——评审时已经确认
 *                真正的 blocker 不是"Reminder OS 缺一个 consumer"，是
 *                Project 本身没有任何 due_datetime 类字段
 *                （00_Sheets_Structure.gs 全字段核对过，见 Reminder OS
 *                侧 00_Architecture_Review_ProjectWorkflow_Reminder_
 *                Integration.js 第一节 G）。
 * Scope note:    本次刻意不叫"Project Reminder Review"——Reminder 只是
 *                这份 deadline contract 未来的一个 consumer（Model A，
 *                见「七」），核心问题是"Project 的 deadline 是什么"，
 *                这个答案同样要服务未来的 Calendar OS/Execution OS/
 *                Property OS 等，不能只从 Reminder OS 的需要反推
 *                schema——否则会出现"为了满足 Reminder 就给 Project
 *                加 due_datetime"这种本末倒置，以后每个新 Domain OS
 *                都各自推动一次 Project schema，互相打架。
 * Prior review:  Review #3（2026-07-13，Due Time Support）——本次
 *                Deliverable 2 直接复用 Review #3 已经落地、已经生产
 *                验证过的 Task due_datetime 三层模型，不重新发明。
 * 本次约束（Architecture Owner 明确要求）：不改 production 代码、不
 * 新增 Project/Workflow 任何字段、不动 Reminder OS 任何文件、不跑
 * migration。「八、Pending Design Decisions」写完即停，等批准。
 */

// ------------------------------------------------------------
// 一、现有架构审查（Deliverable 1：Architecture Review）
// ------------------------------------------------------------

/**
 * 1.1 Project/Workflow/Task 三层关系（00_Entity_Relationship.gs「一、三」）：
 *
 *   Project 1 ── 0..N Task（project_id 可空，Task 不强制属于 Project）
 *   Project 1 ── 0..N Workflow（workflow.project_id 可空）
 *   Workflow 1 ── 0..N Task（Task.workflow_id + sequence_index）
 *   Project 1 ── 0..N Project（parent_project_id，Sub-Project 层级）
 *
 *   Project 的一句话定义："一个有明确边界、可以被 Archive 的生活事务
 *   （搬家/家庭整理/喂流浪猫计划）"——最后这个例子（喂流浪猫计划）
 *   本身就是一个"可能没有自然截止日期"的 Project，对「八」Pending
 *   Decision 1（是否强制）直接构成证据，不是本次凭空假设的场景。
 *
 *   Workflow 的一句话定义："一组 Task 之间的编排规则（谁先谁后/能否
 *   并行/要不要按周期重来一遍）"——注意定义本身就是"规则"，不是"一件
 *   有边界的事务"，跟 Project 的定义性质不同，这条差异直接影响「五」
 *   对 Q3（Workflow 要不要自己的 deadline）的判断。
 *
 * 1.2 Task↔Project 双向转换（00_Entity_Relationship.gs「三」，
 *     ADR-2026-07-24-015）：Task 可以升级成 Project，Project 也可以在
 *     满足前置条件（没有 Sub-Project、没有非终态 Task）时降级成 Task。
 *     这条关系直接关联「五」的一个具体风险点：Task 已经有
 *     due_datetime，如果 Project 也有自己的 due_datetime，这两个方向
 *     的转换要不要携带这个字段、怎么携带，需要在 Deliverable 2 明确
 *     规则，不能留空。
 *
 * 1.3 现有 Task due_datetime 三层模型（Review #3，已生产验证，见本文件
 *     「七」+ Reminder OS 侧 20_ReminderEngine.js
 *     _resolveEffectiveDueDatetime_）：due_datetime（完整 ISO，分钟级）
 *     → due_date + due_time 组合 → 纯 due_date（午夜兜底）。这是本次
 *     Deliverable 2 的直接可复用先例，Reminder OS 那一侧已经完整支持
 *     这个契约，如果 Project 采用同一形状，Reminder OS 消费端不需要
 *     任何新代码（只需要 Reminder OS 侧另开的 entity_type: 'PROJECT'
 *     消费分支，那是「七」的范围，不是本次）。
 *
 * 1.4 WorkflowTemplate 的 capture/instantiate 机制不依赖任何 Project
 *     deadline（00_Business_Rules.gs「二」，重要澄清，避免被误认为
 *     "现有系统已经隐含需要 Project deadline"）：capture 时
 *     due_date 转换成相对 Project 自己 created_time 的 offset 天数；
 *     instantiate 时以"实例化操作发生的时间"为新基准点重新计算
 *     具体 due_date——两端锚点都是"时间戳"（创建/实例化时刻），不是
 *     "Project 的到期时间"。也就是说，这套已经在生产环境跑的相对
 *     偏移机制，从设计上就完全不需要 Project deadline，本次评审
 *     的结论不会跟它冲突，也不应该被它误导成"deadline 已经是隐含
 *     必需品"。
 *
 * 1.5 Project 状态机（27_ProjectEngine.gs，ADR-2026-07-24-017）：
 *     非终态 DRAFT/READY/IN_PROGRESS/WAITING/BLOCKED，终态另有
 *     COMPLETED/CANCELLED/CONVERTED_TO_TASK/ARCHIVED 一类（本次审查
 *     未逐一列全终态清单，「五」Overdue 判断只依赖"是否非终态"这个
 *     二元判断，不需要区分具体是哪个终态）。这套状态机跟"只增不删，
 *     用状态字段表达结束"（00_Data_Ownership.gs「五」）的既有原则
 *     一致——Project overdue 判断必须尊重这套已有状态机，不能另起
 *     一套独立的"是否过期"逻辑。
 *
 * 1.6 Workflow 的 recurrence_rule 机制（28_WorkflowEngine.gs）：
 *     workflow_type 含 SEQUENTIAL/PARALLEL/BRANCH/RECURRING 四种；
 *     RECURRING 类型的 Workflow 完成后，"按 recurrence_rule 判断下一次
 *     是否已到期，due_date 按 recurrence_rule 重新计算"——这套机制已经
 *     在 Task 层面独立处理"下一次什么时候到"，不依赖、也不产出任何
 *     Workflow 级别的单一 deadline。这是「五」判断"不要自动给
 *     Workflow 加 deadline"的关键证据：一个 RECURRING Workflow 概念上
 *     没有"唯一一个截止时间"，它的"到期"是持续滚动的，跟 Project 的
 *     "有边界的一件事"性质不同。
 *
 * 1.7 Schema Authority / Metadata Standard（00_Data_Ownership.gs）：
 *     LIFE_PROJECTS/LIFE_WORKFLOWS 写入权唯一持有者是
 *     10_ProjectionEngine.gs（扩展），铁律"只增不删"。十一字段
 *     Metadata Standard（creator/decision_owner/approval_status 等）
 *     适用于 Project/Task/Workflow/Note 四类实体，若 Project 新增
 *     deadline 字段，字段本身的写入权仍然落在 10_ProjectionEngine.gs，
 *     不产生新的写入权分裂——这条在 Deliverable 3 会再次确认。
 *
 * 1.8 既有可直接复用的两条跨 OS 边界判断先例：
 *     （a）Dashboard Ownership（00_ADR.gs 对应条目，Domain Dashboard
 *     vs Execution Dashboard）——判断方法是"只读本 Domain 自己的表就够
 *     → Domain 自己拥有；需要跨读其它 Domain 才够 → Execution OS 的
 *     范围，本项目不实现"。这条判断方法本次直接套用在"谁拥有 Project
 *     deadline"这个问题上，见「七」。
 *     （b）ADR-2026-07-24-012（Domain is Producer, Execution is
 *     Consumer）——Domain 只管发布 Business Event，不关心消费方怎么用；
 *     消费方只允许保存 Reference，不允许复制/反向修改 Domain 数据。
 *     这条本次同样直接套用，见「七」。
 *
 * 1.9 【重要限制，如实声明】本次 Review 没有查询 Carson 真实
 *     Spreadsheet 里现有 Project 的实际行数、是否已经有用户在
 *     description/title 里手写过截止日期一类的非结构化线索——本次
 *     只能核对 schema（代码层面确认 LIFE_PROJECTS 没有任何 due_date
 *     类字段），不能核对存量数据。这一点直接决定 Deliverable 4
 *     （Migration Plan）目前只能给方法论，给不出真实数字，见该节。
 */

// ------------------------------------------------------------
// 二、Proposed Schema Changes（Deliverable 2）—— 本节是提议内容，
//     未经批准，不写入 00_Sheets_Structure.gs 本体
// ------------------------------------------------------------

/**
 * 2.1 是否需要 deadline（Q1）——不是因为 Reminder OS 想要，Project 就
 *     必须有：
 *
 *     从业务语义看，Project 应该是可选（optional/nullable），不是
 *     强制。证据：1.1 提到的"喂流浪猫计划"这类 Project 本身就可能没有
 *     自然截止日期；Task 层面 reminder_policy/due_date 本身也是可空
 *     设计（20_ReminderEngine.js 的既有惯例），Project 采用同样"可以
 *     不设"的模式，跟既有产品哲学一致，不是新发明一套更严格的规则。
 *     强制要求每个 Project 都填 deadline，会把"喂流浪猫计划"这类本来
 *     没有明确终点的生活事务硬套一个不存在的日期，属于为了满足某个
 *     消费方（Reminder）反过来扭曲 Domain 语义，正是 Architecture
 *     Owner 在本次 Review 要求里明确要避免的陷阱。
 *
 *     Project deadline 与 Task due date 的关系：两者独立——一个
 *     Project 下的 Task 各自可以有自己的 due_datetime，不需要、也不
 *     应该因为 Project 本身没有 deadline 就不能设 Task due_datetime
 *     （现状已经是这样，Task.due_datetime 从来不依赖 project_id 是否
 *     指向一个有 deadline 的 Project）；反过来，Project 设了 deadline
 *     也不会自动给它名下的 Task 都填上同一个 due_datetime（会不会
 *     "建议"是 UX 层面的事，这次不预先定稿，见「八」）。
 *
 * 2.2 due_date vs due_datetime（Q2）——三个候选模型：
 *
 *     Model A（纯 due_date，日期级）：只有一个字段，跟 Task V1 时代
 *     的粒度一致。优点：最简单。缺点：跟 Task 现在已经是 datetime-aware
 *     （Review #3 已经把 Task 升级到分钟级）背道而驰，Reminder OS 的
 *     _resolveEffectiveDueDatetime_ 已经是三层解析设计，Project 单独
 *     退回纯日期级，会让"同一个 Reminder OS 引擎，对 Task 能精确到
 *     分钟、对 Project 只能到天"这种不一致长期存在，没有技术理由
 *     支持这个不一致。
 *
 *     Model B（due_date + due_time 两个独立字段，都可空）：比 Model A
 *     精细，但需要两个字段各自处理"有 date 没 time"的情况，等于
 *     重新发明一遍 Task 已经踩过坑、已经修过的同一类问题
 *     （00_Sheets_Structure.gs/20_ReminderEngine.js 现有的
 *     due_date+due_time 组合解析逻辑）。
 *
 *     Model C（推荐）：due_datetime（canonical，完整 ISO）+
 *     due_date/due_time 作为 fallback 输入方式——逐字复用 Task
 *     现有的三层模型和字段命名（due_datetime/due_date/due_time），
 *     不发明新形状。理由：（a）Reminder OS 的
 *     _resolveEffectiveDueDatetime_ 已经认识这个精确的字段组合，
 *     如果 Project 采用同一形状，「七」的 Reminder 集成部分不需要
 *     Reminder OS 侧写任何新的解析逻辑，只需要新的注册/消费入口；
 *     （b）跟 Review #3 已经验证过的迁移路径、显示逻辑一致，
 *     06_TaskIntentParser 一类的展示层代码有直接可抄的先例；
 *     （c）三个字段都可空，直接满足 2.1"deadline 整体可选"的要求
 *     （due_datetime 为空即"没有 deadline"，不需要额外的
 *     has_deadline 布尔字段）。
 *
 *     本节是 Deliverable 2 的建议内容，具体选哪个模型是「八」
 *     Pending Design Decision 的一项，不在这里替 Architecture Owner
 *     拍板。
 *
 * 2.3 Workflow 是否需要自己的 deadline（Q3）——不建议自动给：
 *
 *     1.6 已经给出证据：RECURRING 类型的 Workflow 本身没有"唯一
 *     截止时间"这个概念，SEQUENTIAL/PARALLEL/BRANCH 三种非 recurring
 *     类型，理论上可以有一个"整个 Workflow 实例什么时候该完成"的
 *     deadline，但目前找不到任何现有机制（既没有 UI 入口，也没有
 *     Engine 逻辑）依赖或需要它——加上 Workflow 命名空间本来就已经
 *     承载了 project_id（可选归属）+ instantiated_from_template_id
 *     （版本绑定）两条关系，贸然再加一个 due_datetime，在没有具体
 *     使用场景验证之前，属于「不做的关系，避免过度设计」
 *     （00_Entity_Relationship.gs「四」）这条既有原则要提防的对象。
 *     建议：这次不给 Workflow 加 deadline 字段，若未来出现具体、
 *     独立于 Project 的 Workflow-level 截止时间需求（跟 Project
 *     deadline 不同的场景），单独另开一次评审，不在本次顺带决定。
 */

// ------------------------------------------------------------
// 三、API Impact（Deliverable 3）
// ------------------------------------------------------------

/**
 * 若 Deliverable 2 的 Model C 获批，预计需要改动（本节全部是"如果
 * 批准会怎样"的提议内容，本次不动一行代码）：
 *
 *   27_ProjectEngine.gs — createProject/updateProject 新增对
 *     due_datetime/due_date/due_time 三个可选字段的接收与校验
 *     （校验逻辑直接抄 Task 侧既有实现，不重新设计一遍）。
 *   00_Sheets_Structure.gs — LIFE_PROJECTS 新增三列，且需要明确
 *     "这三个字段算不算十一字段 Metadata Standard 之外的"业务字段""——
 *     按现有分类，跟 Task 的 due_datetime 一样，属于业务字段，不是
 *     Metadata，不需要改动 00_Data_Ownership.gs「三」的字段清单本身。
 *   10_ProjectionEngine.gs — 扩展部分需要认识这三个新列（沿用既有
 *     "只增不删"的 Projection 写入模式，不需要新的写入权分裂，1.7
 *     已确认）。
 *   14_ProjectQueryEngine.gs — getActiveProjects()/getProjects() 如果
 *     要支持按 due_datetime 排序/筛选，需要相应扩展（是否现在就做，
 *     还是等真的有消费方需要再做，属于「八」的范围）。
 *   UI（50_UIBridge.gs / ui_index.html）— Add/Edit Project 表单是否
 *     暴露这个字段，是独立的 UX 决定，本次不预先定稿（同「八」）。
 *   Task↔Project 转换（12/27 两个 Engine，ADR-2026-07-24-015）——
 *     需要明确转换时 due_datetime 怎么处理：Task→Project 时，源
 *     Task 的 due_datetime 是否带过去成为新 Project 的 due_datetime？
 *     Project→Task 反向转换呢？这条字段映射规则目前是空白，若 Model C
 *     获批，必须在正式实现前补齐，不能实现阶段临时决定（比照
 *     00_Business_Rules.gs「一」现有转换字段映射表的详尽程度）。
 */

// ------------------------------------------------------------
// 四、Migration Plan（Deliverable 4）
// ------------------------------------------------------------

/**
 * 4.1 【如实声明，见 1.9】本次没有真实 Spreadsheet 数据访问权限，以下
 *     是需要 Architecture Owner（或下一次拿到数据访问权限的会话）
 *     回答的具体问题清单，不是本次给出的答案：
 *
 *       - 现在 LIFE_PROJECTS 表实际有多少行（Draft/Design Phase 状态
 *         下可能是 0 或很少，若已经在生产使用则需要真实计数）？
 *       - 现有 Project 的 title/description 里有没有大量手写日期
 *         的模式（比如"9月10日前完成"），如果有，是否值得写一个
 *         一次性脚本尝试识别、建议映射到新字段（供用户确认，不自动
 *         写入——遵守既有"AI Suggests, Human Confirms"原则）？
 *       - 现有 Project 有没有其它可以安全复用的时间类字段（本次
 *         schema 核对没有找到，只有 Metadata 的 created_time/
 *         updated_time，两者语义都不是 deadline，不能直接挪用）？
 *
 * 4.2 无论上面的答案是什么，迁移方案本身推荐走"新增可空列，不做
 *     强制回填"的模式（同 Review #3 Task due_time 迁移的既有先例，
 *     00_Architecture_Review.gs「七、四」migrateSchemaDueTime()）：
 *     现有 Project 的三个新字段全部留空，不是 error 状态，Project
 *     overdue 判断（见「五」）天然把"没有 deadline"处理成"不参与
 *     overdue 判断"，不需要一次性回填就能安全上线。
 *
 * 4.3 是否影响 identity：不影响——07_IdentityEngine 的
 *     IDENTITY_AFFECTING_FIELDS（Task/Workflow 各自的身份判定字段
 *     清单，28_WorkflowEngine.gs:51 可查到 Workflow 那份）里没有任何
 *     due_date/due_time 类字段参与身份判定，新增 Project 的
 *     due_datetime 三列没有理由打破这个既有原则，建议同样不参与
 *     Project 的 identity 判定（若 Project 也有类似的
 *     IDENTITY_AFFECTING_FIELDS 清单，本次审查未找到独立的 Project
 *     Identity Engine，需要在 Deliverable 3 正式设计阶段确认这一点
 *     以什么方式落地）。
 */

// ------------------------------------------------------------
// 五、Risk Analysis（Deliverable 5）
// ------------------------------------------------------------

/**
 * 5.1 Project Overdue 的定义（Q4）——推荐：
 *
 *     Project overdue = 存在 due_datetime（非空） AND due_datetime
 *     早于当前时间 AND status 属于非终态集合（DRAFT/READY/
 *     IN_PROGRESS/WAITING/BLOCKED，1.5）。
 *
 *     明确排除的错误模型：不能因为"Project 下有 Task 逾期"就推导
 *     "Project 也逾期"——这是两个不同语义的判断（Architecture Owner
 *     在需求里已经明确指出这一点）。理由：Project 本身没有 deadline
 *     时，它名下 Task 逾期只说明"某个具体动作没按时做"，不代表
 *     "这件事本身错过了它的边界"——后者需要 Project 自己有 deadline
 *     才谈得上"逾期"，两者是独立的统计口径，不应该互相偷换。这一点
 *     对「三」提到的 Task↔Project 转换尤其重要：如果混淆两种
 *     overdue，Project→Task 降级转换时可能出现"这个 Project 明明
 *     没有自己的 deadline，却因为名下有逾期 Task 被标记过'逾期'，
 *     降级成 Task 后这个状态却又消失了"这种自相矛盾的用户体感。
 *
 * 5.2 Workflow 级联风险——2.3 已经建议不给 Workflow 单独加 deadline，
 *     这里补一条具体风险：如果未来有人提议"Workflow 自动继承所属
 *     Project 的 deadline"，需要格外小心 RECURRING 类型（1.6）——
 *     一个循环执行的 Workflow 沿用它所属 Project 的单一 deadline，
 *     语义上说不通（Project 的 deadline 是"这件事什么时候该完成"，
 *     RECURRING Workflow 从设计上就没有"完成"这个终点）。如果这次
 *     或未来批准 Model C，建议在正式 ADR 里明确写清楚"Workflow 不
 *     自动继承 Project.due_datetime"这条边界，不要留给实现阶段
 *     各自理解。
 *
 * 5.3 【Architecture Owner 特别提醒的陷阱，本次评审认同并采纳】
 *     不要因为这次评审最初的触发点是 Reminder OS 的集成缺口，就把
 *     schema 设计反向拟合 Reminder OS 的需要——2.1/2.2 的推荐理由
 *     全部锚定在 Project 自己的业务语义（跟 Task 现有模型保持一致、
 *     覆盖"喂流浪猫计划"这类无自然截止日的场景）和平台级一致性
 *     （未来 Calendar/Execution/Property 等 OS 都可能是同一个
 *     due_datetime 的读者），Reminder OS 只在「七」最后一节才出现，
 *     且明确是"消费方之一"，不是决定 schema 形状的理由本身。
 */

// ------------------------------------------------------------
// 六、Updated File Map（Deliverable 6，proposed —— 本节是提议内容，
//     尚未写入 00_File_Map.gs 本体，待设计批准、实现完成后再正式同步）
// ------------------------------------------------------------

/**
 * 若 Model C 获批并实现，预计需要更新变更说明的文件：
 *   00_Sheets_Structure.gs（LIFE_PROJECTS 新增三列）、27_ProjectEngine.gs
 *   （新增字段读写）、10_ProjectionEngine.gs（认识新列）、
 *   14_ProjectQueryEngine.gs（如果同时做排序/筛选扩展）、
 *   00_Data_Ownership.gs（Schema Authority 矩阵本身不变，但字段清单
 *   相关的旁注需要提一句新增字段的存在）。「三、Architecture Layer
 *   Map」预计无变更（不新增文件，不改变任何文件的层间调用方向，同
 *   Review #3「六」的先例判断）。
 */

// ------------------------------------------------------------
// 七、Updated Data Flow（Deliverable 7，proposed）
// ------------------------------------------------------------

/**
 * 7.1 Ownership（Q5）——沿用已经确立的规则，不反过来：
 *
 *     Personal Life OS
 *       └─ owns Project.due_datetime（业务数据，跟 Project 本身的
 *          所有权归属一致，1.7 已确认写入权不分裂）
 *              │
 *              ▼ Reminder OS 只读，不写
 *     Reminder OS
 *       └─ owns reminder scheduling/execution（ReminderRules/
 *          Occurrences/History，Reminder OS 自己的调度状态，跟 TASK
 *          路径 ADR-009 已经确立的边界完全一致）
 *
 *     不允许反过来：Reminder OS 不能成为 Project.due_datetime 的
 *     权威来源，也不能替 Personal Life OS 决定"这个 Project 有没有
 *     deadline"——跟 ADR-2026-07-24-012（Domain is Producer,
 *     Execution is Consumer）、Reminder OS 侧 Schema Authority 矩阵
 *     "Reminder Rule | Domain（本项目）"这一行（00_Domain_Boundary.gs）
 *     是同一个原则的第三次复用，不是新发明。
 *
 * 7.2 Execution OS 的影响（Q6）——套用 1.8(a) 的判断方法：
 *
 *     Personal Life OS
 *       Project.due_datetime（Domain 数据，只读本 Domain 自己的表
 *       就能拼出来）
 *             │
 *             │ 发布 Business Event（PROJECT_UPDATED 一类，具体
 *             │ 走既有 EventBus 机制，不新开一套）
 *             ▼
 *     Life Execution OS
 *       Reference（entity_type/entity_id/可选 snapshot/
 *       last_sync_time，同 ADR-2026-07-24-012 已经定义的 Execution
 *       侧 Reference 形状，不新发明一套）
 *             │
 *             ▼
 *     Today / Weekly View（跨多个 Domain OS 聚合，"今天有哪些
 *     Project/Task 到期"这类视图，符合 1.8(a) 的 Execution
 *     Dashboard 判断标准：需要跨读至少一个其它 Domain 才够，不是
 *     Personal Life OS 自己能拼出来的）
 *
 *     Execution OS 只能读/Reference，不能把 deadline 写回 Project——
 *     跟「五、5.3」的陷阱提醒是同一条边界在不同层面的重申。
 *
 * 7.3 Reminder Integration（Q8，最后才讨论，如 Architecture Owner
 *     要求）——沿用 TASK 路径已经验证过的 Model A（ADR-2026-08-27-009）：
 *
 *     Personal Life OS
 *       Project.due_datetime 被设置/变化
 *             │
 *             ▼
 *     （未来，不在本次范围）ProjectEngine 发布 REMINDER_REQUESTED，
 *     entity_type: 'PROJECT'，payload 只带 entity_id + reminder_policy，
 *     不带 due_datetime 本身——跟 TASK 路径完全一致的"事件只作登记
 *     信号，不作数据快照"原则（ADR-009 决策 2）。
 *             │
 *             ▼
 *     Reminder OS 新增 entity_type: 'PROJECT' 消费分支（结构上可以
 *     复用 23_ReminderRequestConsumer.gs 的水位/幂等机制，但需要
 *     Reminder OS 侧读 Personal Life OS 的 LIFE_PROJECTS 表而不是
 *     Tasks 表——这条本身不需要新的跨项目授权，1.8 已经确认 Reminder
 *     OS/Personal Life OS 共享同一个 SPREADSHEET_ID）
 *             │
 *             ▼
 *     ReminderRules（复用既有表，entity_type 需要从"写死 task_id"
 *     泛化，或另开一张结构相同的独立表——这条选择留给 Reminder OS
 *     那一侧真正设计 Project 消费分支时再定，本次不预先决定）
 *
 *     Offset 建议：不在本次预先设计具体 offset 选项（比如"提前几天"
 *     的候选列表）——这是 UX 层面的决定，等 Model C 的字段本身先
 *     批准落地，再单独讨论 Reminder 这一层怎么呈现，避免本次评审
 *     范围进一步膨胀。
 */

// ------------------------------------------------------------
// 八、Pending Design Decisions（不是 Finding，也不是 Improvement
// Opportunity——这些是"证据本身无法替你选出答案，需要一个决策角色
// 做判断"的设计分岔点，沿用 Review #3 已经确立的既有惯例：条目绑定
// 角色而非人名）
// ------------------------------------------------------------

/**
 * Decision Authority: Architecture Owner（本项目现由 Carson 担任）。
 *
 * 1. [Decision Type: Semantic] Project deadline 是否为可选字段——本次
 *    推荐"可选"（2.1），需要 Architecture Owner 确认或改判。
 * 2. [Decision Type: Semantic] due_date/due_datetime 采用 Model A/B/C
 *    哪一个——本次推荐 Model C（2.2），需要确认。
 * 3. [Decision Type: Semantic] Workflow 是否需要独立于 Project 的
 *    deadline 字段——本次推荐"不加，除非未来出现具体场景"（2.3），
 *    需要确认。
 * 4. [Decision Type: Semantic] Task↔Project 双向转换时 due_datetime
 *    的字段映射规则（「三」最后一条）——本次没有给出具体映射建议，
 *    需要 Architecture Owner 判断这条转换语义应该是什么，再交给
 *    Deliverable 3 的正式实现设计。
 * 5. [Decision Type: Migration] 需要真实 Spreadsheet 数据访问，回答
 *    「四、4.1」列出的三个具体问题，才能把 Migration Plan 从方法论
 *    变成有真实数字支撑的执行计划。
 * 6. [Decision Type: UX] Add/Edit Project 的 UI 表单是否暴露这个
 *    字段、以什么形式（跟「三」提到的一样，本次不预先定稿）。
 * 7. [Decision Type: Governance] 若 1-4 获批，正式 ADR 的编号/落点——
 *    建议命名类似 ADR-2026-0X-XX-0XX「Project Deadline Contract」，
 *    具体编号沿用 Personal-Life-main 自己 00_ADR.gs 的既有序列规则，
 *    不是 Reminder OS 那一侧的 00_ADR_00X 序列（两个项目的 ADR 序列
 *    独立编号，见 Reminder OS 侧 ADR-009 治理小节的既有澄清）。
 *
 * 七项里，1-4 是本次评审的核心、彼此有依赖关系（2 依赖 1 的答案，
 * 4 依赖 2 的答案）；5 独立、不阻塞 1-4 的讨论，但阻塞正式 Migration
 * Plan 定稿；6-7 都不阻塞 1-4，可以在正式实现阶段再定。
 */

// ------------------------------------------------------------
// 九、Review Summary（供 06_Review_History.md 收录用——本次未同步
// 写入该文件，理由见下方 Notes）
// ------------------------------------------------------------

/**
 * Reviewer:      Claude（single-project review，evidence-first——
 *                every claim checked against actual code/governance
 *                files, no assumption-based findings；1.9 明确声明
 *                的数据访问限制除外）
 * Gate feeding:  Feature/Change Review（跟 Review #1/#2 的周期性
 *                Domain Profile 合规扫描性质不同，同 Review #3）
 * Findings:      本次不是 UEF Checklist 合规扫描，不产出 HIGH/MEDIUM/
 *                LOW 分级 Finding；核心产出是「八」的 7 项 Pending
 *                Design Decision。
 * Dispositions:  0（本次全部 7 项待 Architecture Owner 批准，未批准
 *                任何一项，也没有单方面替 Architecture Owner 拍板
 *                任何一项）。
 * Notable:
 *   - 现有 WorkflowTemplate capture/instantiate 机制（1.4）完全不
 *     依赖 Project deadline，这条证据本身值得记录：说明"Project 没有
 *     deadline"这件事至今没有真的挡住任何一个已经上线的功能，本次
 *     新增这个字段是为了服务未来（Reminder/Calendar/Execution 等）
 *     消费方，不是修一个当前已经存在的功能缺陷。
 *   - Review #3 已经把 Task 的 due_datetime 三层模型验证到生产环境，
 *     本次 Model C 完全复用同一个形状而不是重新设计，是这次 Review
 *     推荐意见里置信度最高的一条（其余几条更依赖 Architecture Owner
 *     的产品判断，不是纯技术推导）。
 * Status:        REVIEW ONLY——PENDING ARCHITECTURE OWNER APPROVAL。
 *                未实现任何一行代码，未新增任何字段，未跑任何
 *                migration，Reminder OS 一侧未做任何改动。
 *
 * Notes（为什么本次没有同步写入 06_Review_History.md）：核对该文件
 * 既有收录记录，发现 Review #3（同样是"批准前"状态起步的 Feature
 * Review）在完成设计并获批实现之后，也没有被补录进 06_Review_
 * History.md——推断该文件收录的是"已经走完批准流程、有真实
 * Disposition"的 Review，不收录仍处于 Pending Design Decision 阶段
 * 的记录。本次 Review #4 现在的状态（全部待批准）跟这个推断一致，
 * 所以没有写入，等 Architecture Owner 批准、Deliverable 4 的
 * migration 数据补齐、正式 ADR 落地之后再补——这条本身也可以算「八」
 * 之外一个更小的、不阻塞主线的观察，供 Architecture Owner 判断
 * 06_Review_History.md 的收录标准是否需要写清楚（本次不擅自去查证
 * Review #3 当初没有补录是不是也是同一个原因，只是同一份文件里两次
 * 独立出现同一个模式，如实记录）。
 */

// ============================================================
// 九、Project Deadline Schema Impact Audit（2026-08-29）
//     —— Review #4 的 Stage 2：只读事实核查，不是新的独立评审
// ============================================================

/**
 * Stage: SCHEMA IMPACT AUDITED（不是 Decision Ready，更不是
 * Implementation——四段式状态见下方 Stage Tracking）。
 *
 * 边界确认（逐条对照 Architecture Owner 的要求，本次全部遵守）：
 *   ✅ 未新增 Project deadline 字段（00_Sheets_Structure.gs 未改动）
 *   ✅ 未修改 Projects schema / ProjectEngine / IdentityEngine /
 *      Reminder OS / ReminderConnector / Execution OS
 *   ✅ 未跑任何 migration，未删除/重构任何现有代码
 *   ✅ 不假设 Review #4 的 Model C 已经是 production contract——下面
 *      每一条都标注"若 Model C 获批"这个前提，不是既成事实
 *
 * 【明确记录一条状态，避免只停留在聊天记录里】Architecture Owner 在
 * 要求这次 Schema Impact Audit 时，原文说"整体方向我原则上同意"，
 * 逐条同意了 Review #4「八」列出的 8 条推荐方向（deadline 可选、
 * Model C、Workflow 不加 deadline、Project overdue 不得由 Task
 * overdue 推导、既有 ownership 模式、Execution OS 只能 Reference、
 * Reminder OS 沿用 Model A、不能让 Reminder 反过来决定 schema）——
 * 这是"原则性同意"，不是"批准进入 Implementation"，两者本次严格
 * 区分：前者已经发生（这条记录本身就是持久化它），后者仍然待
 * Stage Tracking 走到 Decision Ready 才算数。
 *
 * Stage Tracking：
 *   Review #4 Proposed Decision   ✅ 已完成（2026-08-29 之前）
 *   Architecture Owner 原则性同意  ✅ 已发生（见上，2026-08-29）——
 *                                    不等于批准 Implementation
 *   Schema Impact Audited          ✅ 本文档
 *   Decision Ready                 ⏸️ 待 Architecture Owner 批准「十一」
 *                                    列出的 Open Decisions
 *   Implementation                 ⏸️ 未开始，且明确不会在未批准前开始
 */

/**
 * ---- Q1. Projects 表当前完整 schema + 是否已有字段承担 deadline 语义 ----
 *
 * 完整现有列（00_Sheets_Structure.gs「三」，本次重新逐字核对，不依赖
 * Review #4 时的记忆）：project_id / identity / title / description /
 * execution_mode / parent_project_id / depends_on_project_ids /
 * source_task_id / archived_at / chat_id / status / converted_to_task_id /
 * instantiated_from_template_id / creator / suggested_by /
 * source_domain / source_module / source_event_id / created_method /
 * created_time / updated_time / decision_owner / approval_status
 * （后 9 个是十一字段 Metadata Standard 的其中一部分，
 * 00_Data_Ownership.gs「二」）。
 *
 * 用词根 date/deadline/due/target_/end_/expected/scheduled/complet*_at
 * 重新全量搜索 00_Sheets_Structure.gs，排除 updated_time/created_time/
 * archived_at/template_version 这些已知的 Metadata/版本字段后，零命中。
 * 唯一命中的"due"字符串是 09_TemporalParser.computeNextDueDateFromLabel
 * 这个函数名引用，属于 Task/Workflow recurring 场景的函数调用，不是
 * Project 的列名。
 *
 * 结论：确认没有任何现有字段承担 deadline/target-date/completion-date
 * 语义——Review #4「1.9」的推测在这次逐字重新核对后成立，不是靠印象
 * 结转的结论。
 *
 * ---- Q2. Project create/update/query/projection/identity 全部代码入口 ----
 *
 *   Create : 27_ProjectEngine.gs createProject() [line 80] →
 *            09_IdempotencyManager.gs createProjectIfNotExists()
 *            [line 134] → 27_ProjectEngine.gs createProjectDirect_()
 *            [line 94，仅供 IdempotencyManager 调用]
 *   Update : 27_ProjectEngine.gs updateProject() [line 153]，
 *            transitionProjectStatus() [line ~186，非终态间状态切换]
 *   Query  : 14_ProjectQueryEngine.gs getProject() [line 69] /
 *            getProjects() [line 108] / getActiveProjects() [line 124] /
 *            getProjectsByParent() [line 135]
 *   Projection : 10_ProjectionEngine.gs dispatch() 分派给
 *            projectProjectCreated_/projectProjectUpdated_/
 *            projectProjectCompleted_/projectProjectCancelled_/
 *            projectProjectArchived_ [各自 case 分支见 line 131-135]
 *   Identity : 07_IdentityEngine.gs generateProjectIdentity(chatId,
 *            title, parentProjectId) [line 191]
 *   Conversion（双向，Q9 详细展开）: 20_TaskEngine.gs
 *            createTaskFromConversion_() [line 488]（Project→Task）；
 *            27_ProjectEngine.gs 的 Sprint 3 预留位（Task→Project 由
 *            42_ConversionEngine.gs 调用，该文件已存在，本次未逐行
 *            审查其内部实现，只确认了文件真实存在，不是 Sprint 1
 *            阶段的占位推测）
 *   UI     : 50_UIBridge.gs ui_createProject() [line 843] /
 *            ui_updateProject() [line 573]（Q6 详细展开）
 *
 * ---- Q3. 若加入 due_datetime/due_date/due_time，哪些代码路径必须同步 ----
 *
 * 必须改（按 Review #3 Task 侧的既有实现模式逐条比对）：
 *   ① 27_ProjectEngine.gs:60 UPDATABLE_FIELDS 数组——现在是
 *      ['title', 'description', 'depends_on_project_ids',
 *      'execution_mode']，必须新增 'due_date'/'due_time'（不新增
 *      'due_datetime'，理由见 Q4 対応 Review #3 的既有先例）。
 *   ② 27_ProjectEngine.gs:94 createProjectDirect_() 的 project 对象
 *      字面量——现在没有任何 due_* 字段，必须仿照
 *      20_TaskEngine.createTaskDirect_() 的既有写法新增
 *      due_date/due_time/due_datetime 三个字段的读取与派生计算。
 *   ③ 27_ProjectEngine.gs:153 updateProject()——需要仿照
 *      20_TaskEngine.updateTask() 的既有逻�adapt：due_date 或
 *      due_time 任一被改动时，重新计算 due_datetime 一并写入
 *      payload，不允许外部直接覆写 due_datetime 本身。
 *   ④ 07_IdentityEngine.gs——是否新增/修改 generateProjectIdentity()
 *      的入参，取决于「十」Identity Impact 的结论，本次不预先决定。
 *
 * 确认不需要改（本次审计的正面发现，不是假设）：
 *   ⑤ 10_ProjectionEngine.gs——projectProjectUpdated_()
 *      [已读完整实现] 是完全通用的字段透传（shallowCopy_ payload 后
 *      直接 upsertRowByKey_），没有任何字段级白名单，新字段会自动
 *      流过去，不需要改一行代码。
 *   ⑥ 02_EventBus.gs——PROJECT_CREATED/PROJECT_UPDATED 已经是"payload
 *      带什么就发布什么"的通用事件，不需要新的事件类型。
 *
 * ---- Q4. Project Identity 审计（不擅自改动 identity）----
 *
 * 【关键发现，两条既有先例互相矛盾，必须交给单独的 Identity Impact
 * Review，本次不代为决定】
 *
 * 现状：27_ProjectEngine.gs:55 IDENTITY_AFFECTING_FIELDS = ['title',
 * 'parent_project_id']，文件内注释明确原则："depends_on_project_ids/
 * execution_mode/description 等不影响 identity——描述'这个 Project
 * 跟谁关联/怎么组织'，不描述'这个 Project 本身是什么'"。按这条已经
 * 写明的原则类推，deadline 更接近"这件事什么时候该做完"（组织/调度
 * 属性），不是"这个 Project 本身是什么"——这条推理支持"不放进
 * IDENTITY_AFFECTING_FIELDS"。
 *
 * 但是：20_TaskEngine.gs:81 Task 自己的 IDENTITY_AFFECTING_FIELDS =
 * ['title', 'due_date', 'due_time', 'recurring', 'priority',
 * 'category']——due_date/due_time 确确实实在 Task 的身份判定清单里
 * （本文件之前 Review #4「4.3」曾经写过"Task/Workflow 的
 * IDENTITY_AFFECTING_FIELDS 里没有任何 due_date/due_time 类字段参与
 * 身份判定"——【这是一处需要更正的错误，本次审计重新逐字核对源码
 * 才发现，如实更正，不掩盖】：Task 明确把 due_date/due_time 计入
 * identity，只有 due_datetime 因为是派生值被明确排除（Review #3
 * 原文注释「本文件 line ~856」："due_datetime 是派生值，不需要、也
 * 不应该出现在这个'外部传入触发重算'的清单里"）。这条先例支持
 * "Project 的 due_date/due_time 也应该计入 identity，due_datetime
 * 不计入"——沿用 Task 已经验证过的同一套模式。
 *
 * 这两条先例指向不同结论，原因可能在于二者的实际使用场景不同（Task
 * 的 due_date 计入 identity，猜测是为了让"同名但不同到期时间"的
 * 重复/周期性任务被当成不同的 Task 处理，不互相合并；Project 通常是
 * 单一、持续存在的事务，"改一下目标完成日期"直觉上是同一个 Project
 * 被重新排期，不是变成了另一个 Project）——但这只是本次审计的推测，
 * 不是从代码或既有设计文档里找到的明文原因，需要 Architecture Owner
 * 或专门的 Identity Impact Review 判断这条推测是否成立、该 Project
 * 采用哪一种。
 *
 * 本次审计不替 Architecture Owner 做这个判断，也不修改
 * IDENTITY_AFFECTING_FIELDS 任何一行——按 Architecture Owner 的
 * 明确要求，若确认 deadline 会影响 identity（或者甚至只是"需要判断
 * 会不会影响"这件事本身），应该先开一个独立的 Project Deadline —
 * Identity Impact Review，不要把这个决定悄悄包含进 Project schema
 * 的实现任务里。
 *
 * ---- Q5. Project Event / Projection 是否需要新增字段或事件 ----
 *
 * 不需要新增事件类型——见 Q3⑤⑥。若字段本身获批新增，
 * PROJECT_CREATED/PROJECT_UPDATED 的 payload 会自然携带这些新字段
 * （因为 payload 就是 project 对象/变更集本身），Projection 层
 * 不需要任何改动。
 *
 * ---- Q6. Personal Life OS UI / UIBridge 是否需要同步 ----
 *
 * 需要。ui_index.html「Add Project」表单（line 398-424）目前只有
 * title/description/parent/execution_mode 四个输入，没有任何日期类
 * 输入控件——若 Model C 获批，需要新增至少一个日期（+可选时间）输入，
 * 具体 UX 形式（比如是否复用 Task 表单已有的日期选择组件）属于「十一」
 * Open Decision，不在本次预先定稿。50_UIBridge.gs 的
 * ui_createProject()/ui_updateProject()（line 843/573）已经是
 * "透传给 ProjectEngine，不新开持久化路径"的既有模式（文件头 line
 * 62 自陈），只要 ProjectEngine 支持了新字段，UIBridge 层本身不需要
 * 新增校验逻辑，只需要把表单新增的输入值放进 changes/meta 对象里
 * 转发过去。
 *
 * ---- Q7. Life Execution OS Reference 是否需要新增字段；哪些属于
 *          Reference，哪些绝不能复制成 Domain entity data ----
 *
 * 沿用 ADR-2026-07-24-012（Domain is Producer, Execution is Consumer）
 * 已经定义的 Reference 形状：entity_type/entity_id/可选 snapshot/
 * last_sync_time。若 Project 新增 due_datetime，Execution OS 的
 * Reference 可以有一个"snapshot 里包含 due_datetime 快照"的可选字段
 * （供 Today/Weekly View 展示用，不需要每次都反查 Personal Life OS），
 * 但这个 snapshot 必须明确标注"仅供展示、过期需要重新同步"，不能被
 * 当成权威值使用，也绝不能有任何写路径从 Execution OS 反向修改
 * Personal Life OS 的 Project.due_datetime——跟 ADR-012 原文"消费方
 * 不允许复制 Domain Entity 完整内容、不能修改 Domain State"这条铁律
 * 完全一致，这次不是新发明。这条本身不需要 Personal Life OS 这一侧
 * 现在做任何事——Execution OS 自己的 Reference schema 是它自己的
 * 项目范围，不在本次审计的改动范围内。
 *
 * ---- Q8. ReminderConnector / Reminder OS 最终应该消费哪个 canonical
 *          source ----
 *
 * Personal Life OS 的 LIFE_PROJECTS.due_datetime（若获批新增）是唯一
 * canonical source——跟 TASK 路径已经确立的模式完全一致（Reminder OS
 * 侧 ADR-2026-08-27-009 决策 2："事件只作登记信号，不作数据快照"）。
 * ReminderConnector 未来若要支持 Project，应该继续只发布
 * entity_id + reminder_policy，不携带 due_datetime 本身；Reminder OS
 * 侧的消费者应该现读 Personal Life OS 的 LIFE_PROJECTS 表（复用
 * 23_ReminderRequestConsumer.gs 已经验证过的水位/幂等机制，读表对象
 * 从 Tasks 换成 Projects）。这条本次不实施，只确认方向，具体设计
 * 留给 Reminder OS 那一侧未来真正做 Project 消费分支时展开（见
 * Reminder OS 侧 Architecture Review 第七节「七、七、7.3」已经写过
 * 的同一个结论，这次是从 Personal Life OS 一侧再次确认，两侧结论
 * 一致，没有矛盾）。
 *
 * ---- Q9. 现有 BusinessRule / WorkflowTemplate / Instantiate 机制是否
 *          受影响 ----
 *
 * 不受影响，但有一条需要在正式实现时明确排除的边界。Review #4
 * 「1.4」已经确认 capture/instantiate 的锚点是 created_time/实例化
 * 时刻，不是 Project deadline——这条结论本次没有变化。需要补充一条
 * 本次新发现的边界：00_Business_Rules.gs「三」capture 阶段目前处理
 * 的是 Task 的 due_date（转换成 relative_offset_days），如果 Project
 * 未来也有自己的 due_datetime，capture 逻辑必须明确"只转换 Task 的
 * due_date，不要意外把 Project 自己的 due_datetime 也当成需要
 * relative_offset 化的字段"——本次审计没有找到任何证据表明现有
 * capture 代码会意外这样做（该函数目前只读 Task 的字段，Project 本身
 * 不参与被捕获的字段集合），但这是一条在正式实现 Model C 时需要
 * 补一条回归测试明确断言的边界，不能只靠"目前看起来不会"这种口头
 * 判断。
 *
 * ---- Q10. 真实 Spreadsheet 数据需要检查什么；哪些必须 Carson 在
 *           GAS production environment 实际跑才知道 ----
 *
 * 本次没有真实数据访问权限，以下必须由 Architecture Owner 在真实
 * 环境里查证，本审计给不出数字：
 *   - LIFE_PROJECTS 表实际行数（决定 migration 的实际工作量级别）。
 *   - 现有 Project 的 title/description 里有没有大量手写日期模式
 *     （决定要不要做一次性、供人工确认的日期识别建议脚本）。
 *   - 现有 Project 有没有已经被前端/用户当"deadline"手工塞进
 *     description 自由文本里的实际用法（如果有，正式 UX 设计阶段
 *     需要考虑怎么引导用户改用新的结构化字段，而不是无视这个已经
 *     存在的使用习惯）。
 *   - 42_ConversionEngine.gs 的实际 Task→Project 转换逻辑内部实现
 *     （本次只确认了文件存在，Q2 已如实说明未逐行审查其内部实现——
 *     若要精确定稿「三」提到的 due_datetime 双向转换字段映射规则，
 *     需要先完整读一遍这个文件，本次审计没有把它纳入范围，属于
 *     「十一」的一项 Open Decision）。
 *
 * ---- Q11. Migration 风险等级；能否 backward-compatible/nullable ----
 *
 * 风险等级：LOW（有条件）。理由：
 *   - 00_Data_Ownership.gs「五」的既有铁律"只增不删，用状态字段表达
 *     结束"本身就要求新字段走"新增可空列"这条路径，不是本次审计
 *     发明的额外保守——这是这四张表（Projects/Workflows/Notes/
 *     BusinessRules）一直以来唯一被允许的 schema 演进方式。
 *   - Q5 已确认 Projection 层完全通用，不需要因为新字段而改代码，
 *     降低了"迁移脚本改了 A 却漏了 B"这类常见迁移风险的发生面。
 *   - 条件：LOW 风险的前提是「十」的 Identity Impact 问题必须先
 *     解决——如果最终决定 due_date/due_time 计入 identity，现有
 *     Project（迁移时字段留空）不会因此触发 identity 重算（既有
 *     identity 只在 UPDATABLE_FIELDS 里的字段被显式修改时才重算，
 *     见 27_ProjectEngine.js:175），所以就算最终计入 identity，
 *     对存量数据的迁移本身仍然是安全的、不会意外让所有存量 Project
 *     的 identity 集体改变。这条本身是本次审计确认过的一个具体
 *     安全边界，不是笼统保证。
 *
 * ---- Q12. 完整 Implementation Impact Map（只列出，不实施）----
 *
 *   必改：00_Sheets_Structure.gs（新增3列）、27_ProjectEngine.gs
 *   （UPDATABLE_FIELDS + createProjectDirect_ + updateProject 派生
 *   逻辑，见 Q3①②③）、ui_index.html（Add/Edit Project 表单新增
 *   输入，见 Q6）。
 *   可能需要看情况改：07_IdentityEngine.gs +
 *   27_ProjectEngine.gs:IDENTITY_AFFECTING_FIELDS（取决于「十」的
 *   Identity Impact Review 结论）、14_ProjectQueryEngine.gs（若要
 *   支持按 due_datetime 排序/筛选）、42_ConversionEngine.gs（双向
 *   转换字段映射，取决于「十一」Open Decision 里对该文件的后续审查
 *   结果）。
 *   确认不需要改：10_ProjectionEngine.gs、02_EventBus.gs（Q5）、
 *   00_Business_Rules.gs 现有 capture/instantiate 核心逻辑本体
 *   （Q9，但需要补一条回归测试断言边界）。
 *   本次审计范围之外、Reminder OS 侧未来需要自己做的：
 *   entity_type: 'PROJECT' 的消费分支（Q8，不在 Personal Life OS
 *   这一侧的改动范围内）。
 */

// ------------------------------------------------------------
// 十、Open Decisions（本次审计发现、需要 Architecture Owner 决定，
//     不是本次可以自己拍板的）
// ------------------------------------------------------------

/**
 * Decision Authority: Architecture Owner（现由 Carson 担任）。
 *
 * 1. [Decision Type: Identity——需要单独的 Identity Impact Review，
 *    不在本次/Project schema 实现里顺带决定] Project 的
 *    due_date/due_time 是否应该计入 IDENTITY_AFFECTING_FIELDS——
 *    Task 的既有先例支持"是"，Project 自己的既有原则文字支持"否"，
 *    见「九、Q4」两条互相矛盾的证据。这是本次审计里唯一一条明确
 *    建议"先单独开一次 Review"的项目，不是普通的 Pending Decision。
 * 2. [Decision Type: Semantic] Task↔Project 双向转换时 due_datetime
 *    的具体字段映射规则——需要先完整审查 42_ConversionEngine.gs
 *    （本次未纳入范围，见「九、Q10」）才能给出具体建议，不是本次
 *    能回答的。
 * 3. [Decision Type: Migration] 需要 Architecture Owner 在真实 GAS
 *    环境查证「九、Q10」列出的三个具体问题，才能把 Migration Plan
 *    从"风险等级评估"变成有真实数字支撑的执行清单。
 * 4. [Decision Type: UX] Add/Edit Project 表单具体怎么呈现日期输入
 *    （见「九、Q6」），不阻塞 1-3，可以在正式实现阶段再定。
 *
 * 这四项里，1 是最优先、且明确需要独立走一次 Review 流程的一项——
 * 2-3 可以跟 1 并行推进（互不依赖），4 完全不阻塞前三项。
 */

// ------------------------------------------------------------
// 十一、Recommended Next Step
// ------------------------------------------------------------

/**
 * 本次审计的建议：不要直接进入 Implementation，也不要把「十、1」
 * （Identity Impact）当成一个可以顺手在 Project schema 实现任务里
 * 一并解决的小问题。按 Architecture Owner 自己定的四段状态
 * （Proposed → Audited → Decision Ready → Implementation），当前
 * 状态是 Schema Impact Audited，下一步有两条可以并行走、互不阻塞
 * 的路：
 *
 *   (a) 单独开一次「Project Deadline — Identity Impact Review」，
 *       只回答「十、1」这一个问题：Project 的 due_date/due_time
 *       该不该计入 identity，附带把 Task 当初这么选的真实原因
 *       （如果能找到 07_IdentityEngine.gs 或 Review #3 之外更早的
 *       设计文档说明）挖得更清楚，而不是像这次一样只能推测。
 *   (b) 独立于 (a)，Architecture Owner 自己在真实 GAS 环境查证
 *       「十、3」列出的三个 Migration 相关问题（Project 行数、有没有
 *       手写日期模式、有没有已经被塞进 description 的 deadline
 *       用法）。
 *
 * 两条都完成之后，Decision Ready 阶段才算真正满足条件，届时再决定
 * 是否正式批准 Model C 进入 Implementation——本次到此为止，不自动
 * 往下走。
 */

// ============================================================
// 十二、Project Deadline — Identity Impact Review（2026-08-29）
// ============================================================

/**
 * 只回答一个问题：Project 的 deadline（due_date/due_time/due_datetime）
 * 是否属于 Project Identity / IDENTITY_AFFECTING_FIELDS？不是 schema
 * implementation，不是 UI implementation。
 *
 * 边界确认：本次未修改任何 production code / Project schema /
 * updateProject / UI / Reminder Connector / Reminder OS / Execution OS，
 * 未跑 migration，未改动任何现有 identity function 一行代码。
 *
 * 方法论声明：以下全部核实直接重新读当前源码，不引用「八、Review #4」
 * 或「九、Schema Impact Audit」当时对这个问题的旧结论——凡是跟之前
 * 写过的结论冲突的地方，以这次重新核实的为准，并明确指出冲突。
 */

// ------------------------------------------------------------
// 1. 现有事实核实
// ------------------------------------------------------------

/**
 * 1.1 Project identity 生成（07_IdentityEngine.gs:191
 *     generateProjectIdentity）：
 *
 *     parts = [chat_id, normalizeTitle(title), parent_project_id]
 *     identity = sha256(parts.join('|'))
 *
 *     函数自带的原文注释（不是本次审查转述，是逐字引用）：
 *     "不把 status/execution_mode 纳入 identity——这些是会随时间自然
 *     变化的字段（跟 Task 的 due_date/priority/category 属于'定义这个
 *     对象是什么'不同，Project 的身份不应该因为它从 DRAFT 变成
 *     IN_PROGRESS 就被判定成'另一个不同的 Project'）。parent_project_id
 *     纳入 identity 是为了允许'同名 Sub-Project 挂在不同父 Project 下'
 *     这种合理场景不被误判重复。"
 *
 *     这段原文本身就包含了一句直接相关、但容易被忽略的表述：把 Task
 *     的 due_date 明确归类为"定义这个对象是什么"的一部分——这条本身
 *     就是「4」要展开的核心矛盾的源头，不是本次审查凭空发现的，是
 *     代码自己写在注释里的。
 *
 * 1.2 IDENTITY_AFFECTING_FIELDS（27_ProjectEngine.gs:55）：
 *     ['title', 'parent_project_id']——跟 1.1 的两个哈希输入字段
 *     完全对应，没有第三个字段。
 *
 * 1.3 createProject（27_ProjectEngine.gs:80，薄封装）→
 *     09_IdempotencyManager.gs:134 createProjectIfNotExists(title,
 *     meta, chatId)：
 *
 *     identity = IdentityEngine.generateProjectIdentity(chatId, title,
 *                meta.parent_project_id || '')
 *     existing = DeduplicationEngine.findExistingProject(identity)
 *     若 existing 存在 → 直接返回它，created: false（幂等短路）
 *     否则 → ProjectEngine.createProjectDirect_() 真正建新行
 *
 * 1.4 updateProject（27_ProjectEngine.gs:153，本次逐字重新读，完整
 *     引用关键段）：
 *
 *       var identityFieldChanged = CFG.IDENTITY_AFFECTING_FIELDS.some(
 *         function (f) { return payload.hasOwnProperty(f); }
 *       );
 *       if (identityFieldChanged) {
 *         var newIdentity = IdentityEngine.generateProjectIdentity(
 *           merged.chat_id || chatId || existing.chat_id,
 *           merged.title,
 *           merged.parent_project_id || ''
 *         );
 *         payload.identity = newIdentity;
 *         merged.identity   = newIdentity;
 *       }
 *
 *     【精确澄清一个容易读错的细节】这个判断只看
 *     "payload.hasOwnProperty(f)"（这次请求有没有传这个字段），不比较
 *     新旧值是否真的不同——哪怕把 title 改成完全相同的字符串，只要
 *     title 出现在 changes 里，identityFieldChanged 就是 true，
 *     identity 照样重算（重算结果因为输入没变，数值上会跟原来相同，
 *     但"重算"这个动作本身发生了）。
 *
 *     【最关键的机制性事实】这段代码只会更新【同一行】的 identity
 *     列的值（project_id 全程不变，PROJECT_UPDATED 事件的 payload.
 *     project_id 就是传入的 projectId，没有任何创建新行的路径）。
 *     也就是说，identity 重算这件事本身，从"这一行是不是还是同一个
 *     project_id"的角度看，【永远不会】把一次 update 变成"新建了一个
 *     Project"——见「3」Scenario 1/3 的精确结论。
 *
 * 1.5 DeduplicationEngine.findExistingProject（08_DeduplicationEngine.gs）：
 *
 *       function findExistingProject(identity) {
 *         var row = _findRowByIdentity_(PROJECTS_SHEET, identity);
 *         if (!row) return null;
 *         if (PROJECT_NON_TERMINAL.indexOf(String(row.status||'')
 *             .toUpperCase()) === -1) return null;
 *         return row;
 *       }
 *
 *     两个条件都要满足：identity 精确匹配 AND 状态属于非终态
 *     （PROJECT_NON_TERMINAL = ['DRAFT','READY','IN_PROGRESS','WAITING',
 *     'BLOCKED']，08_DeduplicationEngine.gs:47）。终态 Project
 *     （COMPLETED/ARCHIVED/CANCELLED/CONVERTED_TO_TASK）即使 identity
 *     命中也不会被当成"已存在"——这条对「5」的幂等风险分析是关键前提。
 *
 * 1.6 Migration/rebuild：本次审查未找到独立于
 *     11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs（这是
 *     Task 侧 Track 1B 的迁移脚本）之外、专门针对 Project identity
 *     的 rebuild 脚本——若 Project 需要一次性重算存量数据的 identity，
 *     目前没有现成脚本可以直接复用，需要新写（这条本身是「6」Migration
 *     Impact 的一个具体输入，不是本次要现在解决的事）。
 *
 * 1.7 【重新核实 Task，不引用旧 Review 结论】20_TaskEngine.gs:81：
 *
 *       IDENTITY_AFFECTING_FIELDS: ['title', 'due_date', 'due_time',
 *         'recurring', 'priority', 'category']
 *
 *     但真正喂进 07_IdentityEngine.generateTaskIdentity() 的 due 相关
 *     参数，不是直接读 task.due_date——是经过
 *     IdentityEngine.resolveIdentityDueValue(meta)（07_IdentityEngine.gs）：
 *
 *       function resolveIdentityDueValue(task) {
 *         return _canonicalizeDueValue_(
 *           (task && task.due_datetime) || (task && task.due_date) || ''
 *         );
 *       }
 *
 *     也就是说，实际参与哈希计算的是"due_datetime 优先、否则退回
 *     due_date"这一个值，不是 due_date 和 due_time 各自单独喂一份——
 *     due_time 本身从来没有作为独立参数传给
 *     generateTaskIdentity()（函数签名是 chatId, title, dueDate,
 *     repeatRule, priority, category, scopeKey，只有一个 due 位）。
 *
 *     那 due_time 为什么还出现在 IDENTITY_AFFECTING_FIELDS 里？因为
 *     这份清单回答的是"哪些外部可写字段的变化，应该触发 identity
 *     重算"——due_time 单独变化时，虽然不直接进哈希，但它会导致
 *     due_datetime 被重新计算（due_date+due_time 组合出新的
 *     due_datetime），而新的 due_datetime 才是真正喂进哈希的值——
 *     所以 due_time 间接影响 identity，被放进这份"触发重算"清单里
 *     是正确的，不是列表本身有 bug。due_datetime 本身則不出现在
 *     这份清单里——本文件「八、Review #4」1533-1538 行此前的表述
 *     （"IDENTITY_AFFECTING_FIELDS 里没有任何 due_date/due_time 类
 *     字段参与身份判定"）已经在「九、Q4」更正过一次，这次重新核实，
 *     结论不变：due_date/due_time 确实参与（间接或直接），只有
 *     due_datetime 本身被明确排除，原因是本文件「七」Review #3 原文
 *     注释："due_datetime 是派生值，不需要、也不应该出现在这个'外部
 *     传入触发重算'的清单里"——不允许通过 updateTask 直接改
 *     due_datetime 本身（20_TaskEngine.js 的 UPDATABLE_FIELDS 不包含
 *     它），它永远是从 due_date/due_time 派生出来的，所以不需要单独
 *     出现在"外部输入触发重算"这份清单里。
 *
 *     recurring 参与 identity：让"同一个标题、同一天但一次性 vs.
 *     每周重复"被当成两个不同定义的 Task，不互相合并（跟
 *     generateWorkflowIdentity 纳入 workflow_type 是同一类"定义不同
 *     就不该去重"的推理，07_IdentityEngine.gs 原文注释）。
 *
 *     priority/category 参与 identity：07_IdentityEngine.gs 原文
 *     没有单独解释这两个字段为什么参与，本次审查没有找到比"跟
 *     title/due_date 一起构成'这是什么任务'的定义"更具体的书面理由——
 *     如实记录这一点找不到比这更精确的原始设计动机，不编一个听起来
 *     合理但没有代码/文档依据的解释。
 */

// ------------------------------------------------------------
// 2. 三个概念的区分
// ------------------------------------------------------------

/**
 * A. Entity Identity——"这是同一个 Project，还是另一个 Project？"——
 *    由 IDENTITY_AFFECTING_FIELDS 决定，回答的是"创建时是否应该被
 *    去重"和"更新时 identity 列要不要重算"，不直接等同于"这一行
 *    数据是不是同一行"（project_id 才是那个问题的答案，见「1.4」）。
 *
 * B. Business/Organizational State（如 priority、description、
 *    execution_mode、dependencies）——影响业务行为、影响 UI 展示、
 *    甚至可能影响 Reminder 的具体调度参数，但【不】自动等于 identity
 *    的一部分。当前 Project 的 execution_mode/description/
 *    depends_on_project_ids 都在这一类，明确不参与 identity
 *    （27_ProjectEngine.gs:55 注释原文）。priority 对 Task 而言是个
 *    反例——它属于 B 类"影响业务行为"的字段，但 Task 选择让它也参与
 *    identity（1.7），说明"影响业务行为"和"参与 identity"两件事在
 *    这个代码库里不是自动画等号，也不是自动不画等号——是具体到每个
 *    字段、每个实体类型分别判断的，不能套用统一公式。
 *
 * C. Scheduling/Deadline State（due_date/due_time/due_datetime）——
 *    这是本次 Review 要判断"归 A 还是归 B"的对象本身。Task 的既有
 *    先例把它归进了 A（1.7）；Project 现在的 IDENTITY_AFFECTING_FIELDS
 *    完全不包含任何时间类字段，因为 Project 目前根本没有这类字段——
 *    这不构成"Project 已经决定 C 类归 B"的证据，只是"这个问题在
 *    Project 身上还没被问过"，是这次 Review 第一次正式问。
 *
 * 不能因为一个字段影响业务行为就自动归 A，也不能因为它"只是时间"就
 * 自动归 B——Task 的 due_date 精确地反驳了后一种直觉。
 */

// ------------------------------------------------------------
// 3. 用四个场景测试 identity 语义（按机制精确推演，不是直觉判断）
// ------------------------------------------------------------

/**
 * Scenario 1："装修厨房" deadline 2026-09-01 → 2026-10-01（对已存在的
 * project_id 调用 updateProject，不是重新走 createProjectIfNotExists）：
 *
 *   不管 due_date 是否加入 IDENTITY_AFFECTING_FIELDS，这在【行】的
 *   层面永远是 A："同一个 Project 的 deadline 被修改"——project_id
 *   全程不变，1.4 已经用源码逐字确认 updateProject 没有任何创建新行
 *   的路径。唯一的区别是：如果 due_date 加入了 identity，这次更新会
 *   连带把该行的 identity 列换成一个新哈希值（数据本身没有变多一行，
 *   只是"这行的指纹变了"）——这个指纹变化本身不是问题，问题在于它
 *   会不会引出「5」讨论的下游副作用（旧指纹被"空出来"）。
 *
 * Scenario 2：两个"报税" Project，deadline 分别是 2026-04-30 和
 *   2026-05-31（这必须是两次独立的 createProjectIfNotExists 调用，
 *   不是对同一行的 update，因为 update 需要已知的 project_id，题目
 *   描述的是"两个 Project"这个既成状态）：
 *
 *   若 deadline 不参与 identity（Model A）：两次调用算出的 identity
 *   完全相同（chat_id/title/parent_project_id 都一样）。
 *   findExistingProject 会在第二次调用时找到第一次创建的那个 Project
 *   ——前提是它还处于非终态（1.5）。如果是，第二次调用会被当成
 *   幂等重复请求，直接返回第一个已有的 Project，created: false——
 *   【实际效果是系统会把这两个不同报税周期的 Project 错误合并成一个】，
 *   不会真的出现"两个 Project deadline 不同"这个题目描述的最终状态，
 *   除非第一个已经先转成终态。这是 Model A 的一个具体、可复现的
 *   失败模式，不是理论担忧。
 *
 *   若 due_date 参与 identity（Model B/C）：两次调用算出不同的
 *   identity，findExistingProject 两次都找不到匹配，两个 Project
 *   都会被正确创建为独立实体——题目描述的"两个不同 Project"这个
 *   结果，只有在 due_date 参与 identity 时才会自然发生；Model A 下
 *   要达到同样效果，必须要求调用方额外提供某个人工区分字段（比如
 *   在 title 里手动写年份），不是 identity 机制本身能保证的。
 *
 * Scenario 3："买洗衣机"没有 deadline，后来补上 2026-09-15（对已知
 *   project_id 调用 updateProject，changes 里首次出现 due_date）：
 *
 *   跟 Scenario 1 同一个机制：project_id 不变，仍然是"同一个 Project
 *   的一次 ordinary update"。如果 due_date 参与 identity，
 *   payload.hasOwnProperty('due_date') 为 true，会触发一次 identity
 *   重算（1.4 已确认这个判断不关心"新值是不是从空变成非空"还是
 *   "非空变成另一个非空"，两种情况处理方式相同）。不存在"neither"
 *   这个选项——一旦 due_date 加入 IDENTITY_AFFECTING_FIELDS，任何
 *   一次把 due_date 放进 changes 的更新都会触发重算，这是当前代码
 *   机制的确定性行为，不是看情况。
 *
 * Scenario 4："搬家" deadline 从 "2026-09-01 18:00" 改成
 *   "2026-09-01 20:00"——必须拆开 due_date/due_time/due_datetime
 *   分别讨论：
 *
 *   due_date：值仍然是 "2026-09-01"，如果这次 update 的 changes 里
 *   只发送了变化的部分（只有 due_time），不会重新发送一个跟原值相同
 *   的 due_date——那么即使 due_date 在 IDENTITY_AFFECTING_FIELDS 里，
 *   payload.hasOwnProperty('due_date') 也是 false，不触发重算。
 *
 *   due_time：值从 "18:00" 变成 "20:00"，如果 due_time 本身也在
 *   IDENTITY_AFFECTING_FIELDS 里（沿用 Task 现有清单的做法），
 *   payload.hasOwnProperty('due_time') 为 true，会触发重算——即使
 *   日历日期完全没变。
 *
 *   due_datetime：跟随 due_date/due_time 的组合从
 *   "2026-09-01T18:00:00" 变成 "2026-09-01T20:00:00"，但 due_datetime
 *   本身不该、也不会作为独立字段出现在 IDENTITY_AFFECTING_FIELDS
 *   里（沿用 Task 的既有设计原因：它是派生值，见「1.7」）——它的
 *   变化只是 due_date/due_time 变化的结果，不是触发重算的独立原因。
 *
 *   这个场景暴露的关键设计问题是：如果 Project 选 Model B（只有
 *   due_date 参与 identity，due_time 不参与）——Scenario 4 这种"日期
 *   不变、只改时间"的更新完全不会触发 identity 重算，即使实际的
 *   到期时刻真的变了；如果选 Model C（due_date + due_time 都参与）
 *   ——会触发重算。这不是对错问题，是「7」两个候选模型各自明确要
 *   接受的行为差异，「8」的 Recommendation 需要对这一点给出明确
 *   立场，不能回避。
 */

// ------------------------------------------------------------
// 4. Task 与 Project 为什么可能不同——不能直接照抄 Task 的设计
// ------------------------------------------------------------

/**
 * 「1.1」已经引用了 generateProjectIdentity 自己的原文注释——这段
 * 注释本身承认 Task 的 due_date 被归为"定义这个对象是什么"，用它
 * 来对比说明 Project 的 status/execution_mode 不该有同样待遇。这
 * 意味着代码作者当初已经隐含考虑过"Task 的 due_date 算 identity"
 * 这件事，只是没有明确回答"Project 的 due_date（当时还不存在这个
 * 字段）算不算"——这是一个悬而未决的问题，不是一个已经被默认否决
 * 的问题，这一点很重要：不能把"Project 现在的 IDENTITY_AFFECTING_
 * FIELDS 里没有 due_date"解读成"设计者已经决定 Project 的 due_date
 * 不该算identity"——正确的解读是"这个字段当时根本不存在，这个问题
 * 从未被正式问过"。
 *
 * 支持"Task 的 deadline 可以属于 identity，Project 不必"（沿用现有
 * IDENTITY_AFFECTING_FIELDS 原则文字）的论点：
 *   - Project 的 identity 原则明确是"描述'这个 Project 跟谁关联/
 *     怎么组织'才不算，'这个 Project 本身是什么'才算"——deadline
 *     更接近"什么时候该完成"这个调度属性，不是"这件事本身是什么"。
 *   - Project 通常是单一、持续存在、允许被重新排期的事务（Review #4
 *     「1.1」"喂流浪猫计划"这类例子），"改一下目标完成日期"更接近
 *     "同一件事重新规划时间表"，不是"变成了另一件事"。
 *
 * 支持"Project deadline 也应该属于 identity"的论点（不是简单复制
 * Task，是独立从 Project 自己的场景推出来的）：
 *   - Scenario 2（报税）证明了这一点：deadline 在这类"标题会重复、
 *     但代表不同实例"的 Project 场景里，起到了 Task 的 recurring/
 *     workflow_type 类似的"区分不同定义、避免误判去重"作用——这跟
 *     generateWorkflowIdentity 纳入 workflow_type 的推理（"两个不同
 *     的编排定义，不应该共享同一个去重 identity"）、
 *     generateProjectIdentity 纳入 parent_project_id 的推理（"同名
 *     Sub-Project 挂在不同父级下不该被误判重复"）本质上是同一类
 *     "存在合理的同名不同实例场景，需要用这个字段区分"论证，不是
 *     从 Task 那边硬搬过来的。
 *   - 不是所有 Project 都像"喂流浪猫计划"那样是持续性事务——"报税"
 *     "交房租""续签合同"这类明确带周期性质的 Project，deadline 本身
 *     很可能就是区分"这是哪一次"的关键信息，跟 Task 层面
 *     recurring 字段起的作用高度相似。
 *
 * 两条论点都站得住，且都直接从 Project 自己的实际使用场景（不是从
 * Task 抄过来的）推导出来——这正是本次 Review 存在的意义：证据本身
 * 指向两个方向，需要 Architecture Owner 做一个真正的产品判断，不是
 * 靠更多代码审查就能自动收敛到唯一答案。
 */

// ------------------------------------------------------------
// 5. Idempotency 风险分析
// ------------------------------------------------------------

/**
 * 【核心风险，机制层面已经精确定位，不是猜测】如果 due_date（或
 * due_date+due_time）加入 Project 的 IDENTITY_AFFECTING_FIELDS：
 *
 *   Project A：title=X, due_date=Sep 1（非终态）
 *   → updateProject 把 due_date 改成 Sep 2
 *   → identity 从 hash(X, Sep1, parent) 变成 hash(X, Sep2, parent)
 *   → Project A 这一行本身：project_id 不变，仍然是同一行（1.4 已
 *     确认，不会被系统理解成"新 Project"）。
 *
 *   但是：如果这时候有另一个独立请求，用同样的 title=X（比如用户的
 *   聊天客户端因为网络问题重发了"创建报税 due Sep 1"这条原始消息，
 *   或者某个 recurring 场景意外用旧的 due_date 重新触发了创建），
 *   走的是 createProjectIfNotExists → generateProjectIdentity(chatId,
 *   X, parent) → 算出 hash(X, Sep1, parent)——这个哈希现在【找不到】
 *   匹配的非终态行（因为原来那一行的 identity 已经变成 Sep2 版本了）
 *   ——findExistingProject 返回 null，系统会当成"这是一个新请求"，
 *   真的创建一条新的 Project 行，造成【意外的重复 Project】。
 *
 *   这条风险的触发条件很具体：(a) due_date 加入了 identity，(b)
 *   Project 的 deadline 之后被合法地改过一次，(c) 之后出现一个携带
 *   "旧 deadline"的重复/重试请求。不是"任何时候都会重复"，是"改过
 *   deadline 之后，旧版本的请求重放会绕过去重"。
 *
 *   如果 due_date 不加入 identity：这条风险完全不存在——Scenario 1
 *   改 deadline 不会动 identity 列，任何时候用同样 title+parent 重放
 *   请求都会命中同一行，正常触发幂等短路。这是「7」Model A 相对
 *   Model B/C 的一个具体、机制层面确认过的安全性优势，不是笼统的
 *   "更简单所以更安全"。
 *
 *   Projection/rebuild 层面：materializeProjectRow_ 用
 *   upsertRowByKey_(PROJECTS_SHEET, 'project_id', ...)——按
 *   project_id 定位行，不按 identity——所以 identity 值本身变化，
 *   不会导致 Projection 写错行或者产生额外行，这条已经通过「九、Q5」
 *   核实过，这次重新确认结论不变。
 */

// ------------------------------------------------------------
// 6. Migration Impact
// ------------------------------------------------------------

/**
 * 若最终决定 deadline NOT identity（Model A）：
 *   - Migration 只是「九、四」已经写过的"新增三个可空列，不强制
 *     回填"——不涉及任何 identity 相关改动，存量 Project 的 identity
 *     值完全不受影响，风险最低。
 *
 * 若最终决定 deadline IS identity（Model B 或 C）：
 *   - 存量 Project：现有 identity 是按【不含 deadline】的公式算出来
 *     的（当时这个字段还不存在），新公式加入 deadline 后，同一个
 *     Project 若不重算，identity 列的值会跟"如果从今天用新公式重新
 *     创建"算出来的值不一致——这本身不是错误状态（旧行的 identity
 *     依然是它创建那一刻的正确值），但如果之后 findExistingProject
 *     用新公式给一个新请求算 identity，可能因为存量行还是"旧公式
 *     值"而找不到匹配，造成存量 Project 被意外当成"不存在"而重复
 *     创建——这条风险类似「5」，但触发条件是"新旧公式切换"而不是
 *     "deadline 被改过"。
 *   - 是否需要重算存量 identity：需要，如果想避免上一条风险——但
 *     「1.6」已经确认目前没有现成的 Project identity rebuild 脚本，
 *     需要新写一个（可以参考 Task 侧 Track 1B 的
 *     11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs 思路，但
 *     不能直接照搬，那份脚本是为 Task 的具体字段设计的）。
 *   - old identity 是否保留：建议保留完整变更历史（沿用这个项目
 *     "只增不删，历史有用"的既有惯例，具体怎么记录——比如要不要在
 *     ReminderHistory 同款位置记一条"identity 变更日志"——属于正式
 *     实现阶段的设计细节，本次不预先定稿）。
 *   - Idempotency 是否可能改变：会，「5」已经详细展开。
 *   - Rebuild 是否受影响：受影响，需要新脚本（见上）。
 *
 * 无法访问真实数据，不猜数字——需要 Carson 在真实环境确认：
 *   - 现有 LIFE_PROJECTS 有多少行处于非终态（这部分是「5」风险的
 *     实际暴露面，行数越多，一次性重算的工作量和验证成本越高）。
 *   - 有没有已知的、真实发生过的"同名 Project 被意外去重"或者
 *     "同名 Project 被要求区分但做不到"的用户反馈/使用场景——这是
 *     判断 Scenario 2 那类风险是否只是理论场景、还是已经真实发生过
 *     的关键证据，本次审查完全无法在没有真实使用记录的情况下回答。
 */

// ------------------------------------------------------------
// 7. 三个候选模型
// ------------------------------------------------------------

/**
 * Model A — Deadline 完全不属于 Project Identity。
 *   IDENTITY_AFFECTING_FIELDS 保持 ['title', 'parent_project_id']
 *   不变，新增的 due_date/due_time/due_datetime 三个字段全部只是
 *   UPDATABLE_FIELDS 里的普通业务字段。
 *
 * Model B — 只有 due_date 属于 identity，due_time/due_datetime 不属于。
 *   IDENTITY_AFFECTING_FIELDS 变成 ['title', 'parent_project_id',
 *   'due_date']。Scenario 4 的分析适用：同一天内改时间不触发重算。
 *
 * Model C — due_date + due_time 完整都属于 identity（due_datetime
 *   本身依然不直接参与，理由同 Task，「1.7」）。
 *   IDENTITY_AFFECTING_FIELDS 变成 ['title', 'parent_project_id',
 *   'due_date', 'due_time']——逐字复用 Task 现有清单里跟 due 相关的
 *   两项，只是换了实体。
 *
 * 本次审查没有找到支持"还有第四种模型"的具体代码证据（比如"只有
 * due_time 参与、due_date 不参与"这种组合，在 Task 或其它现有实体
 * 里都找不到对应先例，也想不出有说服力的业务理由），三个模型已经
 * 覆盖了这次证据能支持的完整选项空间。
 */

// ------------------------------------------------------------
// 8. Recommendation
// ------------------------------------------------------------

/**
 * 推荐 Model B（只有 due_date 属于 identity，due_time/due_datetime
 * 不属于）。
 *
 * 逐项对应 A-E：
 *
 *   A. Domain semantics —— Scenario 2（报税）证明"哪一天到期"往往
 *      就是区分"这是哪一次"的关键业务信息，这条支持"deadline 需要
 *      参与 identity"，而不是完全归入 Model A。但 Scenario 4 同时
 *      说明"同一天内几点到期"通常不构成"这是不是同一件事"的判断
 *      依据（"下午6点搬家"和"下午8点搬家"，业务上几乎总是同一次
 *      搬家计划，只是估计的完成时刻不同），这条排除 Model C。两条
 *      合起来精确指向 Model B。
 *
 *   B. Existing Project identity contract —— 27_ProjectEngine.gs:55
 *      的原则是"定义这个对象是什么"才算——"哪一天"比"哪一天的几点"
 *      更接近对一件事的定义性描述（对照日常语言："报税 4月30日到期"
 *      是在描述这件事本身；"报税下午5点到期"里的"下午5点"通常只是
 *      执行细节），这跟 A 的结论互相印证，不是巧合。
 *
 *   C. Task identity precedent —— Task 把 due_date 和 due_time 都
 *      纳入了 identity（「1.7」，这是本次重新核实过、比之前的记录
 *      更精确的结论）。Model B 没有完全照抄这个先例——这不是疏漏，
 *      是「4」已经论证过的：Task 的"同名不同 due_time"经常代表真的
 *      是不同的任务实例（比如同一天安排了两次不同时段的提醒），
 *      Project 的典型使用场景里，这种"同一天内需要精确到小时区分
 *      两个不同 Project"的真实需求目前没有找到具体证据支持，属于
 *      "不能确定 Task 的理由在 Project 身上同样成立"，所以只借用
 *      Task 对 due_date 的处理，不借用对 due_time 的处理。
 *
 *   D. Idempotency/migration impact —— Model B 比 Model C 涉及的
 *      identity-affecting 字段少一个，「5」「6」两节分析的风险面
 *      （重算范围、rebuild 工作量、意外重复创建的触发条件）都相应
 *      更小，在 A/B 两条业务论证已经支持"不需要 due_time 参与"的
 *      前提下，没有理由为了"跟 Task 保持字面一致"去主动多承担这
 *      部分本可以避免的风险。
 *
 *   E. Future consumers（Reminder/Execution/UI）—— Reminder OS
 *      侧只按 entity_id 读 Personal Life OS 的权威行（「九、Q8」已
 *      确认），不依赖、也不关心 Project 的 identity 值本身；
 *      Execution OS 的 Reference 同样只按 entity_id（「九、Q7」），
 *      identity 是 Personal Life OS 内部的去重机制，不是任何下游
 *      消费方依赖的契约的一部分——这条结论上对 A/B/C 三个模型的
 *      选择是中性的，Reminder/Execution 不会因为选哪个模型而受到
 *      直接影响，所以这一项没有把 Recommendation 推向任何一个特定
 *      方向，如实记录"这项是中性的"，不是每一项都必须支持推荐结论
 *      才算完整。
 *
 * 明确的 Trade-offs（选 Model B 放弃了什么，不只写好处）：
 *   - 放弃了跟 Task 完全一致的 due_time-level 去重能力——如果未来
 *     真的出现"同一天需要按小时区分不同 Project"的真实场景，Model B
 *     无法处理，需要重新评审（见 Falsifiability）。
 *   - 相对 Model A，多承担了「5」「6」描述的那部分 identity 重算/
 *     migration 复杂度和"deadline 改过之后旧请求重放可能造成重复"
 *     的风险——只是比 Model C 少，不是零。
 *   - Scenario 4 揭示的"改时间不触发重算"这条行为，如果未来有人
 *     直觉上认为"到期时刻变了，identity 应该跟着变"，会觉得 Model B
 *     不符合直觉——这是选择 Model B 需要能够对外解释清楚的一个
 *     具体的、非直觉的行为，不是隐藏的缺陷，但需要被清楚地
 *     记录下来，不能等实现完了才有人发现。
 *
 * Falsifiability / Reopening Condition（可以被未来验证的具体条件）：
 *   - 生产中真实观察到"同一天内需要按小时区分不同 Project、但
 *     Model B 把它们错误合并成一个"的具体案例（不是理论推演）。
 *   - 有下游 Domain OS（Calendar/Execution/Property 等）明确需要
 *     依赖 Project identity 精确到 due_time 级别才能正常工作
 *     （目前「E」的结论是中性的，如果未来变得不中性，需要重新评审）。
 *   - Project 的数据规模/使用模式变化到"同名同日期不同时间的 Project
 *     开始大量出现"这个程度（本次没有真实数据，无法判断这个阈值
 *     是多少，只能定性描述这个条件本身）。
 *   - Migration/Idempotency 在真实实现之后，实际观测到「5」「6」
 *     描述的风险确实发生过至少一次，且发生频率高到需要重新考虑
 *     模型选择本身，而不只是加固实现细节。
 *
 * Implementation Consistency（明确声明）：
 *   如果 Model B 获批，正式实现禁止通过任何 implementation shortcut
 *   把 due_time 或 due_datetime 偷偷加进 Project 的
 *   IDENTITY_AFFECTING_FIELDS 或 identity 哈希输入——只有 due_date
 *   可以出现在这两个地方。若实现过程中发现 Model B 不够用，必须
 *   回到这份 Review 走一次正式的重新评审（对照 Falsifiability），
 *   不能在写代码的时候临时"顺手"多加一个字段。Written architecture
 *   （本文档）与 shipped code 必须逐字一致，这条本身也是「三」
 *   Implementation Impact Map 未来验收时需要专门核对的一项。
 */

// ------------------------------------------------------------
// 9. 与 Dashboard Ownership precedent 对照
// ------------------------------------------------------------

/**
 * 不重新发明 ownership principle，直接引用已有原则："ownership 由
 * 它展示的数据本身决定，不由哪个界面渲染它决定"（00_ADR.gs 对应
 * 条目，Review #4「1.8(a)」已经引用过一次）。
 *
 * 这条原则本身是回答"谁该拥有这份数据"的，「Identity」问题
 * ——"这份数据的哪一部分该参与去重判断"——是一个不同维度的问题，
 * 两者不能直接划等号，但可以用同一个判断方法：Project deadline
 * （如果存在）代表的是"Project 的 scheduling state"（这次「二、2.1」
 * Q1 已经确认它是可选的调度属性，不是 Project 存在的必要条件）——
 * 按 ownership 原则，scheduling state 由 Personal Life OS 拥有
 * （「九、7.1」已确认），这条结论不因为「本次 Identity Review」的
 * 结论是 A/B/C 哪一个而改变——Ownership 问题和 Identity 问题在这里
 * 是两个独立轴：无论 deadline 算不算 identity 的一部分，它始终是
 * Personal Life OS 拥有的数据，Reminder OS/Execution OS 只消费，
 * 不拥有，也不参与决定它该不该进 Project 的 identity 哈希——那是
 * Personal Life OS 自己内部的去重机制设计，不是一个需要跨 OS 协调
 * 的决定。
 */

// ------------------------------------------------------------
// 十三、Summary
// ------------------------------------------------------------

/**
 * 【原始需求文档在"10."这一条处被截断，本次审查只能处理 1-9 完整
 * 呈现的部分，如实说明，没有猜测第10条可能是什么】
 *
 * Stage: Identity Impact Review 完成（本文档），推荐 Model B，
 * 附完整 Trade-offs/Falsifiability/Implementation Consistency 声明。
 * 未获批准前，Decision Ready 阶段仍未达成——「九、十」列出的 Open
 * Decision #1（正是这次要解决的问题）现在有了一个有证据支撑的
 * 推荐答案，但仍然是推荐，不是决定，需要 Architecture Owner 明确
 * 批准（或改判 Model A/C）才算真正解决。
 *
 * 批准后建议的下一步（本次不自动执行）：把「8」的最终决定连同
 * 「九、Q2」的 Model C schema 决定一起，写进一份正式 ADR
 * （Personal-Life-main 自己的 00_ADR.gs 序列，不是 Reminder OS 的
 * 00_ADR_00X 序列），再进入 Decision Ready → Implementation。
 */
