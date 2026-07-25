/**
 * 00_ADR.gs
 * Personal Life OS v5.1（Design Phase）— Architecture Decision Records
 *
 * Changelog: v5.0 → v5.1（2026-07-24，综合两轮独立外部评审后）——
 * ADR-007 由 Proposed 转 Accepted；ADR-008 由 Proposed 转 Accepted
 * （内容因两轮评审的不同意见做了合并式重写，不是简单二选一）；ADR-006
 * 由 Accepted 转 Superseded（被 ADR-015 取代）；新增 ADR-010 至
 * ADR-015 共六条。ADR-001~005、009 内容不变，不重复收录理由——完整
 * 内容见 v5.0 存档或直接读本文件对应条目（本次只在有变化的条目上
 * 标注 v5.1）。
 */

// ============================================================
// ADR-2026-07-24-001：Personal Life OS 是 Productivity OS 的演进
//                      （V2），不是全新项目
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-001
 * Status          : Accepted（v5.1 不变）
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 全部（项目级决定）
 * Related ADR      : (none)
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。
 */

// ============================================================
// ADR-2026-07-24-002：Execution 永远不拥有 Business Data
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-002
 * Status          : Accepted（v5.1 不变，被 ADR-012 进一步细化，
 *                   不冲突）
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 全部 Domain Engine
 * Related ADR      : ADR-2026-07-24-012（v5.1 新增，细化本条的
 *                   落地机制）
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。
 */

// ============================================================
// ADR-2026-07-24-003：沿用既有 Sheet 表名，不改名为 LIFE_TASKS
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-003
 * Status          : Accepted（v5.1 不变）
 * Decision Date   : 2026-07-24
 * Related ADR      : ADR-2026-07-24-001
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。
 */

// ============================================================
// ADR-2026-07-24-004：Timeline 是 Projection，不是第二个 Write Model
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-004
 * Status          : Accepted（v5.1 不变）
 * Decision Date   : 2026-07-24
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。entity_type 枚举
 * v5.1 追加 WORKFLOW_TEMPLATE，见 00_Sheets_Structure.gs「五」，不
 * 影响本 ADR 的核心决定。
 */

// ============================================================
// ADR-2026-07-24-005：BusinessRule 与 Workflow 级 Recurring 是两种
//                      不同机制
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-005
 * Status          : Accepted（v5.1 不变，两轮评审都明确认可这条区分，
 *                   其中一轮评审原话"这个反而觉得 Claude 做得很好"）
 * Decision Date   : 2026-07-24
 * Related ADR      : ADR-2026-07-24-011（v5.1 新增，BusinessRule
 *                   内部拆成三层，不影响本条跟 Workflow Recurring
 *                   的区分）
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。
 */

// ============================================================
// ADR-2026-07-24-006：Task→Project 转换单向
//                      【v5.1：Status 改为 Superseded】
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-006
 * Status          : Superseded
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : ADR-2026-07-24-015
 * Affected Modules: 20_TaskEngine.gs, 27_ProjectEngine.gs,
 *                   42_ConversionEngine.gs
 *
 * Context
 *   原决定：v5.0 只实现 Task→Project 单向转换，Metadata Standard 新增
 *   created_method='Converted'。
 *
 * 为什么被取代
 *   两轮独立外部评审中的一轮明确指出，"Project 后来发现其实只是一个
 *   动作"这个场景同样常见，且保留 History 的机制（Metadata 血缘 +
 *   Timeline 记录）已经就绪，反方向只是复用同一套机制、新增对称的
 *   前置校验，边际成本低、收益明确，不属于投机性扩展。完整的新决定
 *   见 ADR-2026-07-24-015。
 *
 * Notes
 *   created_method='Converted' 这个枚举值本身不受影响，双向转换
 *   都使用它，只是"哪个方向"现在需要额外看 source_task_id 还是
 *   source_project_id 哪个字段有值来判断。
 */

// ============================================================
// ADR-2026-07-24-007：Dashboard Ownership 由数据决定，不由名称决定
// 【v5.1：Status 改为 Accepted】
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-007
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 25_DashboardEngine.gs
 * Related ADR      : ADR-2026-07-24-002, Productivity OS
 *                   ADR-2026-07-06
 *
 * Context
 *   v5.0 发现既有 25_DashboardEngine.gs（本 Domain 范围的仪表盘）跟
 *   新 Boundary 规则"Dashboard 不能拥有"字面冲突，提出建议但标记
 *   Proposed 等待确认。两轮独立外部评审都认可这个方向，并且都提出了
 *   比 v5.0 更精确的判断标准表述。
 *
 * Decision
 *   Dashboard 的 Ownership 由它展示的数据决定，不由"Dashboard"这个
 *   名称决定：
 *     Domain Dashboard（允许，属于各 Domain 自己）——只展示单一
 *     Domain 自己的数据。例如 Personal Life OS 的"今日 Routine/本周
 *     完成率"（既有 25_DashboardEngine.gs）、未来 Property OS 的
 *     "本月维修费/保修剩余天数"、Investment OS 的"今日盈亏/持仓分布"。
 *     Execution Dashboard（Life Execution OS 专属）——展示聚合多个
 *     Domain 的数据。例如"Today：Property 2 Tasks / Investment
 *     1 Task / Personal Life 3 Tasks"、"Goal Progress/Blocked/
 *     Waiting"这类只有跨 Domain 才有意义的统计口径。
 *   可操作的判断方法：这份 Dashboard 只需要读本 Domain 自己的表就能
 *   拼出来 → Domain Dashboard；需要跨读至少一个其它 Domain 的数据
 *   才能拼出来 → Execution Dashboard，本项目不实现。
 *   既有 25_DashboardEngine.gs 按此标准属于 Domain Dashboard，继续
 *   保留，不删除、不迁移、Telegram 指令行为不变。
 *
 * Consequences
 *   正面：不破坏既有功能；判断标准可操作、可被未来所有 Domain OS
 *   直接复用，不需要每个新 Domain 都重新讨论一遍"我这个算不算
 *   Dashboard"。
 *   需要接受的代价：Boundary 文档需要保留这段辨析文字（见
 *   00_Domain_Boundary.gs「四」），对不熟悉这段历史的未来读者需要
 *   格外说明。
 *
 * Notes
 *   两轮评审的表述略有不同（一轮说"Business Dashboard 属于
 *   Domain；Cross-Domain Dashboard 属于 Life Execution"，另一轮说
 *   "Dashboard 的 Ownership 由展示的数据决定，而不是由 Dashboard
 *   这个名称决定"）——本 ADR 采用后者作为正式表述，因为它把判断
 *   标准讲成一个可操作的规则（"看数据来源"），而不只是重新给两类
 *   Dashboard 起名字；前者的分类结果被完整保留、两者不冲突。
 */

// ============================================================
// ADR-2026-07-24-008：Branch Workflow 未选分支的处理——
// Branch Resolution Policy + NOT_SELECTED 状态
// 【v5.1：Status 改为 Accepted，内容重写】
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-008
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 28_WorkflowEngine.gs, 20_TaskEngine.gs
 * Related ADR      : (none)
 *
 * Context
 *   v5.0 提出"未选分支自动 Cancel"作为唯一固定行为，标记 Proposed。
 *   两轮独立外部评审都不同意固定成单一行为，但给出的替代方案不完全
 *   相同：一轮建议增加 Branch Resolution Policy（每个 Branch 自己
 *   选择 AUTO_CANCEL/KEEP_OPEN/RETURN_TO_QUEUE/WAITING/MANUAL 五种
 *   策略之一），并给出三个真实场景（Developer 维修/买股票/等回复）
 *   说明为什么不能只有一种固定行为；另一轮建议不要用 CANCELLED，
 *   而是新增一个语义更准确的 NOT_SELECTED 状态，理由是 CANCELLED
 *   意味着"本该执行、后来取消"，但未选分支"从一开始就没有执行资格"，
 *   两种语义不同，对未来 Audit 的可解释性有实质影响。
 *
 * Decision
 *   采纳两轮评审的合并方案，两者并不冲突，可以同时满足：
 *     (a) 新增 branch_resolution_policy 字段（配置在每个
 *         branch_group 上），支持 AUTO / KEEP_OPEN /
 *         RETURN_TO_QUEUE / WAITING / MANUAL 五种取值，具体行为见
 *         00_Business_Rules.gs「七」（含三个场景怎么对应到具体
 *         policy 的完整说明）
 *     (b) 五种取值里唯一涉及"让未选分支进入某种终态"的是 AUTO，其
 *         结果状态采用 NOT_SELECTED（不是 CANCELLED），语义上明确
 *         "这条路径从一开始就没有被选中执行的资格"，与"本该执行、
 *         后来主动取消"的 CANCELLED 区分开
 *   默认值为 MANUAL（不显式配置就什么都不自动做）。
 *
 * Consequences
 *   正面：既保留了"不同场景需要不同处理方式"的灵活性（评审 A 的
 *   诉求），又保证了状态语义的准确性、便于未来 Audit（评审 B 的
 *   诉求）；两个诉求实际上作用在两个不同层面（policy 是"要不要自动
 *   处理及怎么处理"，NOT_SELECTED 是"自动处理时具体写成什么状态"），
 *   合并方案不需要在两者之间取舍。
 *   需要接受的代价：Task 状态机比 v5.0 设想的更复杂一层（多一个
 *   NOT_SELECTED 终态 + 一个新字段），需要在实现阶段的状态转换图里
 *   明确画出 NOT_SELECTED 只能由 AUTO policy 产生，不能被用户手动
 *   设置（不开放 Public API 直接把某个 Task 设成 NOT_SELECTED，
 *   避免这个状态被滥用到"未选分支"以外的场景，稀释它的语义精确性）。
 */

// ============================================================
// ADR-2026-07-24-009：Priority 拆分为 priority_user + 
//                      priority_ai_recommended
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-009
 * Status          : Accepted（v5.1 不变）
 * Decision Date   : 2026-07-24
 *
 * Context/Decision/Consequences：内容不变，见 v5.0。
 */

// ============================================================
// ADR-2026-07-24-010：Business Rule / Workflow Template 必须 Versioning
//                      （v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-010
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 41_BusinessRuleEngine.gs
 * Related ADR      : ADR-2026-07-24-005, ADR-2026-07-24-011
 *
 * Context
 *   评审指出一个真实场景：某个流程模板（如"验屋"）会随时间演变，
 *   但已经实例化出去、正在跑或已经跑完的旧 Project/Workflow 不应该
 *   因为模板后来改了就被动跟着变——否则历史记录会跟"这个 Project
 *   当初实际用的是什么流程"对不上，Audit 时会非常混乱。
 *
 * Decision
 *   WorkflowTemplate 携带整数 version，同一个 BusinessRule 下版本号
 *   只递增不复用；每个 Workflow（Instance）创建时永久绑定具体的
 *   template_id（而不是绑定 BusinessRule 本身），这个绑定关系创建后
 *   不因模板后续升级而改变；已经 FROZEN 的版本内容永久不可再编辑。
 *
 * Consequences
 *   正面：任意时刻回看一个 Workflow Instance，都能准确知道它当初
 *   基于哪个具体版本的模板——Audit Trail 完整、不会因为模板演进
 *   而失真。
 *   需要接受的代价：实例化时调用方必须显式指定 templateId（不能只给
 *   BusinessRule 名字让系统自己猜"当前该用哪个版本"），多一步查询
 *   （getActiveTemplateForRule），换取"不会被系统偷偷决定用哪个
 *   版本"这条更重要的可控性。
 */

// ============================================================
// ADR-2026-07-24-011：BusinessRule 拆分为三层
//                      （Business Rule → Workflow Template →
//                      Workflow Instance）（v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-011
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 41_BusinessRuleEngine.gs,
 *                   19_BusinessRuleQueryEngine.gs
 * Related ADR      : ADR-2026-07-24-010
 *
 * Context
 *   v5.0 把"可复用流程模板"设计成单一一张表，一条记录同时承载"这是
 *   什么类别的规则"和"这个版本具体长什么样"两件事。Versioning 需求
 *   （ADR-010）出现后，单表设计没有清晰的地方安放"版本"这个概念——
 *   评审建议拆成三层，让"类别"和"版本"分别落在不同的表上，"运行中的
 *   实例"又是另外一回事。
 *
 * Decision
 *   BusinessRule（LIFE_BUSINESS_RULES，最顶层，只是具名类别+标签，
 *   如"验屋"）→ WorkflowTemplate（LIFE_WORKFLOW_TEMPLATES，具体版本，
 *   如"验屋 v1.0"）→ Workflow Instance（即既有 LIFE_WORKFLOWS 表，
 *   如"Property Est8 用的这次验屋"）。一个 BusinessRule 下可以有多个
 *   版本的 WorkflowTemplate；一个 WorkflowTemplate 可以被实例化出
 *   多个互不干扰的 Workflow Instance。完整实体关系见
 *   00_Entity_Relationship.gs「二」。
 *
 * Consequences
 *   正面：同一个模板可以被安全地重复使用 100 次而互不干扰（评审
 *   原话的例子）；"类别""版本""实例"三个概念不再挤在一张表里，各自
 *   的生命周期（类别几乎不变、版本偶尔演进、实例频繁产生）可以独立
 *   管理，不互相干扰对方的查询/统计。
 *   需要接受的代价：比 v5.0 的单表设计多一张表、多一层间接（capture
 *   一次可能同时产生一次 BusinessRule 创建 + 一次 WorkflowTemplate
 *   创建两个事件），实现阶段的 Query 逻辑需要多一次 join
 *   （BusinessRule→WorkflowTemplate）才能拿到完整信息；这个复杂度
 *   的增加被认为是值得的，因为它是 Versioning 需求（ADR-010）的
 *   直接后果，不是额外的投机设计。
 */

// ============================================================
// ADR-2026-07-24-012：Domain is Producer, Execution is Consumer——
//                      Reference Integrity（v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-012
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 全部（原则级决定）
 * Related ADR      : ADR-2026-07-24-002
 *
 * Context
 *   ADR-002 已经确立"Execution 永远不拥有 Business Data"，但没有
 *   规定 Execution 手上到底应该拿着什么、怎么保持同步。两轮外部评审
 *   都独立提出了这个缺口，其中一轮评审明确指出这是"整个 Personal
 *   AI Core 最值得长期坚持的架构原则之一"，并给出了具体的反面案例：
 *   如果 Execution 图方便直接复制一份 Domain 数据，Domain 那边状态
 *   变了、Execution 这份没跟着刷新，就会出现"Property 显示 Done，
 *   Execution 显示 Pending"这种两边不一致的情况。
 *
 * Decision
 *   正式确立原则：Domain 永远是 Producer——只负责产生 Business
 *   Event、Task、Project、Timeline，不主动推送、不关心 Execution
 *   怎么用；Execution 永远是 Consumer——只负责订阅这些 Event 来组织
 *   执行、规划目标、安排 Today、生成 Review，不拥有任何 Business
 *   State，也不修改 Domain State。机制上，Execution 一侧只允许保存
 *   Reference（ReferenceID/SourceOS/EntityType/EntityID/
 *   Snapshot(optional)/LastSyncTime），不允许复制 Domain Entity 的
 *   完整内容；任何刷新都必须经过"Domain 发布 Event → Execution 订阅
 *   刷新"这条唯一路径，不允许 Execution 直接改 Domain 的表。
 *
 * Consequences
 *   正面：从根本上排除"两边数据不一致"这类问题的可能性（不是靠约定
 *   避免，而是靠"Execution 压根不存副本"从结构上排除）；这条原则
 *   跟 Domain 数量无关——即使未来平台上有 20 个 Domain OS，Execution
 *   一侧的实现方式不需要因为 Domain 数量增加而重新设计。
 *   需要接受的代价：Execution 侧的实现会比"自己存一份完整数据"更
 *   复杂（每次展示都可能需要实时查询对应 Domain 的 QueryEngine，
 *   而不是简单读自己的一张表）；这个复杂度增加发生在 Execution 那个
 *   项目里，不影响本项目（Personal Life OS）本身的实现难度——本项目
 *   只需要老老实实遵守既有 Schema Authority 发布事件，不需要为了
 *   配合这条原则新增任何代码。
 *
 * Notes
 *   本条建议同时写入 UEF（跨全部 Domain OS 的平台级框架，其权威定义
 *   不在本项目），本文件只能在 Personal Life OS 自己的范围内正式
 *   采纳并遵守；若要让这条原则对其它 Domain OS 也具备强制力，需要
 *   由 Personal AI Core / UEF 的维护者另行确认并收录到 UEF 自己的
 *   文档里——本 ADR 不能替 UEF 做这个决定，只记录"本项目侧已经完全
 *   遵守这条原则"这一事实。
 */

// ============================================================
// ADR-2026-07-24-013：Metadata 新增 Decision Owner / Approval
//                      （v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-013
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 全部拥有 Metadata 字段的实体
 *                   （Task/Project/Workflow/Note/WorkflowTemplate/
 *                   BusinessRule）
 * Related ADR      : (none)
 *
 * Context
 *   既有 Metadata 九字段能回答"这条记录是谁建的、AI 建议来自哪里"，
 *   但回答不了"AI 建的这条，人有没有批准"。评审举的例子：Creator=
 *   Claude，Suggested By=Investment AI，如果没有一个字段记录"Carson
 *   批准了没有"，未来无法区分"这是 AI 自主决定的"还是"AI 建议、人
 *   确认过的"，这个区分对长期 Audit 很重要。
 *
 * Decision
 *   Metadata Standard 新增 decision_owner（谁有权批准）+
 *   approval_status（APPROVED/PENDING/REJECTED）两个字段，具体行为
 *   规则见 00_Business_Rules.gs「八」（含显式批准/隐式批准/拒绝
 *   三条路径）。
 *
 * Consequences
 *   正面：把"AI Suggests, Human Confirms"这条既有 Architecture
 *   Principle 从"行为准则"变成"数据结构里可查询、可审计的字段"，
 *   不再只依赖行为上的约定。
 *   需要接受的代价：既有四张表（Tasks/LIFE_PROJECTS/LIFE_WORKFLOWS/
 *   LIFE_NOTES）各新增两列，历史存量数据需要一次性回填默认值
 *   （approval_status 统一置为 'APPROVED'，见
 *   00_Sheets_Structure.gs「十」迁移说明）。
 */

// ============================================================
// ADR-2026-07-24-014：Personal Life OS 是 Canonical Reference
//                      Implementation（v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-014
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : (none)
 * Superseded By   : (none)
 * Affected Modules: 全部（治理级决定，约束的是未来其它 Domain OS，
 *                   不是本项目自己的代码）
 * Related ADR      : ADR-2026-07-24-001
 *
 * Context
 *   v5.0 的定位是"未来所有 Domain OS 的参考实现"——语气上是"建议
 *   参考"，没有强制力。评审指出这不够——如果未来 Property OS/
 *   Health OS 的 Task/Workflow/Timeline/Project/Reminder/Review
 *   行为可以随意跟本项目不一样，这个"参考实现"的价值会随时间被
 *   逐渐侵蚀，起不到"以后增加第 N 个 Domain OS 都不需要重构整个
 *   生态"的效果。
 *
 * Decision
 *   Personal Life OS 是所有 Domain OS 的 Canonical Reference
 *   Implementation。未来任何 Domain OS 的 Task/Workflow/Timeline/
 *   Project/Reminder/Review 行为如果要跟本项目已确立的模式不同，
 *   必须走 ADR（在那个 Domain OS 自己的治理文档里写明为什么要
 *   偏离、偏离的具体内容），不能未经记录直接改。
 *
 * Consequences
 *   正面：整个生态的核心行为模式保持统一，新增 Domain OS 的成本
 *   主要是"填入具体业务内容"，不需要重新设计基础能力；任何偏离都
 *   有据可查，不会出现"为什么 Property OS 的 Task 状态机跟 Personal
 *   Life OS 不一样，但没人知道原因"这种情况。
 *   需要接受的代价：这对未来所有 Domain OS 的设计者构成一条额外的
 *   治理约束——不能图方便就绕开 ADR 直接改，即使改动看起来很小；
 *   这是刻意接受的代价，用来换取生态层面的长期一致性。
 */

// ============================================================
// ADR-2026-07-24-015：Task↔Project 转换扩展为双向
//                      【取代 ADR-2026-07-24-006】（v5.1 新增）
// ============================================================

/**
 * ADR Number      : ADR-2026-07-24-015
 * Status          : Accepted
 * Decision Date   : 2026-07-24
 * Supersedes      : ADR-2026-07-24-006
 * Superseded By   : (none)
 * Affected Modules: 20_TaskEngine.gs, 27_ProjectEngine.gs,
 *                   42_ConversionEngine.gs
 * Related ADR      : ADR-2026-07-24-006
 *
 * Context
 *   ADR-006 把 V1 范围限定为 Task→Project 单向，理由是需求原文只
 *   提到这一个方向。评审指出反方向同样是真实场景——"Project 后来
 *   发现其实只是一个动作"——且保留 History 的机制（Metadata 血缘 +
 *   Timeline 记录 + CONVERTED 终态模式）已经在 ADR-006/
 *   Architecture Principle 11 里就绪，扩展到反方向只是复用同一套
 *   机制、新增对称的前置校验，不需要引入新的架构概念。
 *
 * Decision
 *   新增 Project→Task 方向。与 Task→Project 不同，这个方向有明确
 *   前置条件（源 Project 必须没有 Sub-Project、没有非终态子
 *   Task——即"确实只是空的/只是一件小事"才允许降级），不是任意
 *   Project 都能转换，完整规则见 00_Business_Rules.gs「一」。
 *
 * Consequences
 *   正面：Task↔Project 现在是完整的双向操作，覆盖"低估复杂度"（
 *   Task 长大变 Project）和"高估复杂度"（Project 发现其实很简单，
 *   降级变 Task）两种真实场景；Audit Trail 机制（Metadata 血缘 +
 *   Timeline）两个方向复用同一套，不需要维护两套不同的追溯逻辑。
 *   需要接受的代价：Project→Task 的前置条件比 Task→Project 严格得多
 *   （后者几乎没有限制，前者要求"结构上确实是空的"），两个方向在
 *   使用体验上不对称——这是刻意的不对称，不是实现疏漏：反方向如果
 *   不加限制，会出现"把一个还有 5 个未完成子任务的 Project 硬塞进
 *   一个 Task"这种明显丢失结构信息的操作，必须挡住。
 *
 * Notes
 *   ADR-006 的 Status 已更新为 Superseded，其原始 Context/Decision
 *   完整保留在该条目下，不删除、不覆写，供未来查阅"为什么最初只做
 *   了单向"这段历史。
 */
