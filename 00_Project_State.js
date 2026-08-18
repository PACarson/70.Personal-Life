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
 *   设计：v5.2（Architecture Freeze，已冻结，见 00_ADR.gs 全部 21 条，
 *   新增 ADR-2026-07-24-021）
 *   实现：Sprint 1（Foundation）Reference Certified；Sprint 3
 *   （Integration）Reference Certified；Sprint 4（AI）Recovery →
 *   Contract Verified，Integration Pending（UI Entry Point 见「九」
 *   已有决定，具体指令/入口设计还没做）；UI Phase 0 Audit 已完成，
 *   Vertical Slice 1（Note→Task）、Slice 2（Task↔Project）均已
 *   Stable（代码 + 真实环境测试 + 真实浏览器验证三者都过），Slice 3
 *   （Project→Workflow，BusinessRule 三层模型）代码已写完，尚未跑
 *   Gate、尚未真实浏览器验证——见「十一」
 *   最后更新：2026-08-18
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
 *   （Sprint 4 已移到「八」，不再是"未开始"——Recovery 后 Contract
 *   Verified，Integration 待做）
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
// 五、Sprint 3（Integration）—— Reference Certified
// ============================================================

/**
 *   状态：✅ CERTIFIED（2026-08-16 第二次真实运行全部通过，详见「七」；
 *   同 Sprint 1 流程，见 ADR-2026-07-24-019）
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

// ============================================================
// 七、Sprint 1 + Sprint 3 Gate 重新运行（2026-08-16）—— 全部通过，
//     「六」的待确认状态解除
// ============================================================

/**
 *   背景：Sprint 4（AI）开发中途会话崩溃、容器重置后，2026-08-14 做了
 *   一次 Recovery + Architecture Audit（见「八」），审计发现「六」记录
 *   的"等 Carson 确认"这一步一直没有被正式确认过（Finding F1）。
 *   2026-08-16 在真实生产 Apps Script 环境把 Sprint 1 和 Sprint 3 两个
 *   Gate 都重新跑了一遍。
 *
 *   Sprint 1 Gate（runSprint1AcceptanceGate()，08:43:40–08:45:01）：
 *   6/6 通过（跟 2026-07-27 那次结果一致，没有回归）。
 *
 *   Sprint 3 Gate（runSprint3AcceptanceGate()，08:47:19–08:48:59）：
 *   4/4 通过（对比「六」记录的第一次真实运行 2/4——Bug 1/Bug 2 的修复
 *   这次得到真实环境验证，不再只是"代码交付了但没确认"）：
 *     ✅ Note Lifecycle Test
 *     ✅ Business Rule Full Cycle Test（过程中 IdempotencyManager 正确
 *        拦截了一次重复创建："BusinessRule 已存在（并发安全），跳过
 *        创建"——这不是失败，是判重机制按设计生效的证据）
 *     ✅ Bidirectional Conversion Test
 *     ✅ Reminder Connector Smoke Test
 *
 *   结论：Sprint 1 与 Sprint 3 均可视为 Reference Certified。「六」
 *   的待确认状态到此解除。
 */

// ============================================================
// 八、Sprint 4（AI）—— Recovery → Contract Verified →
//     Integration Pending（2026-08-14 起，见 ADR-2026-07-24-021）
// ============================================================

/**
 *   背景：Sprint 4 开发中途，执行环境用量耗尽、容器文件系统被重置。
 *   仅 46_AIConnector.gs / 22_PriorityEngine.gs（AI 增量）/
 *   47_AIPlanningEngine.gs 三个文件成功救回；40_ReviewEngine.gs 和
 *   本文件（00_Project_State.gs）的 Sprint 4 修改确认丢失（两者现存
 *   内容均为干净的 Sprint 3 baseline，无残缺痕迹）。
 *
 *   2026-08-14 Recovery + Architecture Audit：核实三个救回文件语法、
 *   依赖、契约、引用的治理依据（ADR-009、Architecture Principle 9、
 *   Domain Boundary、workflow_shape 字段名）均真实准确，未发现 P0
 *   问题。审计中一处初判为"新架构例外"的问题（47→17_NoteQueryEngine）
 *   经进一步核实，确认属于 40/41 已有的 Domain→QueryEngine 常规读取
 *   模式，不是新例外，详见 ADR-2026-07-24-021。
 *
 *   Governance Registration（2026-08-14）：00_File_Map.gs、
 *   00_Module_Responsibility.gs 补录三个文件；00_Known_Limitations.gs
 *   新增「四」，把三个新 AI 函数记为 Internal Capability, Not Yet
 *   Exposed（跟既有 suggestPriority() 先例同一处理方式，不是遗漏）。
 *
 *   Contract-level Tests（2026-08-16 真实环境运行，
 *   37_Tests_AIEngines.gs）：12/12 通过——覆盖 AI 合法/非法/缺字段
 *   响应、AIConnector 报错原样传播、46 自身对非 200 响应与 ```json
 *   代码块的处理。
 *
 *   当前状态：Contract Verified、真实环境 Unit 级测试通过。仍然
 *   Integration Pending——没有任何 Telegram 或其它入口能触达这三个
 *   AI 函数，也没有 Integration/Failure/Regression Tests 覆盖"人类
 *   确认后走 27/28/20 创建实体"这条完整链路（这条链路本身也还不
 *   存在）。指令/入口设计留给「九」UI Phase 决定，不在 Sprint 4
 *   范围内单独仓促决定。
 */

// ============================================================
// 九、UI Phase 0（Architecture Audit）—— 2026-08-16 启动
// ============================================================

/**
 *   Sprint 1、Sprint 3 均已 Certified，Sprint 4 三个 AI 文件 Contract
 *   Verified 之后，Carson 决定先做 UI，而不是先补 Telegram 指令层——
 *   方向是 Google Apps Script HtmlService Web App（responsive，
 *   desktop/tablet/mobile browser），明确排除 Telegram Command UI
 *   作为第一阶段方案。
 *
 *   Phase 0 范围：只做 Architecture Audit，不写任何 UI 代码。先验证
 *   Note → Task 这一个 Vertical Slice 能不能走通 UI → Command/Engine →
 *   Event → Projection → UI 完整闭环，其余（Task→Project、
 *   Project→Workflow→Task、Priority+AI Recommendation）留到 Slice 1
 *   稳定之后。
 *
 *   状态：Phase 0 Audit 完成（UI_Architecture_Audit_Phase0.md）。部署
 *   位置决定：Option A——UI 归属并部署在 Personal Life OS 自己项目里，
 *   不放 Personal AI Core（避免过早引入跨项目复杂度，Core 保留为 AI
 *   Infrastructure / Coordination Layer，Personal Life OS 通过既有
 *   approved 集成机制调用它，不是反过来）。身份决定：核实过
 *   07_IdentityEngine.gs 只是内容去重哈希生成器，没有 Actor/User
 *   Identity 概念——不复用 Telegram chatId 当 Web Identity，改用
 *   Session.getEffectiveUser().getEmail() 作为 decision_owner；chat_id
 *   参数位继续传真实 SecureConfig 'TELEGRAM_CHAT_ID'（因为
 *   03_Output.sendMessage/43_ReminderConnector 把 chat_id 当真实
 *   Telegram 投递地址用，混入非 Telegram 值会导致提醒静默送不出去——
 *   这是核实过的真实风险）。
 *
 *   Slice 1（Note → Task）代码已写完：50_UIBridge.gs（3 个 Public API
 *   + doGet 入口）+ ui_index.html（Notes 面板，其余导航项禁用/标 soon）
 *   + 38_Tests_UIBridge.gs（8 个 Positive/Negative/Integrity 测试）。
 *
 *   2026-08-16 第一次真实环境跑 38_Tests_UIBridge：7/8 通过，
 *   testUIBridge_ConvertNoteToTask_Success_ 失败——发现一个既有 Bug（不
 *   在这次新写的文件里）：42_ConversionEngine.convertNoteToTask 内部
 *   拼 TaskEngine.createTask 的 meta 时用的是写死的对象，没有转发
 *   decision_owner，转换出来的 Task 会静默丢失调用方传入的
 *   decision_owner、回退成 chat_id。已修复（补一行字段转发，不影响
 *   其它调用方的既有 fallback 行为），2026-08-16 重新跑
 *   38_Tests_UIBridge：8/8 通过。这处修改碰的是 Sprint 3 已 Certified
 *   的文件，建议之后找机会重新跑一次 Sprint 3 Gate 确认没有回归（目前
 *   还没有专门为这一处改动重新跑过，只跑了 UI Bridge 自己的 Gate）。
 *   同一 Bug 模式在 convertTaskToProject 里也存在，Slice 2 用到时再
 *   处理，这次没动。
 *
 *   Carson 手动通过真实浏览器界面测试时曾报告：第 1 条 Note 转换正常
 *   （Sheet 里有对应 Task），第 2、3 条转换后 UI 显示完成，但 Sheet
 *   里没看到对应 Task 行。2026-08-16 Carson 确认这个疑似问题已解决
 *   （具体原因未展开说明，按已解决处理，不重新展开排查）。
 *
 *   治理文档已补齐：00_File_Map.gs「二」「三」、
 *   00_Module_Responsibility.gs「十四」、00_Data_Ownership.gs「六」。
 *
 *   状态：Slice 1（Note → Task）Stable——Bridge 层 Contract Verified
 *   （8/8，真实环境），真实浏览器手动验证通过，此前的未确认项已由
 *   Carson 确认解决。
 */

// ============================================================
// 十、UI Phase 0 → Slice 2（Task ↔ Project，2026-08-16）
// ============================================================

/**
 *   代码已写完：50_UIBridge.gs 新增 4 个函数
 *   （ui_getConvertibleTasks/ui_getActiveProjects/
 *   ui_convertTaskToProject/ui_convertProjectToTask）；ui_index.html
 *   加了 Tasks/Projects 两个面板 + 面板切换逻辑；
 *   38_Tests_UIBridge.gs 新增 7 个测试（含专门测 ADR-2026-07-24-015
 *   降级前置校验的两个 Integrity Test：Sub-Project 未处理 / 未完成
 *   Task 未处理）。
 *
 *   顺手修了 convertTaskToProject 里同一个 decision_owner 不转发的
 *   Bug（Slice 1 那次在 convertNoteToTask 发现的同一模式，这次没有
 *   等测试再发现一次，直接改）。
 *
 *   一个已知、这次没有修的限制：Project→Task 方向
 *   （TaskEngine.createTaskFromConversion_）的字段映射按其自身 JSDoc
 *   明确是"预留，不接受调用方覆盖"，decision_owner 固定 fallback 成
 *   chat_id，跟另外两个方向不对称。没有动它——那是它自己文档里说好
 *   留到以后再决定的行为，不是这次 Slice 2 该顺手改的范围。
 *
 *   状态：Slice 2（Task ↔ Project）Stable——Bridge 层 Contract Verified
 *   （15/15，真实环境，Slice 1+2 一起重跑无回归），2026-08-18 真实
 *   浏览器三个场景全部确认：Task→Project 卡片即时迁移；Project→Task
 *   空项目降级顺畅；Project→Task 受阻项目暖色提示清晰、不跟真实报错
 *   混淆。Vertical Slice 3（Project → Workflow → Task，含 Business
 *   Rule → Workflow Template → Workflow Instance 三层）开始，先做
 *   研究，再动代码——Carson 原文档特别强调这三层"不能混淆"，值得比
 *   Slice 1/2 多花一点时间先把机制看清楚。
 */

// ============================================================
// 十一、UI Phase 0 → Slice 3（Project → Workflow → Task，2026-08-18）
// ============================================================

/**
 *   研究先行确认了三层模型的准确机制（41_BusinessRuleEngine.gs 头部
 *   注释 + captureAsWorkflowTemplate/instantiateFromTemplate 源码）：
 *   BusinessRule（顶层分类）1-N WorkflowTemplate（版本，capture 时
 *   自动给上一个 ACTIVE 版本打 FROZEN）1-N Workflow Instance（永久
 *   绑定创建时的具体版本）。"Project → Workflow" 不是一次直接转换，
 *   是两个独立动作：Capture（现有 Project 结构"拍照"存成
 *   WorkflowTemplate，不产生 Workflow）+ Instantiate（拿一个
 *   WorkflowTemplate 生成全新的 Project + Workflow + 一批 Task）。
 *
 *   代码已写完：50_UIBridge.gs 新增
 *   ui_captureProjectAsTemplate(projectId, ruleName)、
 *   ui_instantiateTemplate(templateId)；ui_index.html 的 Project 卡片
 *   加了"Capture as Template"（进度式内联表单，输 rule name），
 *   Capture 成功后就地展示"Instantiate Now"；
 *   38_Tests_UIBridge.gs 新增 7 个测试，重点覆盖三层不混淆：同一
 *   Project 重复 Capture 应该在同一个 BusinessRule 下生成新版本
 *   （不是新建一个 BusinessRule）、同一 Template 实例化两次应该产生
 *   两组完全独立的 Project/Workflow/Task（不能互相污染）。
 *
 *   已知缺口，这次没有解决：19_BusinessRuleQueryEngine.gs 没有"列出
 *   全部 Template"的读接口——当前 UI 只支持"刚 Capture 完立刻
 *   Instantiate"，没法做一个"浏览我所有模板、过几天回来用"的面板。
 *   需要时再加一个新的 QueryEngine 读函数，这次范围内没有必要碰。
 *
 *   状态：Written，尚未在真实环境跑 runUIBridgeSlice3Gate()、尚未真实
 *   浏览器点击验证 Capture → Instantiate 这条交互。
 */

// ============================================================
// 十二、Open Items（还没有被处理、也不属于上面任何一个 Sprint/Slice
//      状态行的独立事项，避免开新窗口后被忘记）
// ============================================================

/**
 *   1. 改名成 "Life OS"（Carson 2026-08-14 提出，见 Sprint4_Recovery_
 *      Audit.md「7.7」）：目前只在文档/记忆里采用了新名字，代码库本身
 *      （文件头"Personal Life OS v5.2"、Library Identifier
 *      PersonalLifeOS、GAS 项目名）完全没有动过，Carson 也还没有回复
 *      要不要现在做、什么时候做。建议：等这一整轮 UI Vertical Slice
 *      （1-4）都稳定后再单独做一次 Rename Migration，不要现在顺手做。
 *
 *   2. 19_BusinessRuleQueryEngine.gs 缺"列出全部 Template"的读接口
 *      （见「十一」）——Slice 3 UI 目前只能"刚 Capture 完立刻用"，
 *      不能"浏览所有已存模板"。
 *
 *   3. TaskEngine.createTaskFromConversion_ 的 decision_owner 固定
 *      fallback 成 chat_id，跟 convertNoteToTask/convertTaskToProject
 *      两个方向不对称（见「十」）——该函数自身 JSDoc 说明这是"预留，
 *      暂不接受调用方覆盖"，不建议在没有明确决定"是否要开放覆盖"之前
 *      顺手改掉。
 *
 *   4. Vertical Slice 4（Priority + AI Recommendation）尚未开始——
 *      要用到的三个 AI 函数（22/47 文件里）本身已经 Contract Verified
 *      （见「八」），缺的是这一层的 UI Bridge + 前端，跟 Slice 1-3 是
 *      同一个模式，届时可以直接参照。
 */

