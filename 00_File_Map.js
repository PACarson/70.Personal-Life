/**
 * 00_File_Map.gs
 * Personal Life OS v5.2（Design Phase — Architecture Freeze）—
 * File Map
 *
 * 【2026-08-16 补充，UI Phase 0 → Slice 1，见 00_Project_State.gs「九」】
 * 50_UIBridge.gs + ui_index.html 补录进「二」「三」两节。不是版本号变化
 * （仍是 v5.2）。
 *
 * 【2026-08-14 补充，Sprint 4 Recovery，见 ADR-2026-07-24-021】
 * 46_AIConnector.gs / 47_AIPlanningEngine.gs 补录进「一」「二」「三」
 * 三节；22_PriorityEngine.gs 的依赖列表补上 Sprint 4 新增的
 * 46_AIConnector 依赖。不是版本号变化（仍是 v5.2），是治理文档补录之前
 * 遗漏的两个文件——文件本身在一次会话崩溃前就已经写好，只是没有同步
 * 进本文件（详见该次 Recovery Audit 报告）。
 *
 * Changelog: v5.1 → v5.2——新增 45_CanonicalRepresentation.gs
 * （Foundation 层，见下方「一」）。
 *
 * Changelog: v5.0 → v5.1——41_BusinessRuleEngine.gs 现在同时管理
 * LIFE_BUSINESS_RULES 和 LIFE_WORKFLOW_TEMPLATES 两张表；
 * 19_BusinessRuleQueryEngine.gs 同步扩展读取范围。无新增文件编号
 * （三层模型 / 双向转换 / Branch Policy 全部通过扩展既有文件实现，
 * 不需要新开号段）。
 *
 * 本文件对应需求「8. File Map」。结构沿用 Productivity OS 既有
 * 00_File_Map.gs 的三段式（一、按 Blueprint 分类的文件详情；二、模块
 * 依赖关系图；三、Architecture Layer Map），扩大到本次新增的全部文件。
 * 编号策略：既有文件编号不变（不做任何改名/挪号，理由见
 * 00_ADR.gs ADR-2026-07-24-003 同一种判断标准），新文件插入既有编号
 * 体系里本来就空着的号段（14/16/17/18/19，Query Engine 用）和新开的
 * 27-29 + 40-44 号段（Domain/Application Engine 用），不占用 30-39
 *（既有 Tests 号段，34 已被 Productivity OS 占用）。
 */

// ============================================================
// 一、文件详情（按 Blueprint 分类）
// ============================================================

/**
 * ── 0. Governance（不变，8个文件，实现阶段并入本设计包10份文件的内容）──
 *   00_ADR.gs / 00_Architecture_Review.gs / 00_Command_Reference.gs /
 *   00_File_Map.gs / 00_Known_Limitations.gs /
 *   00_Project_Constitution.gs / 00_Project_State.gs / 00_Roadmap.gs
 *
 * ── 1. Foundation（既有5个扩展，无新文件）──────────────────────────────
 *   01_SecureConfig.gs        （不变）
 *   02_EventBus.gs             （扩展：新增15个事件类型的文件头文档，
 *                              见 00_Event_Flow.gs）
 *   03_Output.gs                （不变）
 *   05_SheetUtils.gs              （不变，新表复用同一套
 *                              getSheet_/upsertRowByKey_ 等工具）
 *   07_IdentityEngine.gs            （扩展：新增4个
 *                              generateXxxIdentity 纯函数）
 *   09_TemporalParser.gs               （不变，Workflow 级 Recurring
 *                              复用其日期计算，不改动它本身）
 *
 * ── 2. Runtime / Application（既有6个扩展 + 6个新文件）─────────────────
 *   06_TaskIntentParser.gs      （扩展：新增 PROJECT_CREATE/
 *                              NOTE_CREATE/REVIEW_* 等意图，实现阶段
 *                              落地）
 *   08_DeduplicationEngine.gs    （扩展：覆盖新实体类型）
 *   09_IdempotencyManager.gs       （扩展：覆盖新实体类型的
 *                              createXxxIfNotExists）
 *   10_ProjectionEngine.gs           （扩展：新增6个实体的 project*_
 *                              函数 + 无条件的 LIFE_TIMELINE 追加逻辑）
 *   11_ProjectionRebuilder.gs           （扩展：新增6个 rebuildXxx
 *                              Projection 函数 +
 *                              migrateSchemaPersonalLifeOS()）
 *   12_TaskQueryEngine.gs                  （扩展：新增
 *                              project_id/workflow_id 相关查询）
 *   13_ActiveTasksEngine.gs                  （不变）
 *   14_ProjectQueryEngine.gs                    【新增】
 *   15_Setup.gs                                    （扩展：建表清单
 *                              新增六张表）
 *   16_WorkflowQueryEngine.gs                         【新增】
 *   17_NoteQueryEngine.gs                                【新增】
 *   18_ReviewQueryEngine.gs                                 【新增】
 *   19_BusinessRuleQueryEngine.gs                               【新增，
 *                              v5.1 扩展读取 LIFE_WORKFLOW_TEMPLATES】
 *   44_TimelineQueryEngine.gs                                      【新增】
 *
 * ── 2.5 Domain（既有7个不变 + 6个新文件）────────────────────────────────
 *   20_TaskEngine.gs           （扩展：见 00_Module_Responsibility.gs
 *                              「一」）
 *   21_RecurringEngine.gs        （不变，Task 级）
 *   22_PriorityEngine.gs           （扩展：双轨 Priority）
 *   23_SearchEngine.gs                （不变，仍只服务 Task）
 *   24_ViewEngine.gs                     （不变）
 *   25_DashboardEngine.gs                  （保留，见
 *                              00_ADR.gs ADR-2026-07-24-007，
 *                              Accepted——v5.1 两轮评审后已定稿）
 *   26_AnalyticsEngine.gs                      （不变）
 *   27_ProjectEngine.gs                           【新增，v5.1 增加
 *                              降级转换相关函数】
 *   28_WorkflowEngine.gs                              【新增，v5.1
 *                              重写 Branch 处理为可配置 Policy】
 *   29_NoteEngine.gs                                     【新增】
 *   40_ReviewEngine.gs                                      【新增】
 *   41_BusinessRuleEngine.gs                                   【新增，
 *                              v5.1 起同时管理 LIFE_BUSINESS_RULES +
 *                              LIFE_WORKFLOW_TEMPLATES 两张表，见
 *                              00_Module_Responsibility.gs「六」】
 *   42_ConversionEngine.gs                                        【新增，
 *                              v5.1 增加 Project→Task 反方向】
 *   45_CanonicalRepresentation.gs                                    【v5.2
 *                              新增，纯函数，见
 *                              00_Module_Responsibility.gs「十」】
 *
 * ── 4. Integration（1个新文件）───────────────────────────────────────
 *   43_ReminderConnector.gs                                          【新增】
 *
 * ── 4.5 Operations（无新文件，逻辑并入 11_ProjectionRebuilder.gs /
 *      15_Setup.gs，见上）
 *
 * ── 5. Testing（预留号段，本设计包不写代码）─────────────────────────────
 *   34_Tests_ReminderPolicy.gs（既有，不变）
 *   35_Tests_ProjectEngine.gs / 36_Tests_WorkflowEngine.gs / ...
 *      （预留，实现阶段按需创建，本设计包只占位号段）
 */

// ============================================================
// 二、模块依赖关系图（新增部分；既有 Productivity OS 依赖图不变）
// ============================================================

/**
 *   06_TaskIntentParser
 *     → 09_IdempotencyManager → { 20_TaskEngine, 27_ProjectEngine,
 *       28_WorkflowEngine, 29_NoteEngine }
 *     → 41_BusinessRuleEngine.suggestMatchingRules（Decision 阶段，
 *       只读建议）
 *     → 42_ConversionEngine（当用户明确发起转换指令）
 *
 *   27_ProjectEngine
 *     → 09_IdempotencyManager, 07_IdentityEngine, 14_ProjectQueryEngine
 *     ← 42_ConversionEngine（调用 createProjectFromConversion_）
 *     ← 41_BusinessRuleEngine（调用 createProjectFromBusinessRule_）
 *
 *   28_WorkflowEngine
 *     → 09_TemporalParser, 20_TaskEngine（批量创建）,
 *       07_IdentityEngine, 16_WorkflowQueryEngine
 *     ← 20_TaskEngine.completeTask（Branch 分支解决 /
 *       Workflow 完成检测触发）
 *
 *   29_NoteEngine
 *     → 09_IdempotencyManager, 07_IdentityEngine, 17_NoteQueryEngine
 *     ← 42_ConversionEngine（调用 markNoteConverted_）
 *
 *   40_ReviewEngine
 *     → 12_TaskQueryEngine, 14_ProjectQueryEngine, 26_AnalyticsEngine
 *
 *   41_BusinessRuleEngine
 *     → 14_ProjectQueryEngine, 27_ProjectEngine,
 *       19_BusinessRuleQueryEngine, 07_IdentityEngine
 *
 *   42_ConversionEngine
 *     → 20_TaskEngine.markTaskConverted_,
 *       27_ProjectEngine.createProjectFromConversion_,
 *       29_NoteEngine.markNoteConverted_, 07_IdentityEngine,
 *       02_EventBus
 *
 *   43_ReminderConnector
 *     → 02_EventBus（唯一依赖）
 *
 *   10_ProjectionEngine
 *     → 05_SheetUtils（读写全部 LIFE_ 表 + Tasks）
 *
 *   46_AIConnector（Sprint 4，Recovered → Contract Verified →
 *   Integration Pending，见 00_ADR.gs ADR-2026-07-24-021）
 *     → 01_SecureConfig, GAS 内建 UrlFetchApp（唯二依赖，Forbidden：
 *       Sheet/Events，见文件自身 Engine Contract）
 *
 *   47_AIPlanningEngine（Sprint 4，Recovered → Contract Verified →
 *   Integration Pending，见 ADR-2026-07-24-021）
 *     → 46_AIConnector, 17_NoteQueryEngine（读，不写；跟下面 22 的新
 *       依赖一样，属于 G2 说明的 Domain→QueryEngine 常规读取，不是
 *       Known Exception）
 *
 *   22_PriorityEngine（Sprint 4 增量，见十三、Module_Responsibility）
 *     → 新增 46_AIConnector（仅 suggestPriorityWithAI_ 使用）
 *
 *   50_UIBridge（UI Phase 0 Slice 1，见十四、Module_Responsibility，
 *   00_Data_Ownership.gs「五」）
 *     → 29_NoteEngine, 42_ConversionEngine, 17_NoteQueryEngine,
 *       01_SecureConfig（读 TELEGRAM_CHAT_ID）——同样是 Domain/
 *       Application 常规调用，不是新例外
 *     配套前端文件：ui_index.html（Presentation，纯静态，不在
 *     scriptExtensions 里，clasp 单独处理，不计入以上依赖图）
 *
 * 依赖方向铁律不变（见 00_Project_Constitution.gs 零之四）：一律从
 * Runtime/Intelligence 指向 Integration，禁止反向。
 *
 * G2（2026-08-14 补充，见 ADR-2026-07-24-021）：Domain 引擎依赖
 * Application 层 QueryEngine（例如 40_ReviewEngine → 12/14、
 * 41_BusinessRuleEngine → 14/19、现在的 47_AIPlanningEngine → 17）
 * 属于常规读取模式——QueryEngine 本来就是设计给"任何需要只读数据的层"
 * 用的（见 00_Command_Reference.gs G1），不计入下面这条"已知例外，
 * 不再新增"的名单。真正的 Known Exception 专指 Domain 直接依赖
 * Application 层"非 QueryEngine"的工具/编排逻辑（判重、日期解析这类），
 * 目前仍然只有两条，唯一沿用既有模式（28_WorkflowEngine 依赖
 * 09_TemporalParser 属于同一类"复用日期计算，不重新实现"的已记录例外，
 * 跟 21_RecurringEngine 那条是同一条例外原则的第二次应用，不是新开
 * 一类例外）——47_AIPlanningEngine 不构成第三条，因为它依赖的是
 * QueryEngine，不是同一类问题。
 */

// ============================================================
// 三、Architecture Layer Map（四层：Presentation/Application/Domain/
//     Infrastructure，扩展版）
// ============================================================

/**
 *   Presentation   : 06_TaskIntentParser.gs, 50_UIBridge.gs（2026-08-16
 *                    新增，UI Phase 0 Slice 1——跟 06 同一种角色，把
 *                    外部输入（这次是 HTTP/google.script.run，不是
 *                    Telegram 指令文本）转成对内部 Command/QueryEngine
 *                    的调用）
 *
 *   Application    : 08_DeduplicationEngine.gs, 09_IdempotencyManager.gs,
 *                    11_ProjectionRebuilder.gs, 12_TaskQueryEngine.gs,
 *                    14_ProjectQueryEngine.gs, 15_Setup.gs,
 *                    16_WorkflowQueryEngine.gs, 17_NoteQueryEngine.gs,
 *                    18_ReviewQueryEngine.gs,
 *                    19_BusinessRuleQueryEngine.gs,
 *                    43_ReminderConnector.gs, 44_TimelineQueryEngine.gs
 *
 *   Domain         : 07_IdentityEngine.gs, 09_TemporalParser.gs,
 *                    20_TaskEngine.gs, 21_RecurringEngine.gs,
 *                    22_PriorityEngine.gs, 23_SearchEngine.gs,
 *                    24_ViewEngine.gs, 25_DashboardEngine.gs,
 *                    26_AnalyticsEngine.gs, 27_ProjectEngine.gs,
 *                    28_WorkflowEngine.gs, 29_NoteEngine.gs,
 *                    40_ReviewEngine.gs, 41_BusinessRuleEngine.gs,
 *                    42_ConversionEngine.gs,
 *                    45_CanonicalRepresentation.gs（v5.2 新增，跟
 *                    07_IdentityEngine.gs 归同一层——纯函数、承载
 *                    跨实体的规范定义，符合 Domain 层"承载业务能力"
 *                    的定义，不是通用读写基础设施）,
 *                    47_AIPlanningEngine.gs（Sprint 4 新增——两个
 *                    Public API 都只产出建议、不落地任何实体，跟同层
 *                    其它"只读输入、只出建议/衍生数据"的 Engine 同类）
 *
 *   Infrastructure : 01_SecureConfig.gs, 02_EventBus.gs, 03_Output.gs,
 *                    05_SheetUtils.gs, 10_ProjectionEngine.gs,
 *                    13_ActiveTasksEngine.gs,
 *                    46_AIConnector.gs（Sprint 4 新增——不碰 Sheet/
 *                    Events，纯外部 I/O 桥接，跟 01_SecureConfig.gs 同类）
 *
 * 规则不变：低层不导入高层（Infrastructure 不知道 Domain 的存在）；
 * 每个文件恰好属于一层，不跨层（对照 UEF Checklist A3）。
 *
 * 42_ConversionEngine.gs 分层说明：它同时依赖三个 Domain 层的 Engine
 * （TaskEngine/ProjectEngine/NoteEngine），但自己仍归类为 Domain 层而
 * 不是 Application 层——因为它承载的是业务规则本身（"转换时状态怎么
 * 变、字段怎么映射"），不是通用的读写基础设施，符合 Domain 层"承载
 * 业务能力"的定义，而不是因为它调用别的 Domain 文件就该归类为更高层。
 */
