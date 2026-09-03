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


// ============================================================
// 十七、Track 1A / Track 1B 正式关闭（2026-08-23，Carson 确认真实
//      环境全部通过后要求正式 Closed）
// ============================================================

/**
 *   Track 1A — Identity Impact Audit（workflow_id scope key）：
 *     PASSED / CLOSED
 *   Track 1B — Due Date Canonicalization + Identity Boundary：
 *     PASSED / CLOSED
 *
 *   真实环境最终结果（Carson 确认）：
 *     - Production migration（11_ProjectionRebuilder__DUE_DATE_VALUE_
 *       MIGRATION.gs 五阶段）：VERIFIED
 *     - runDueDateCanonicalizationGate()（53）：PASSED
 *     - runIdentityScopeKeyRegressionGate()（39）：PASSED
 *       （含此前失败、现在应验证通过的
 *       testIdentityScope_UpdateTaskPreservesScope_）
 *     - runSprint3AcceptanceGate()：PASSED
 *     - runUIBridgeSlice3Gate() / runUIBridgeInteractionsGate()：PASSED
 *
 *   治理约定：Track 1A / Track 1B 不因为"看起来还能再优化"或者
 *   "顺手就能改"被重新打开或重构——只有未来出现真实的回归证据
 *   （某个 Gate 重新跑出失败、或者生产环境观察到 identity/due_date
 *   相关的真实异常）才重新评估，不接受"觉得这里可以写得更好"这类
 *   理由重新动这两个 Track 已经关闭的范围。
 *
 *   四条线现状（Carson 2026-08-23 确认）：
 *     Track 1A → CLOSED
 *     Track 1B → CLOSED
 *     Track 2（UI-I1~I5）→ 独立推进中，见下方汇报
 *     Drag Ordering ADR（UI-I6）→ 独立推进中，见 00_Drag_Ordering_
 *     ADR.gs，UI-I6 本身保持 BLOCKED_PENDING_ARCHITECTURE_DECISION
 */

// 十八、Governance Adoption —— UEF v1.12 §0.6 persistence/checkpoint
//       规则正式 local adoption（2026-08-24，见 ADR-2026-07-24-024）

/**
 * 决定见 00_ADR.gs ADR-2026-07-24-024，论证不在本文件重复。
 *
 * 1. Governance Rule Adopted：✅
 *    ADR-2026-07-24-024 已 Accepted（2026-08-24）。
 *
 * 2. Constitution Synchronization：✅
 *    00_Project_Constitution.gs 零之七(四) 已引用本条 ADR。
 *
 * 3. Project State Adoption Record：本章节本身。
 *
 * 4. Implementation Checkpoint System Active：⏳ PENDING
 *    "治理规则已採纳"不等于"日常开发已经实际执行该规则"。只有未来
 *    实际观察到 Modify → Validate → Persist/Export → Independent
 *    Verify → Checkpoint 这套开发行为后，才能把这一项改成 Active。
 *
 * 5. Scope / Boundary：
 *    本记录不代表 Universal-Recovery-Manifest.md、
 *    OS-Directory-for-Personal-AI-Core.md 或 Universal UEF 已被修改。
 *    Universal 层同步是后续独立的治理步骤，不因这次 local adoption
 *    自动发生。
 *
 *    本决定最初在另一轮工作中被暂定编号为「十六」；核对本仓库真实
 *    状态后确认「十六」「十七」已经是 Track 1B / Track 1A-1B 收尾
 *    那两段真实记录（2026-08-22／2026-08-23），因此本记录正式编号
 *    为「十八」，内容本身未变。
 */


// ============================================================
// 十九、Track 2 —— UI Create Capability 落地（2026-08-24）
// ============================================================

/**
 * 背景：Carson 在本窗口开局明确要求 Add Task / Add Project 必须是一等
 * UI 操作，不能藏在 Edit 里面，写路径必须走既有 UI → UIBridge → 既有
 * Domain Command/Engine → EventBus → Projection，复用既有 createTask/
 * createProject 契约，不允许新开 UI 专属持久化路径。
 *
 * 实现内容：
 *   1. 50_UIBridge.gs 新增 ui_createTask(title, meta, _testOverrides)、
 *      ui_createProject(title, meta, _testOverrides)——内部分别只调用
 *      既有 TaskEngine.createTask() / ProjectEngine.createProject()，
 *      不直接碰 Sheet/Events，跟本文件其它 ui_* 函数同一种角色。
 *   2. ui_index.html 新增 Add Task / Add Project 两个独立 create-panel
 *      （"+ Add Task" / "+ Add Project" 按钮 + 折叠表单），位于各自面板
 *      工具栏之上，不依附于 Edit。
 *   3. 51_Tests_UIBridge_Interactions.gs 新增 4 条测试 + 独立入口
 *      runUICreateInteractionsGate()——刻意跟既有 14 项的
 *      runUIBridgeInteractionsGate() 分开，避免新增覆盖污染 Carson
 *      要求"先干净重跑一次"的既有回归基线。
 *
 * 字段范围决定（Add Task）：title / priority / category / due_date /
 *   due_time / notes / project_id（下拉，取自既有 rawProjectsCache）/
 *   workflow_id（纯文本输入——本项目目前没有 Workflow 列表可选，
 *   Workflows 面板还没做，这个不对称是事实的直接反映，不是疏漏）/
 *   tags / recurring。source / provenance metadata（source_module /
 *   decision_owner）由 ui_createTask 内部自动写入，不作为表单字段暴露
 *   ——沿用 ui_createNote 的既有先例。
 *
 *   一处需要 Carson 确认的字段解释：Task 表本身有 notes 和 description
 *   两个独立字段，语义未见文档区分；Carson 原话把它们写成一行
 *   "notes / description"。本次实现把表单这一个字段只映射到 notes，
 *   description 作为独立字段未被本次 Add Task 覆盖——这是一个解释选择，
 *   不是确认过的决定，如果 Carson 的本意不同，需要另行调整。
 *
 * 字段范围决定（Add Project）：title / description / parent_project_id
 *   （下拉）/ execution_mode（SEQUENTIAL/PARALLEL/BRANCH/未设置）。
 *
 * 验证状态（请勿混淆以下三层）：
 *   - 代码语法：✅ VERIFIED（node --check 通过，本文件写入时已重新确认）
 *   - 服务端契约（runUICreateInteractionsGate()）：✅ VERIFIED LIVE
 *     ——2026-08-25 Carson 贴回真实 Logger 输出，4/4 全部通过
 *   - 真实浏览器端到端流程（创建 Task/Project 后列表正确刷新）：
 *     ⚠️ 尚未确认成功。见「二十一」「二十二」——第一次真实浏览器使用
 *     Add Task 时曾经复现真实 bug（写入成功但列表不刷新，控制台报错），
 *     经两轮修复后，Carson 尚未回报最新一轮修复是否已经解决。
 *     在收到 Carson 明确的"重新测试成功"确认之前，不应该把 Add Task
 *     当作端到端已验证。
 */

// ============================================================
// 二十、UI-I1~I5 Interactions Gate —— 13/14 → 14/14 重跑确认（2026-08-25）
// ============================================================

/**
 * 「十五」记录的 13/14 失败原因（AI mock 误用 'CRITICAL'，
 * suggestPriorityWithAI_ 的真实校验不允许这个值）已经在代码层面修复
 * （mock 改成 'HIGH'）。Carson 明确要求：在把 UI-I1~I5 移入最终验收之前，
 * 必须先干净重跑一次这个 Gate，不接受"代码已经改了"就当作已经验证。
 *
 * 2026-08-25，Carson 贴回真实 Logger 输出：
 *   runUIBridgeInteractionsGate() —— 14/14 全部通过（真实环境，非本次
 *   对话内推测）。
 *
 * 状态：UI-I1~I5（Sort/Filter/Edit Task/Edit Project/Priority/Done/
 * Cancel）服务端契约 ✅ VERIFIED LIVE。真实浏览器手动验证（Sort 的四个
 * 排序选项、Filter、Edit 表单实际渲染等）本节不涉及，仍然只能人工点——
 * 见 Carson 原话"Do not claim browser verification based solely on
 * automated tests"，本项目未见 Carson 回报这一步的结果。
 */

// ============================================================
// 二十一、Due-Date Canonicalization —— 生产环境真实复现 +
//        UIBridge 传输层修复（2026-08-25）
// ============================================================

/**
 * 【重要边界，先声明】：Track 1A / Track 1B 在「十七」已经正式 CLOSED，
 * 本节完全不重新打开那两条线，也不实现 Track 1B 自己的方案（
 * resolveIdentityDueValue() 归一化 + Sheet 存量数据迁移，那部分范围更大、
 * 风险更高，仍然是 AUDIT_PENDING_IMPLEMENTATION，仍然需要 Carson 单独
 * 批准，本节完全不碰 07_IdentityEngine.gs / 12_TaskQueryEngine.gs /
 * 14_ProjectQueryEngine.gs 本身，也不碰任何真实 Sheet 数据）。本节记录
 * 的是一个范围窄得多、独立的 UIBridge 传输层修复。
 *
 * 现象：2026-08-25，Carson 通过真实浏览器使用新上线的 Add Task 功能后，
 * 任务写入成功（确认写入链路本身没问题），但 Tasks 列表未刷新，浏览器
 * 控制台报 "Cannot read properties of null (reading 'ok')"。
 *
 * 根因（不是新问题，是 00_Due_Date_Canonicalization_Audit.gs 早就审计
 * 过、状态一直是 AUDIT_PENDING_IMPLEMENTATION 的同一个存量问题，这是
 * 它第一次经由真实浏览器路径被触发）：
 *   1. 12_TaskQueryEngine.gs 的 _readAllRows_() 把 Range.getValues() 的
 *      原始返回值不做任何类型转换直接赋值——如果 Sheets 把某个
 *      due_date/due_time/due_datetime 单元格自动识别成了日期/时间格式，
 *      读回来的就是原生 JS Date 对象。
 *   2. _setPlainTextFormatForNewColumns_ 的 Plain-Text 保护范围止于
 *      调用当时的 lastRow，不保证覆盖之后新增的行——新建的 Add Task
 *      行正是最可能漏保护的那类行。
 *   3. 经 web search 独立核实（非本仓库内部推断）：Google 官方文档
 *      明确规定 google.script.run 禁止传输原生 Date 对象（包括嵌套在
 *      对象/数组内部），一旦命中，不抛错，直接让前端 successHandler
 *      收到 null——这是真实、文档化的平台行为，不是猜测。
 *
 * 修复：50_UIBridge.gs 新增 _sanitizeTaskDatesForTransport_()
 * （紧邻既有 _wrapError_ 放置），把 due_date/due_time/due_datetime 上
 * 任何 Date 实例（以及防御性兜底扫描到的其它未预期 Date 字段）转回
 * canonical string（Utilities.formatDate + 脚本真实时区——不用
 * toISOString()，该审计文件已经证实 toISOString() 会因时区换算把日期
 * 错移一天）。应用范围（截至本次 checkpoint，见「二十二」的完整清单）：
 * 12 处返回点，覆盖本文件所有会把 Task/Project 数据回传给浏览器的
 * ui_* 函数。
 *
 * 验证状态：
 *   - 代码语法：✅ VERIFIED（node --check 通过）
 *   - 3 条针对 _sanitizeTaskDatesForTransport_ 本身的纯函数单元测试：
 *     已写入 51_Tests_UIBridge_Interactions.gs，尚未见 Carson 贴回
 *     真实运行结果——⚠️ 未经 Carson 独立核验
 *   - 真实浏览器端到端：⚠️ 未确认解决，见「二十二」——第一次修复
 *     部署后，Carson 仍然复现了空响应（只是不再是未捕获异常，
 *     而是本次新加的 null-guard 正确显示的"empty response"提示）。
 */

// ============================================================
// 二十二、UIBridge / UI 全面防御性加固 —— 第二轮（2026-08-25）
// ============================================================

/**
 * 触发原因：第一轮修复（「二十一」）部署后，Carson real-browser 重新
 * 测试 Add Task，仍然收到空响应提示，而不是列表正常刷新。Carson 贴回
 * 第二份第三方诊断报告，声称 (a) google.script.run 对 Date 对象有
 * "硬性封锁"，(b) 存在"跨执行域（Realm）的 instanceof Date 误判"
 * 导致部分字段漏检。
 *
 * 核实结果（没有直接采信，逐条独立核查）：
 *   (a) 通过 web search 核实为真——Google 官方文档与开发者社区讨论均
 *       确认 Date 是 google.script.run 明确禁止的参数/返回值类型，
 *       命中时静默返回 null、不报错。这条判断是对的。
 *   (b) 未找到任何证据支持"跨 Realm instanceof 误判"这个机制——本项目
 *       所有 Sheet 读取都在同一个 Apps Script 执行上下文里完成，没有
 *       真正的跨 Realm 边界。没有采信这条、也没有基于它实现任何
 *       "修复"。仍然额外加了一层 duck-typing（检测 getTime/getMonth
 *       方法）作为不增加风险的兜底加固，代码注释里明确写清楚这不是在
 *       证实那个说法。
 *
 * 报告里可核实的具体断言，逐条对照真实文件核实（没有直接照抄补丁）：
 *   - 报告声称 3 个函数（ui_convertNoteToTask / ui_convertProjectToTask /
 *     ui_instantiateTemplate）遗漏了 _sanitizeTaskDatesForTransport_
 *     包裹——核实为真。
 *   - 但报告的清单本身不完整——遗漏了 ui_convertTaskToProject（同样的
 *     风险模式），本次一并补上。至此 50_UIBridge.gs 共 12 处返回点
 *     包裹了该函数（从「二十一」的 6 处增加到 12 处）。
 *
 * 独立于两份报告、自行检查发现并修复的问题：
 *   - ui_index.html 里 Task 和 Project 的 Edit 保存按钮（save-edit-btn）
 *     完全没有 withFailureHandler，也没有失败时重置按钮/表单——
 *     跟本窗口更早修复过的 Done/Cancel 按钮是同一类 bug，理应在第一次
 *     处理 Done/Cancel 时就一并检查所有同类按钮，当时没有做到，这次
 *     补上。
 *   - sortTasks() 的 due_date 比较器直接调用 .localeCompare()，如果
 *     due_date 不是字符串会直接抛异常中断排序——已改成
 *     String(...).localeCompare(String(...))。
 *   - "Accept AI Suggestion"这个动作完全没有 withFailureHandler，
 *     且不管 ui_updateTask 是否真的成功都会重新加载列表——已补上完整
 *     的成功/失败处理。
 *   - ui_index.html 剩余的所有 google.script.run 回调（loadNotes /
 *     addNote / convertNoteToTask / Task 的 Done·Cancel·Ask AI·
 *     Convert to Project / Project 的 Complete·Cancel·Convert to Task·
 *     Capture·Instantiate）均补上了 null 防护——第二份报告在这一部分
 *     的清单是准确的。
 *
 * 验证状态（务必准确记录，不要跟「已讨论/已实现」混淆）：
 *   - 代码语法：✅ VERIFIED（node --check 通过，本 checkpoint 撰写时
 *     已重新核对：sandbox 工作副本与 /mnt/user-data/outputs/ 已导出的
 *     四个文件字节级一致，diff 无输出）
 *   - 真实浏览器端到端：❌ 尚未验证。Carson 尚未针对这一整轮修复重新
 *     测试 Add Task。在收到 Carson 明确的重新测试结果之前，不应该
 *     假设这轮加固已经解决真实空响应问题。
 *   - 最可能但未经证实的解释：修复代码可能还没有以"New Version"
 *     重新部署——这是下一次排查最便宜、最应该先排除的可能性，优先于
 *     任何代码层面的新理论。
 */

// ============================================================
// 二十三、Drag Ordering ADR —— Section G 新增（2026-08-24），
//        仍为 PROPOSED，非 Accepted
// ============================================================

/**
 * 00_Drag_Ordering_ADR.gs 新增 Section G "Ownership of the
 * Context-Scoped Ordering Entity"，回应 Carson 明确要求："不要因为
 * 叫它 ordering entity 就当作 ownership-neutral"，对 Inbox / Today /
 * Weekly / Project / Workflow / Goal / Review / Timeline 逐一给出
 * ownership 结论：
 *   - Inbox / Project / Review（本项目自己的 Review Engine）→
 *     Personal Life OS Domain state。
 *   - Workflow → Domain state，但明确写清楚一条边界：这份排序数据
 *     永远不能反过来影响 sequence_index（Workflow 步骤执行顺序的
 *     既有权威字段）。
 *   - Timeline → 建议完全不引入持久化的手动排序——它是时间戳驱动的
 *     历史记录，允许用户手动重排等于允许改写历史发生顺序，跟它存在
 *     的目的矛盾。
 *   - Today / Weekly → 拆成两个不同答案：本项目自己
 *     24_ViewEngine.gs 的 today()/thisWeek()（目前是纯函数筛选，
 *     没有持久化排序，Domain-local，本项目 UI 也还没有对应面板）
 *     vs. 00_Domain_Boundary.gs 矩阵里跨 Domain 聚合的"Today View"/
 *     "Weekly View"（Life Execution OS 拥有，如果需要排序，应该走
 *     Execution 自己的 Reference 信封机制，不进入本项目 Schema
 *     Authority）。
 *   - Goal → 同 Today/Weekly 的第二种情形，Life Execution OS state。
 *
 * 同时补上了提议实体（TaskViewOrder）完整规格：identity / owner /
 * storage / lifecycle / event semantics / projection behavior /
 * cross-device behavior / deletion behavior / orphan behavior
 * （限本项目 Schema Authority 内的四个 context）。
 *
 * 文件内部章节改动：原本的收尾状态章节从 G 改编号为 H，让"Ownership"
 * 这节插入在 F（Recommendation）之后、状态声明之前，保持字母顺序不
 * 出现 G 在 H 之前的错误。
 *
 * 状态：本节全部内容是分析，不是实现——UI-I6 保持
 * BLOCKED_PENDING_ARCHITECTURE_DECISION，代码库里没有任何排序相关
 * 代码。Model 3 推荐仍在 Carson 审阅中，未批准。对应在 00_ADR.gs
 * 新增 ADR-2026-08-26-026，Status 明确写 Proposed（不是 Accepted）
 * ——这是本次 checkpoint 新增的记录动作本身，不代表这个决定现在
 * 变成已批准；只是让这个待决项目在 ADR Log 里可查，而不是只活在
 * 独立的 ADR 文件里。
 */

// ============================================================
// 二十四、ADR-2026-07-24-024（Checkpoint 治理纪律）—— 本次对话的
//        坦诚自评
// ============================================================

/**
 * 背景：00_ADR.gs 的 ADR-2026-07-24-024（2026-08-24 Accepted）正式
 * 采纳了"Modify → Validate → 立即 Persist/Export → 独立核验持久化
 * 副本可读 → 记录 checkpoint"的纪律，并明确标注 Implementation
 * Checkpoint System Active 仍是 ⏳ PENDING——"规则已採纳"不等于
 * "日常开发确实照着做"。本节是对本窗口实际执行情况的坦诚自评，不是
 * 单方面宣布已经 Active。
 *
 * 一个直接相关的真实数据点：本窗口开局不久，Carson 上传的
 * 00_Session_Handoff_Checkpoint_2026-08-23.gs 在会话中途从
 * /mnt/user-data/uploads 消失（先在一次目录列举里出现，下一次读取
 * 就找不到，经文件系统搜索确认确实不在了）——这正是 ADR-024 Context
 * 部分描述的那类"容器/session 本身不是权威存储"的真实案例，只是这次
 * 丢的是交接文档本身，不是实现文件。当时的应对：没有从记忆里凭空
 * 重建这份文件的具体内容去冒充"读过"，而是明确告知 Carson 文件已经
 * 不可读，改为直接读取 Carson 同时上传的 70_Personal-Life-main.zip
 * （真实代码）作为依据——这跟 ADR-024 第 5 条"只从持久化文件 +
 * 已核验记录恢复"的精神一致，虽然当时还没有见到这条 ADR 的正式文本。
 *
 * 本窗口实际执行情况，逐条对照 ADR-024 的 Decision：
 *   1. Modify → Validate：✅ 基本做到——每次代码改动后都执行了
 *      node --check（HTML 文件额外做了 JS 提取 + 语法检查、标签配对
 *      检查、重复 id 检查），没有见过语法错误被留到下一步。
 *   2. 立即 Persist/Export，不允许"改完好几个文件最后一次性导出"：
 *      ⚠️ 部分做到，不是完全做到——本窗口是按"一个完整功能/一整轮
 *      修复"为单位做 present_files（例如"UI Create Capability 四个
 *      文件一起交付"、"第二轮防御性加固"），而不是每改完一个文件的
 *      每一处改动就单独导出一次。可以论证每个批次内部是一个真正连贯、
 *      完整、已验证的工作单元，不是任意断点，但严格按字面"每个文件
 *      修改后立即导出"这条并没有做到最细颗粒度。
 *   3. 独立核验持久化副本可读：⚠️ 直到本次 checkpoint 撰写时才第一次
 *      作为明确、独立的步骤执行——本次已经用 diff 核对 sandbox 工作
 *      副本与 /mnt/user-data/outputs/ 已交付副本，确认 ui_index.html、
 *      50_UIBridge.gs、51_Tests_UIBridge_Interactions.gs、
 *      00_Drag_Ordering_ADR.gs 四个文件字节级一致，没有发现导出内容
 *      跟实际交付内容不一致的情况——但这是本窗口第一次做这个具体检查，
 *      不是持续在做的习惯性动作。
 *   4. Project State 自己也要走同一套流程：本次新增的这几节内容，
 *      正在按同样的 Modify → Validate → Persist/Export → Independent
 *      Verify 顺序处理，见本 checkpoint 文件末尾的执行记录。
 *
 * 结论：Implementation Checkpoint System Active 维持 ⏳ PENDING——
 * 本次是一次认真的、补课性质的核验和记录尝试，不等于这套纪律从此已经
 * 成为日常习惯性动作。要把这一项改成 Active，需要未来几个窗口持续
 * 观察到逐文件、逐改动的 checkpoint 习惯，而不是本次一次性的完整审计。
 */

// ============================================================
// 二十五、UI V2 Slice 1（Core UI Consistency）—— 已交付,等待 Carson
//        Test Gate / Regression Gate（2026-09-01）
// ============================================================

/**
 * 背景：2026-08-31 的 UI Enhancement Architecture & UX Audit → 2026-09-01
 * 的 Capability Gap Review → Implementation Plan（5-Slice），三份文档
 * 依次交付并被 Carson 逐份批准；本节记录 Plan 里 Slice 1 的实际实现。
 * 范围：Unified Create/Edit、OS/Domain selector（Task+Project）、
 * Priority、Due date/time、Enter/focus 行为。
 *
 * 改动文件：20_TaskEngine.gs、27_ProjectEngine.gs、50_UIBridge.gs、
 * ui_index.html、00_ADR.gs（新增 ADR-2026-09-01-027）、
 * 00_Data_Ownership.gs（source_domain 条目同步更新）。完整改动内容见
 * ADR-2026-09-01-027 的 Affected Modules 和 Decision。
 *
 * 验证状态（对照「二十四」自己定的纪律，如实记录，不夸大）：
 *   - 代码语法：✅ VERIFIED——5 个改动文件全部经 node --check
 *     （ui_index.html 额外提取 <script> 内容单独检查）通过。
 *   - 真实 GAS/Spreadsheet/浏览器端到端：⚠️ 完全未验证——本窗口没有
 *     实际连接 Carson 的 Google Apps Script/Sheets 环境的能力，全部
 *     改动只经过静态代码审阅 + 语法检查。这不是"大概率没问题"，是
 *     "尚未验证"，两者不能混为一谈。
 *   - Test Gate / Regression Gate：按 Carson 的既定流程，由他在真实
 *     环境里跑，结果回贴后再决定是否进入 Slice 2——本节记录的是
 *     "已交付"，不是"已验证通过"。
 *
 * 交付时做出的、需要 Carson 知悉/可能需要修正的具体范围决定：
 *   1. OS_REGISTRY 初始值只收了 PersonalLifeOS/PropertyOS/RiderOS/
 *      InvestmentOS/Other 五个——Carson 原始请求里举例提到的
 *      ProcurementOS/InventoryOS/ComplianceOS/FinanceOS/CalendarOS/
 *      HealthOS/NewsOS/ContentOS 没有收进枚举，因为找不到独立证据
 *      证明这些已经是正式注册的 OS（详见 ADR-027）。
 *   2. Project 的 Edit 表单额外加了 execution_mode——这是本次审计
 *      发现的同类型缺口（Create 能设、Edit 不能改），套用了 Carson
 *      已经批准的同一条原则做的延伸，但 Carson 这几轮消息里没有
 *      逐字确认这一项，值得他看一眼是否认可。
 *   3. Context 字段的 placeholder 文案（"@home, @errand"）是 GTD
 *      方法论里"情境标签"的常见含义，代码/文档里没有找到这个字段
 *      本来的确切定义，是推测填的，Carson 如果另有所指需要改文案。
 *   4. 前端 OS_REGISTRY 是后端同名全局量的手抄副本（做法上跟既有
 *      category/priority/recurring 完全一致），不是动态拉取——新增
 *      OS 目前仍然要改两处。
 *   5. Create/Edit 没有做成一个真正通用的、数据驱动的 schema renderer
 *      ——两个表单分别手写了对应字段的 HTML/JS，字段列表现在保持一致，
 *      但"保持一致"依赖的是这次改动本身的完整性，不是结构上不可能
 *      再次出现分歧。理由：本窗口无法实际跑这份 GAS+HTML 代码，一个
 *      更通用的渲染抽象层出错的方式会更难被肉眼审出、也更难被 Carson
 *      在他自己的环境里定位问题——权衡之后选择了更笨、但更容易逐行核对
 *      的写法。如果 Carson 更想要真正 schema-driven 的版本，可以作为
 *      后续一次单独的重构提出。
 *   6. 本次加的"保存成功后聚焦回标题输入框"是等真实 google.script.run
 *      响应回来之后才做的，不是乐观更新——完整的乐观 UI（点击后立刻
 *      显示、失败再回滚）刻意留给 Slice 5，因为那部分需要先有真实
 *      延迟数字才能决定值不值得做、怎么做防重复提交。
 *
 * 明确保持不变（按 Carson 的要求核对过）：
 *   - 07_IdentityEngine.gs、09_IdempotencyManager.gs、
 *     08_DeduplicationEngine.gs：零改动。
 *   - source_domain 两个 Engine 里都确认【不在】IDENTITY_AFFECTING_FIELDS
 *     里，重新归类不会触发 identity 重算。
 *   - 28_WorkflowEngine.gs、29_NoteEngine.gs：零改动——按 Carson 明确
 *     决定，本轮不给这两个实体接入 source_domain。
 *   - Done/Cancel 两个方向（Task 和 Project）：本 Slice 完全没有碰
 *     completeTask/cancelTask/completeProject/cancelProject 或它们的
 *     UIBridge 包装，继续走既有正式 Command，没有被拉进共享字段改动里。
 *
 * 下一步：等 Carson 在真实环境跑完 Test Gate + Regression Gate、结果
 * 贴回来——通过后才进入 Slice 2（Overall Dashboard）。
 */

// ============================================================
// 二十六、UI V2 Slice 2（Task Dashboard）—— 已交付,等待 Carson
//        Test Gate / Regression Gate（2026-09-02）
// ============================================================

/**
 * 背景：Carson 因为在外送外卖、暂时无法做 Slice 1 的实机验证，明确指示
 * "不要因为 Slice 1 未验证就阻塞 Slice 2"，同时明确要求本窗口在动手前
 * 重新核对当前真实代码状态、不能只依赖之前的报告。已按此执行——重新读了
 * 24_ViewEngine.gs/25_DashboardEngine.gs/12_TaskQueryEngine.gs/
 * 14_ProjectQueryEngine.gs，并且发现一处此前审计没有完全说清楚的地方，
 * 见下方"核对中发现的修正"。
 *
 * 改动文件：24_ViewEngine.gs（_isNonTerminal_ 收紧）、
 * 12_TaskQueryEngine.gs（新增 getTaskDashboard）、50_UIBridge.gs（新增
 * ui_getTaskDashboard）、ui_index.html（新增 Dashboard nav + panel）。
 * 25_DashboardEngine.gs（Telegram 契约）：零改动，确认冻结。
 * 20_TaskEngine.gs/27_ProjectEngine.gs（Slice 1 交付物）：零改动。
 *
 * 核对中发现的修正（如实记录，不夸大也不回避）：
 *   之前的审计把 ViewEngine._isNonTerminal_ 只排除 DONE/CANCELLED 这件事
 *   记成"确认的 bug"。本轮重新核对 10_ProjectionEngine.gs 后发现这个
 *   定性不准确——projectTaskConvertedToProject_/projectTaskNotSelected_
 *   已经会把 CONVERTED/NOT_SELECTED 状态的 Task 从 ActiveTasks 物理删除，
 *   而 12_TaskQueryEngine.gs 的七个高频视图（V4.8 修复）全部读
 *   ActiveTasks——所以在现有调用路径下，这个不一致目前【不会】被实际
 *   触发，是潜在（latent）问题，不是活跃（live）bug。仍然做了收紧（见
 *   ViewEngine 文件内注释），理由是防御性的：本次新增的
 *   getTaskDashboard() 直接构建在这个函数之上。这个修正本身印证了 Carson
 *   "先重新核对当前代码、不要只信之前报告"这条要求的价值。
 *
 * 设计取舍（Carson 要求先分析"最小安全 adapter"方案，这里记录结论）：
 *   getTaskDashboard() 放在 12_TaskQueryEngine.gs 内部（不是新文件、不是
 *   塞进 25_DashboardEngine.gs）——理由：这个文件本来就是"本 OS 唯一允许
 *   直接读 Tasks/ActiveTasks 的模块"，新函数内部把 ActiveTasks
 *   只读一次、复用 24_ViewEngine.gs 的既有纯函数过滤器做多个 bucket，
 *   没有新写一条 Task 查询/过滤逻辑，也没有改动
 *   25_DashboardEngine.gs 一个字符——两条路径（Telegram 文本 / Web UI
 *   JSON）自此完全独立，互不牵连。
 *
 * OS 分组对既有值不一致的处理：_normalizeOsDomainForGrouping_ 只在
 * 读取/展示时把 'Personal Life'（Slice 1 之前的旧默认值）和
 * 'PersonalLifeOS'（Slice 1 之后的新默认值）当同一组——不改写 Sheet 里
 * 任何一行的实际存储值，不是 data migration，Carson 已经明确要求不要做
 * 后者。
 *
 * Project 边界：project_due_view 字段显式返回
 * {status:'BLOCKED_PENDING_PROJECT_DEADLINE_CONTRACT', message:...}——
 * 没有给 Project 加任何日期字段，没有假设 Project deadline。
 *
 * 验证状态（Carson 要求的四态口径，如实标注，不把 pending 当 PASS）：
 *   - 代码语法：STATIC VERIFIED——4 个改动文件全部经 node --check
 *     （ui_index.html 提取 <script> 内容单独检查）通过。
 *   - _isNonTerminal_ 收紧对既有七个高频视图的行为影响：STATIC VERIFIED
 *     （逻辑推导：ActiveTasks 已经物理排除 CONVERTED/NOT_SELECTED，收紧
 *     前后对这七个函数的实际输出无差异）——但这是静态推导，不是实跑验证，
 *     仍然建议 Carson 实机跑一次现有 Track 2 Sort/Filter 用例确认。
 *   - getTaskDashboard/ui_getTaskDashboard 实际返回结构、去重是否正确、
 *     OS 分组是否正确：LIVE TEST PENDING。
 *   - Dashboard 面板浏览器渲染、Done/Cancel 快捷操作、导航切换：
 *     LIVE TEST PENDING。
 *   - Project 相关部分：BLOCKED_PENDING_PROJECT_DEADLINE_CONTRACT（按
 *     设计如此，不是缺陷）。
 *   - Slice 1（Task/Project 的 OS selector、Create/Edit parity 等）：
 *     SLICE_1_LIVE_VALIDATION_PENDING——本轮沙盒重新核对确认文件仍然
 *     完整、语法仍然有效，但真实浏览器/GAS 行为仍然是 Carson 回家后才能
 *     验证的，没有因为 Slice 2 的开展而改变这个状态。
 *
 * Test Gate（Carson 回家后，Slice 1 + Slice 2 一起跑）：
 *   1. 打开 Dashboard 面板，确认 Overdue/Today/This Week/Upcoming/
 *      Recurring/High Priority 分区正确显示，同一个任务不会在多个时间类
 *      分区里重复出现。
 *   2. 确认 By OS/Domain 分组里，Slice 1 之前创建的任务（source_domain=
 *      'Personal Life'）和之后创建的任务（'PersonalLifeOS'）被合并显示
 *      在同一组，不是分成两组。
 *   3. 在 Dashboard 面板点 Done/Cancel，确认任务正确变更状态且从
 *      Dashboard 消失，Tasks 面板本身的数据也同步反映。
 *   4. 确认 Projects 相关的提示文字正确显示"pending Project Deadline
 *      Contract"，没有任何 Project 出现在任何 Due 分区里。
 *   5. 确认 Telegram 端（如果方便测试）/today /week 等指令输出跟改动前
 *      完全一致（25_DashboardEngine.gs 零改动的直接验证）。
 *
 * 下一步：等 Carson 把 Slice 1 + Slice 2 的实机结果一起贴回来——通过后
 * 才进入 Slice 3（Note Edit）。
 */

// ============================================================
// 二十七、Slice 1 + 2 实机测试报告 + 一处 Hotfix（2026-09-02）
// ============================================================

/**
 * Carson 回家后实机跑了 Slice 1 + Slice 2：自动化测试 4/4、14/14 全绿；
 * Add Task 写入成功无报错，OS 下拉可选，提交后焦点回弹；OS 归一化合并
 * 正常（未拆成两组）；Dashboard 的 Done/Cancel 正常——以上全部 LIVE
 * VERIFIED PASS，Slice 1 从「SLICE_1_LIVE_VALIDATION_PENDING」正式转为
 * 通过。
 *
 * 唯一发现的问题：今天到期的任务出现在 Overdue，没有出现在 Today。
 *
 * 根因（05_SheetUtils.gs，不是 Slice 1/2 新写的代码，是既有共用函数）：
 * isOverdue_() 对纯日期字符串（无 due_time）解析后是当天 00:00:00，原来
 * 直接拿这个时间点跟 Date.now() 比——导致"今天到期"的任务从当天凌晨过后
 * 的每一刻起就被判定成 overdue。这个函数被 24_ViewEngine.overdue() 和
 * 26_AnalyticsEngine.computeStatistics 两处共用，之前审计没有发现，是
 * 这次 Slice 2 的去重逻辑（overdue 优先级高于 today，一个任务只保留在
 * 一个 bucket 里）第一次让这个既有问题变得肉眼可见——旧的 Telegram
 * buildTodayDashboard 因为 Today/Overdue 两个分区之间本来就没有互相去重，
 * 这个任务会同时出现在两个分区里，没有像 Slice 2 这样表现成"从 Today
 * 消失"，所以更容易被忽略。
 *
 * 修复：isOverdue_() 改成纯日期字符串比到"当天结束"（23:59:59.999）而
 * 不是当天开始，今天到期的任务要到明天才算 overdue，跟日历直觉一致。
 * 带时间部分的字符串维持原来的精确时刻比较，不受影响。只改了
 * 05_SheetUtils.gs 一个文件；24_ViewEngine.gs/26_AnalyticsEngine.gs 的
 * 调用点不需要跟着改，因为问题出在被调用的共用函数本身，不是调用方式。
 *
 * 需要如实指出的一点：这处修复会让 Telegram 的 /today 指令（
 * 25_DashboardEngine.buildTodayDashboard 的 Overdue 分区）跟
 * AnalyticsEngine 算出来的 overdue 统计数字也发生变化——不再把今天到期
 * 的任务算进逾期。这不是为了 Web UI 而改动 25_DashboardEngine.gs 本身
 * （那个文件零改动），是修复一个两边共用、此前一直存在的真实计算错误，
 * 双方都会因此变得更准确。
 *
 * 验证状态：
 *   - STATIC VERIFIED（Node 模拟，用真实当前日期跑了 isOverdue_ 本身）：
 *     今天到期 → false（修复前是 true）；昨天到期 → true；明天到期 →
 *     false；空值 → false；里程类（'40000km'）→ false。修复前后对
 *     "非今天"的既有场景结果完全一致，只改变了"恰好是今天"这一种情况。
 *   - LIVE TEST PENDING：这是函数级模拟，不是在真实 GAS+Sheets+浏览器
 *     环境里用一条真实 Task 行跑出来的——请 Carson 用同一条今天到期的
 *     Task 再验证一次 Dashboard 的 Today/Overdue 分区，以及方便的话
 *     顺手看一眼 Telegram /today 的 Overdue 分区是不是也不再把它算进去。
 *
 * 下一步：等这一处 hotfix 的实机确认，通过后进入 Slice 3（Note Edit）。
 */

// ============================================================
// 二十八、isOverdue_ 第一版热修不完整——Carson 指出根因,已二次修复
//        （2026-09-02，同日）
// ============================================================

/**
 * Carson 复测/分析后指出：第一版热修（比较 endOfDueDay）判断"是不是纯
 * 日期"靠对 String(原始输入) 做正则匹配——但 Sheets 里被识别成日期类型
 * 的格子，getValues() 读回来的实际类型是原生 Date 实例，不是字符串；
 * String(Date 实例) 产出 "Thu Sep 03 2026 00:00:00 GMT+0800..." 这种
 * 格式，永远匹配不上 /^\d{4}-\d{2}-\d{2}$/，导致第一版热修对 Sheets 里
 * 真实的日期格子完全没有生效，bug 原样重现。诊断准确，已用 Node 复现
 * 确认——本窗口第一版验证时只测了字符串输入，没有测 Date 实例输入，是
 * 本窗口自己验证方法的疏漏，这里如实记录，不归咎为"当时没法预见"。
 *
 * 二次修复不是照搬 Carson 给出的"侦测这是不是纯日期"版本（判断
 * Date 实例是否 getHours()===0，字符串是否匹配正则），而是换了一种更
 * 不容易再踩坑的做法：不再侦测"这是不是纯日期"，直接统一按"日历日"
 * 粒度比较——把 due 和"此刻"都丢弃时分秒、只留年月日，严格早于才算
 * 逾期。这样处理是安全的，因为核对过 isOverdue_ 目前仅有的两个调用点
 * （24_ViewEngine.overdue()、26_AnalyticsEngine.computeStatistics）
 * 传进来的永远是 due_date，从来不是精确到时刻的 due_datetime——日历日
 * 粒度本来就是这个字段唯一有意义的语义，不需要靠猜格式决定要不要看
 * 时分秒，这个"侦测格式"的动作本身正是第一版热修出问题的地方。
 *
 * parseDueDate_() 同步加了 raw instanceof Date 的直接分支——之前只能
 * 处理字符串，Date 实例传进来要先被调用方 String() 转一道再传，这一圈
 * 本身就是问题根源，现在直接原生支持。
 *
 * Carson 同时建议在 12_TaskQueryEngine.getTaskDashboard() 里对 active
 * 任务的日期字段做一次预处理再喂给各个 View 函数——这一处没有采纳：
 * 根因已经在 isOverdue_/parseDueDate_ 这一层修掉，getTaskDashboard 本身
 * 调用的还是同一套 ViewEngine 函数，不需要也不应该在这一个调用点上再
 * 加一层重复的类型防护——那样会制造第二份"日期类型怎么处理"的逻辑，
 * 跟这份代码库一直以来"发现重复实现要合并、不要在多处分别打补丁"的
 * 原则相反，而且不会让 Telegram 端的其它调用路径一起受益。
 *
 * 顺手独立核实了一件事（不是假设）：24_ViewEngine._dueDateOf_（供
 * today/tomorrow/thisWeek/thisMonth/upcoming 五个视图共用）不受这个
 * bug 影响——它调用 parseDueDate_ 前自己已经 String() 了一次，Date 实例
 * 经这个路径能正确 round-trip 回同一个日历日（用 Node 从真实文件提取
 * 函数验证过，年月日完全一致），所以 Carson 这次只报告 Overdue 出问题、
 * Today 本身没问题，跟这个独立验证的结果一致。这也是为什么这一版没有
 * 动 24_ViewEngine.gs 一个字符——它没有坏，不属于这次该改的范围。
 *
 * 验证状态：
 *   - STATIC VERIFIED：直接从改动后的真实 05_SheetUtils.js 文件里提取
 *     函数（不是手抄测试片段）用 Node 跑：字符串-今天/Date实例-今天均为
 *     false，字符串-昨天/Date实例-昨天均为 true，明天两种输入均为
 *     false，空值/里程字符串/非法 Date 均为 false——Date 实例这条路径
 *     这次真正跑通了，不再是仅字符串路径通过。
 *   - LIVE TEST PENDING：请 Carson 用同一条今天到期的 Task 在真实
 *     Dashboard 里再验证一次 Today/Overdue 分区，这次应该能看到它正确
 *     出现在 Today。
 *
 * 下一步：等这次的实机确认，通过后进入 Slice 3（Note Edit）。
 */
