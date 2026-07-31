/**
 * 00_Project_State.gs
 * Personal Life OS — Project State（当前实现进度快照）
 *
 * 这份文件不是设计包原本要求的 10 项之一——README.md「本包的生命周期」
 * 一直说好"实现阶段的具体决定进 00_Project_State.gs"，现在第一次真正
 * 有"状态"可记（代码写完、且在真实环境跑过验收），所以现在建立，跟
 * Carson 既有 Productivity OS 治理体系里的 00_Project_State.gs 是
 * 同一个角色：只记事实快照，不重复论证——论证在 00_ADR.gs。
 *
 * 更新方式：每次 Sprint 交付或 Gate 结果变化时更新，不需要每次代码
 * 小改动都来改这个文件。
 */

// ============================================================
// 一、当前版本
// ============================================================

/**
 *   设计：v5.2（Architecture Freeze，已冻结，见 00_ADR.gs 全部 20 条）
 *   实现：Sprint 1（Foundation）Reference Certified；Sprint 3
 *   （Integration）代码已交付，Gate 待跑
 *   最后更新：2026-07-27
 */

// ============================================================
// 二、Sprint 1（Foundation）— Reference Certified
// ============================================================

/**
 *   状态：✅ CERTIFIED（2026-07-27，见 00_ADR.gs ADR-2026-07-24-019
 *   Reference Domain Certification 条款）
 *
 *   证据：Carson 在真实生产 Apps Script 环境执行
 *   runSprint1AcceptanceGate()，6/6 测试通过：
 *     ✅ Migration Test
 *     ✅ Existing Data Compatibility Test
 *     ✅ Workflow Test（洗衣流程场景）
 *     ✅ Timeline Integrity Test
 *     ✅ Metadata Traceability Test
 *     ✅ Reference Contract Mock Test
 *   执行时间：2026-07-27 08:43:59–08:45:04（本地时区）
 *
 *   交付范围：Identity（07_IdentityEngine 扩展）、Task（20_TaskEngine
 *   扩展）、Project（新增 27_ProjectEngine）、Workflow（新增
 *   28_WorkflowEngine）、Timeline（10_ProjectionEngine 扩展 + 新增
 *   44_TimelineQueryEngine）、Query（新增 14/16_XxxQueryEngine +
 *   12_TaskQueryEngine 扩展）、Canonical Identity/Lifecycle（新增
 *   45_CanonicalRepresentation）、Schema（15_Setup 扩展 +
 *   11_ProjectionRebuilder 新增 migrateSchemaPersonalLifeOS）、
 *   验收测试（新增 35_Tests_Sprint1Acceptance）。
 *
 *   认证含义（见 ADR-2026-07-24-019 (b)）：Foundation 层模式
 *   （Identity/Task/Project/Workflow/Timeline/Query/Projection）
 *   即日起可被未来 Domain OS（Property OS 等）直接信任、复用，不需要
 *   重新验证这一层的正确性。
 */

// ============================================================
// 三、尚未开始
// ============================================================

/**
 *   Sprint 2（Execution）—— 不属于本项目，属于 Life Execution OS，见
 *   00_Domain_Boundary.gs
 *
 *   Sprint 4（AI）—— 未开始
 */

// ============================================================
// 四、七张新表去掉 LIFE_ 前缀（2026-07-27，ADR-2026-07-24-020）
// ============================================================

/**
 *   LIFE_PROJECTS/LIFE_WORKFLOWS/LIFE_TIMELINE/LIFE_NOTES/
 *   LIFE_REVIEWS/LIFE_BUSINESS_RULES/LIFE_WORKFLOW_TEMPLATES 改为
 *   Projects/Workflows/Timeline/Notes/Reviews/BusinessRules/
 *   WorkflowTemplates（PascalCase，跟既有 Tasks/ActiveTasks 一致）。
 *   已跨约 15 个代码文件 + 10 份设计文档全局替换完成。真实环境需要
 *   先跑 renameSheetsToPascalCase()（11_ProjectionRebuilder.gs）才能
 *   让改名后的代码找到正确的分页。
 */

// ============================================================
// 五、Sprint 3（Integration）—— 代码已交付，Acceptance Gate 待跑
// ============================================================

/**
 *   状态：🟡 代码已交付（2026-07-27），Reference Certified 待
 *   Carson 在真实环境跑 runSprint3AcceptanceGate() 后确认（同
 *   Sprint 1 流程，见 ADR-2026-07-24-019）
 *
 *   交付范围：Note（新增 29_NoteEngine + 17_NoteQueryEngine）、
 *   Review（新增 40_ReviewEngine + 18_ReviewQueryEngine）、
 *   BusinessRule 三层模型（新增 41_BusinessRuleEngine +
 *   19_BusinessRuleQueryEngine，覆盖 capture/deprecate/instantiate/
 *   suggest）、Conversion 双向（新增 42_ConversionEngine，
 *   Task↔Project 双向 + Note→Task/Project/GoalCandidate；
 *   20_TaskEngine/27_ProjectEngine 补上 Sprint 1 时预留但未落地的
 *   markTaskConverted_/createTaskFromConversion_/
 *   checkEligibleForTaskDemotion_/markProjectConvertedToTask_）、
 *   ReminderConnector（新增 43_ReminderConnector）、
 *   10_ProjectionEngine 扩展全部对应投影、验收测试（新增
 *   36_Tests_Sprint3Acceptance，补上 Sprint 1 Gate 明确挪出去的
 *   Business Rule/Workflow Template 场景 + Task⇄Project Test，见
 *   ADR-2026-07-24-019 (c)）。
 *
 *   Note/Review 归属判断（见「三」原有讨论）：Carson 未明确反对，
 *   按已记录的判断纳入 Sprint 3 交付。
 */

// ============================================================
// 六、Sprint 3 Gate 第一次真实运行（2026-07-29）—— 发现并修复两处真实
//     Bug（不是文件同步问题，是代码本身的错误）
// ============================================================

/**
 *   跑分：Note Lifecycle Test ✅、Reminder Connector Smoke Test ✅、
 *   Business Rule Full Cycle Test ❌、Bidirectional Conversion Test ❌
 *   （前一轮"部分文件没同步"的问题已解决——这两个测试能跑起来本身
 *   就证明了那一点）。
 *
 *   Bug 1：BusinessRules / WorkflowTemplates 建表定义（15_Setup.gs）
 *   漏了 identity 列（本设计包 00_Sheets_Structure.gs 也同样漏写）。
 *   后果：DeduplicationEngine 永远找不到已存在的 BusinessRule，第二次
 *   capture 同名规则时会在一个从未真正落盘的"幻影" rule_id 上继续
 *   操作，版本号/FROZEN 判断因此全错。修复：15_Setup.gs 两处建表
 *   定义补上 identity（放在最后一列，不插入中间——中间插入会让已有
 *   数据跟表头错位）；41_BusinessRuleEngine.createBusinessRuleDirect_
 *   补上 identity 字段赋值（原来也漏了）；
 *   11_ProjectionRebuilder.migrateSchemaPersonalLifeOS() 新增两行
 *   _appendMissingColumns_ 调用，修复 Carson 已经建好的旧表。
 *
 *   Bug 2：27_ProjectEngine.checkEligibleForTaskDemotion_ 调用
 *   getProjectsByParent(projectId) 漏了 ProjectQueryEngine. 前缀
 *   （同一文件另一处 archiveProject 里的调用是对的，这里是纯粹的
 *   复制/编写疏漏）。修复：加上前缀。
 *
 *   同时给 36_Tests_Sprint3Acceptance.gs 的
 *   testBusinessRuleFullCycle_ 加了提前 return（原本一个环节失败后
 *   还会继续往下跑，导致真正原因被后面的 JSON.parse 崩溃盖掉）；
 *   testReminderConnectorSmoke_ 加了"创建后查询回来确认真的落盘"的
 *   检查（原来只看 createProject 有没有抛异常，但 EventBus 会吞掉
 *   投影失败，不抛错不等于真的写进表里）。
 *
 *   状态：这一轮修复后的四个文件（15_Setup.gs、
 *   11_ProjectionRebuilder 追加函数、41_BusinessRuleEngine.gs、
 *   27_ProjectEngine.gs）已重新交付，等 Carson 重新跑
 *   runSprint3AcceptanceGate() 确认。
 */

