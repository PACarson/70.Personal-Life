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
 *
 * 【2026-10-16 修订——ADR-2026-10-16-035】上面一段是 v5.1 设计包当时的
 * 范围说明，原文保留，不改。自本次修订起，本文件的定位是 Personal Life
 * OS 项目事件词汇的预期权威目录（intended authoritative directory）：
 * 权威范围只有三项——事件词汇的成员资格、定义位置、定义状态。正式契约
 * 内容（Payload / Required Fields 等）仍以各事件现有、已批准的定义位置
 * 为准，本文件不复制它们。目录的结构见下面的「〇」。
 */

// ============================================================
// 〇、事件词汇目录（2026-10-16 新增，ADR-2026-10-16-035）
// ============================================================

/**
 * 〇.1 定位与图例
 *
 * 本节回答三个问题：某个事件类型是否在词汇表里（成员资格）、它的正式
 * 定义在哪里（定义位置）、它现在处于什么状态（定义状态）。它不回答"这个
 * 事件的契约是什么"——那是各事件现有、已批准的定义位置的事。
 *
 * 只有 A 类和 B 类是正式定义：满足 00_Project_Constitution.js 零之五的
 * Event Definition Standard，并位于权威位置。C、D、E、F 类都不是契约，没有
 * Required Fields。Accepted ADR 可以作为治理来源被引用，但 ADR 正文提到的
 * 字段不因此成为 Required Fields；观察到的 payload 同理。收录于本目录不代表
 * 任何事件被批准、被推荐，也不使它成为 Execution 的订阅信号（见 §二 之后
 * 的说明）。
 *
 *   A 已在 Constitution 零之五有正式定义（指针，不复制）
 *   B 已在本文件 §一有正式定义（指针，不复制；原文一字未改）
 *   C 已观察到、尚无正式定义（OBSERVED — NOT A CONTRACT）
 *   D 跨项目事件引用（外部契约 UNVERIFIED）
 *   E 历史定义指针（当前无法解析）
 *   F 已知不一致（未裁决）
 *
 * 证据状态用语：VERIFIED = 对下面的快照做了静态阅读；REPORTED = 只有治理
 * 文本或设计文档的记载；UNVERIFIED / UNRESOLVED = 没有足够证据；NOT A
 * CONTRACT = 仅为观察或引用，不是已批准契约。
 *
 * 证据基准：70_Personal-Life-main.zip（sha256 cbb10235e490…，2026-10-12
 * 12:54 打包）。下文的 file:line 以该快照为准，文件之后变化时行号可能失效。
 * 没有运行任何测试，没有任何实机（LIVE GAS）验证。
 */

/**
 * 〇.2 A 类——已在 Constitution 零之五有正式定义（5 个；定义留在原处）
 *   定义位置：00_Project_Constitution.js 零之五（Event Definition Standard
 *   格式）。状态：FORMAL DEFINITION（原位）；本次没有重新核对这些定义块的
 *   字段内容。
 *     TASK_CREATED     第 513–536 行
 *     TASK_UPDATED     第 537–556 行    另见 F 类 M2
 *     TASK_COMPLETED   第 557–569 行
 *     TASK_CANCELLED   第 570–579 行
 *     REMINDER_SENT    第 580–589 行    另见 D 类、F 类 M4
 */

/**
 * 〇.3 B 类——已在本文件 §一有正式定义（6 个；原文一字未改）
 *   定义位置：本文件 §一（按条目名查找）。状态：FORMAL DEFINITION（原位）；
 *   本次只核对了条目里引用的 Engine 函数与 projection 函数在上述快照中仍
 *   存在，没有重新核对字段内容。
 *     BUSINESS_RULE_CREATED、WORKFLOW_TEMPLATE_CAPTURED、
 *     WORKFLOW_TEMPLATE_FROZEN、WORKFLOW_TEMPLATE_DEPRECATED、
 *     WORKFLOW_INSTANCE_CREATED、PROJECT_CONVERTED_TO_TASK
 */

/**
 * 〇.4 C 类——已观察到、尚无正式定义（OBSERVED — NOT A CONTRACT）
 *   下面六个事件已作为观察条目收录。条目只记录证据，没有 Required Fields；
 *   "观察到的 payload"只是发布处所见，不是 schema，也不是契约。
 *
 * ── NOTE_ARCHIVED
 *   状态          : OBSERVED — 尚无正式定义
 *   发布位置      : 29_NoteEngine.js:140（archiveNote，129–146）
 *   触发路径      : UNRESOLVED——上述快照里没有找到 archiveNote 的任何调用
 *                   方，生产中是否真会发出该事件 UNKNOWN
 *   观察到的 payload: { note_id }
 *   消费／投影    : 10_ProjectionEngine.js dispatch :168 →
 *                   projectNoteArchived_（560–564）；在 TIMELINE_ENTITY_MAP
 *                   中；重放 29_NoteEngine.js:264
 *   相关 ADR / 文档: 无（已检索 ADR 与设计文档，没有提及）
 *   测试（已核对断言）: 无——没有测试调用 archiveNote
 *   未决问题      : 触发路径；状态语义与可逆性没有任何说明
 *   证据状态      : VERIFIED（静态阅读）
 *
 * ── NOTE_UPDATED
 *   状态          : OBSERVED — 尚无正式定义
 *   发布位置      : 29_NoteEngine.js:206（updateNote，162–213）
 *   观察到的 payload: 键集合随调用而变——note_id、被更新的白名单字段
 *                   （UPDATABLE_FIELDS = content、category）、内容或类别变化
 *                   时附带的 identity、updated_time
 *   消费／投影    : dispatch :170 → projectNoteUpdated_（579–586；note_id
 *                   之外的键整体拷贝，没有白名单）；重放 29_NoteEngine.js:274
 *   Timeline      : 不在 TIMELINE_ENTITY_MAP 中——是否有意 UNKNOWN，没有任何
 *                   文档说明
 *   相关 ADR / 文档: 没有 ADR 定义该事件。ADR-2026-09-02-030（Accepted）只在
 *                   C6 提到 Slice 3 为它补过 NoteEngine.deriveFromEvent 分支；
 *                   Personal_Life_OS_UIV2_Implementation_Plan_2026-09-01.md
 *                   （78–79 行）是计划性文字，不是决定
 *   测试（已核对断言）: 56_Tests_NoteEdit.js
 *                   testNoteEdit_EventEmittedAndProjected_（230–264）断言的是
 *                   Note 行的 content、identity 被更新，没有读取事件或 payload；
 *                   testNoteEdit_InvalidCategoryOnly_NoChange_（176–204）断言
 *                   返回 null 且无效类别没有写入。该文件其余测试的断言本次
 *                   未读
 *   未决问题      : Timeline 排除是否有意；局部更新 payload 的语义（哪些键
 *                   允许、identity 是否属于其中）
 *   证据状态      : VERIFIED（静态阅读）
 *
 * ── TASK_CONVERTED_TO_NOTE
 *   状态          : OBSERVED — 尚无 Standard 格式的正式定义
 *   发布位置      : 20_TaskEngine.js:614（markTaskConvertedToNote_，
 *                   594–621；唯一调用方 42_ConversionEngine.js:380
 *                   convertTaskToNote）
 *   观察到的 payload: { task_id, status:'CONVERTED', converted_to_note_id,
 *                   updated_time }
 *   消费／投影    : dispatch :165 → projectTaskConvertedToNote_（529–541；读取
 *                   task_id、converted_to_note_id，状态写死为 CONVERTED，不
 *                   读 payload.status）；在 TIMELINE_ENTITY_MAP 中；重放
 *                   20_TaskEngine.js:699
 *   相关 ADR      : ADR-2026-09-02-030（Accepted，2026-09-04）：C4 事件命名、
 *                   C5 投影与 Timeline 登记、C6 重放分支、A2 源任务状态
 *                   CONVERTED。该 ADR 没有给出完整的 payload schema，也没有
 *                   声明 Required Fields（正文没有 payload 字段清单）
 *   测试（已核对断言）: 54_Tests_TaskToNoteConversion.js
 *                   testTaskToNote_EventEmittedAndProjected_（181–218）断言
 *                   该任务恰有 1 条本事件（192–197）、payload 的
 *                   converted_to_note_id 等于新 Note 的 id（199–200）、重读的
 *                   任务状态为 CONVERTED（206）；
 *                   testTaskToNote_ReplayConsistency_（227–267）断言重放得到
 *                   的 converted_to_note_id 与实时一致（255）。没有断言
 *                   payload.status 与 updated_time。57_Tests_TaskToProject
 *                   Precheck.js 也调用 convertTaskToNote 一次，断言本次未读
 *   未决问题      : payload.status 是否属于契约；CONVERTED 的终态语义见
 *                   TASK_NOT_SELECTED 条目里提到的 BLOCKED 记录
 *   证据状态      : VERIFIED（静态阅读）
 *
 * ── TASK_NOT_SELECTED
 *   状态          : OBSERVED — 尚无正式定义
 *   发布位置      : 20_TaskEngine.js:531（markTaskNotSelected_，517–538；
 *                   唯一调用方 28_WorkflowEngine.js:262
 *                   handleBranchResolution_，244–279）
 *   观察到的 payload: { task_id }
 *   消费／投影    : dispatch :152 → projectTaskNotSelected_（332–352）；在
 *                   TIMELINE_ENTITY_MAP 中；重放 20_TaskEngine.js:684
 *   未解决的治理差异（原样保留，本条目不裁定）:
 *                   ADR-2026-10-06-033 D6(b) 与 Known Limitations「十四」把
 *                   CONVERTED / NOT_SELECTED 的终态语义记为 BLOCKED —
 *                   CONTRACT UNRESOLVED：代码把它们视为终态，Command
 *                   Reference G2(a) 写的是 DONE / CANCELLED。另有两条
 *                   Accepted ADR 涉及 NOT_SELECTED：ADR-2026-07-24-008 把它
 *                   描述为 AUTO policy 的终态结果，ADR-2026-07-24-017 把它
 *                   映射到规范状态 CANCELLED。它们没有命名本事件，也没有出
 *                   现在上述 BLOCKED 记录的引用里；它们与 BLOCKED 记录的
 *                   关系未裁决
 *   测试（已核对断言）: 无——没有测试经过本事件的发布路径；
 *                   62_Tests_ViewEngine.js 第 36、256 行明确写 NOT_SELECTED
 *                   的终态排除不在测试范围内
 *   未决问题      : 终态语义；上述 ADR 与 BLOCKED 记录的关系。本条目不重新
 *                   定义终态含义
 *   证据状态      : VERIFIED（静态阅读）
 *
 * ── VIEW_ORDER_UPDATED
 *   状态          : OBSERVED — 尚无 Standard 格式的正式定义
 *   发布位置      : 20_TaskEngine.js:478（updateTaskOrder，467–498）
 *   观察到的 payload: { context_key, ordered_task_ids, chat_id }（发布处
 *                   478–482 所见；设计材料描述的键相同，见下）
 *   消费／投影    : dispatch :179 → projectViewOrderUpdated_（693–697；三个键
 *                   缺一个会静默返回）；重放由 11_ProjectionRebuilder.js:631
 *                   与 11_ProjectionRebuilder__UI_I6_ADDITIONS.js:56 处理
 *   Timeline      : 有意不进 TIMELINE_ENTITY_MAP（10_ProjectionEngine.js 的
 *                   map 注释；00_Drag_Ordering_ADR.js 698–701）
 *   相关 ADR / 文档: ADR-2026-08-26-026（Accepted，2026-09-11；ADR 自称
 *                   LIVE VERIFIED——只是 ADR 自己的记录，REPORTED，本次
 *                   没有复核）及设计材料 00_Drag_Ordering_ADR.js（H.3 的
 *                   事件语义 424–436，J.5 647–655，J.6 698–701）。它们描述了
 *                   事件粒度、payload 的键和投影方式，但没有 Required Fields
 *                   声明；所描述的字段不自动成为 Required Fields
 *   测试（已核对断言）: 58_Tests_DragOrdering.js
 *                   testUpdateTaskOrder_PersistsAndReadsBack_（52–78）断言读
 *                   回的 order_index；testUpdateTaskOrder_RejectsInvalidInput_
 *                   （146–167）断言空 contextKey、空数组、null、空 chatId 会
 *                   抛错；testRebuildTaskViewOrderProjection_MatchesLiveState_
 *                   （251–283）断言重放结果等于最后一次事件的顺序、且与重放
 *                   前状态一致。没有任何断言读取事件对象或 payload
 *   未决问题      : 三个键是否都属于契约；context_key 的格式；chat_id 与
 *                   发布参数重复
 *   证据状态      : VERIFIED（静态阅读）
 *
 * ── WORKFLOW_UPDATED
 *   状态          : OBSERVED — 尚无正式定义
 *   发布位置（两处，payload 形状不同；都只是观察，没有指定哪一种是规范
 *   形状）        :
 *                   28_WorkflowEngine.js:147（startWorkflow，143–154）
 *                     { workflow_id, status:'IN_PROGRESS', updated_time }
 *                   28_WorkflowEngine.js:359（spawnNextWorkflowIfNeeded，
 *                   305–366；只在 spawnFailed 分支内发布，358–361；由
 *                   finishWorkflow 在 :174 调用）
 *                     { workflow_id, status:'DRAFT' }
 *   消费／投影    : dispatch :159 → projectWorkflowUpdated_（480–487；
 *                   workflow_id 之外的键整体拷贝，没有白名单）；在
 *                   TIMELINE_ENTITY_MAP 中；重放 28_WorkflowEngine.js:378
 *   相关 ADR      : 没有 ADR 命名本事件或定义其 payload。ADR-2026-07-24-017
 *                   （Accepted）列出 Workflow.status 的规范取值（DRAFT /
 *                   READY / IN_PROGRESS / COMPLETED / CANCELLED）；
 *                   ADR-2026-07-24-008 只定义 WAITING policy（见 Project
 *                   State「六十六」）
 *   测试（已核对断言）: 35_Tests_Sprint1Acceptance.js testWorkflowScenario_
 *                   （146–199，已读 153–176）断言 startWorkflow 返回值的
 *                   status 为 IN_PROGRESS，以及第一个任务完成后 Workflow 没
 *                   有被误判为 COMPLETED；没有断言读取事件或 payload。没有
 *                   测试调用 finishWorkflow 或 spawnNextWorkflowIfNeeded
 *   未决问题      : 规范 payload 形状；与 WORKFLOW_STARTED / FINISHED /
 *                   CANCELLED 的语义边界在现有文本里没有说明。本条目不发明
 *                   规范契约
 *   证据状态      : VERIFIED（静态阅读）
 */

/**
 * 〇.5 D 类——跨项目事件引用（外部契约 UNVERIFIED）
 *   下列条目只登记引用位和本项目一侧所见；外部项目的生产方、消费方、
 *   payload 契约与所有权在取得权威证据之前一律视为未验证。
 *
 * ── REMINDER_REQUESTED（另见 E 类、F 类 M3）
 *   本项目一侧    : 43_ReminderConnector.js:48、66 两处发布；在本项目内没有
 *                   dispatcher case、不在 TIMELINE_ENTITY_MAP 中、没有
 *                   Standard 格式定义（VERIFIED）
 *   外部消费方    : UNVERIFIED——上述快照里没有来自 Reminder OS 的权威证据。
 *                   00_Implementation_Plan_TaskReminder_EventConsumer.js 的
 *                   状态是 Plan — Pending Review（2026-08-27），它是计划，
 *                   不是证据；本目录不声称 Reminder OS 消费该事件
 *   payload       : 本目录不记录（外部契约 UNVERIFIED）
 *
 * ── REMINDER_SENT（正式定义在 A 类；此处只登记跨项目状态）
 *   正式定义      : Constitution 零之五；其 Source Module 字段写的是
 *                   Reminder OS
 *   本项目内发布点: 没有找到——上述快照里没有任何 EventBus.publish 发布它
 *                   （VERIFIED）；dispatch 有对应 case
 *   实际生产方    : UNVERIFIED，本目录不推断
 *   相关说法互不一致: 见 F 类 M4
 *
 * ── Personal AI Core 的 Inventory 事件
 *   仅登记引用位：02_EventBus.js 文件头（29–38 行）说明 Inventory 相关事件的
 *   写入路径是 Core 自己的 02_EventBus.gs，并与本项目共用同一张 Events 表
 *   （REPORTED——Core 的代码不在上述快照里）。事件名称与契约没有任何证据，
 *   本目录不列名称。
 */

/**
 * 〇.6 E 类——历史定义指针（当前无法解析）
 *   本文件文件头（12–17 行）把下列 13 个 v5.0 事件称为"定义不变，见 v5.0
 *   存档版本或 00_Project_Constitution.gs 零之五"。在上述快照里：v5.0 存档
 *   版本不在仓库；零之五只有 A 类那 5 个事件，不含它们；也没有找到它们的
 *   Standard 格式定义。因此这 13 个事件的正式定义 UNRESOLVED。它们在代码里
 *   都已观察到发布点（VERIFIED），但本目录不为它们记录 payload、Required
 *   Fields 或其它契约内容，也不推测它们的历史定义。
 *     PROJECT_CREATED、PROJECT_UPDATED、PROJECT_COMPLETED、PROJECT_CANCELLED、
 *     PROJECT_ARCHIVED
 *     WORKFLOW_STARTED、WORKFLOW_FINISHED、WORKFLOW_CANCELLED
 *     NOTE_CREATED、NOTE_CONVERTED
 *     TASK_CONVERTED_TO_PROJECT、REVIEW_GENERATED
 *     REMINDER_REQUESTED（另见 D 类）
 */

/**
 * 〇.7 F 类——已知不一致（只记录，不裁决；不改代码，不改其它文档）
 *   M1 文件头事件清单：Constitution 720–724、Architecture 182–183、File Map
 *      51–52 说 02_EventBus 文件头注释里有事件类型清单。上述快照里
 *      02_EventBus.js 的文件头（1–65 行）没有这样的清单，只在 32 行的一句话
 *      里提到 4 个事件名。
 *   M2 TASK_UPDATED 的发布点：20_TaskEngine.js:334 与 28_WorkflowEngine.js:272
 *      各有一处发布（后者带 status 字段，代码注释称为"例外"）；Constitution
 *      553–554 的定义块写"唯一发布方"。该例外是否有意，没有治理记录。两处
 *      发布点都没有被改动，本目录不裁决。
 *   M3 REMINDER_REQUESTED：本项目发布（43_ReminderConnector.js:48、66），
 *      但没有 dispatcher case、没有 Timeline 条目、没有 Standard 格式定义；
 *      外部消费方 UNVERIFIED（见 D 类）。
 *   M4 REMINDER_SENT 的写入方：Constitution 587–588 的 Source Module 写
 *      Reminder OS；Constitution 666 与 02_EventBus.js 32–34 的说法把它放在
 *      本项目一侧的写入路径上。上述快照里没有发布点；实际生产方 UNVERIFIED，
 *      不推断。
 *   M5 Constitution 666 写"本项目只追加自己的 TASK_ 开头和 REMINDER_SENT
 *      事件"；上述快照里本项目发布 29 种事件类型，其中以 TASK_ 开头的有 7
 *      种，REMINDER_SENT 没有发布点。本目录不对这个差异给出历史解释。
 *   M6 本文件文件头点名的 v5.0 事件有 13 个，而 §二（原文）与 File Map 51
 *      行写"v5.0 新增 15 个"。
 *   M7 Architecture 371、375 引用本文件的"Timeline 投影规则"与
 *      Cross-Domain 示例/流程 B，本文件里没有这些章节。
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

/**
 * 【2026-10-16 说明——ADR-2026-10-16-035；上面 §二 的原文一字未改】
 * 本文件新增的「〇」节（事件词汇目录）只说明各事件类型在词汇表里的状态，
 * 不对 Execution 的订阅范围作任何声明，也不重新定义它。§二 所指的集合以
 * §二 原文的列举为准（既有 5 个 + v5.0 新增 15 个 + 本次 v5.1 新增/改名
 * 6 个）；「〇」节里的 C 类（观察）、D 类（跨项目引用）条目不因收录于本
 * 目录而被并入该集合，收录也不使任何条目成为已批准的契约。Execution 该
 * 订阅哪些事件，不由本文件、也不由 ADR-2026-10-16-035 决定。
 */
