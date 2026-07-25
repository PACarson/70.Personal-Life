/**
 * 00_Architecture.gs
 * Personal Life OS v5.1（Design Phase）— Architecture
 *
 * Changelog
 *   v5.0 → v5.1（2026-07-24，两轮外部评审后）：新增 Architecture
 *   Principle 12（Execution is Consumer, Domain is Producer，见
 *   00_ADR.gs ADR-2026-07-24-012）；P2 定位从"参考实现"升级为
 *   "Canonical Reference Implementation"（见
 *   00_ADR.gs ADR-2026-07-24-014）；ADR-007/008 由 Proposed 转
 *   Accepted；ADR-006 由 Accepted 转 Superseded（见
 *   00_ADR.gs ADR-2026-07-24-015）。完整变更清单见 README.md
 *   「v5.1 变更摘要」。
 *
 * 本文件对应需求「1. Architecture」。是整个 Personal Life OS 设计包
 * （00_Architecture / 00_Domain_Boundary / 00_Module_Responsibility /
 * 00_Data_Ownership / 00_Entity_Relationship / 00_Event_Flow /
 * 00_Sheets_Structure / 00_File_Map / 00_Business_Rules / 00_ADR，
 * 共10份，见 README.md 导读）里最先读的一份。
 *
 * 血缘关系（重要，决定了本文件"能不能重新定义平台级原则"）：
 *   Personal Life OS 不是一个全新项目，而是 Productivity OS（v4.9）的
 *   演进版本——同一个 Apps Script 项目、同一个 SPREADSHEET_ID、同一套
 *   Events 表、同一套 00_Project_Constitution.gs 已经确立的 Universal
 *   Domain OS Blueprint / Architecture Principles / Engine Contract
 *   Standard / Dependency Rules / Event Definition Standard。这是
 *   Carson 在本次设计会话最开始就定的原则："不要直接改 Productivity OS，
 *   而是把它当成 Personal Life OS V2 来演进，这样历史不会断掉，代码也
 *   更容易迁移。"
 *
 *   因此本文件不重新发明 Blueprint / Architecture Principles——那些的
 *   权威定义仍然在 00_Project_Constitution.gs（零 / 零之二 / 零之三 /
 *   零之四 / 零之五 / 零之六）。本文件只做两件事：(a) 原样引用已经冻结的
 *   平台级模板；(b) 记录 Personal Life OS 这个更大的 Domain 具体怎么套用
 *   这份模板——跟 00_Project_Constitution.gs 原本"这个 OS 具体怎么套用"
 *   的分工完全一致，只是范围从"Task 一个实体"扩大到"Project/Task/
 *   Workflow/Timeline/Note/Review/BusinessRule 七个实体"。
 *
 * 版本策略：Productivity OS 上一个版本是 v4.9（2026-07-17 Reminder Policy
 * Override）。本设计包是 v5.0，处于 Design Phase——只有文档，没有代码。
 * 待 Carson 确认本包内容后，v5.0 才会进入实现阶段，届时 00_Project_State.gs
 * 会新开一节记录实现进度，00_Project_Constitution.gs 本体也会把下面
 * 「三、P4 落地映射」并入其正式的 P4 小节（而不是本文件永久独立存在——
 * 见 README.md「本包的生命周期」）。
 */

// ============================================================
// 一、定位（Positioning）
// ============================================================

/**
 * P1. 这是什么
 *
 *   Personal Life OS 是「Personal AI Core」平台下第一个 Domain OS，
 *   管理用户个人生活领域的完整执行留痕：Project 的创建/推进/归档、
 *   Task 的创建/更新/完成/取消/父子/依赖/续期、Workflow 的编排、
 *   Timeline 的完整历史、Note 的暂存与转化、Review 的定期回顾、
 *   BusinessRule（可复用流程模板）的沉淀与复用。
 *
 *   跟 Productivity OS 的关系：不是"新建一个项目去调用 Productivity OS"，
 *   而是 Productivity OS 本身升级、改名、扩大范围。Productivity OS 现有的
 *   Task 全生命周期能力（9个 Engine、CQRS 读写分层、Idempotency/Identity/
 *   Dedup 基础设施）原样保留，作为 Personal Life OS 的 Task 子域，Project/
 *   Workflow/Timeline/Note/Review/BusinessRule 是在这个既有基础上新增的
 *   六个子域。
 *
 * P2. 为什么现在做（Carson 原话，记录留档）
 *
 *   "这个 OS 很可能会成为未来所有 Domain OS 的参考实现"——Property OS/
 *   Procurement OS/Inventory OS/Health OS/Content OS 以后都会对照这份
 *   Blueprint 落地映射来设计自己的 P4，而不必每个 Domain OS 重新发明
 *   Project/Task/Workflow/Timeline 这类几乎所有 Domain 都需要的基础能力。
 *   这是本设计包被要求"企业级/高扩展性/长期维护 10 年以上"的直接原因——
 *   这里的任何草率决定，都会被后续 Domain OS 照抄放大。
 *
 *   v5.1 更新：经两轮外部评审确认，这条定位从"参考实现"（其它 Domain
 *   OS 可以参考、也可以不参考）正式升级为 Canonical Reference
 *   Implementation——其它 Domain OS 的 Task/Workflow/Timeline/Project/
 *   Reminder/Review 行为如果要跟本文件不同，必须走 ADR，不能直接改。
 *   完整决定见 00_ADR.gs ADR-2026-07-24-014。
 *
 * P3. 部署形态（继承 Productivity OS，不变）
 *
 *   独立 Apps Script 项目，以 Library 形式被 Personal AI Core 引入
 *   （Identifier 待实现阶段确认是否沿用 "ProductivityOS" 或改名
 *   "PersonalLifeOS"——这是一处需要 Carson 决定的命名延续性问题，
 *   见 00_ADR.gs ADR-2026-07-24-001 的 Consequences 段落）。不接
 *   Telegram webhook，被 Core 的 04_Main.gs 调用。Library 依赖方向
 *   单向：Core → Personal Life OS，本项目不依赖、不调用 Core 或任何
 *   兄弟 Domain OS（Property OS 等）的代码。
 *
 * P4. 数据边界（继承并扩大）
 *
 *   跟 Personal AI Core / Reminder OS 共享同一个 Google Spreadsheet
 *   （SPREADSHEET_ID 三边一致）。本项目拥有的表见 00_Sheets_Structure.gs
 *   完整清单；简述：既有 Tasks/ActiveTasks/ArchiveTasks/TaskStatistics/
 *   TaskFilters 五张表继续归本项目所有并扩展字段，新增 LIFE_PROJECTS/
 *   LIFE_WORKFLOWS/LIFE_TIMELINE/LIFE_NOTES/LIFE_REVIEWS/
 *   LIFE_BUSINESS_RULES 六张表。共享 Events 表仍是唯一事实来源，本项目
 *   新增一批 LIFE_ 前缀之外、按 Blueprint Event Definition Standard
 *   记录在 00_Event_Flow.gs 的事件类型。
 *
 * P5. 跟 Life Execution OS 的关系（最重要的一条边界，独立成
 *     00_Domain_Boundary.gs 详细展开，这里只提示存在这条线）
 *
 *   Personal Life OS 是 Domain，不是 Coordinator。Vision/Goal/
 *   Execution Project/Today View/Weekly View/Dashboard（跨 Domain 聚合
 *   版本）属于 Life Execution OS，本项目绝对不实现。铁律：
 *   "Execution 永远不拥有 Business Data。"
 */

// ============================================================
// 二、Universal Domain OS Blueprint（沿用零之六最终结构，不重新定义）
// ============================================================

/**
 * 以下模板逐字引用自 00_Project_Constitution.gs「零之六、Universal
 * Domain OS Blueprint 最终结构（V4.3 升级）」——这是平台级冻结模板，
 * 本文件只引用，不修改。修改这份模板本身需要在 Personal AI Core 项目
 * 走正式的 ADR 流程，不能由某一个 Domain OS 单方面改动（否则以后每个
 * Domain OS 参照的模板都不一样，参考实现就失去意义）。
 *
 * Universal Domain OS Blueprint（最终结构）
 *
 * Architecture
 * ├── Governance
 * ├── Foundation
 * ├── Runtime
 * ├── Domain
 * ├── Intelligence
 * ├── Integration
 * ├── Operations
 * └── Testing
 *
 *   Runtime  = 请求的生命周期本身（一次调用经过哪些阶段）
 *   Domain   = 业务能力（这些阶段具体调用的是哪些 Engine，这些 Engine
 *              承载什么业务规则）
 *   Operations = 维护系统本身（Migration/Backup/Repair/Diagnostics/
 *              Health Check/Monitoring/Rebuild/Recovery），不是响应
 *              一次用户请求。
 */

// ============================================================
// 三、Personal Life OS 在 Blueprint 的落地映射（P4，本文件核心内容）
// ============================================================

/**
 * 0. Governance
 *
 *    沿用 Productivity OS 既有的 8 份治理文件（Project Constitution /
 *    Project State / ADR / File Map / Command Reference / Known
 *    Limitations / Roadmap / Architecture Review），实现阶段启动后
 *    本设计包的 10 份文件会按内容并入这 8 份里对应的文件，而不是
 *    永久作为第 9 套并行的治理文件独立存在（见 README.md）。
 *
 * 1. Foundation
 *
 *    Configuration        → 01_SecureConfig.gs（不变）+ 20_TaskEngine.gs
 *                           的 ProductivityConfig 扩展新增
 *                           PROJECT_STATUSES / WORKFLOW_TYPES /
 *                           NOTE_CATEGORIES / REVIEW_TYPES 等枚举
 *                           （具体值见 00_Business_Rules.gs）
 *    Schema               → 15_Setup.gs 扩展（新增六张表的建表定义），
 *                           权威来源规则见 00_Sheets_Structure.gs 开头的
 *                           Schema Authority 延伸条款
 *    Identity             → 07_IdentityEngine.gs 新增
 *                           generateProjectIdentity() /
 *                           generateWorkflowIdentity() /
 *                           generateNoteIdentity() /
 *                           generateBusinessRuleIdentity()，全部沿用
 *                           既有 generateTaskIdentity() 的纯函数确定性
 *                           哈希设计，不引入新算法
 *    Event Definitions    → 02_EventBus.gs 文件头新增事件类型清单，
 *                           完整规格见 00_Event_Flow.gs
 *    Permissions          → 00_Data_Ownership.gs（本设计包新文件，
 *                           取代零散写法，实现阶段并入 00_File_Map.gs
 *                           「架构铁律」小节）
 *    Versioning           → 本文件头 + 各新文件头版本号
 *
 * 2. Runtime（Domain Pattern，对每一类 Request 都适用同一条生命周期）
 *
 *    Request              → 06_TaskIntentParser.gs 扩展新增意图
 *                           （PROJECT_CREATE / NOTE_CREATE / REVIEW_*
 *                           等，具体指令见 00_Business_Rules.gs）
 *    Planner              → 同文件内解析（识别意图 + 抽取参数，不落盘）
 *    Decision             → 22_PriorityEngine.gs（沿用，扩展为同时支持
 *                           Task 和 Project 两级优先级建议）+
 *                           41_BusinessRuleEngine.gs 的
 *                           suggestMatchingRules()（为"遇到类似情况"
 *                           推荐可复用模板，只建议不执行）
 *    User Confirmation    → 同 Productivity OS，Telegram 文字/按钮确认
 *    Execution            → 各新 Domain Engine（27/28/29/40/41/42/43，
 *                           见 00_File_Map.gs）
 *    Event                → 02_EventBus.gs（不变，唯一写入口）
 *    Projection           → 10_ProjectionEngine.gs 扩展 + 11_
 *                           ProjectionRebuilder.gs 扩展
 *    Query                → 新增 14/16/17/18/19/44 五个 QueryEngine，
 *                           每个实体一个，延续 12_TaskQueryEngine.gs
 *                           "所有查询必须经过唯一 QueryEngine" 的铁律，
 *                           只是铁律的"唯一入口"从一个扩大到按实体分别
 *                           唯一（见 00_Domain_Boundary.gs 对这条延伸的
 *                           正式论证）
 *
 * 2.5 Domain（业务能力层，Runtime 各阶段具体调用谁）
 *
 *    TaskEngine           → 20_TaskEngine.gs（扩展：project_id/
 *                           workflow_id/parent_task_id/
 *                           depends_on_task_ids/waiting 状态/双轨
 *                           Priority，见 00_Module_Responsibility.gs）
 *    Recurring            → 21_RecurringEngine.gs（Task 级日历续期，
 *                           不变）
 *    ProjectEngine        → 27_ProjectEngine.gs（新增）
 *    WorkflowEngine       → 28_WorkflowEngine.gs（新增，含 Workflow 级
 *                           Recurring，复用 21_RecurringEngine.gs 的
 *                           日期计算但独立实现"续期"本身，见
 *                           00_ADR.gs ADR-2026-07-24-005）
 *    NoteEngine           → 29_NoteEngine.gs（新增，原 Inbox Engine 改名）
 *    ReviewEngine         → 40_ReviewEngine.gs（新增）
 *    BusinessRuleEngine   → 41_BusinessRuleEngine.gs（新增，两个新功能
 *                           之一：capture / instantiate / match）
 *    ConversionEngine     → 42_ConversionEngine.gs（新增，两个新功能
 *                           之一：Task→Project 转换的通用编排逻辑，
 *                           同时服务 Note→Task/Project 既有需求）
 *    ReminderConnector    → 43_ReminderConnector.gs（新增，publish-only）
 *    Priority             → 22_PriorityEngine.gs（扩展为双轨）
 *    Search               → 23_SearchEngine.gs（不变，仍只服务 Task
 *                           全文搜索，见 00_Domain_Boundary.gs 的范围说明）
 *    View                 → 24_ViewEngine.gs（不变）
 *    Dashboard            → 25_DashboardEngine.gs（保留为 Domain-local
 *                           能力，见 00_ADR.gs ADR-2026-07-24-007——
 *                           这是本次设计对既有代码与新 Boundary 规则的
 *                           一处冲突提出的建议解法，需要 Carson 确认）
 *    Analytics            → 26_AnalyticsEngine.gs（不变）
 *
 * 3. Intelligence
 *
 *    Knowledge            → LIFE_BUSINESS_RULES（BusinessRule 本身就是
 *                           一种需要维护的参考数据——"以前怎么做过"）
 *    Analytics             → 26_AnalyticsEngine.gs（沿用，Task 范围不变，
 *                           Project 级统计留待有具体需求时再评估，见
 *                           00_Business_Rules.gs「暂不做」清单）
 *    Prediction             →（暂无，同 Productivity OS 现状）
 *    Suggestions            → 22_PriorityEngine.gs（双轨建议）+
 *                           41_BusinessRuleEngine.suggestMatchingRules()
 *                           （"遇到类似情况"的匹配建议，V1 只做标签/
 *                           关键词匹配，不做语义相似度，见
 *                           00_Business_Rules.gs 的范围声明）
 *    Insights                →（暂无）
 *    Learning                →（暂无；BusinessRule 的 usage_count 字段
 *                           为未来"哪些模板被验证有效"这类学习能力预留
 *                           数据基础，但本版本不实现任何学习逻辑，纯粹
 *                           是计数器，见 00_Sheets_Structure.gs）
 *
 * 4. Integration
 *
 *    Bridge                  → 跟 Life Execution OS 的关系：本项目不
 *                           主动调用 Execution，只被动发布 Events 供
 *                           Execution 订阅（Execution → 本项目 单向
 *                           Reference 读取，见 00_Domain_Boundary.gs）
 *    Connectors              → 43_ReminderConnector.gs（对 Reminder OS）
 *    APIs                    →（暂无，本项目对外只有 Library 导出函数）
 *    Import / Export          →（暂无）
 *    External Systems          →（暂无）
 *
 * 4.5 Operations
 *
 *    Migration               → 11_ProjectionRebuilder.gs 新增
 *                           migrateSchemaPersonalLifeOS()（一次性新增
 *                           六张新表 + 给 Tasks 表新增列，幂等，见
 *                           00_Sheets_Structure.gs 的迁移章节）
 *    Repair / Diagnostics     → 15_Setup.gs 扩展 runDiagnostics()
 *                           覆盖新表存在性检查
 *    Rebuild                  → 11_ProjectionRebuilder.gs 新增
 *                           rebuildProjectsProjection() /
 *                           rebuildWorkflowsProjection() /
 *                           rebuildTimelineProjection() /
 *                           rebuildNotesProjection() /
 *                           rebuildReviewsProjection() /
 *                           rebuildBusinessRulesProjection()，跟既有
 *                           四个 rebuild 函数一起纳入
 *                           rebuildAllProjections()
 *
 * 5. Testing
 *
 *    沿用 Productivity OS 的测试组织方式（各 Engine 文件内 test* 函数 +
 *    15_Setup.runDiagnostics()），实现阶段落地，本设计包不涉及。
 */

// ============================================================
// 四、Architecture Principles（继承 + 两条新增）
// ============================================================

/**
 * 00_Project_Constitution.gs 的十条 Architecture Principles 全部原样
 * 适用于 Personal Life OS 的六个新子域，不重复抄录（Single Source of
 * Truth / Pure Function First / Event is Fact / Read Models are
 * Disposable / Decision Never Executes / Views Never Persist / Single
 * Responsibility / Dependency Direction / AI Suggests Human Confirms /
 * Everything Rebuildable）。新增一条，专门针对本次扩大到多实体、且
 * 引入"实体互相转换"（Task↔Project、Note↔Task/Project）之后才出现的
 * 新风险：
 *
 * ── 11. Conversion Preserves Lineage（转换必须保留血缘）──────────────────
 * WHY：一旦一个实体可以"变成"另一个实体（Task 转 Project、Note 转
 *      Task/Project），如果转换发生时不留痕迹，Timeline 会出现断层——
 *      使用者会看到一个 Project 凭空出现，却不知道它其实是某个 Task
 *      长大了变成的，历史的连续性（Carson 本次设计最开始就强调的
 *      "这样历史不会断掉"）会被破坏。
 * WHAT：任何转换操作必须同时满足三件事——(a) 源实体状态变为 CONVERTED
 *      （终态，不与 DONE/CANCELLED 混淆）；(b) 目标实体的 Metadata 记录
 *      Source Task ID / Source Note ID 等血缘字段；(c) 发布一个明确的
 *      转换类事件（TASK_CONVERTED_TO_PROJECT / NOTE_CONVERTED），
 *      使 Timeline 能完整还原"A 变成了 B"这件事本身。
 * HOW：42_ConversionEngine.gs 是唯一允许执行转换的模块（不允许
 *      27_ProjectEngine.gs 或 20_TaskEngine.gs 各自实现一遍转换逻辑，
 *      避免两处判断标准不一致），完整规则见 00_Business_Rules.gs。
 *
 * ── 12. Execution is Consumer, Domain is Producer（v5.1 新增，两轮
 *      外部评审后确认，完整 ADR 见 00_ADR.gs ADR-2026-07-24-012）───────
 * WHY：ADR-2026-07-24-002（Execution 永远不拥有 Business Data）说的是
 *      "不能拥有"，但没有说清楚"那 Execution 手上到底应该拿着什么、
 *      怎么保持跟 Domain 同步"——评审明确指出，如果这条不讲清楚，
 *      Execution 的实现者迟早会为了方便，在自己表里"抄一份"Domain
 *      数据，然后 Domain 那边状态变了、Execution 这份没同步，出现
 *      "Property 那边显示 Done，Execution 这边还显示 Pending"这种
 *      两边不一致的灾难。
 * WHAT：Domain（本项目）永远是 Producer——只负责产生 Business Event、
 *      Task、Project、Timeline，不主动往 Execution 推送、不关心
 *      Execution 怎么用。Execution 永远是 Consumer——只负责订阅这些
 *      Event 来组织执行、规划目标、安排 Today、生成 Review，不拥有任何
 *      Business State，也不修改 Domain State。Execution 一侧只允许保存
 *      Reference（ReferenceID/SourceOS/EntityType/EntityID/
 *      Snapshot(optional)/LastSyncTime），不允许复制 Domain Entity 的
 *      完整内容；任何刷新都必须经过"Domain 发布 Event → Execution 订阅
 *      刷新"这条唯一路径，不允许 Execution 直接改 Domain 的表。
 * HOW：本项目这一侧的落实很简单——只要严格遵守既有 Schema Authority
 *      （每张表只有一个写入方）和 Event Ownership Matrix，就已经在
 *      扮演好 Producer 角色，不需要新增任何代码；Consumer 一侧的落实
 *      属于 Life Execution OS 自己的职责范围，本文件只记录这条契约，
 *      不能替 Execution 实现它。
 */

// ============================================================
// 五、Core Process Flows（CQRS 写入链路 + Runtime Domain Pattern，扩展）
// ============================================================

/**
 * 流程 A：CQRS 写入链路，跟 Productivity OS 完全同构，只是从一条 Task
 * 链路扩展成七条并行链路，全部共享同一个 Events 表（Single Source of
 * Truth 不因为实体变多而改变）：
 *
 *   Events（唯一 Write Model，只追加）
 *     ↓ Projection（10_ProjectionEngine.gs dispatch，按 event.type 路由）
 *   Tasks / LIFE_PROJECTS / LIFE_WORKFLOWS / LIFE_NOTES / LIFE_REVIEWS /
 *   LIFE_BUSINESS_RULES（各自的全量 Read Model）
 *     ↓（仅 Task 有）Archive Engine
 *   ActiveTasks / ArchiveTasks
 *
 *   LIFE_TIMELINE 是一条特殊的并行投影——它不对应"某一个实体自己的状态"，
 *   而是跨全部七个实体的统一历史流水账，由 ProjectionEngine 在处理任何
 *   一个 LIFE_ 前缀或 TASK_ 前缀事件时都顺带追加一行（详见
 *   00_Event_Flow.gs「Timeline 投影规则」），完整论证见
 *   00_ADR.gs ADR-2026-07-24-004。
 *
 * 流程 B：Runtime Domain Pattern，同构于 Productivity OS 既有流程，
 * 完整版本 + Cross-Domain 示例见 00_Event_Flow.gs。
 */

// ============================================================
// 六、UEF Self-Check（对照 02_Review_Checklist_Library.md，设计阶段自查）
// ============================================================

/**
 * UEF（Universal Engineering Framework）的权威定义不在本项目，本节只是
 * 在正式提交给 Carson 审阅前，先对照 UEF 的共享 Checklist Library
 * （A1-D3）做一次设计阶段自查，避免明显能在写代码前发现的问题留到
 * 实现后才被 Architecture Review 抓到：
 *
 *   A1 Separation of Concerns  — 七个实体各自的 Engine 只做一件事
 *      （create/update/status transition），Query 单独拆分，Conversion
 *      单独拆成一个不属于任何单一实体的编排层——通过。
 *   A2 Dependency Direction    — 新模块全部遵守既有 Presentation→
 *      Application→Domain→Infrastructure 四层方向，唯一的跨层例外
 *      （Domain→Application）沿用 21_RecurringEngine.gs 已经记录在案的
 *      同一条例外模式（见 00_File_Map.gs）——通过。
 *   A3 Layering                — 每个新文件在 00_File_Map.gs 的
 *      Architecture Layer Map 里恰好出现一次——通过（见该文件）。
 *   A5 Event Flow              — 每个新事件类型都有 00_Event_Flow.gs
 *      里唯一、可查的定义——通过。
 *   B1 Extensibility           — Workflow 的 Loop 类型、BusinessRule 的
 *      语义相似度匹配，两处本设计包刻意只留占位、不做完整实现，因为
 *      Carson 没有给出具体近期场景（对照 B1 第三条"不能是投机性泛化"）——
 *      已在 00_Business_Rules.gs / 00_Module_Responsibility.gs 里明确
 *      标注为 Known Limitation，等待具体场景出现再设计，不是遗漏。
 *   D1 Governance              — 本设计包引入的每一处不是"显而易见"的
 *      判断（Dashboard 归属冲突、Sheet 是否改名、Branch 自动取消规则）
 *      都单独开了 ADR 条目，两条标记 Proposed 等待 Carson 确认，不是
 *      只在文件头论证一遍就当作已经决定——见 00_ADR.gs。
 *   D2 YAGNI                   — 没有为 Property OS/Rider OS 等尚不存在
 *      的兄弟 Domain 预先设计任何专属字段或钩子；本设计包的可复用性
 *      来自"跟 Domain 无关的通用结构"（Project/Task/Workflow/Timeline
 *      本身），不是靠猜兄弟 Domain 需要什么提前加参数。
 *
 * 未完全自查的维度（B2 Scalability / B4 Performance / C1 Testing 等）
 * 需要看到实际实现或真实数据量才能有意义地评估，设计阶段无法提前判断，
 * 列为实现阶段 Architecture Review 的既定动作，不在本设计包范围内。
 */
