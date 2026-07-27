/**
 * 00_Module_Responsibility.gs
 * Personal Life OS v5.2（Design Phase — Architecture Freeze）—
 * Module Responsibility
 *
 * Changelog: v5.1 → v5.2——新增 45_CanonicalRepresentation.gs（见
 * 本文件末尾「十」），承载 Canonical Identity 组装 + Task 状态到
 * Canonical Lifecycle 的映射（ADR-016/017）。27_ProjectEngine.gs /
 * 28_WorkflowEngine.gs 的 status 枚举同步更新为 Canonical Lifecycle
 * 词汇，Engine Contract 本身职责不变，不重复列出。
 *
 * Changelog: v5.0 → v5.1（两轮外部评审后）——TaskEngine/ProjectEngine
 * 新增双向转换相关函数；WorkflowEngine 的 Branch 处理改为可配置策略；
 * BusinessRuleEngine 重构为管理两张表（BusinessRule + WorkflowTemplate）；
 * ConversionEngine 新增反方向；BusinessRuleQueryEngine 扩展。未提及的
 * 模块（NoteEngine/ReviewEngine/ReminderConnector 及全部既有 Query
 * Engine 结构）沿用 v5.0，不重复列出未变化的部分。
 *
 * 本文件对应需求「3. Module Responsibility」，按 Engine Contract
 * Standard 十三字段逐一补全。
 */

// ============================================================
// 一、20_TaskEngine.gs（扩展）
// ============================================================

/**
 * ── Engine Contract（v5.1 在 v5.0 基础上的增量）──────────────────────────
 *   Responsibilities      : v5.0 全部保留（project_id/workflow_id 关联、
 *                           Parent/Child、Task Dependency、双轨
 *                           Priority），v5.1 新增：接收 Project→Task
 *                           降级转换产生的新 Task（
 *                           createTaskFromConversion_）、维护
 *                           branch_resolution_policy 字段、NOT_SELECTED
 *                           状态的落地（由 28_WorkflowEngine 调用触发，
 *                           TaskEngine 自己不主动判断"该不该
 *                           NOT_SELECTED"）
 *   Owns                  : status 枚举新增 NOT_SELECTED（终态，语义
 *                           见 00_Sheets_Structure.gs「一」）；
 *                           branch_resolution_policy 枚举
 *                           （'AUTO'\|'KEEP_OPEN'\|'RETURN_TO_QUEUE'\|
 *                           'WAITING'\|'MANUAL'，默认 'MANUAL'——不
 *                           显式配置就什么都不自动做，避免意外的自动
 *                           状态变更，见 00_Business_Rules.gs「二」）
 *   Public API            : v5.0 四件套 + markTaskConverted_ 不变；
 *                           新增 createTaskFromConversion_(sourceProject,
 *                           meta)（仅允许 42_ConversionEngine.gs
 *                           调用）、markTaskNotSelected_(taskId,
 *                           branchGroup)（仅允许
 *                           28_WorkflowEngine.gs 调用）
 *   Forbidden Dependencies  : 不变；createTaskFromConversion_ 不允许
 *                           读写 LIFE_PROJECTS（源 Project 的状态变更
 *                           由 27_ProjectEngine 自己完成，TaskEngine
 *                           只负责生出新 Task 这一侧）
 *   Notes                     : createTaskFromConversion_ 与既有
 *                           createTask 的区别——后者 identity 由标题+
 *                           时间等常规字段计算，前者额外把
 *                           source_project_id 纳入 identity 计算
 *                           输入（防止同一个 Project 被误触发两次
 *                           降级产生两个重复 Task，幂等边界跟其它
 *                           create* 函数一致）
 */

// ============================================================
// 二、27_ProjectEngine.gs（扩展）
// ============================================================

/**
 * ── Engine Contract（v5.1 增量）───────────────────────────────────────
 *   Responsibilities      : v5.0 全部保留，v5.1 新增：Project→Task
 *                           降级转换的发起侧（
 *                           markProjectConvertedToTask_）、实例化来源
 *                           指针改为指向 WorkflowTemplate（见「Owns」）
 *   Owns                  : status 枚举新增 CONVERTED_TO_TASK（终态）；
 *                           降级转换前置条件的校验规则——只有满足
 *                           "无 Sub-Project（没有其它 Project 的
 *                           parent_project_id 指向本 Project）且无
 *                           非终态子 Task"两个条件同时成立的 Project
 *                           才允许降级，校验逻辑属于本 Engine（不是
 *                           ConversionEngine——"这个 Project 够不够格
 *                           被降级"是 Project 自己的业务规则，
 *                           ConversionEngine 只负责编排，不重复实现
 *                           判断标准，呼应既有 Architecture Principle
 *                           11 的分工方式）
 *   Public API            : v5.0 全部保留（含
 *                           createProjectFromBusinessRule_，v5.1 起
 *                           改名为 createProjectFromTemplate_，语义
 *                           不变只是反映调用方从
 *                           41_BusinessRuleEngine 传入的现在是
 *                           WorkflowTemplate 而不是扁平的
 *                           BusinessRule）；新增
 *                           markProjectConvertedToTask_(projectId,
 *                           newTaskId)（仅允许
 *                           42_ConversionEngine.gs 调用）、
 *                           checkEligibleForTaskDemotion_(projectId)
 *                           （纯查询，供 ConversionEngine 在真正执行
 *                           转换前先校验，避免校验逻辑分散在两个文件
 *                           里各写一遍）
 *   Notes                     : checkEligibleForTaskDemotion_ 是本次
 *                           唯一一个"专门为满足另一个 Engine 的前置
 *                           校验需求而新增的只读函数"——之所以不让
 *                           ConversionEngine 直接读 LIFE_PROJECTS/
 *                           Tasks 自己判断，是因为"什么样的 Project
 *                           算够格降级"属于 Project 自己的业务规则，
 *                           规则变化时只需要改一个地方
 */

// ============================================================
// 三、28_WorkflowEngine.gs（扩展：Branch Resolution Policy）
// ============================================================

/**
 * ── Engine Contract（v5.1 增量，取代 v5.0 固定 Auto-Cancel 的设计）──────
 *   Responsibilities      : v5.0 全部保留（start/finish/cancel、
 *                           Workflow 级 Recurring），v5.1 重新设计
 *                           Branch 类型的处理方式：不再有唯一固定行为，
 *                           改为读取该 branch_group 配置的
 *                           branch_resolution_policy 决定怎么处理
 *                           未选分支
 *   Owns                  : Branch Resolution Policy 的具体执行逻辑
 *                           （不是策略本身的定义——那是
 *                           20_TaskEngine.gs 的字段——而是"收到某个
 *                           分支被 Complete 的信号后，该对同组其它
 *                           Task 做什么"这件事）：
 *                             AUTO             → 调用
 *                               20_TaskEngine.markTaskNotSelected_
 *                               处理同组其余 Task
 *                             KEEP_OPEN         → 不做任何操作，同组
 *                               其余 Task 保持原状态
 *                             RETURN_TO_QUEUE    → 同组其余 Task 保持
 *                               PENDING，但清除它们的
 *                               due_date/due_time（如果有），表示"移回
 *                               待安排"，不设终态
 *                             WAITING              → 同组其余 Task
 *                               状态改为既有的 WAITING 值（描述"在等，
 *                               但不是等外部依赖，是等要不要走这条
 *                               分支"）
 *                             MANUAL                 → 不做任何自动
 *                               操作，等同 KEEP_OPEN，区别只在语义
 *                               标注"这是用户特意选择要手动处理"，
 *                               便于未来 UI 展示区分"我没配置"和
 *                               "我特意选择不自动处理"
 *   Public API            : v5.0 全部保留；
 *                           handleBranchResolution_(workflowId,
 *                           chosenTaskId) 内部实现改为按上述五种
 *                           policy 分派，函数签名不变（对调用方
 *                           20_TaskEngine.completeTask 透明，不需要
 *                           调用方关心具体走了哪条 policy）
 *   Dependencies           : 新增
 *                           20_TaskEngine.markTaskNotSelected_
 *   Notes                     : 默认值 'MANUAL'（见
 *                           20_TaskEngine.gs「Owns」）意味着——如果
 *                           创建 Branch Workflow 时没有显式配置
 *                           branch_resolution_policy，系统不会做任何
 *                           自动状态变更，这是刻意的保守默认（"不确定
 *                           该怎么办时，什么都不做，比自动做错事安全"）
 */

// ============================================================
// 四、29_NoteEngine.gs（不变，沿用 v5.0）
// ============================================================

/**
 * 沿用 v5.0 Engine Contract，无变化。
 */

// ============================================================
// 五、40_ReviewEngine.gs（不变，沿用 v5.0）
// ============================================================

/**
 * 沿用 v5.0 Engine Contract，无变化。
 */

// ============================================================
// 六、41_BusinessRuleEngine.gs（v5.1：重构为管理两张表）
// ============================================================

/**
 * ── Engine Contract（v5.1 重写，取代 v5.0 单表版本）───────────────────────
 *   Responsibilities      : 管理 BusinessRule（顶层分类）+
 *                           WorkflowTemplate（具体版本）两张表——
 *                           capture（把一个 Project 抽象成某个
 *                           BusinessRule 下的新版本 WorkflowTemplate，
 *                           必要时先创建 BusinessRule 本身）、
 *                           deprecate（显式标记某个版本不再推荐）、
 *                           instantiate（从某个具体版本的
 *                           WorkflowTemplate 生成新 Workflow Instance，
 *                           可选同时生成新 Project）、suggest（标签/
 *                           关键词匹配，先匹配到 BusinessRule 层，再
 *                           默认推荐其 ACTIVE 版本，也允许调用方指定
 *                           想要哪个具体版本）
 *   Owns                  : 抽象规则不变（同 v5.0，workflow_shape 的
 *                           生成方式）；版本号递增规则（同一
 *                           business_rule_id 下 version = 已有最大
 *                           version + 1）；版本状态流转规则——新版本
 *                           创建时，同一 business_rule_id 下原本
 *                           ACTIVE 的版本自动转 FROZEN（不是
 *                           DEPRECATED，两者语义不同，见
 *                           00_Business_Rules.gs「三」）；DEPRECATED
 *                           只能由显式调用产生，不会被 capture 新版本
 *                           的动作自动触发
 *   Reads                 : 14_ProjectQueryEngine（capture 时读取源
 *                           Project 的完整 Task/Workflow 结构）、
 *                           19_BusinessRuleQueryEngine（instantiate/
 *                           suggest 时读取已有 BusinessRule +
 *                           WorkflowTemplate）
 *   Writes                : Events（BUSINESS_RULE_CREATED,
 *                           WORKFLOW_TEMPLATE_CAPTURED,
 *                           WORKFLOW_TEMPLATE_FROZEN,
 *                           WORKFLOW_TEMPLATE_DEPRECATED,
 *                           WORKFLOW_INSTANCE_CREATED）
 *   Public API            : captureAsWorkflowTemplate(projectId,
 *                           ruleName, tags)（v5.1 改名，取代 v5.0 的
 *                           captureAsBusinessRule，行为上"发现
 *                           ruleName 不存在则先创建 BusinessRule"由
 *                           本函数内部处理，调用方不需要分两步调用）/
 *                           deprecateWorkflowTemplate(templateId)
 *                           （v5.1 新增）/
 *                           instantiateFromTemplate(templateId,
 *                           newProjectMeta)（v5.1 改名，取代 v5.0 的
 *                           instantiateFromBusinessRule，参数从
 *                           ruleId 改为 templateId——调用方必须指定
 *                           具体版本，不能只给 BusinessRule 就期待
 *                           系统自己猜该用哪个版本；如果调用方只知道
 *                           BusinessRule 想用"当前默认版本"，先调用
 *                           下面的 getActiveTemplateForRule 拿到
 *                           templateId 再传入）/
 *                           suggestMatchingRules(queryTags)（不变，
 *                           返回 BusinessRule 层级的建议列表，附带
 *                           各自当前 ACTIVE 版本的 template_id 方便
 *                           调用方直接拿去 instantiate）
 *   Dependencies           : 14_ProjectQueryEngine.gs、
 *                           27_ProjectEngine.gs
 *                           （createProjectFromTemplate_）、
 *                           20_TaskEngine.gs（实例化时批量创建 Task）、
 *                           19_BusinessRuleQueryEngine.gs、
 *                           07_IdentityEngine.gs（新增
 *                           generateBusinessRuleIdentity /
 *                           generateWorkflowTemplateIdentity 两个
 *                           纯函数，取代 v5.0 单一的
 *                           generateBusinessRuleIdentity）
 *   Forbidden Dependencies  : 自动执行 instantiate（不变，必须显式
 *                           触发）；自动 deprecate（不会因为版本
 *                           FROZEN 就跟着自动 DEPRECATED，两者互不
 *                           触发，必须分开显式操作）
 *   Notes                     : instantiateFromTemplate 生成的
 *                           Workflow（Instance）永久绑定传入的
 *                           templateId，即使之后同一个 BusinessRule
 *                           下又 capture 了更新的版本，这个已经生成的
 *                           Instance 不会被通知、不会被要求升级、
 *                           完全独立运行到底，完整论证见
 *                           00_ADR.gs ADR-2026-07-24-010
 */

// ============================================================
// 七、42_ConversionEngine.gs（v5.1：新增反方向）
// ============================================================

/**
 * ── Engine Contract（v5.1 增量）───────────────────────────────────────
 *   Responsibilities      : v5.0 全部保留（Task→Project、
 *                           Note→Task/Project/Goal Candidate），v5.1
 *                           新增 Project→Task（降级转换）
 *   Owns                  : v5.0 规则不变；新增降级转换的字段映射
 *                           规则（Project.title → Task.title，
 *                           Project.description → Task.notes，
 *                           新 Task.project_id = 源
 *                           Project.parent_project_id——让新 Task
 *                           "接替"源 Project 在其父级下的位置，完整
 *                           论证见 00_Entity_Relationship.gs「三」）
 *   Public API            : v5.0 三个 convert* 函数不变；新增
 *                           convertProjectToTask(projectId, taskMeta)
 *   Dependencies           : v5.0 不变 +
 *                           27_ProjectEngine.checkEligibleForTaskDemotion_
 *                           （执行转换前的前置校验）、
 *                           27_ProjectEngine.markProjectConvertedToTask_、
 *                           20_TaskEngine.createTaskFromConversion_
 *   Notes                     : convertProjectToTask 调用
 *                           checkEligibleForTaskDemotion_ 未通过时，
 *                           返回明确的拒绝原因（"还有 N 个 Sub-Project"
 *                           或"还有 N 个未完成的子 Task"），不是笼统的
 *                           失败——这是 Reference Integrity/Audit
 *                           Trail 这条评审反复强调的"可解释性"在这个
 *                           具体函数上的落实
 */

// ============================================================
// 八、43_ReminderConnector.gs（不变，沿用 v5.0）
// ============================================================

/**
 * 沿用 v5.0 Engine Contract，无变化。
 */

// ============================================================
// 九、Query Engines（14/16/17/18/19/44，v5.1 更新 19）
// ============================================================

/**
 * 14/16/17/18/44 沿用 v5.0，无变化。19_BusinessRuleQueryEngine.gs
 * 因三层模型扩展：
 *
 *   Reads                 : LIFE_BUSINESS_RULES（新增）+
 *                           LIFE_WORKFLOW_TEMPLATES（新增，v5.0 时
 *                           这些字段都还在 LIFE_BUSINESS_RULES 一张表
 *                           里）
 *   Public API            : getBusinessRule(ruleId) / findByTags(tags)
 *                           （不变）+ 新增
 *                           getWorkflowTemplate(templateId) /
 *                           getTemplatesForRule(ruleId) /
 *                           getActiveTemplateForRule(ruleId)（返回该
 *                           BusinessRule 下 status='ACTIVE' 的那一个
 *                           版本，正常情况下同一 business_rule_id 下
 *                           恰好只有一行是 ACTIVE，若查询到多于一行，
 *                           属于数据不一致，应该记录告警而不是随便
 *                           返回其中一个）
 */

// ============================================================
// 十、45_CanonicalRepresentation.gs（v5.2 新增）
// ============================================================

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 两件事，都是纯函数、都不碰任何 Sheet——
 *                           (a) 组装 Canonical Identity（Domain+
 *                           EntityType+EntityID+Version 四段式，见
 *                           00_ADR.gs ADR-2026-07-24-016）；(b) 把
 *                           Task 的原生 status 映射成 Canonical
 *                           Entity Lifecycle 词汇（见
 *                           00_ADR.gs ADR-2026-07-24-017）
 *   Owns                  : Task 状态映射表本身（PENDING→READY 等
 *                           七条对应关系，完整列表见
 *                           00_Business_Rules.gs「十」）
 *   Reads                 : 无（接收调用方已经准备好的字段，不查询
 *                           任何表）
 *   Writes                : 无
 *   Public API            : composeCanonicalIdentity_(domain,
 *                           entityType, entityId, version) /
 *                           mapTaskStatusToCanonical_(nativeStatus)
 *                           （Project/Workflow 不需要映射函数——
 *                           它们的原生 status 本来就是 Canonical
 *                           词汇，见 00_Sheets_Structure.gs「三」
 *                           「四」）
 *   Dependencies           : 无
 *   Forbidden Dependencies  : Sheet 读写、任何其它 Engine
 *   Pure Function           : YES（全部函数）
 *   Replay Events            : NO
 *   Projection                : NO
 *   Thread Safety              : 不需要（无共享可变状态）
 *   Side Effects               : NO
 *   Notes                      : 本文件是全项目里除
 *                           07_IdentityEngine.gs 外唯一一个"完全没有
 *                           副作用、不依赖任何其它文件"的模块——刻意
 *                           保持这样，因为 Canonical Identity/
 *                           Lifecycle 是要给 Execution、未来 AI、
 *                           未来其它 Domain OS 都能安全调用的基础
 *                           设施，依赖越少越不容易被其它模块的变化
 *                           连累
 */
