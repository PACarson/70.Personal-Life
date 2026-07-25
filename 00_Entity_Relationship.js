/**
 * 00_Entity_Relationship.gs
 * Personal Life OS v5.1（Design Phase）— Entity Relationship
 *
 * Changelog: v5.0 → v5.1（两轮外部评审后）——BusinessRule 由单层拆成
 * 三层（Business Rule → Workflow Template → Workflow Instance，见
 * 00_ADR.gs ADR-2026-07-24-011）；Task↔Project 转换由单向改为双向
 * （见 00_ADR.gs ADR-2026-07-24-015，取代原 ADR-2026-07-24-006）。
 *
 * 本文件对应需求「5. Entity Relationship」。列出九个核心实体（v5.0
 * 是七个，本次新增 WorkflowTemplate，并把原来的 BusinessRule 概念一分
 * 为二）、彼此的关系与基数，以及"为什么是这个关系而不是另一种"的理由——
 * 完整的逐列字段定义在 00_Sheets_Structure.gs，本文件只关心实体之间
 * 怎么连接。可视化版本见同目录 Entity_Relationship.mermaid。
 */

// ============================================================
// 一、九个核心实体（一句话定义）
// ============================================================

/**
 *   Project             — 一个有明确边界、可以被 Archive 的生活事务
 *                         （搬家/家庭整理/喂流浪猫计划）
 *   Task                  — Project 承载可以拆解的实际动作（洗衣/晾衣/
 *                         收衣）
 *   Workflow                — 一组 Task 之间的编排规则（谁先谁后/能否
 *                         并行/要不要按周期重来一遍），本文件里也叫
 *                         Workflow Instance（跟 Workflow Template
 *                         对应，见下方三层模型）
 *   Timeline Entry             — 上述任何实体发生的一次状态变化，只读、
 *                         只追加
 *   Note                          — 还不知道该归类成什么的原始记录
 *   Review                           — 某个时间窗口内 Task/Project 状态
 *                         的只读汇总
 *   BusinessRule                       — 三层模型的最顶层，一个具名的
 *                         "可复用流程类别"（如"验屋""搬家"），本身不
 *                         携带具体的任务结构
 *   Workflow Template                     — 三层模型的中间层，
 *                         BusinessRule 下某个具体、有版本号的流程结构
 *                         快照（如"验屋 v1.0"）
 *   （Workflow Instance 就是上面的 Workflow——同一个实体，两种称呼，
 *   视角不同：单独存在时叫 Workflow，强调"它是从某个 Template
 *   实例化来的"时叫 Workflow Instance）
 */

// ============================================================
// 二、BusinessRule 三层模型（v5.1 新增，替代 v5.0 的单层设计）
// ============================================================

/**
 * 背景：v5.0 把"可复用流程模板"设计成单一一张 LIFE_BUSINESS_RULES 表，
 * 评审指出这样无法表达"同一个业务概念（如"验屋"）的流程本身会随时间
 * 演变，但已经实例化出去的旧 Project 不应该跟着自动升级"这个真实场景
 * （例子：验屋流程今年改了，去年那个验屋 Project 不能被动跟着变）。
 * v5.1 拆成三层：
 *
 *   BusinessRule（LIFE_BUSINESS_RULES 表，1条）
 *     "验屋" —— 只是一个具名类别 + 标签，本身不含任何具体步骤
 *     │
 *     ├─ WorkflowTemplate v1.0（LIFE_WORKFLOW_TEMPLATES 表，status=FROZEN）
 *     │    └─ Workflow Instance A（Property Est8，2026年创建，
 *     │       instantiated_from_template_id 指向 v1.0，永久绑定）
 *     │    └─ Workflow Instance B（Property Est12，2026年创建，
 *     │       同样绑定 v1.0）
 *     │
 *     └─ WorkflowTemplate v2.0（status=ACTIVE，2027年新流程）
 *          └─ Workflow Instance C（2027年创建，绑定 v2.0）
 *
 * 一个 BusinessRule 下可以有多个 WorkflowTemplate（不同版本）；一个
 * WorkflowTemplate 下可以有多个 Workflow Instance（同一版本反复使用，
 * 互不影响，例子里 A/B 都绑定 v1.0，各自独立推进，互不干扰）。
 */

// ============================================================
// 三、关系与基数
// ============================================================

/**
 *   Project 1 ── 0..N Task
 *     一个 Project 下可以有零到多个 Task；Task 也可以不属于任何
 *     Project（project_id 可空）。
 *
 *   Project 1 ── 0..N Project（自引用，Sub-Project 层级）
 *     parent_project_id 表达"属于哪个更大的 Project"。
 *
 *   Project N ── N Project（Project Dependency，非层级）
 *     depends_on_project_ids。
 *
 *   Project 1 ── 0..N Workflow（Workflow Instance）
 *     workflow.project_id，可空。
 *
 *   Workflow 1 ── 0..N Task
 *     Task.workflow_id + Task.sequence_index。
 *
 *   Task 1 ── 0..N Task（自引用，Parent/Child）
 *     parent_task_id。
 *
 *   Task N ── N Task（Task Dependency，非层级）
 *     depends_on_task_ids。
 *
 *   Note 0..1 ── 0..1 Task / Project
 *     converted_to_type + converted_to_id。
 *
 *   Task 0..1 ── 0..1 Project（Task→Project 转换，v5.0 已有方向）
 *     源 Task.status='CONVERTED' + Task.converted_to_project_id；
 *     目标 Project.source_task_id 指回源 Task。
 *
 *   Project 0..1 ── 0..1 Task（Project→Task 转换，v5.1 新增反方向，
 *   见 00_ADR.gs ADR-2026-07-24-015）
 *     源 Project.status='CONVERTED_TO_TASK' +
 *     Project.converted_to_task_id；目标 Task.source_project_id
 *     指回源 Project——注意这是一个跟 project_id（"属于哪个 Project"，
 *     成员关系）完全不同的字段，source_project_id 表达的是"我是被
 *     哪个 Project 降级转换来的"（血缘关系），两者语义不同、不要合并，
 *     完整规则（含前置条件、字段映射）见 00_Business_Rules.gs「一」。
 *     二者互为镜像但不是同一条 ADR 的重复——Task→Project 几乎没有
 *     前置条件（任何非终态 Task 都能升级），Project→Task 有明确前置
 *     条件（Project 必须没有 Sub-Project、没有非终态 Task 挂在下面，
 *     即"事后发现其实是空的/只是一件小事"才能降级），两个方向的
 *     Consequences 并不对称。
 *
 *   BusinessRule 1 ── 0..N WorkflowTemplate
 *     WorkflowTemplate.business_rule_id 指回所属 BusinessRule。
 *
 *   WorkflowTemplate 0..1 ── 0..1 Project（capture 方向）
 *     WorkflowTemplate.captured_from_project_id 指向被抽象的源
 *     Project（注意：这条指针从 v5.0 挂在 BusinessRule 上，v5.1 挪到
 *     WorkflowTemplate 上——因为"从哪个 Project 抽象而来"是某一个
 *     具体版本的属性，不是整个 BusinessRule 类别的属性；同一个
 *     BusinessRule 下 v1.0 和 v2.0 完全可能抽象自两个不同的源
 *     Project）。
 *
 *   WorkflowTemplate 1 ── 0..N Workflow（instantiate 方向）
 *     Workflow.instantiated_from_template_id 指回具体的
 *     WorkflowTemplate 版本（不是指回 BusinessRule）——这是三层模型
 *     最核心的一条关系：Workflow Instance 永久绑定创建时的具体版本，
 *     WorkflowTemplate 之后升级新版本，不影响已经指向旧版本的既有
 *     Workflow Instance，见 00_ADR.gs ADR-2026-07-24-010
 *     （Versioning）。
 *
 *   Timeline Entry N ── 1 (Project|Task|Workflow|Note|Review|
 *   BusinessRule|WorkflowTemplate)（多态引用）
 *     entity_type + entity_id。
 *
 *   Review N ── 0（无直接外键）
 */

// ============================================================
// 四、为什么不做的关系（避免过度设计）
// ============================================================

/**
 *   Workflow（Instance）之间没有互相引用——即使两个 Instance 绑定
 *   同一个 WorkflowTemplate（上面例子里的 A/B），它们彼此独立推进，
 *   互不感知对方的存在，这正是三层模型要解决的问题（同一个模板可以
 *   被安全地重复使用）。
 *
 *   Note 之间没有互相引用——理由不变，见 v5.0 原文。
 *
 *   Project↔Task 转换不做"转换链"——一个 Project 转成 Task 后，这个
 *   Task 理论上还能不能再转回 Project？本设计不禁止（Task→Project
 *   本身的前置条件只看 Task 当前状态，不关心它是否曾经是个
 *   Project），但也不做任何特殊的"记得你曾经是 Project”优化——每次
 *   转换都是一次独立、对称的操作，血缘链条通过 Timeline 完整可查，
 *   不需要额外建模。
 */
