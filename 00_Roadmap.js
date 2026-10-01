/**
 * 00_Roadmap.gs
 * Productivity OS / Personal Life OS — Roadmap（长期规划）
 *
 * ⚠️ 本文件只谈"接下来要往哪走"，不记录历史、不记录 Bug、不记录架构决策——
 * 那三类内容分别属于 00_Project_State.gs（当前状态快照）、
 * 00_Known_Limitations.gs（已知问题）、00_ADR.gs（决策记录）。本文件跟
 * 00_Project_State.gs 一样是"快照"，每次更新覆盖旧内容，不是日志。
 *
 * LAST_UPDATED: 2026-09-28（Governance Synchronization Pass，纯文档
 * 同步，不涉及任何 runtime code / production data 改动）——上一次更新
 * 是 2026-07-13，中间横跨的真实交付（UI V2 Implementation Plan 全部
 * 5 个 Slice、Drag Ordering/UI-I6、ADR-2026-09-18-031 Project Deadline
 * Contract、Task→Note/Project conversion、due_date/due_time/due_datetime
 * write-time protection 等）此前完全没有反映在本文件里——00_Project_State.gs
 * 「三十九」第一条（NEXT SLICE DISCOVERY → 补齐 Slice 4 Part A）已经指出过
 * 这个过期问题，但一直没有真正同步，这次是第一次真正处理。全文依据
 * 00_Project_State.gs 真实记录（至「六十二」，2026-09-28）逐项核对；无法
 * 从 Project State/governance 文件确认真实状态的项目，标注 UNKNOWN /
 * NEEDS DECISION，不猜测。
 *
 * 同日第二轮（Vertical Slice 4 Reassessment 的正式记录，见 Project State
 * 「六十二」）：本文件里涉及 UI Vertical Slice 4 的「一」「二」「三」条目
 * 据此改写；同时更正了上一轮的几处不准确写法——
 *   (1)「七」把 suggestPriorityWithAI_ 够不到 CRITICAL 档写成"没找到后续
 *      记录/UNKNOWN"，实际 Known Limitation「三」（2026-08-21 补充）已经
 *      把它记录为"已知、非阻塞的小缺口"；
 *   (2)「三」第 6 项把「十二」第 1 项的"建议"写成了"前提条件"；
 *   (3)「一」「二」把 UI V2 各 Slice / Conversion / Web UI 笼统写成"全部
 *      实机验证通过"，与 Project State 记录不符（Slice 3 的 UI 层、
 *      Slice 4B 第 14 项、Slice 5 都有未验证的记录），已改为分层写法；
 *   (4)「二」"共八份文档体系"是从 2026-07-13 旧版本原样带过来、没有核对
 *      的说法，实际 00_ 开头的治理文件有 20 份，已改为如实统计；
 *   (5) 上一轮文件里有一处 "*" 紧跟 "/" 出现在块注释内部（事件类型列表的
 *      通配写法），会提前结束注释、造成 JS 语法错误，已修复。
 * 全部只是文档更正，不涉及任何代码/行为改动。
 *
 * 另外，本次同步中直接发现：00_Project_State.gs 自己顶部「一、当前版本」
 * 摘要段落也停留在 2026-08-18，落后于其自身「二十五」到「六十一」的后续
 * 记录——这不是本次任务范围（本次只同步 Roadmap），如实记录在这里，是否
 * 处理由 Carson 决定。
 */

// ============================================================
// 一、Current Version
// ============================================================

/**
 *   设计：v5.2（Architecture Freeze，见 00_ADR.gs）。
 *   实现现状（按 00_Project_State.gs 至「六十二」）：
 *     - Sprint 1（Foundation）/ Sprint 3（Integration）：CERTIFIED。
 *     - UI Phase 0 → Vertical Slice 1/2/3（Note→Task / Task↔Project /
 *       Project→Workflow→Task，2026-08 系列，跟下面"UI V2"系列是两套
 *       不同编号，00_Project_State.gs「三十九」第二条明确记录过这个命名
 *       混淆，不要混为一谈）：Stable。
 *     - UI Vertical Slice 4（Priority + AI Recommendation，同一套 2026-08
 *       系列；跟下面 UI V2 Plan 的 Slice 4 Part A/B 是同名不同物）：
 *       **PARTIALLY SUPERSEDED**（2026-09-28 Reassessment，Project
 *       State「六十二」）——
 *         · Priority AI: ALREADY COMPLETED（经 Track 2 / UI-I3 交付，
 *           Project State「十五」；Ask AI Priority / Accept / Dismiss、
 *           priority / priority_ai_recommended 双轨字段；服务端契约
 *           真实环境验证 14/14，「二十」）
 *         · AI Project Suggestion: PENDING（47_AIPlanningEngine.
 *           suggestNewProject_：Contract Verified，Integration Pending，
 *           无 UI Bridge / frontend entry）
 *         · AI Workflow Generation: PENDING（47_AIPlanningEngine.
 *           generateWorkflowSuggestion_：同上）
 *       AI Goal Planning 不属于 PersonalLifeOS（Life Execution OS 的
 *       职责）；AI 自动创建/自动执行不在范围（Architecture Principle 9）。
 *     - UI V2 Implementation Plan（Slice 1 Core UI Consistency / Slice 2
 *       Task Dashboard / Slice 3 Note Edit / Slice 4 Part A Task→Project
 *       BLOCKED / Slice 4 Part B Task→Note / Slice 5 Performance）：
 *       全部 5 个 Slice 已交付代码。验证状态按 Project State 记录分层，
 *       不合并成"全部验证通过"：
 *         · Slice 1 + 2：LIVE VERIFIED PASS（「三十」）
 *         · Slice 3 Note Edit：Engine 层 LIVE VERIFIED（runNoteEditGate
 *           6/6，「四十三」）；ui_updateNote 包装层 + 浏览器 Edit 表单
 *           仍是 STATIC VERIFIED / LIVE TEST PENDING（此后未见记录）
 *         · Slice 4 Part A（Task→Project BLOCKED）/ Part B（Task→Note）：
 *           Gate 层 LIVE VERIFIED；Part B 第 14 项（confirmation cancel，
 *           纯前端行为）需人工浏览器验证，未见结果记录（第二条「三十九」）
 *         · Slice 5 Performance：最后一次记录仍是 LIVE TEST PENDING
 *           （第二条「三十九」，2026-09-08）——已有的 Gate 都直接调
 *           Engine，测不到它的埋点/乐观 UI；此后 Project State 没有再
 *           记录它的验证
 *     - Drag Ordering（UI-I6，ADR-2026-08-26-026）：**ACCEPTED / LIVE
 *       VERIFIED**（Project State「四十七」）——第一个完整走完 STATIC→
 *       AUTOMATED→REGRESSION→LIVE 全链路的新功能。
 *     - ADR-2026-09-18-031（Project Deadline Contract）：Accepted，
 *       Phase 2/3 已实施。它自己单独设计的正式 Real GAS Verification
 *       Plan（Phase 1-5，2026-09-19 文档）**从未作为一份完整协议被执行
 *       过**（Project State「五十二」如实记录）；但其核心写入机制
 *       （Task/Project create/update、Task→Project conversion、
 *       Projection 全量重建）已经通过平行的 due_time/due_datetime
 *       write-time protection 那一轮工作（Known Limitation「十一」，即
 *       _setPlainTextFormatForNewColumns_ 保护有生命周期上限那一条）被
 *       LIVE GAS VERIFIED（Project State「五十七」～「五十九」）——两件
 *       事不是同一回事，不要合并成"ADR-031 已完整验证"。
 *     - due_time/due_datetime write-time 纯文本保护（同一条 Known
 *       Limitation「十一」的修复）：LIVE GAS VERIFIED，全部真实写入路径
 *       确认。
 *     - due_date 同一层保护：**未纳入**，13 行历史损坏数据仍未修复
 *       （Known Limitation「十二」，见「七、Known / Deferred Items」；
 *       不是「十三」——「十三」是 due_time 的历史时区精度问题，见下方
 *       该条本身）。
 *     - Recurring Monthly Task Done→Next Occurrence 事故（2026-09-28）：
 *       已排查关闭，非系统 bug（用户操作层面的解释）。
 *   最后更新（本文件）：2026-09-28
 */

// ============================================================
// 二、Completed（本版本达成的能力边界，非历史记录）
// ============================================================

/**
 *   这里只说"现在能做什么"，不重复 00_Project_State.gs 的逐条修复过程：
 *
 *   - Task/Project/Note/Workflow/BusinessRule 生命周期：create/update/
 *     complete-或对应终态/cancel，identity 在影响去重字段变更时自动
 *     重算。
 *   - Recurring：完成时按 Daily/Weekly/Monthly/Yearly 自动续期一次
 *     （前提：创建时已选择对应 recurring 值——2026-09-28 事故确认过
 *     这一点，不是本次新增能力描述）。
 *   - Conversion：Task↔Project 双向、Note→Task/Project/GoalCandidate、
 *     Task→Note（42_ConversionEngine.gs），均已交付；验证状态见「一」
 *     和 Project State 对应条目。
 *   - Web UI（ui_index.html + 50_UIBridge.gs）：Dashboard、Task 的
 *     Sort/Filter/Edit/Done/Cancel/Drag Reorder、Note Edit，均已交付；
 *     验证状态分层记录在 Project State 里（Drag Reorder：LIVE VERIFIED，
 *     「四十七」；UI-I1~I5：服务端契约 LIVE VERIFIED、浏览器手动验证未见
 *     记录，「二十」；Note Edit UI 层 / Slice 5：见「一」）。
 *   - Priority（UI-I3，Track 2）：直接修改 + AI 建议（Ask AI Priority /
 *     AI Suggestion / Accept / Dismiss）。AI 建议只写
 *     priority_ai_recommended，priority 只有用户点 Accept 才改变
 *     （Architecture Principle 9 / ADR-2026-07-24-009）。验证层次：服务端
 *     契约真实环境验证（Project State「二十」14/14）；浏览器手动验证在
 *     Project State 里没有单独记录（「二十」原文：未见 Carson 回报这一
 *     步）——按 Carson 2026-09-28 的指示记为完成并经过真实环境验证。
 *     随附的已知非阻塞限制：AI 建议只能到 HIGH/MEDIUM/LOW，够不到
 *     CRITICAL（Known Limitation「三」，2026-08-21 补充）。
 *   - 写入时纯文本保护：due_time/due_datetime 全部真实路径已验证；
 *     due_date 尚未纳入（见「七」）。
 *   - 治理文档体系：00_ 开头的治理文件目前 20 份（按 2026-09-28 上传
 *     快照统计，清单见 00_File_Map.gs）。
 */

// ============================================================
// 三、Next Version 候选（逐项重新核对，未经 Carson 选择前均为候选，
//     不代表已排定顺序）
// ============================================================

/**
 *   对 2026-07-13 版本遗留的四项逐一重新判断（按 Carson 本次同步的明确
 *   要求，不因为任何单一事故自动改变优先级）：
 *
 *   1. Recurring lifecycle 补全（暂停/恢复某条 recurring 规则）：
 *      **DEFERRED / NOT CURRENTLY SELECTED**。2026-09-28 的 Recurring
 *      Monthly 事故已排查关闭，结论是"非系统 bug"，不构成重新打开这项
 *      工作的理由；Project State 里也没有找到独立于该事故之外的、
 *      明确的未完成 recurring 需求。保留在候选列表，但不是 Next Slice。
 *
 *   2. TaskPriority 缓存表：条件（22_PriorityEngine.computePriorityScore
 *      现算变贵）**尚未观察到**——Project State 全文没有出现相关性能
 *      记录。条件未触发，候选本身仍然有效，暂不选择。
 *
 *   3. Health Check 独立函数：条件（需要更轻量、可被定时触发器频繁
 *      调用的健康检查）**尚未出现**。候选仍然有效，暂不选择。
 *
 *   4. 04_EventDefinitions.gs 独立文件：条件（事件类型数量 > 10）
 *      **已经满足**——本次同步实际统计全仓库 EventBus.publish 事件
 *      类型，去重后 28 种（TASK_ 系列 / PROJECT_ 系列 / NOTE_ 系列 / WORKFLOW_ 系列 /
 *      BUSINESS_RULE_CREATED/REMINDER_REQUESTED/REVIEW_GENERATED/
 *      VIEW_ORDER_UPDATED），远超原定阈值。这是四项里唯一一个"条件已
 *      客观满足"的候选，但满足条件不代表自动成为 Next Slice——是否
 *      现在做、什么时候做，仍然是 Carson 的选择。
 *
 *   另外两项不在 2026-07-13 旧列表里，但同样是 Project State 明确记录
 *   的候选：
 *
 *   5. AI Planning Suggestions — Project + Workflow（原"UI Vertical
 *      Slice 4 — Priority + AI Recommendation"的剩余部分；Project State
 *      「六十二」，2026-09-28 Reassessment）：
 *        · Priority AI: ALREADY COMPLETED（Track 2 / UI-I3，见「二」）
 *        · AI Project Suggestion: PENDING（47_AIPlanningEngine.
 *          suggestNewProject_）
 *        · AI Workflow Generation: PENDING（47_AIPlanningEngine.
 *          generateWorkflowSuggestion_）
 *      两个函数本身 Contract Verified（37_Tests_AIEngines.gs 12/12，
 *      2026-08-16），Integration Pending：没有 UI Bridge / frontend
 *      entry，全仓库除测试和文档注释外没有调用方。已有记录里的提醒
 *      （只记录，不是设计）：Project State「八」——"人类确认后走
 *      27/28/20 创建实体"这条链路本身还不存在、也没有对应测试；Known
 *      Limitation「四」（2026-08-21 补充）——orphan entity 风险的推理
 *      需要重新评估，不能直接套用 Priority 这条的结论；00_ADR.gs 里没有
 *      专门针对这两项 UI 集成的 ADR。
 *      不属于范围：AI Goal Planning（Life Execution OS 的职责）；AI 自动
 *      创建/自动执行（Architecture Principle 9）。
 *      这是候选，不是 Next Slice / Next Priority，没有被排期。
 *      Naming / numbering: NEEDS DECISION（本文件不创造新的 Slice 编号；
 *      "Slice 4"在 Project State 里已经有两个含义）。
 *
 *   6. 改名为 "Life OS"：Carson 2026-08-14 提出；Project State「十二」
 *      第 1 项当时写的是建议——"等这一整轮 UI Vertical Slice（1-4）都
 *      稳定后再单独做一次 Rename Migration"（是建议，不是 Carson 的决定，
 *      Carson 当时也还没有回复）。UI Vertical Slice 4 已重新分类为
 *      PARTIALLY SUPERSEDED（见第 5 项 / Project State「六十二」），这条
 *      建议的前提现在算不算已经满足：NEEDS DECISION，本次不判断。直接
 *      检查代码确认文件头/Library Identifier 现在仍然是 "Personal Life
 *      OS"/"PersonalLifeOS"，没有做过 Rename Migration。
 */

// ============================================================
// 四、Future（方向明确但暂无具体计划）
// ============================================================

/**
 *   - Web / App / 语音助手前端：架构上不依赖 Telegram 呈现介质，理论
 *     上可行，目前没有具体第二前端需求，暂不启动。
 *
 *   - Domain OS 间的 Bridge：目前"暂无"，见 00_Project_Constitution.gs。
 *
 *   - Monitoring（主动监控）：目前是被动告警，如果 Projection 失败
 *     频率变得不可忽视，应该考虑主动监控。
 *
 *   - 移除 20_TaskEngine.gs 的裸全局 wrapper 函数：前提是确认跨项目
 *     消费端（04_Main.gs 等）已全部切换完毕，本项目单方面无法判断，
 *     暂不启动。
 */

// ============================================================
// 五、Long Term Vision
// ============================================================

/**
 *   Productivity OS 是 Universal Domain OS Blueprint 的第一个完整落地
 *   样本，长期价值两条：(1) 把 Task 这个业务领域本身做深；(2) 作为
 *   Blueprint 落地范式的参考实现，供未来新 Domain OS 直接参照本项目
 *   的治理文档写法。
 */

// ============================================================
// 六、Architecture Evolution（架构层面演进方向）
// ============================================================

/**
 *   以下均延续自 2026-07-11 Architecture Review，本次同步未发现
 *   Project State 里有后续处理记录，状态标注为按原样保留（不代表
 *   已核实"仍然成立"，只是没找到"已处理"的证据）：
 *
 *   - Dependency Rules 例外数量：目前 1 个已知例外
 *     （21_RecurringEngine.gs → 09_IdempotencyManager.gs），长期目标
 *     是不再增加。
 *
 *   - Testing Coverage 缺口：V4 新增文件里 5 个纯函数 Engine 零测试
 *     覆盖，Architecture Review 唯一还没关闭的发现。UNKNOWN / NEEDS
 *     DECISION——没有在 Project State 后续记录里找到"已补齐"或"已
 *     决定暂缓+期限"的证据，需要 Carson 确认现状。
 *
 *   - ActiveTasks 表维护了但查询路径从未真正读取（走 _readAllTasks_()
 *     全表扫描）：不紧急的性能优化，UNKNOWN / NEEDS DECISION，同样
 *     没找到后续处理记录。
 *
 *   - 25_DashboardEngine.gs 返回纯文本而非结构化数据：待 Personal AI
 *     Core 真正需要消费时再处理，暂不需要现在动手。
 */

// ============================================================
// 七、Known / Deferred Items（从 Known Limitations / Project State
//     提炼的当前真实挂起状态，只记录状态，不代表本次启动处理）
// ============================================================

/**
 *   - Known Limitation「十二」：due_date 现存 13 行历史损坏数据
 *     （裸 Date 对象，Project State「六十」/「六十一」的真实审计确认）。
 *     NO REPAIR AUTHORIZED，一直挂着。
 *
 *   - due_date 是否纳入跟 due_time/due_datetime 相同的写入时纯文本
 *     保护：已提议给 Carson，NEEDS DECISION，未决策，未改代码。
 *
 *   - 13_ActiveTasksEngine.runDailyArchive：没有专门测试过（低风险，
 *     每日定时任务，不建议手动触发测试）。
 *
 *   - due_time 历史时区精度上限（Known Limitation「十三」，独立条目，
 *     不是「十一」的补充——2026-09-20 新增）：Google Sheets 1899-12-30
 *     序列日期锚点在新加坡/马来西亚 1899 年历史 UTC 偏移下（约 +6:55），
 *     读时校正一个已经被误判成 Date 对象的 due_time 会产生约 65 分钟
 *     系统性偏差——这是"读时恢复"这条路径本身在这个时区下的精度上限，
 *     不是代码 bug，只影响"due_time 已经被误判需要读时补救"这一种情况。
 *     是否处理、怎么处理，留给 Carson。
 *
 *   - Known Limitation「三」（2026-08-21 补充，Carson 提出）：
 *     22_PriorityEngine.suggestPriorityWithAI_() 的 prompt 和校验数组
 *     都只有 HIGH/MEDIUM/LOW，AI 建议够不到 CRITICAL，跟纯公式的
 *     suggestPriority()（能给到 CRITICAL）不对称。记录为"已知、非阻塞
 *     的小缺口"，跟 Carson 确认过、暂不修（Project State「十二」第 7 项、
 *     「十五」同样有记录）；没有找到修复记录。它作为随附限制跟 Priority
 *     AI 一起记录，不改变"Priority AI: ALREADY COMPLETED"这个分类。
 *     （上一轮 Roadmap 曾把这一条写成"没找到后续处理记录/UNKNOWN"，
 *     不准确，这次更正。）
 *
 *   - Project State「十二」Open Items 里另外两项，本次同步没有找到
 *     任何后续处理记录，如实保留为 UNKNOWN（可能仍然开着，也可能
 *     已经不重要，没有证据支持任何一种判断）：
 *       (a) 19_BusinessRuleQueryEngine.gs 缺"列出全部 Template"读接口；
 *       (b) 28_WorkflowEngine.gs 缺 updateWorkflow。
 */
