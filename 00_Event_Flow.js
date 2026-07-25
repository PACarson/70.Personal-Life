/**
 * 00_Event_Flow.gs
 * Personal Life OS v5.1（Design Phase）— Event Flow
 *
 * Changelog: v5.0 → v5.1——BusinessRule 相关事件因三层模型重新设计：
 * BUSINESS_RULE_CAPTURED 拆分/改名为 WORKFLOW_TEMPLATE_CAPTURED，
 * BUSINESS_RULE_INSTANTIATED 改名为 WORKFLOW_INSTANCE_CREATED，新增
 * BUSINESS_RULE_CREATED / WORKFLOW_TEMPLATE_FROZEN /
 * WORKFLOW_TEMPLATE_DEPRECATED；新增 PROJECT_CONVERTED_TO_TASK（反向
 * 转换）。
 *
 * 本文件对应需求「6. Event Flow」。既有 5 个 Task 事件 + v5.0 的
 * PROJECT_CREATED/UPDATED/COMPLETED/CANCELLED/ARCHIVED、
 * WORKFLOW_STARTED/FINISHED/CANCELLED、NOTE_CREATED/CONVERTED、
 * TASK_CONVERTED_TO_PROJECT/REVIEW_GENERATED/REMINDER_REQUESTED
 * 定义不变，不在本文件重复（见 v5.0 存档版本或
 * 00_Project_Constitution.gs 零之五）。本文件只列 v5.1 新增/改名的
 * 事件。
 */

// ============================================================
// 一、v5.1 新增/改名事件目录
// ============================================================

/**
 * ── BUSINESS_RULE_CREATED（新增）──────────────────────────────────────────
 *   Purpose         : 一个新的顶层 BusinessRule 类别被创建（通常隐式
 *                     发生——第一次 capture 一个新名字的规则时，
 *                     BusinessRuleEngine 自动先创建 BusinessRule 再
 *                     创建它的第一个 WorkflowTemplate，两个事件在同一次
 *                     调用里先后发布）
 *   Payload         : { rule_id, name, tags }
 *   Required Fields : rule_id, name
 *   Projection Updated: LIFE_BUSINESS_RULES（新增行）, LIFE_TIMELINE
 *   Example         : { rule_id:"RULE-20260724-R3S4", name:"验屋" }
 *   Version         : v5.1
 *   Source Module   : 41_BusinessRuleEngine.captureAsWorkflowTemplate
 *                     （当传入的 name 在 LIFE_BUSINESS_RULES 里找不到
 *                     匹配行时，内部先触发这个事件）
 *   Destination Projection: 10_ProjectionEngine.projectBusinessRuleCreated_
 *
 * ── WORKFLOW_TEMPLATE_CAPTURED（改名，取代 v5.0 的
 *    BUSINESS_RULE_CAPTURED）────────────────────────────────────────────
 *   Purpose         : 一个 Project 的结构被抽象成一个具体版本的
 *                     WorkflowTemplate
 *   Payload         : 完整 workflowTemplate 对象（template_id/
 *                     business_rule_id/version/status/workflow_shape/
 *                     captured_from_project_id + Metadata 十一字段）
 *   Required Fields : template_id, business_rule_id, version,
 *                     captured_from_project_id
 *   Projection Updated: LIFE_WORKFLOW_TEMPLATES（新增行）, LIFE_TIMELINE
 *   Example         : { template_id:"TPL-20260724-T1U2",
 *                     business_rule_id:"RULE-20260724-R3S4", version:1,
 *                     captured_from_project_id:"PRJ-..." }
 *   Version         : v5.1（v5.0 名为 BUSINESS_RULE_CAPTURED，语义
 *                     不同——旧版本直接把结构存在 BusinessRule 本身
 *                     上，新版本存在独立的 WorkflowTemplate 行上）
 *   Source Module   : 41_BusinessRuleEngine.captureAsWorkflowTemplate
 *   Destination Projection: 10_ProjectionEngine.projectWorkflowTemplateCaptured_
 *
 * ── WORKFLOW_TEMPLATE_FROZEN（新增）───────────────────────────────────────
 *   Purpose         : 某个 WorkflowTemplate 版本因为有更新版本被
 *                     capture，从 ACTIVE 转为 FROZEN（不再是默认推荐
 *                     版本，但内容永久保留、仍可被显式引用）
 *   Payload         : { template_id }
 *   Required Fields : template_id
 *   Projection Updated: LIFE_WORKFLOW_TEMPLATES（status=FROZEN）,
 *                     LIFE_TIMELINE
 *   Example         : { template_id:"TPL-20260724-T1U2" }
 *   Version         : v5.1
 *   Source Module   : 41_BusinessRuleEngine.captureAsWorkflowTemplate
 *                     （捕获新版本时，自动把同一 business_rule_id 下
 *                     原本 status=ACTIVE 的那一行转为 FROZEN，两个
 *                     事件同一次调用里先后发布）
 *   Destination Projection: 10_ProjectionEngine.projectWorkflowTemplateFrozen_
 *
 * ── WORKFLOW_TEMPLATE_DEPRECATED（新增）───────────────────────────────────
 *   Purpose         : 用户显式标记某个版本"不建议再使用"（跟是否为
 *                     最新版本无关，ACTIVE 或 FROZEN 的版本都可以被
 *                     显式 Deprecate）
 *   Payload         : { template_id }
 *   Required Fields : template_id
 *   Projection Updated: LIFE_WORKFLOW_TEMPLATES（status=DEPRECATED）,
 *                     LIFE_TIMELINE
 *   Example         : { template_id:"TPL-20260724-T1U2" }
 *   Version         : v5.1
 *   Source Module   : 41_BusinessRuleEngine.deprecateWorkflowTemplate
 *                     （显式调用，不会被 capture 新版本自动触发——
 *                     跟 WORKFLOW_TEMPLATE_FROZEN 是两件不同的事，
 *                     一个是自动的"降级为非默认"，一个是人工的"标记
 *                     不要用"）
 *   Destination Projection: 10_ProjectionEngine.projectWorkflowTemplateDeprecated_
 *
 * ── WORKFLOW_INSTANCE_CREATED（改名，取代 v5.0 的
 *    BUSINESS_RULE_INSTANTIATED）────────────────────────────────────────
 *   Purpose         : 从一个具体的 WorkflowTemplate 版本实例化出了一个
 *                     新的 Workflow（Instance），可能同时创建新 Project
 *   Payload         : { template_id, new_workflow_id, new_project_id
 *                     （可空，若实例化目标是挂到既有 Project 下而不是
 *                     新建 Project）}
 *   Required Fields : template_id, new_workflow_id
 *   Projection Updated: LIFE_WORKFLOWS（新增行，
 *                     instantiated_from_template_id +
 *                     template_version_at_instantiation 写入）,
 *                     LIFE_PROJECTS（若 new_project_id 非空，新增行，
 *                     instantiated_from_template_id 写入）,
 *                     LIFE_WORKFLOW_TEMPLATES（usage_count +1,
 *                     last_used_at 更新）, LIFE_TIMELINE
 *   Example         : { template_id:"TPL-20260724-T1U2",
 *                     new_workflow_id:"WKF-20260901-V5W6",
 *                     new_project_id:"PRJ-20260901-T5U6" }
 *   Version         : v5.1（v5.0 名为 BUSINESS_RULE_INSTANTIATED，
 *                     直接生成 Project；v5.1 生成的是 Workflow
 *                     Instance，Project 是否同时生成取决于调用方是否
 *                     提供 new_project_id）
 *   Source Module   : 41_BusinessRuleEngine.instantiateFromTemplate
 *   Destination Projection: 10_ProjectionEngine.projectWorkflowInstanceCreated_
 *
 * ── PROJECT_CONVERTED_TO_TASK（新增，v5.1 双向转换的反方向）───────────────
 *   Purpose         : 一个 Project 被降级/转换为一个 Task（前置条件：
 *                     无 Sub-Project、无非终态子 Task，见
 *                     00_Business_Rules.gs「一」）
 *   Payload         : { project_id, new_task_id }
 *   Required Fields : project_id, new_task_id
 *   Projection Updated: LIFE_PROJECTS（status=CONVERTED_TO_TASK,
 *                     converted_to_task_id）, Tasks（新增行，
 *                     source_project_id 指回源 Project）,
 *                     LIFE_TIMELINE（两条：源 Project 一条"转换离开"，
 *                     新 Task 一条"由转换诞生"）
 *   Example         : { project_id:"PRJ-20260710-L1M2",
 *                     new_task_id:"TSK-20260724-N3O4" }
 *   Version         : v5.1
 *   Source Module   : 42_ConversionEngine.convertProjectToTask
 *   Destination Projection: 10_ProjectionEngine.projectProjectConvertedToTask_
 */

// ============================================================
// 二、Reference Integrity 与本项目事件流的关系（v5.1 新增说明）
// ============================================================

/**
 * 00_Domain_Boundary.gs「七」/ 00_ADR.gs ADR-2026-07-24-012 要求
 * Execution 只能通过订阅本项目发布的 Event 来刷新它自己的 Reference，
 * 不能反过来直接写本项目任何表。这条契约不需要本项目新增任何事件
 * 类型来配合——本文件目录里已有的全部事件（既有 5 个 + v5.0 新增
 * 15 个 + 本次 v5.1 新增/改名 6 个）本身就是 Execution 唯一应该订阅
 * 的信号来源；本项目侧不需要为"给 Execution 用"这个目的单独发布任何
 * 专门格式的事件，Execution 该怎么解读、缓存、展示这些事件，完全是
 * 它自己的实现细节。
 */
