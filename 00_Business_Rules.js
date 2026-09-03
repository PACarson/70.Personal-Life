/**
 * 00_Business_Rules.gs
 * Personal Life OS v5.3（Design Phase — Architecture Freeze）—
 * Business Rules
 *
 * Changelog: v5.2 → v5.3（2026-09-02，UI V2 Capability Gap Review 之后）
 * ——新增「十一」Conversion No-Silent-Loss Principle（跨全部 Conversion
 * 的通用原则）；「一」Task→Project 补充这条原则的具体落地规则（完整
 * ADR 见 00_ADR.gs ADR-2026-09-02-028）。这一版只记录决定本身，
 * BLOCKED 判断的实际代码尚未实现（Implementation Plan Slice 4，
 * 还没开始）——见该 ADR 的 Status。
 *
 * Changelog: v5.1 → v5.2——新增「十」Task 状态到 Canonical Lifecycle
 * 的完整映射表（ADR-017）。
 *
 * Changelog: v5.0 → v5.1（两轮外部评审后）——「一」新增 Project→Task
 * 反方向规则；「三」因三层模型重写；新增「七」Branch Resolution
 * Policy 完整规则（取代 v5.0 固定的 Auto-Cancel）；新增「八」
 * Decision Owner / Approval 规则。
 *
 * 本文件对应需求「9. Business Rules」，也是需求原文"可能要做一个
 * business rule 文件"的落地位置。两个用法在本文件里都出现（本文件
 * 本身 vs. BusinessRule 实体），见文件末尾「九」的辨析。
 */

// ============================================================
// 一、Task↔Project 双向转换规则（v5.1：新增 Project→Task 反方向）
// ============================================================

/**
 * Task → Project（v5.0 已有，规则不变）：
 *
 *   字段映射：Task.title → Project.title；Task.description/notes →
 *   Project.description；新 Project 的 source_task_id = 源 task_id，
 *   created_method = 'Converted'，creator/suggested_by/source_domain
 *   继承源 Task。
 *
 *   幂等：同一个 task_id 已是 CONVERTED 状态时，重复调用直接返回既有
 *   converted_to_project_id，不重复创建。
 *
 *   前置校验：只有非终态 Task（PENDING/BLOCKED/WAITING）允许转换。
 *
 *   失败恢复：先创建目标 Project，再标记源 Task 为 CONVERTED，最后
 *   发布事件——"先做不可逆的加法，再做收尾"。
 *
 * Project → Task（v5.1 新增，完整 ADR 见
 * 00_ADR.gs ADR-2026-07-24-015）：
 *
 *   前置校验（由 27_ProjectEngine.checkEligibleForTaskDemotion_
 *   执行，两个条件同时满足才允许）：
 *     (a) 没有其它 Project 的 parent_project_id 指向本 Project
 *         （无 Sub-Project）
 *     (b) 本 Project 名下的 Task，全部已是终态（COMPLETED/CANCELLED/
 *         CONVERTED/NOT_SELECTED 均算终态），或者压根没有任何 Task
 *   任一条件不满足，拒绝转换，返回明确原因（"还有 N 个 Sub-Project
 *   未处理"或"还有 N 个未完成的 Task"），不是笼统报错——这是"事后
 *   发现其实只是一件小事"这个使用场景的直接反映：如果 Project 底下
 *   还有实质性的未完成结构，说明它不是"只是一件小事"，不应该被降级，
 *   而应该先把结构本身处理完。
 *
 *   字段映射：Project.title → Task.title；Project.description →
 *   Task.notes；新 Task.project_id = 源 Project.parent_project_id
 *   （若源 Project 是顶层 Project，则为空——新 Task"接替"源 Project
 *   在其父级结构中的位置，完整论证见
 *   00_Entity_Relationship.gs「三」）；新 Task.source_project_id = 源
 *   project_id；created_method = 'Converted'。
 *
 *   幂等：同一个 project_id 已是 CONVERTED_TO_TASK 状态时，重复调用
 *   直接返回既有 converted_to_task_id。
 *
 *   失败恢复：跟 Task→Project 同一套"先创建不可逆产物、再收尾"策略——
 *   先创建目标 Task，再标记源 Project 为 CONVERTED_TO_TASK，最后
 *   发布 PROJECT_CONVERTED_TO_TASK。
 *
 * 两个方向都不做"转换链"特殊优化（见
 * 00_Entity_Relationship.gs「四」）——一个 Task 转成 Project 后，
 * 理论上还能再被转回 Task，每次都是独立、对称的操作，血缘通过
 * Timeline 完整可查。
 *
 * 【v5.3 新增，2026-09-02，见「十一」No-Silent-Loss Principle、
 * ADR-2026-09-02-028】Task→Project 现状：源 Task 的 due_date/due_time/
 * due_datetime 完全不映射到目标 Project——因为 Project 目前没有这几个
 * 字段（Project Deadline Contract 尚未批准）。这条决定：源 Task 带
 * 非空 due_date/due_time 时，转换必须返回结构化 BLOCKED（不是静默完成，
 * 也不是靠一次性确认弹窗放行丢失），提示大意为"Project 尚不支持
 * deadline，暂时无法转换"。不带日期的 Task 转换行为不变。
 *
 * 【状态：DECIDED，代码尚未实现】——这是 Implementation Plan Slice 4
 * 的范围，本文件这次只记录决定本身，`42_ConversionEngine.
 * convertTaskToProject`/`50_UIBridge.ui_convertTaskToProject`
 * 目前的实际代码还没有加这条 BLOCKED 检查，见 ADR-028 的 Status 字段。
 * Project Deadline Contract 一旦批准，这条规则本身也需要跟着重新评估
 * （届时 Project 有地方存日期了，可能就不再需要 BLOCKED，改成正常
 * 映射）。
 */

// ============================================================
// 二、Workflow 控制流规则（v5.0 SEQUENTIAL/PARALLEL/LOOP/RECURRING
//     不变，Branch 完整规则移到「七」）
// ============================================================

/**
 * SEQUENTIAL/PARALLEL/LOOP/RECURRING 规则与 v5.0 完全相同，不重复。
 * Branch 类型的完整处理规则（v5.1 重写）见本文件「七」。
 *
 * Workflow FINISHED 判定规则不变：全部子 Task 到达终态（v5.1 起终态
 * 集合扩大为 COMPLETED/CANCELLED/CONVERTED/NOT_SELECTED 四种）才算
 * FINISHED。
 */

// ============================================================
// 三、BusinessRule 三层模型——捕获 / 版本 / 匹配 / 实例化规则
//     （v5.1 重写，取代 v5.0 单层设计）
// ============================================================

/**
 * 捕获（captureAsWorkflowTemplate(projectId, ruleName, tags)）：
 *   - 若 ruleName 在 LIFE_BUSINESS_RULES 里找不到匹配的现有行：先
 *     发布 BUSINESS_RULE_CREATED 创建新 BusinessRule（version 计数器
 *     从这个新 BusinessRule 下重新开始），再继续下一步
 *   - 在该 BusinessRule 下新建一个 WorkflowTemplate：version = 该
 *     business_rule_id 下已有最大 version + 1（首次捕获则为 1），
 *     status = 'ACTIVE'
 *   - 若该 BusinessRule 下原本存在 status='ACTIVE' 的旧版本，同一次
 *     调用里额外发布 WORKFLOW_TEMPLATE_FROZEN，把旧版本转为
 *     'FROZEN'——注意这是自动发生的，不需要用户额外操作
 *   - 抽象规则不变（同 v5.0）：Task.title 保留为 title_template
 *     原文；due_date 转换成 relative_offset_days（相对 Project 自己
 *     created_time 的天数差）；保留 sequence_index/parent_task_id/
 *     branch_group 结构；不保留 chat_id、不保留源 Task 的 Metadata
 *     十一字段（模板有自己独立的 Metadata）
 *   - v5.1 新增：workflow_shape 里每个 branch_group 的
 *     branch_resolution_policy 原样保留（若源 Task 有配置），实例化
 *     时沿用同一个 policy，不需要每次实例化都重新配置
 *
 * 版本状态流转（v5.1 新增，完整论证见
 * 00_ADR.gs ADR-2026-07-24-010）：
 *   ACTIVE（当前默认推荐）──capture新版本──▶ FROZEN（历史版本，
 *     内容永久冻结不可再编辑，仍可被显式引用/查询）
 *   ACTIVE 或 FROZEN ──用户显式 deprecateWorkflowTemplate──▶
 *     DEPRECATED（"不建议再用"，与是否为最新版本无关——FROZEN 不会
 *     自动变成 DEPRECATED，两者是两件独立的事）
 *   已经 DEPRECATED 或 FROZEN 的版本，不能反向变回 ACTIVE（如果想
 *     "恢复用旧版本"，正确做法是基于旧版本内容重新 capture 一次，
 *     产生一个新的更高版本号，不是把旧版本的 status 改回去——版本号
 *     只前进不倒退，保持 Audit Trail 的时间线单调）
 *
 * 匹配（suggestMatchingRules，V1 范围不变，仍是标签交集 + 标题关键词
 * 包含，见 00_Domain_Boundary.gs「三」的范围声明）：
 *   - 返回 BusinessRule 层级的建议（rule_id + name + 匹配到的标签），
 *     附带该 BusinessRule 当前 getActiveTemplateForRule 查到的
 *     template_id，方便调用方直接拿去实例化
 *
 * 实例化（instantiateFromTemplate(templateId, newProjectMeta)）：
 *   - 调用方必须传入具体 templateId（不能只给 rule_id 让系统自己猜
 *     版本）；若调用方只知道想用"当前默认版本"，先调用
 *     19_BusinessRuleQueryEngine.getActiveTemplateForRule(ruleId)
 *     拿到 templateId 再传入——这个"必须显式选择版本"的设计本身就是
 *     Versioning 规则的一部分：不允许系统悄悄替用户决定"用哪个版本"
 *   - 按 workflow_shape 里的 relative_offset_days，以实例化操作发生
 *     的时间为新基准点，重新计算全部新 Task 的具体 due_date
 *   - 新生成的 Workflow（Instance）的
 *     instantiated_from_template_id = 传入的 templateId（永久绑定，
 *     不随后续新版本变化）
 *   - 失败恢复：先创建新 Project/Workflow/Task，全部成功后才更新
 *     WorkflowTemplate 的 usage_count/last_used_at
 */

// ============================================================
// 四、Project 层面的范围声明（不变，沿用 v5.0）
// ============================================================

/**
 * Project 本版本仍不提供独立的 Priority 字段、不提供独立的
 * ProjectStatistics 表，理由同 v5.0，不重复。
 */

// ============================================================
// 五、Review 时间窗口定义（不变，沿用 v5.0）
// ============================================================

/**
 * DAILY/WEEKLY/MONTHLY 定义同 v5.0，不重复。
 */

// ============================================================
// 六、辨析：本文件 vs. BusinessRule 实体（不变，沿用 v5.0，补充一句）
// ============================================================

/**
 * "Business Rule" 的两层含义（本文件 vs. 数据实体）说明同 v5.0。
 * v5.1 补充：数据实体现在实际拆成两张表（BusinessRule 顶层分类 +
 * WorkflowTemplate 具体版本），但对外仍统称"BusinessRule 相关能力"，
 * 不需要造第三个词——两层含义的区分标准不变，只是其中"数据实体"这
 * 一层内部又分了两张表，这层内部结构见 00_Entity_Relationship.gs「二」。
 */

// ============================================================
// 七、Branch Resolution Policy（v5.1 新增，取代 v5.0 固定 Auto-Cancel）
// ============================================================

/**
 * 背景：v5.0 曾提议"未选分支自动 Cancel"作为唯一固定行为
 * （00_ADR.gs 原 ADR-2026-07-24-008，Proposed）。两轮评审都指出
 * 固定行为不够用——不同 Branch 场景需要不同的后续处理，评审给出的
 * 三个真实例子完整保留在本节，作为未来实现/测试的参照：
 *
 *   例子 A——Developer 维修（适合 AUTO）：
 *     "还有 Defect？" Yes→继续维修 / No→结束。选了 No 之后，Yes
 *     那条"继续维修"分支确实不会再发生，适合自动标记 NOT_SELECTED。
 *
 *   例子 B——买股票 A/B/C（适合 RETURN_TO_QUEUE）：
 *     今天买了 A，不代表 B 以后不会买——B/C 不能被 NOT_SELECTED
 *     一次性判死，应该退回待安排状态，保留"以后还可能做"的空间。
 *
 *   例子 C——等 Developer 回复（适合 WAITING）：
 *     "收到？" No→还在等回复，这条路径既不是"没被选中"也不是"退回
 *     待安排"，是"确实还悬而未决"，适合标记既有的 WAITING 状态。
 *
 * 规则本体：branch_resolution_policy 是配置在 branch_group 上的字段
 * （物理上落在同组每个 Task 行，同组内所有行取值必须一致，创建
 * Workflow 时统一设定，不允许组内不一致——见
 * 00_Sheets_Structure.gs「一」），五个取值：
 *
 *   AUTO             — 同组其余 Task 自动转为 NOT_SELECTED（例子 A）
 *   RETURN_TO_QUEUE   — 同组其余 Task 保持 PENDING，清除 due_date/
 *                      due_time（例子 B）
 *   WAITING            — 同组其余 Task 转为 WAITING（例子 C）
 *   KEEP_OPEN            — 不做任何自动操作，保持原状态不变
 *   MANUAL                — 效果同 KEEP_OPEN，语义上标注"用户特意选择
 *                      不自动处理"，供未来 UI 区分"未配置"与"明确
 *                      选择手动"
 *
 * 默认值：'MANUAL'——不显式配置就什么都不自动做（见
 * 00_Module_Responsibility.gs「三」Notes 的安全默认原则）。
 *
 * NOT_SELECTED 与 CANCELLED 的语义边界（两轮评审共同强调，完整 ADR
 * 见 00_ADR.gs ADR-2026-07-24-008）：CANCELLED 表示"本来应该执行，
 * 后来主动取消"；NOT_SELECTED 表示"这条路径从一开始就没有被选中执行
 * 的资格"——两者对 Audit 而言含义完全不同，不能混用，也不能互相
 * 转换（一个 NOT_SELECTED 的 Task 不能之后被改成 CANCELLED，反之
 * 亦然；如果判断错了，正确做法是先 markTaskConverted_ 等价的更正
 * 操作，而不是直接覆盖 status 列，同样是为了保留可解释的
 * Audit Trail，而不是让历史记录跟实际发生的事不符）。
 */

// ============================================================
// 八、Decision Owner / Approval 规则（v5.1 新增）
// ============================================================

/**
 * 完整字段定义见 00_Data_Ownership.gs「三」。本节记录具体行为规则：
 *
 *   - creator='User' 的实体：decision_owner=该用户，
 *     approval_status='APPROVED'，创建时一次性写入，不会再变化
 *   - creator='AI' 的实体（created_method 为 'AI Suggestion' 或
 *     'Rule Generated'）：decision_owner=当前配置的批准人（单用户
 *     场景固定是 Carson），approval_status 初始 'PENDING'
 *   - approveEntity_(entityType, entityId, decisionOwner) 显式批准：
 *     approval_status → 'APPROVED'，LIFE_TIMELINE 记一条
 *     event_type='ENTITY_APPROVED'，actor=decisionOwner
 *   - 隐式批准：用户对 approval_status='PENDING' 的实体发起任何
 *     update/complete/cancel 类操作时，操作本身在 Timeline
 *     追加记录之前，先把 approval_status 翻转为 'APPROVED'
 *     （actor='System-Implicit'，与显式批准的
 *     actor=decisionOwner 区分，方便未来审计区分"用户点了批准
 *     按钮"还是"用户直接动手做了这件事，系统认为这就是批准"）
 *   - 拒绝：approveEntity_ 的反向操作
 *     rejectEntity_(entityType, entityId, decisionOwner, reason)，
 *     approval_status → 'REJECTED'（终态，被拒绝的实体本身状态
 *     也同步转为该实体的取消类终态，如 Task 的 CANCELLED、Project
 *     的 CANCELLED——REJECTED 描述的是"审批结果"，不是替代实体自己
 *     的业务状态机，两者分开记录）
 *   - 'PENDING' 状态的实体正常出现在既有视图（ActiveTasks/Dashboard
 *     等）里，不隐藏、不阻塞，只在展示层标注"待确认"——理由见
 *     00_Data_Ownership.gs「三」Notes
 */

// ============================================================
// 九、辨析补充（沿用 v5.0 结尾辨析，见「六」）
// ============================================================

// ============================================================
// 十、Task 原生状态 → Canonical Entity Lifecycle 映射表
//     （v5.2 新增，完整 ADR 见 00_ADR.gs ADR-2026-07-24-017）
// ============================================================

/**
 *   Task 原生 status   | Canonical Lifecycle 值 | 说明
 *   -------------------|------------------------|---------------------
 *   PENDING             | READY                  | 尚未开始，可以开始
 *   DONE                   | COMPLETED              | 完成
 *   CANCELLED                 | CANCELLED              | 原生词汇恰好
 *                       |                        | 和规范词汇相同
 *   BLOCKED                     | BLOCKED                | 原生词汇恰好
 *                       |                        | 和规范词汇相同
 *   WAITING                       | WAITING                | 原生词汇恰好
 *                       |                        | 和规范词汇相同
 *   CONVERTED                       | ARCHIVED               | 已转换离开，
 *                       |                        | 归入"已归档"类
 *   NOT_SELECTED                       | CANCELLED              | 未被选中的
 *                       |                        | 分支，归入
 *                       |                        | "已取消"类（但
 *                       |                        | Task 自己的原生
 *                       |                        | status 仍保留
 *                       |                        | NOT_SELECTED 这个
 *                       |                        | 更精确的值，只有
 *                       |                        | 对外规范化报告
 *                       |                        | 时才折叠成
 *                       |                        | CANCELLED）
 *
 * Project/Workflow 不需要映射表——v5.2 起它们的原生 status 直接就是
 * Canonical Lifecycle 词汇（见 00_Sheets_Structure.gs「三」「四」），
 * mapTaskStatusToCanonical_ 是本文件唯一需要的映射函数。
 */

// ============================================================
// 十一、Conversion No-Silent-Loss Principle（v5.3 新增，2026-09-02，
//      完整 ADR 见 00_ADR.gs ADR-2026-09-02-028）
// ============================================================

/**
 * 原则（适用于本文件「一」「三」描述的全部 Conversion，不只是
 * Task→Project）：
 *
 *   任何 Conversion 都不能静默丢失用户已经存在的数据。
 *
 * 具体要求：如果源实体的某个字段，目标实体的 schema 里没有地方可以
 * 存放（比如现状 Task→Project 转换里的 due_date/due_time/
 * due_datetime），转换必须满足以下二选一，不能是第三种（静默丢弃）：
 *
 *   (a) 返回结构化 BLOCKED，附带清楚的原因，让用户知道为什么现在不能转
 *   (b) 转换前给用户一个明确的、需要主动确认的提示，说明这个字段不会
 *       被带过去
 *
 * 这条原则不预设"BLOCKED"和"确认后继续"哪个更好——由每一条具体转换
 * 规则自己决定（Task→Project 目前决定用 (a)，见「一」的补充说明和
 * ADR-028）。唯一不允许的是：既不提示、也不阻止，让数据在用户没有
 * 察觉的情况下消失。
 *
 * 这条原则本身不是"发现一个新 bug 才有的补丁"——2026-08-31 的审计
 * 发现 Task→Project 转换会静默丢失日期信息时，这条原则被正式确立为
 * 跨所有 Conversion 的通用要求，而不只是对付这一个具体案例的一次性
 * 修复。未来任何新的 Conversion（比如尚未实现的 Task→Note，见
 * ADR-2026-09-02-030）设计时都要先对照这条原则检查一遍。
 */
