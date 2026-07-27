/**
 * 00_Sheets_Structure.gs
 * Personal Life OS v5.2（Design Phase — Architecture Freeze）—
 * Google Sheets Structure
 *
 * Changelog: v5.1 → v5.2——LIFE_PROJECTS.status / LIFE_WORKFLOWS.status
 * 原生改用 Canonical Entity Lifecycle 词汇（见「三」「四」），Tasks
 * 表不变（保留原生词汇，映射逻辑见
 * 00_Business_Rules.gs「十」）。Canonical Identity（Domain+
 * EntityType+EntityID+Version）不新增任何存储列——按需现算，见
 * 00_ADR.gs ADR-2026-07-24-016。
 *
 * Changelog: v5.0 → v5.1——新增 LIFE_WORKFLOW_TEMPLATES 表（三层模型
 * 中间层）；LIFE_BUSINESS_RULES 简化为纯顶层分类；LIFE_WORKFLOWS 新增
 * 版本绑定字段；Tasks/LIFE_PROJECTS 新增双向转换字段；Metadata 标准
 * 字段由九个扩为十一个（全部表格同步）。
 *
 * 本文件对应需求「7. Google Sheets Structure」。给出每张表的逐列定义。
 * 沿用 05_SheetUtils.gs 的既有约定：所有列按表头名字读写，不写死列号；
 * 新增列一律追加在表的最后。
 *
 * Metadata 十一字段（creator/suggested_by/source_domain/source_module/
 * source_event_id/source_task_id/created_method/created_time/
 * updated_time/decision_owner/approval_status）完整定义见
 * 00_Data_Ownership.gs「三」，下面每张适用的表格只列列名，不重复解释
 * 取值范围。
 */

// ============================================================
// 一、Tasks（既有表，扩展列，v5.1 在 v5.0 基础上再新增三列）
// ============================================================

/**
 * 既有列全部保留、顺序不变。v5.0 新增列（不变，全部保留）：
 *
 *   project_id / workflow_id / sequence_index / parent_task_id /
 *   depends_on_task_ids / branch_group / branch_condition /
 *   converted_to_project_id / priority_ai_recommended / Metadata 字段
 *   （见下方，v5.1 扩为十一个）
 *
 * v5.1 新增列（追加在 v5.0 新增列之后）：
 *
 *   source_project_id           — 可空，若本 Task 由某个 Project 降级
 *                                转换而来，指向源 Project（跟
 *                                project_id"属于哪个 Project"的成员
 *                                关系是两个不同字段，不要合并，见
 *                                00_Entity_Relationship.gs「三」的
 *                                辨析）
 *   branch_resolution_policy       — 可空，仅 Branch 类型 Workflow 使用，
 *                                'AUTO' \| 'KEEP_OPEN' \|
 *                                'RETURN_TO_QUEUE' \| 'WAITING' \|
 *                                'MANUAL'（同一 branch_group 内全部
 *                                Task 此字段取值必须一致，见
 *                                00_Business_Rules.gs「二」）
 *   decision_owner / approval_status
 *                                — Metadata 新增两字段，见
 *                                00_Data_Ownership.gs「三」
 *
 * status 枚举：v5.0 已新增 WAITING、CONVERTED；v5.1 再新增
 * NOT_SELECTED（Branch 类型 Workflow 里，未被选中的分支步骤专用状态，
 * 语义上不同于 CANCELLED——CANCELLED 代表"本该执行、后来取消"，
 * NOT_SELECTED 代表"从一开始就没有被选中执行的资格"，完整论证见
 * 00_ADR.gs ADR-2026-07-24-008）。
 */

// ============================================================
// 二、ActiveTasks / ArchiveTasks / TaskStatistics / TaskFilters（既有表）
// ============================================================

/**
 * 结构不变，同 v5.0 说明：是否需要同步新增列取决于实现阶段实际查询
 * 需求，设计阶段不锁死。
 */

// ============================================================
// 三、LIFE_PROJECTS（v5.1：新增双向转换字段，调整实例化来源字段）
// ============================================================

/**
 *   project_id / identity / title / description / execution_mode /
 *   parent_project_id / depends_on_project_ids / source_task_id /
 *   archived_at / chat_id — 不变
 *
 *   status                     — v5.2 起原生采用 Canonical Entity
 *                                Lifecycle（见 00_ADR.gs
 *                                ADR-2026-07-24-017）：DRAFT / READY /
 *                                IN_PROGRESS / WAITING / BLOCKED /
 *                                COMPLETED / ARCHIVED / CANCELLED，
 *                                + Project 专属的 CONVERTED_TO_TASK
 *                                （v5.0/v5.1 曾用 PENDING/ACTIVE/
 *                                ON_HOLD，v5.2 起统一替换，因为这两张
 *                                表在 v5.2 定稿前从未写过生产数据，
 *                                改动零成本）
 *   converted_to_task_id          — v5.1 新增，可空，本 Project 降级
 *                                转换后指向新 Task
 *   captured_as_rule_id              — v5.1 起废弃此列（v5.0 曾用于指向
 *                                本 Project 被抽象成的 BusinessRule；
 *                                三层模型下，"capture"产生的是
 *                                WorkflowTemplate 而不是直接产生
 *                                BusinessRule，所以这个指针的语义已经
 *                                不准确）。替代方案：查询"这个 Project
 *                                是否已被抽象过"，改为反向查询
 *                                LIFE_WORKFLOW_TEMPLATES 表中
 *                                captured_from_project_id = 本
 *                                project_id 的记录，不在 LIFE_PROJECTS
 *                                自己身上保留这个字段（避免两处各存一份
 *                                容易失配的指针）
 *   instantiated_from_rule_id        — v5.1 起废弃此列名，改为
 *                                instantiated_from_template_id
 *                                （见下一行），语义从"指向 BusinessRule"
 *                                改为"指向具体的 WorkflowTemplate 版本"，
 *                                因为一个 Project 是从某个具体版本
 *                                实例化的，不是从抽象类别实例化的
 *   instantiated_from_template_id       — v5.1 新增（取代上一行），可空，
 *                                指向 LIFE_WORKFLOW_TEMPLATES.template_id
 *   decision_owner / approval_status        — Metadata 新增两字段
 */

// ============================================================
// 四、LIFE_WORKFLOWS（v5.1：新增版本绑定字段）
// ============================================================

/**
 *   workflow_id / identity / project_id / title / loop_max_iterations /
 *   chat_id — 不变
 *
 *   recurrence_rule            — 【实现阶段核实后修正】简单字符串标签
 *                                （'Daily'/'Weekly'/'Monthly'/
 *                                'Yearly'，可空），直接复用既有
 *                                ProductivityConfig.TASK_RECURRING
 *                                同一套词汇——不是独立的 JSON 规则
 *                                对象。这是对照
 *                                09_TemporalParser.computeNextDueDateFromLabel
 *                                (prevDueDateStr, recurringLabel) 的
 *                                真实签名核实后的修正（v5.2 设计阶段
 *                                曾设想为可序列化的复杂规则对象，实现
 *                                阶段发现既有日期计算函数就是按这个
 *                                简单标签工作，直接复用，不重新发明
 *                                格式）
 *   workflow_type              — 不变（SEQUENTIAL/PARALLEL/BRANCH/
 *                                LOOP/RECURRING）
 *   status                         — v5.2 起原生采用 Canonical Entity
 *                                Lifecycle 的子集（见
 *                                00_ADR.gs ADR-2026-07-24-017）：
 *                                DRAFT / READY / IN_PROGRESS /
 *                                COMPLETED / CANCELLED（Workflow 本身
 *                                不用 WAITING/BLOCKED，那是它下面
 *                                具体 Task 的事）；v5.0/v5.1 曾用
 *                                PENDING/ACTIVE/FINISHED，v5.2 起
 *                                替换
 *
 *   instantiated_from_template_id  — v5.1 新增，可空，若本 Workflow
 *                                （Instance）是从某个 WorkflowTemplate
 *                                实例化而来，指向该 template_id——
 *                                永久绑定，不随模板后续升版而改变，见
 *                                00_ADR.gs ADR-2026-07-24-010
 *   template_version_at_instantiation — v5.1 新增，可空，创建时冗余
 *                                快照该模板当时的 version 号（纯查询
 *                                便利，不是事实来源——事实来源始终是
 *                                instantiated_from_template_id 指向的
 *                                那一行，那一行一旦 FROZEN 后
 *                                workflow_shape 不再变化，见
 *                                00_Business_Rules.gs「三」）
 *   decision_owner / approval_status  — Metadata 新增两字段
 */

// ============================================================
// 五、LIFE_TIMELINE（不变，entity_type 新增可选值）
// ============================================================

/**
 * 结构不变。entity_type 枚举追加 WORKFLOW_TEMPLATE（v5.1 三层模型
 * 新增实体类型需要能被 Timeline 记录）。
 */

// ============================================================
// 六、LIFE_NOTES（不变）
// ============================================================

/**
 * 结构不变，Metadata 字段随「九、Metadata 字段扩展」统一从九字段扩为
 * 十一字段。
 */

// ============================================================
// 七、LIFE_REVIEWS（不变）
// ============================================================

/**
 * 结构不变——本表本来就不含完整 Metadata 九/十一字段（只有
 * created_time，见 v5.0 原文说明），decision_owner/approval_status
 * 这两个新字段同样不适用于本表（Review 几乎总是系统批量生成，没有
 * "谁批准"这个业务问题）。
 */

// ============================================================
// 八、LIFE_BUSINESS_RULES（v5.1：大幅简化，降级为纯顶层分类）
// ============================================================

/**
 *   rule_id                — 主键，格式 RULE-YYYYMMDD-XXXXXX
 *   name                       — 名称（如"验屋""搬家标准流程"）
 *   tags                           — 逗号分隔标签，供匹配用
 *   status                             — ACTIVE / DEPRECATED（本层的
 *                                    状态只表达"这整个类别还用不用"，
 *                                    不含版本概念——版本是下面
 *                                    WorkflowTemplate 层的事）
 *   creator / suggested_by / source_domain / source_module /
 *   source_event_id / source_task_id / created_method / created_time /
 *   updated_time / decision_owner / approval_status
 *                                    — Metadata 十一字段
 *
 * v5.1 起移除的列（迁移至下方新表 LIFE_WORKFLOW_TEMPLATES）：
 *   captured_from_project_id, workflow_shape, version, usage_count,
 *   last_used_at
 */

// ============================================================
// 九、LIFE_WORKFLOW_TEMPLATES（v5.1 新增，三层模型的中间层）
// ============================================================

/**
 *   template_id                — 主键，格式 TPL-YYYYMMDD-XXXXXX
 *   business_rule_id               — 必填，指向所属 LIFE_BUSINESS_RULES
 *   version                            — 整数，同一 business_rule_id 下
 *                                    从 1 开始递增
 *   status                                — ACTIVE（当前默认推荐版本）/
 *                                    FROZEN（历史版本，不再是默认推荐，
 *                                    但仍可被显式引用/查询，内容永久
 *                                    不可再编辑）/ DEPRECATED（用户
 *                                    显式标记"不建议再用"，与是否为
 *                                    最新版本无关，见
 *                                    00_Business_Rules.gs「三」的
 *                                    状态流转规则）
 *   workflow_shape                        — JSON 字符串，抽象后的结构
 *                                    （不含具体日期，只含相对偏移，
 *                                    定义不变，同 v5.0）
 *   captured_from_project_id                  — 可空（v5.1 从
 *                                    LIFE_BUSINESS_RULES 移到本表，
 *                                    理由见
 *                                    00_Entity_Relationship.gs「三」）
 *   usage_count                                  — 整数，本版本每次被
 *                                    实例化 +1（注意：是"这个版本"的
 *                                    使用次数，不是整个 BusinessRule
 *                                    的累计次数——后者可以通过查询同一
 *                                    business_rule_id 下全部版本的
 *                                    usage_count 求和得到，不需要
 *                                    本表之外再单独维护一个汇总列）
 *   last_used_at                                    — 可空
 *   creator / suggested_by / source_domain / source_module /
 *   source_event_id / source_task_id / created_method / created_time /
 *   updated_time / decision_owner / approval_status
 *                                    — Metadata 十一字段
 */

// ============================================================
// 十、迁移说明（Operations，v5.1 更新）
// ============================================================

/**
 * migrateSchemaPersonalLifeOS() 需要额外处理（在 v5.0 版本"新增六张表 +
 * Tasks 新增列"的基础上）：
 *   (c) 新增 LIFE_WORKFLOW_TEMPLATES 表
 *   (d) 对 Tasks 表新增本文件「一」列出的 v5.1 新列
 *   (e) 对 LIFE_PROJECTS/LIFE_WORKFLOWS/LIFE_NOTES/LIFE_BUSINESS_RULES
 *       新增 decision_owner/approval_status 两列，历史存量行迁移时
 *       默认 approval_status='APPROVED'（存量数据视为已确认，不倒查）
 *   (f) 若 LIFE_BUSINESS_RULES 表在 v5.0 阶段已经创建并写入过数据
 *       （本设计包是纯文档，理论上不会发生，但作为迁移脚本的健壮性
 *       要求写明）：把既有行的 captured_from_project_id/
 *       workflow_shape/version/usage_count/last_used_at 迁移到新建的
 *       LIFE_WORKFLOW_TEMPLATES 表（每行生成一个 version=1 的
 *       Template），LIFE_BUSINESS_RULES 原表只保留 rule_id/name/tags/
 *       status，其余列删除
 * 全部步骤保持幂等，可重复执行。
 */
