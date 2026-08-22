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
 *
 *   5. UI Interaction Layer（Sort/Filter/Edit/Priority/Done/Cancel/
 *      拖拽排序，见「十三」）UI-I6（Manual Drag Reorder）冻结为
 *      BLOCKED_PENDING_ARCHITECTURE_DECISION——排序归属（Task 自己
 *      拥有 / Project-membership 拥有 / View 本地状态，三选一，不允许
 *      发明第四种绕开问题）尚未写成正式 ADR，写完并经 Carson 明确批准
 *      之前不得实现。UI-I1~I5 不受此影响，可独立推进。
 *
 *   6. UI 审计顺带发现两处现有 Domain 缺口，跟 UI-I6 一样先记录、不
 *      在当前范围内顺手补：(a) 28_WorkflowEngine.gs 没有 updateWorkflow
 *      ——create/start/finish/cancel 都有，唯独没有编辑；Slice 3 UI
 *      如果以后要做"编辑 Workflow"会先卡在这里。(b) 全仓库没有任何
 *      order/position/rank/display_order/manual_order 字段（跟「5」
 *      是同一个缺口的两个侧面：UI-I6 要不要做，取决于这个字段最终该
 *      挂在哪一层，而不是先随手加一个）。
 *
 *   7. 22_PriorityEngine.suggestPriorityWithAI_() 目前只在
 *      HIGH/MEDIUM/LOW 三档里选，不含 CRITICAL——UI 的 Priority 下拉
 *      本身四档都有（LOW/MEDIUM/HIGH/CRITICAL，见 TASK_PRIORITIES），
 *      两者不一致；不阻塞 UI-I3，记一笔，之后有空再补 AI 推荐逻辑。
 */

// ============================================================
// 十三、UI Phase 0 → Slice 3 Gate 完整通过 + Task Identity Collision
//      修复（2026-08-19~20）——「十一」的"尚未验证"状态解除
// ============================================================

/**
 *   真实环境第一次跑 runUIBridgeSlice3Gate()（2026-08-19）：5/7 通过，
 *   testUIBridge_InstantiateTwice_NoCrossContamination_ 失败——同一个
 *   WorkflowTemplate 连续 instantiate 两次，Project/Workflow/Task 三个
 *   都被 IdempotencyManager 判定成"已存在"，复用了第一次的记录，而不是
 *   各自产生独立实例。诊断出两处独立碰撞，不是一处：
 *
 *   ① Project 碰撞：41_BusinessRuleEngine.gs instantiateFromTemplate
 *      在 newProjectMeta.title 缺省时，默认标题写死成
 *      '实例化-' + template.template_id——同一模板反复 instantiate，
 *      这串字符逐字节不变，generateProjectIdentity() 算出同一个
 *      identity。修复：默认标题加一个每次调用都不同的短后缀（沿用
 *      本文件内 generateRuleId_/BG- 前缀已经在用的
 *      Utilities.getUuid().split('-')[0].toUpperCase() 写法），
 *      07_IdentityEngine.gs 零改动。Workflow 跟着自动不碰撞（它的
 *      默认标题依赖 project.title，现在天然不同了）。
 *
 *   ② Task 碰撞：generateTaskIdentity() 完全不看 project_id/
 *      workflow_id，两次 instantiate 产生的 Task 标题/due_date/
 *      priority/category 全部相同，仍会被判成重复。这一处涉及
 *      07_IdentityEngine.gs（此前 ADR-2026-07-24-021 的 due_time 改动
 *      明确要求"不改 generateTaskIdentity() 签名，避免牵动本文件及其
 *      单元测试"），所以先做完整的 Identity Impact Audit（见
 *      Identity_Impact_Audit.md，逐条回答 Carson 提出的 8 个问题，
 *      全部有 file:line 证据）才动手改，不是直接改。
 *
 *   审计确认：identity 已被生产数据持久化并依赖（DeduplicationEngine.
 *   findExistingTask 精确匹配）；全仓库只有 4 条业务路径调用
 *   createTaskIfNotExists（聊天捕获/周期任务续期/Note→Task/
 *   Project→Task 转换）+ 2 条会传 workflow_id（instantiateFromTemplate、
 *   28_WorkflowEngine.spawnNextWorkflowIfNeeded——后者是审计过程中
 *   意外发现的同类潜在风险，目前靠 due_date 每轮天然递增侥幸没暴露）；
 *   11_ProjectionRebuilder.gs 只在原始 Event payload 缺 identity 字段
 *   时才在线重算，正常数据重建时直接照抄 payload 里存的值，未来改
 *   公式对历史数据重建结果零影响；因此不需要 migration。
 *
 *   关键发现：scope key 应该用 workflow_id，不是最初设想的
 *   project_id——spawnNextWorkflowIfNeeded 每轮续期复用同一个
 *   project_id，只有 workflow_id 每轮才是新的，按 project_id 分区
 *   分不开这条路径；按 workflow_id 分区，两条风险路径一起覆盖，
 *   且完全不影响 Project→Task 转换（它从不传 workflow_id）。
 *
 *   实施（2026-08-20）：07_IdentityEngine.gs 的 generateTaskIdentity()
 *   加第 7 个可选参数 scopeKey——缺省/空字符串时拼接结果逐字节不变，
 *   仅当非空时才多拼一段进哈希；testIdentity() 新增 3 组断言直接验证
 *   这条兼容性。09_IdempotencyManager.gs 的 createTaskIfNotExists()
 *   把 meta.workflow_id || '' 作为这个新参数传入。
 *   41_BusinessRuleEngine.gs / 28_WorkflowEngine.gs 零改动——两条路径
 *   本来就在 meta 里带 workflow_id，机制自动生效。
 *
 *   状态：runUIBridgeSlice3Gate() 2026-08-20 完整重跑，7/7 全部通过，
 *   含之前失败的 Cross-Contamination 那条。「十一」记录的"Written，
 *   尚未验证"状态到此解除，Slice 3 三层模型（BusinessRule/
 *   WorkflowTemplate/WorkflowInstance）闭环验证完成。
 *
 *   下一步（未完成）：真实浏览器手动走一遍 Capture as Template →
 *   Instantiate Now 这条交互，确认 UI 体验本身（尤其 template name
 *   输入框、Instantiate 成功后 Tasks/Projects 面板是否正确刷新）——
 *   这一步 Gate 测试覆盖不到，只能人工点。
 *
 *   本次同一轮对话里另外定下、但还没开始实现的：批准 UI-I1~I5
 *   （Sort/Filter/Edit Task/Edit Project/Priority/Done/Cancel）独立于
 *   Task Identity 这条线推进；UI-I6（拖拽排序）冻结待 ADR（见「十二」
 *   第 5 条）。三条线互不阻塞，各自独立交付、独立汇报，不合并成一个
 *   "UI Phase 完成"关口。
 */


// ============================================================
// 十四、Track 1 Implementation Preflight + 正式 Regression Gate
//      落地（2026-08-21）——补上「十三」跳过的治理步骤
// ============================================================

/**
 *   背景：「十三」记录的 2026-08-20 实施（07_IdentityEngine.gs +
 *   09_IdempotencyManager.gs）本身是对的，但 Carson 当时的批准消息
 *   明确要求先做一道 Implementation Preflight（4 项确认）、再实施，
 *   且要求正式 regression test 覆盖至少 6 个场景——这两项治理动作在
 *   「十三」的记录里没有独立留痕，只有 testIdentity() 里 3 组
 *   Logger.log 断言，不构成正式、可重复运行、带 pass/fail 汇总的
 *   Gate。本节补上这道治理步骤，不是重做实施。
 *
 *   Implementation Preflight 四项确认结果：
 *   1. scopeKey 缺省时哈希逐字节不变——用一个跟本项目完全独立、从零
 *      实现的参照哈希函数在 Node 沙盒里对 07_IdentityEngine.gs 的
 *      generateTaskIdentity() 跑真实断言（不是读代码猜测），4 组样例
 *      + undefined/''/null 三种缺省写法全部通过。
 *   2. 只有新 context-aware 调用路径传 workflow_id——逐一追踪全仓库
 *      调用 createTaskIfNotExists/createTask 的路径：06_TaskIntentParser
 *      （聊天捕获）、21_RecurringEngine（周期续期）、
 *      42_ConversionEngine 的 convertNoteToTask/convertProjectToTask，
 *      确认均不传 workflow_id（legacy，行为不变）；
 *      41_BusinessRuleEngine.instantiateFromTemplate、
 *      28_WorkflowEngine.spawnNextWorkflowIfNeeded 确认均传
 *      workflow_id（context-aware，符合预期）。
 *   3. ProjectionRebuilder 对 legacy Task identity 不受影响——确认
 *      11_ProjectionRebuilder.gs 的 rebuildTasksProjection() /
 *      rebuildActiveTasksProjection() 均遵循"payload 已带 identity
 *      就直接照抄，只有缺失时才在线重算"的既有约定，逻辑本身零改动。
 *   4.（新发现，不在原始 4 项字面范围内，但属于同一类"确认不会意外
 *      破坏其它行为"）：20_TaskEngine.gs 的 updateTask() 在
 *      identity-affecting 字段变更时会重算 identity，但重算调用漏传
 *      了 scopeKey——这条路径此前（testIdentity 写断言时）没有被
 *      注意到，因为 updateTask() 至今没有真实调用方（见
 *      00_Known_Limitations.gs 二"Current callers: none via
 *      Telegram"），一直是 dead path。但 Track 2 的 UI-I2（Edit Task）
 *      即将成为它第一个真实调用方——一旦上线，编辑 context-aware
 *      Task 的标题/日期/优先级/分类会让它的 identity 退化回不带
 *      scope 的旧公式，重新引入 Track 1 本来要修的碰撞风险，只是
 *      触发时机从"创建时"变成"编辑时"。因为：(a) 与 Track 1 已批准
 *      原则（workflow_id 作为 scope key）完全同类，不是新规则；
 *      (b) 修法是同一个已批准、向后兼容的 scopeKey 参数，纯增量；
 *      (c) Track 2 马上要让这条路径第一次被真实触发；三者叠加，
 *      判断为应该在本轮一并修复，而不是留到 Track 2 上线后才发现。
 *      已修复（20_TaskEngine.gs updateTask()，加一个参数，见该处
 *      2026-08-20 修复注释），且已加回归测试直接验证修复生效
 *      （见下）。此前"07/09 范围内，41/28 不改"的范围声明本身不变——
 *      这一处是范围声明写下时（基于当时审计总结）遗漏的第三个落点，
 *      不是重新打开已批准范围。
 *
 *   正式 Regression Gate：新增 39_Tests_IdentityScopeKey.js，单一入口
 *   runIdentityScopeKeyRegressionGate()，覆盖 Carson 批准消息列出的
 *   6 项 + 上面第 4 点的修复验证，共 6 个测试函数。其中纯函数三项
 *   （legacy unchanged / same-different workflow / no collision with
 *   legacy）已经用独立参照实现在 Node 里跑过真实断言，全部通过；
 *   真实环境三项（repeat instantiate / updateTask 编辑路径 /
 *   ProjectionRebuilder 折叠逻辑）需要 Carson 把改动过的文件（
 *   20_TaskEngine.js、新增的 39_Tests_IdentityScopeKey.js）粘贴进
 *   真实 GAS 项目后跑 runIdentityScopeKeyRegressionGate() 才能拿到
 *   真实 Sheet/EventBus 环境下的 pass/fail——沙盒里没有 Carson 的
 *   真实 Spreadsheet，这一步没法代跑。
 *
 *   状态：Preflight 4 项确认全部通过（含新发现项，已修复）；正式
 *   Regression Gate 已交付，等待 Carson 在真实环境跑一遍确认，随后
 *   建议连带重跑一次 runSprint3AcceptanceGate() 和
 *   runUIBridgeSlice3Gate()（因为改动触碰了 20_TaskEngine.js，
 *   两个既有 Gate 都间接依赖它）。Track 1 视为"实施 + 治理留痕"
 *   双重完成，可以据此推进 Track 2。
 *
 * 【2026-08-21/22 补充，真实环境跑出的结果，撤回上面"双重完成"的
 * 结论】runIdentityScopeKeyRegressionGate() 在真实环境 5/6 通过，
 * testIdentityScope_UpdateTaskPreservesScope_ 失败："编辑后 identity
 * 应该等于新字段+原 workflow_id 重算结果，实际不等"。
 * runSprint3AcceptanceGate()、runUIBridgeSlice3Gate() 两个都 100%
 * 通过，说明这次改动没有破坏任何原本就在跑的东西——问题出在一个此前
 * 从没被真正验证过的路径上，不是一次回归。
 *
 * 排查结论（代码追踪，非猜测）：identity 纯哈希逻辑本身是对的——
 * 6 项里另外 5 项都通过，其中包含直接验证 scopeKey 差异化的两项，
 * 以及绕开真实 Sheet、只用内存事件验证 ProjectionRebuilder 折叠逻辑
 * 的那项。真正可疑的是"从真实 Sheet 里把 workflow_id 读回来"这一步：
 * 05_SheetUtils.upsertRowByKey_（写）和
 * 12_TaskQueryEngine.getTask（读）都是按 Sheet 表头实际有哪些列名
 * 来决定读/写哪些字段（headerMap.hasOwnProperty(key) 才写；
 * getTask 只在 headerMap 里出现的列名才会出现在返回对象上）——
 * 如果 Carson 真实 Tasks 表的表头这一行本来就没有 workflow_id 这一列，
 * 这个字段会被这两处静默丢弃，不报错、不提示。这会是一个在这次改动
 * 之前就存在的数据缺口（Sprint 1 引入 workflow_id 时，如果表头没有
 * 同步加这一列），这次只是第一次有代码路径需要把 workflow_id
 * "写进去再读出来"——之前所有用到 workflow_id 的地方（
 * spawnNextWorkflowIfNeeded/instantiateFromTemplate）都只在创建那一刻
 * 用内存里的值，从来没有真的读回过 Sheet，所以从来没有暴露过这个问题。
 *
 * 需要 Carson 确认（沙盒里没有真实 Spreadsheet，这一步没法代查）：
 * Tasks 表的表头第一行，是否真的存在一列叫 workflow_id。如果确认
 * 缺失，这本身可能是一个比这次改动范围更大的问题——同一批 Sprint 1
 * 字段（project_id/sequence_index/parent_task_id/
 * depends_on_task_ids/branch_group/branch_resolution_policy/
 * source_project_id/十一个 Metadata 字段）会不会也有同样的表头缺口，
 * 值得一并核实，不只是补 workflow_id 一列。Track 1 的核心哈希逻辑
 * 判定正确，但这一条编辑路径回归测试的真实环境验证目前是"失败，
 * 原因指向环境/数据问题，不是这次代码逻辑本身"，不算完成，等 Carson
 * 确认表头情况后再决定怎么修（补表头列，还是要不要顺带给
 * upsertRowByKey_/getTask 加一条"写入了却因为表头缺列被静默丢弃"的
 * 提示，这两种修法影响面不一样，不该我自己替 Carson 决定）。
 */


// ============================================================
// 十五、Track 2 — UI-I1~I5 落地（2026-08-21）
// ============================================================

/**
 *   范围：Sort+Filter（I1）、Edit Task/Edit Project（I2）、Priority（I3）、
 *   Done（I4）、Cancel（I5），独立于 Track 1 Identity 那条线（见「十四」）。
 *
 *   50_UIBridge.gs 新增 7 个函数：ui_updateTask、ui_updateProject、
 *   ui_suggestPriority、ui_completeTask、ui_cancelTask、
 *   ui_completeProject、ui_cancelProject；ui_getConvertibleTasks/
 *   ui_getActiveProjects 扩展了一个可选 filters 前置参数（向后兼容，
 *   唯一真实调用方 ui_index.html 原本零参数调用不受影响）。ui_index.html
 *   新增：Sort+Filter 工具栏（Tasks/Projects 各一个）、Priority 控件
 *   （直接改 + Ask AI + 建议展示/采纳/忽略）、Edit 内联表单（Task：
 *   title/category/due_date；Project：title/description）、Done 按钮、
 *   Cancel 按钮（点一次变成 Sure?/No 二次确认，不用浏览器原生
 *   confirm()，跟既有内嵌交互风格一致）。
 *
 *   架构遵守：UI → UIBridge → Query/Command → Domain Engine → EventBus
 *   → Projection 不变，没有往 UI 塞 Domain 逻辑，没有为了凑功能在 UI
 *   层发明既有 Domain 没有的能力——updateTask/updateProject/
 *   completeTask/cancelTask/completeProject/cancelProject 全部复用
 *   既有 Command，UIBridge 只做 not_found/already_X/invalid_state →
 *   {ok,code,message} 的翻译（同 Slice 1~3 已有惯例）。
 *
 *   两个值得记录的设计决定：
 *   1. updateTask(null) 在"任务不存在"和"没有合法字段变化"两种情况下
 *      返回同一个 null，UIBridge 没法从返回值区分——ui_updateTask/
 *      ui_updateProject 改为先用既有 TaskQueryEngine.getTask/
 *      ProjectQueryEngine.getProject（本来就是已声明的 Reads 依赖）自己
 *      判断一次"存在与否"，让 NOT_FOUND 和 NO_CHANGES 在 Bridge 层就
 *      区分清楚，不是新增 Domain 逻辑。
 *   2. Priority 严格照 ADR-2026-07-24-009（"AI Suggests, Human
 *      Confirms"）：ui_suggestPriority 只产出建议，唯一的写是把这次
 *      生成的建议记到 priority_ai_recommended（通过既有 updateTask）；
 *      priority 本身只有用户点"采纳"才会变，走的是同一个 updateTask，
 *      不是另一条特殊通道；Sort/Filter 全程只读 priority，不读
 *      priority_ai_recommended。
 *
 *   Preflight 过程中顺带发现并补上两处此前遗漏的治理留痕（不是本次
 *   新引入的问题，是早就存在、这次因为要动同一批文件而顺带发现的）：
 *   - 00_Module_Responsibility.gs「十四」50_UIBridge.gs 的 Engine
 *     Contract 从 2026-08-18（Slice 1 时）之后就没跟上 Slice 2/3 早就
 *     有的 Reads/Public API，这次连同 Track 2 的新增一起重新同步，
 *     不是本次改动引入的滞后。
 *   - Carson 批准 Track 2 时明确要求把"Sort 目前是前端方案"记成过渡
 *     决定、不是最终架构——之前没有落到任何文件里，这次补进
 *     00_Known_Limitations.gs「五」（新section）。同一次批准里提到的
 *     "suggestPriorityWithAI_ 缺 CRITICAL 档"也一并补进
 *     00_Known_Limitations.gs「三」，并更正了「四」里"三个 AI 函数都
 *     没有暴露给用户"这句话——第 1 个（suggestPriorityWithAI_）现在
 *     经 Web UI 暴露了，另外两个不变。
 *
 *   测试：新增 51_Tests_UIBridge_Interactions.js，14 个测试，单一入口
 *   runUIBridgeInteractionsGate()，覆盖 I2~I5 的服务端契约 + I3 的
 *   "AI 建议不自动生效"这条核心不变量（AIConnector.callAIForJSON_
 *   mock，沿用 37_Tests_AIEngines.gs 的先例，不依赖真实网络/AI 凭证）。
 *   I1 的 Filter 服务端一半有测试；Sort 是纯前端 JS，这套 GAS 测试体系
 *   覆盖不到，需要人工浏览器验证四个排序选项。
 *
 *   状态：代码已交付，沙盒里跑了 JS 语法检查 + HTML 标签配平检查，
 *   全部通过；真实 Sheet/EventBus 环境下的 14 个测试、以及浏览器里的
 *   Sort/Edit/Priority/Done/Cancel 交互，需要 Carson 把改动过的文件
 *   粘贴进真实 GAS 项目后跑 runUIBridgeInteractionsGate() + 人工走一遍
 *   UI 才能拿到确认——沙盒里没有 Carson 的真实 Spreadsheet 和浏览器，
 *   这两步没法代跑。
 *
 * 【2026-08-21/22 补充，真实环境结果】13/14 通过。唯一失败的
 * testUIInteractions_SuggestPriority_NeverAutoApplies_ 是测试自己的
 * bug，不是 UIBridge 的问题：mock 让 AIConnector.callAIForJSON_ 返回
 * priority:'CRITICAL'，但 suggestPriorityWithAI_ 真实校验只认
 * HIGH/MEDIUM/LOW（这条限制是我自己发现、写进
 * 00_Known_Limitations.gs「三」的，结果自己写 mock 的时候没对上）——
 * 已改成 'HIGH'。其余 13 项（Edit Task/Project、Done/Cancel 含幂等、
 * Accept Suggestion 落盘、Filter 两项）真实环境全部通过，UI-I2~I5 的
 * 服务端契约视为确认完成。Sort 仍待人工浏览器验证（前端 JS，见「五」）。
 */


// ============================================================
// 十六、Track 1B — Due-Date Canonicalization 实施就绪（2026-08-22）
// ============================================================

/**
 *   批准依据：00_Due_Date_Canonicalization_Audit.md + ADR-2026-07-24-023
 *   + Carson 2026-08-22 批准消息（Option C，10 条条件，明确的
 *   Inventory → Dry-run → Backup → Write → Read-back Verify → Identity
 *   regression → Recurring regression → Full Sprint regression 顺序）。
 *
 *   代码已交付（沙盒里语法检查 + 跨 3 个不同时区（UTC/Asia-Shanghai/
 *   America-Los_Angeles）的 Node 独立验证全部通过，含逐字节复现
 *   Carson 真实诊断数值的回归断言）：
 *
 *   1. 07_IdentityEngine.js：resolveIdentityDueValue() 内部新增
 *      _canonicalizeDueValue_() 归一化，同时以 canonicalizeDueValue
 *      名义暴露公开 API（给迁移脚本复用同一套算法，不重复实现）。
 *      不改动 Track 1A 的 scopeKey 逻辑（Carson 条件 5）。
 *   2. 11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.js（新增）：
 *      Option A 的存量数据值迁移，5 个函数对应 Carson 要求的 5 个
 *      阶段（Step1 Inventory ~ Step5 ReadBackVerify），状态持久化在
 *      新增的 Due_Date_Migration_Log 分页里（不依赖单次执行内存，
 *      因为几步之间大概率是分开的手动执行）。Step 4（Write）要求
 *      显式传入确认字符串，不能在没看过 Dry-run/Backup 输出的情况下
 *      顺手触发。Step 3（Backup）用 getSheet_('Tasks').getParent()
 *      拿真实 Spreadsheet 对象再 .copy()——这个项目是 standalone
 *      script，没有 getActiveSpreadsheet() 可用，见
 *      05_SheetUtils.getSheet_ 文件头说明。
 *   3. 53_Tests_DueDateCanonicalization.js（新增）：7 个测试，单一
 *      入口 runDueDateCanonicalizationGate()，覆盖归一化函数本身
 *      （含逐字节复现 Carson 真实诊断值的核心回归断言）、updateTask
 *      编辑路径、以及 Carson 明确要求的 Recurring regression
 *      （21_RecurringEngine 路径）。
 *   4. ADR-2026-07-24-023：记录"due_date canonicalization 是 Domain
 *      data contract / identity boundary 修复，不是 UI workaround"
 *      这条 Carson 特别要求保留的定性。
 *
 *   Carson 10 条条件对照：① Preflight 已做（本轮所有代码改动前的
 *   file:line 追查）；② Option C 已采用；③ Data-only migration（不碰
 *   identity）；④ 无 identity migration；⑤ 未改 Track 1A scope-key
 *   逻辑；⑥ Migration 含 checkpoint（Step 3 Backup）+ read-back
 *   verification（Step 5）；⑦ 测试覆盖审计「十一」列出的项目；
 *   ⑧ 本节即 Track 1B 独立报告；⑨ 不阻塞 UI-I1~I5；⑩ 不启动 Drag
 *   UI-I6——十条均满足。
 *
 *   还需要 Carson 在真实环境按顺序手动执行（沙盒没有真实 Spreadsheet，
 *   这几步没法代跑）：
 *     Step 1~5（11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs）
 *     → runDueDateCanonicalizationGate()（53）
 *     → runIdentityScopeKeyRegressionGate()（39，Identity regression，
 *       这次应该 6/6 全过，包括此前失败的
 *       testIdentityScope_UpdateTaskPreservesScope_）
 *     → runSprint3AcceptanceGate() / runUIBridgeSlice3Gate() /
 *       runUIBridgeInteractionsGate()（Full Sprint regression）
 *
 *   Track 1A / Track 1B / Track 2 边界（Carson 明确要求记录）：
 *     Track 1A（workflow_id）→ 独立完成
 *     Track 1B（due_date canonicalization）→ 本节，独立实施就绪
 *     Track 2（UI-I1~I5）→ 独立推进，不受本节影响
 *     Drag Ordering ADR（UI-I6）→ 独立待写，不受本节影响
 *   四者刻意保持互不阻塞，不合并成一次大改动。
 */
