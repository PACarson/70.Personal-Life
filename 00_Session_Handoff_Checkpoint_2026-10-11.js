/**
 * 00_Session_Handoff_Checkpoint_2026-10-11.gs
 * Personal Life OS — Session Handoff Checkpoint
 *
 * 本窗口范围：2026-10-03/04（沙盒时间戳推断）至 2026-10-11。
 * 上一份 checkpoint：00_Session_Handoff_Checkpoint_2026-09-30.gs——只作历史
 * 参考，状态以本文件和「六」列出的治理文件为准。
 *
 * 读法：本文件不是治理记录本身。决定的"正式记录"在 ADR Log / Project State /
 * Known Limitations / Roadmap；本文件只是索引 + 状态分类 + 下一步。两者冲突时
 * 以治理文件为准——而且新窗口第一件事是核对"交付文件是否真的已进入 Carson 的
 * 真实项目"（见「五」Step 0、「八」）。
 *
 * 日期说明：时间工具本次无响应，日期取系统给出的 2026-10-11；其它日期由沙盒
 * 文件时间戳推断，不是 Carson 提供的日期，凡标"推断"的都不要当作事实引用。
 *
 * 验证等级用语（全文统一）：
 *   LIVE GAS VERIFIED = 在真实 Apps Script 环境里实际运行并确认
 *   SIM VERIFIED      = 在 Node/vm 模拟里，对真实、未改动的 Production 源文件
 *                       执行并确认（方法见附录 A）；不等于 LIVE
 *   STATIC            = 只靠读代码 / 读文档 / 脚本统计，没有执行
 *   DIFF/SYNTAX       = 与基线文件逐行 diff + node --check
 *   UNVERIFIED        = 没有验证
 */

// ============================================================
// 零、一句话结论
// ============================================================

/**
 * - 本窗口没有任何"做到一半、被中断"的 implementation。已交付的全部是：
 *   2 处 Roadmap 日期的 Metadata Sync、4 个新测试文件（61–64，38 个测试）、
 *   4 份治理文件的追加/状态同步。没有改动任何 Production 代码、任何已有
 *   测试（含 60）。
 * - Testing Coverage：CLOSED FOR THIS SCOPE（只限 23/24/25/26 确定性纯函数
 *   coverage；不等于 ALL TESTING COVERAGE COMPLETE）。
 * - EventDefinitions 拆分：Pre-work Gate = SCOPE MISMATCH；Authority
 *   Investigation = FINAL RECONCILIATION COMPLETE；结论 Authority
 *   UNRESOLVED / Implementation NOT AUTHORIZED，停在"等待 Carson 的 Human
 *   Decision"。没有创建任何 EventDefinitions 文件。
 * - 下一个 Work Item：没有选。
 * - 交付件是否已进入 Carson 的真实项目：UNKNOWN（见「八」的 md5 核对）。
 */

// ============================================================
// 一、当前项目状态
// ============================================================

/**
 * 证据基础：Carson 上传的项目 zip（2026-10-03 快照）+ 本窗口交付的文件。
 * 真实 Apps Script 项目 / Library 本窗口无法访问。
 *
 * 【沿用自 2026-09-30 handoff，本窗口没有重新核实】
 *   - UI V2 五个 Slice：Slice 1、2 LIVE VERIFIED；Slice 3 的 UI 层和
 *     Slice 4 Part B 第 14 项没有验证记录；Slice 5 仍是 LIVE TEST PENDING。
 *   - 已关闭：Recurring Monthly 事故（非系统 bug）；UI Slice 4（PARTIALLY
 *     SUPERSEDED）；Priority Score 公式（ADR-2026-09-30-032：CLOSED /
 *     UNRESOLVED BY DESIGN——是明确选择不解决，不是待办）。
 *   - due_date 13 行历史损坏数据：NO REPAIR AUTHORIZED（Known Limitation
 *     「十二」）。
 *
 * 【本窗口新增】
 *   1. Testing Coverage：CLOSED FOR THIS SCOPE。61/62/63/64 共 38 个测试，
 *      SIM VERIFIED 38/38，NOT LIVE GAS VERIFIED。记录：Project State
 *      「六十五」、ADR-2026-10-06-033。
 *   2. EventDefinitions：OPEN（调查完成，待 Human Decision）。记录：Project
 *      State「六十六」、ADR-2026-10-11-034（NOT A DECISION）、Known
 *      Limitations「十七」、Roadmap「三」第 4 项。
 *   3. Known Limitations 新增「十四」至「十八」（见「三」E）。
 *
 * 【候选池（handoff 2026-09-30「五」，共 9 项）当前状态】
 *   1 AI Planning Suggestions：未开始，候选
 *   2 due_date 迁移：方法已批准（2026-08-22），零次执行，候选
 *   3 due_date write-time 扩展：仅提议，没有决策
 *   4 due_time 时区精度：handoff 建议维持 Defer
 *   5 EventDefinitions 拆分：Pre-work 完成，OPEN，Scope NOT YET AUTHORIZED
 *   6 Testing Coverage：CLOSED FOR THIS SCOPE；剩余部分各有 blocker
 *   7 ActiveTasks：handoff 建议"确认关闭"，未做
 *   8 旧 Project State 小项：应逐项判断，未做
 *   9 Life OS 改名：NEEDS DECISION，未做
 *   （Roadmap 里另有 3 个更早的候选：Recurring lifecycle、TaskPriority 缓存
 *   表、Health Check 独立函数——条件均未触发，未选。）
 *   Carson 贴入的一段排序意见（EventDefinitions > due_date 迁移 > due_date
 *   write-time > AI Planning > ActiveTasks > 改名 > 旧 Project State 小项，
 *   due_time Defer，Testing Coverage Closed）只是建议，不是已批准的决定；
 *   他实际的动作是"先对 EventDefinitions 做 Pre-work，不 coding"。
 */

// ============================================================
// 二、本窗口的重要决定（谁决定 / 记录在哪 / 状态）
// ============================================================

/**
 * 【Carson 的决定——已写入治理文件】
 *  D1 Roadmap Metadata Sync Only（本窗口早期）：只把 LAST_UPDATED 与第 109
 *     行的"最后更新"改成 2026-09-30；原第 18 行"至「六十二」"是历史描述，
 *     不机械替换。状态：Carson 判定 PASS 并关闭。记录：00_Roadmap.gs 本身。
 *     （2026-10-11 的 Roadmap 更新又覆盖了这两处日期；旧值保留在
 *     PREVIOUS_UPDATE 段落。）
 *  D2 Testing Coverage Scope Decision（2026-10-06）：范围、Contract Evidence
 *     Standard（三方一致即够）、授权测试范围、BLOCKED / OUT OF SCOPE 清单、
 *     Implementation Rule、Security Finding 处理规则。记录：ADR-2026-10-06-033
 *     D1–D5。状态：Accepted（仅限本 Work Item）。
 *  D3 Testing Coverage Human Decision & Closure（2026-10-06）：Priority 时区
 *     缺陷 DEFERRED；CONVERTED/NOT_SELECTED BLOCKED — CONTRACT UNRESOLVED；
 *     Weekly/Monthly routing 测试保留；接受 38 个测试与 mutation
 *     verification；CLOSED FOR THIS SCOPE ≠ ALL TESTING COVERAGE COMPLETE。
 *     记录：ADR-2026-10-06-033 D6；Project State「六十五」；Known
 *     Limitations「十四」「十五」「十八」。
 *  D4 Closure Record（2026-10-06）：Carson 要求把 closure 记进 Project State
 *     已有的顺序条目位置，不建新结构。记录：Project State「六十五」。
 *  D5 选择 EventDefinitions 做 Pre-work Gate（只读）与随后的 Authority
 *     Investigation，并要求"收敛后停止，等待 Human Decision"。记录：Project
 *     State「六十六」；ADR-2026-10-11-034。
 *  D6 Checkpoint 持久化指令（本次）：要求把已形成的决定同步写入对应治理文件
 *     和 ADR Log，未决的标 pending/proposed。本次因此新增了 ADR-033、
 *     ADR-034、Project State「六十六」、Known Limitations「十四」–「十八」
 *     以及 Roadmap 的状态同步（见「九」）。
 *
 * 【没有决定的事项——只以 pending/proposed 形式记录，不要当作已批准】
 *  - EventDefinitions 的 P1–P6 待决问题（ADR-2026-10-11-034）。
 *  - "三方一致即足够证据"这条标准是否推广到本 Work Item 之外。
 *  - CONVERTED / NOT_SELECTED 的终态语义。
 *  - 60 号测试时区缺陷是否修。
 *  - spawn_error 被吞掉 / monthly setMonth 溢出：是入档 Known Limitation、
 *    Deferred technical debt、正常行为还是真正 defect——没有判断（代码事实
 *    记录在 Project State「六十四」附记）。
 *  - 疑似凭证的核实与处理。
 *  - 下一个 Work Item。
 *
 * 【Carson 在本窗口反复使用的工作规则】
 *  其中 W1、W7 也出现在 2026-09-30 handoff；其余在各自任务里表述，没有明说
 *  是否永久通用——保守起见，新任务默认沿用，除非 Carson 另有说明。
 *  W1 候选 / 条件满足 ≠ 已授权 ≠ Next Slice；"可以做" ≠ "已经被授权做"。
 *  W2 Existing Contract → Required Coverage → Missing Coverage；
 *     "某函数没有测试" ≠ "应该补测试"。
 *  W3 Test existing behavior; do not invent behavior。
 *  W4 证据冲突 → BLOCKED，不得自行选版本（尤其 Command Reference vs 代码）。
 *  W5 对账事实（29/11/19）≠ implementation requirement；coverage 事实
 *     ≠ 必须补测试。
 *  W6 scope / handoff / 实际代码不一致 → STOP AND REPORT，不自行修正。
 *  W7 Truth protection：治理记录追加而非重写历史，不为了 metadata 好看去
 *     改无关的历史记录。
 *  W8 凭证内容绝不打印、复制、写进任何文件。
 *  W9 每个新 Work Item 先做 read-only Pre-work Integrity Gate，PASSED 之后
 *     也先停，等 Carson 再授权 coding。
 */

// ============================================================
// 三、状态分类（不把"讨论过"当作"已实现或已验证"）
// ============================================================

/**
 * ── A. 已完成且已验证 ──────────────────────────────────────────
 *  A1 Roadmap Metadata Sync：2 行日期。DIFF/SYNTAX。Carson 判定 PASS。
 *  A2 Testing Coverage 新测试 61–64（38 个）：SIM VERIFIED 38/38——UTC、
 *     Asia/Taipei、Pacific/Auckland、America/New_York 四个时区下 4 个新 gate
 *     均通过；Mutation verification：对 Production 临时副本做 10 处破坏，
 *     全部检出（首轮 9/10，补 ViewEngine.upcoming 的 23:59:59.999 边界用例后
 *     10/10）；4 个文件 node --check 通过；当时的逐文件比对结果：Production /
 *     已有测试 / 治理文件相对 zip 零改动。本次 checkpoint 再次重跑，结果
 *     一致。（只有 SIM，不是 LIVE。）
 *  A3 Project State「六十五」（Testing Coverage closure）：DIFF/SYNTAX，纯
 *     追加。Carson 判定 PASS。
 *  A4 EventDefinitions Pre-work Gate + Authority Investigation：STATIC。
 *     数字（29/29/11/26/28 与各差集）由脚本对去注释后的源码统计，可复现
 *     （方法见「七」）；引用的 file:line 已对照 zip 快照逐条核对。
 *  A5 本次治理持久化（ADR-033/034、Project State「六十六」、Known
 *     Limitations「十四」–「十八」、Roadmap 状态同步）：DIFF/SYNTAX——
 *     ADR / KL / Project State 与基线逐行比对，原有行逐字一致（纯追加）；
 *     Roadmap 相对 zip 只有 2 行被改动（LAST_UPDATED、第 109 行日期），其余
 *     为新增；4 个文件 node --check 通过；新增内容扫描无凭证类字符串。
 *     内容与代码的对应关系是 STATIC 核对。
 *
 * ── B. 已实现但未验证 ──────────────────────────────────────────
 *  B1 61–64 从未在真实 Apps Script 里运行过（NOT LIVE GAS VERIFIED）。
 *  B2 所有交付件是否已被应用到 Carson 的真实项目：UNKNOWN（用「八」的 md5
 *     核对，不要假设）。
 *  B3 Known Limitations「十六」两处 Weekly Dashboard 观察：静态阅读 + Node
 *     模拟复现，没有 LIVE 验证；Monthly Dashboard 没有做同样的逐项核对。
 *  B4 Known Limitations「十五」时区缺陷：只在 Node 模拟里复现，真实 GAS 是否
 *     受影响取决于脚本时区，未验证。
 *  B5 沿用自 2026-09-30 handoff 的未验证项（Slice 3 UI 层、Slice 4 Part B
 *     第 14 项、Slice 5 LIVE TEST PENDING）：本窗口没有触碰。
 *
 * ── C. 正在进行 ────────────────────────────────────────────────
 *  无。EventDefinitions 是"调查完成、等待 Human Decision"，不是进行中的
 *  实施。
 *
 * ── D. 尚未实现（也没有授权）──────────────────────────────────
 *  - EventDefinitions 的任何文件 / 修改（04_EventDefinitions、13_*、补
 *    00_Event_Flow、registry、constants、改 EventBus / dispatcher / Timeline
 *    map / deriveFromEvent / publisher）。
 *  - 未实现的测试：Weekly/Monthly 内容、21_RecurringEngine、12_Task
 *    QueryEngine Contract Test、CONVERTED/NOT_SELECTED 终态、Priority 的
 *    overdue clamp / recurring discount / 显式 Math.min(100)。
 *  - 候选池 9 项（见「一」）以及 Roadmap 的另 3 个早期候选，全部没有开始。
 *  - 没有授权去修的已知问题：60 的时区 helper；TASK_UPDATED 双发布方与
 *    Constitution 的不一致；Weekly Dashboard 两处疑点；Roadmap 里一处过期
 *    陈述（见「十」）。
 *
 * ── E. 未解决 / blocked ────────────────────────────────────────
 *  E1 EventDefinitions：Authority UNRESOLVED，P1–P6 待决（ADR-034）。Known
 *     Limitations「十七」。
 *  E2 CONVERTED / NOT_SELECTED 终态语义：BLOCKED — CONTRACT UNRESOLVED。
 *     Known Limitations「十四」。
 *  E3 Weekly/Monthly Dashboard 内容：只是观察，未裁决。Known Limitations
 *     「十六」。
 *  E4 60_Tests_PriorityEngineBoundaries 时区缺陷：DEFERRED。Known
 *     Limitations「十五」。
 *  E5 POTENTIAL SECRET EXPOSURE — FOLLOW-UP REQUIRED：Test.gs 的
 *     setupGeminiConfig 疑似真实 AI API key；是否真实、是否 active 均未确认；
 *     没有复制、没有修改、没有 rotate。需要 Carson 自己在 provider 控制台
 *     核实（assistant 建议，不是决定：若真实，先在 provider 侧 rotate/
 *     revoke，再另议如何从源码移除）。Known Limitations「十八」。
 *  E6 Priority Contract：CLOSED / UNRESOLVED BY DESIGN——不是 blocker，不要
 *     重新打开。
 *  E7 无法获得的历史资料：ADR-2026-07-06-002 原文（HISTORICAL REFERENCE
 *     NOT FOUND）；v5.0 存档（NOT AVAILABLE / NOT VERIFIED）；"Next Work
 *     Item Decision Brief"（不在仓库里）。
 *  E8 spawn_error / setMonth 的归类（见「二」）。
 *  E9 due_date 13 行历史损坏 NO REPAIR AUTHORIZED；due_date write-time
 *     保护扩展无决策。
 *
 * ── F. 已被取代 / 已更正 ────────────────────────────────────────
 *  F1 2026-09-30 handoff 的"Next Work Item 没有选 / Testing Coverage 仅是
 *     候选"：已被本窗口取代。
 *  F2 Roadmap「六」Testing Coverage 的"其余 10 个文件仍是 0"：已过期，
 *     Roadmap 2026-10-11 已加更新说明。
 *  F3 Roadmap「三」第 4 项的"28 种"：重新核实为 29 种，Roadmap 已加更新说明。
 *  F4 Testing Coverage Pre-work 的 SCOPE MISMATCH：已被 Carson 的 Scope
 *     Decision 解决。
 *  F5 assistant 口头说过的"deriveFromEvent 只有 8 个 case"：已更正——那只是
 *     20_TaskEngine 一份，6 个按实体划分的 deriveFromEvent 合计覆盖 28 个
 *     事件（Project State「六十六」二·D）。
 *  F6 Project State「六十五」里的"新增 ADR: NO / 不在 Roadmap 里新增或修改
 *     任何条目"：closure 当时是真的；之后才有 ADR-033 与 Roadmap 同步——这
 *     不是矛盾，「六十六」十和 ADR-033 的 Record Date 已说明。
 */

// ============================================================
// 四、当前 implementation checkpoint
// ============================================================

/**
 * 结论：没有被中断的 implementation，没有"做到一半"的代码。下面是本窗口实际
 * 产生的全部文件改动（相对 2026-10-03 zip 基线）：
 *
 *   文件                          性质                                   验证
 *   00_Roadmap.js                 2 行被改动（LAST_UPDATED、第 109 行日   DIFF/SYNTAX
 *                                 期）+ 新增行（头部更新段、第 4 项状态、
 *                                 Testing Coverage 状态、「七」bullet）
 *   00_Project_State.js           纯追加：「六十五」「六十六」             DIFF/SYNTAX
 *   00_ADR.js                     纯追加：ADR-033、ADR-034                DIFF/SYNTAX
 *   00_Known_Limitations.js       纯追加：「十四」–「十八」               DIFF/SYNTAX
 *   61_Tests_SearchEngine.js      新文件，10 个测试                       SIM
 *   62_Tests_ViewEngine.js        新文件，13 个测试                       SIM
 *   63_Tests_DashboardEngine.js   新文件，6 个测试                        SIM
 *   64_Tests_AnalyticsEngine.js   新文件，9 个测试                        SIM
 *
 *   未改动（相对 zip 逐文件比对）：全部 Production .js、全部已有测试（含
 *   60_Tests_PriorityEngineBoundaries.js）、00_Command_Reference /
 *   00_Project_Constitution / 00_Architecture_Review / 00_File_Map /
 *   00_Module_Responsibility / 00_Event_Flow / Test.js 等其它文件。
 *
 *   沙盒里的临时文件（/tmp，不属于项目、不交付、可复现）：Node/vm 验证脚本
 *   （附录 A）、Weekly Dashboard 一次性探针、事件统计的中间 JSON。
 *
 * 中断点：无。继续点：「五」。
 * 编号提醒：Project State「六十五」「六十六」、ADR-2026-10-06-033 /
 * 2026-10-11-034、Known Limitations「十四」–「十八」都是基于 zip 快照
 * （最后编号：Project State 六十四、ADR-032、KL 十三）的"下一个顺序号"。
 * 如果 Carson 的真实项目在 2026-10-03 之后还有别的窗口追加过治理条目，先
 * 核对编号再贴，不要覆盖。
 */

// ============================================================
// 五、下一步准确操作（不替 Carson 选，只列机制）
// ============================================================

/**
 * Step 0（任何新工作之前必做）：核对真实项目与交付件。
 *   对「八」表里的 8 个文件，在真实项目里算 md5（取前 12 位）：
 *     - 与"最终 md5"一致 → 已应用，继续。
 *     - 与"中间版 md5"或"zip 基线 md5"一致 → 只应用了一部分或没应用：把
 *       交付的最终版整体替换进去（Project State / ADR / KL 相对基线是纯
 *       追加；Roadmap 也是整体替换，不要只合并部分段落）。
 *     - 都不一致 → 真实项目在别处被改过：不要覆盖，先人工合并，并检查
 *       编号是否冲突。
 *   同时确认 Project State 里有「六十五」「六十六」各 1 条、ADR Log 里有
 *   ADR-033/034、Known Limitations 里有「十四」–「十八」。
 *
 * Step 1：由 Carson 选择下一步（任选，不替他选）：
 *   (a) 对 EventDefinitions 的 P1–P6 做 Human Decision（可以只答一部分）；
 *       每个决定先落成 ADR / decision，再谈 coding。
 *   (b) 从候选池另选一个 Work Item（「一」的 9 项 + 3 个早期候选）。
 *   (c) 独立 follow-up：核实 / 处理疑似凭证（E5）；决定 CONVERTED/
 *       NOT_SELECTED 语义（E2）；归类 spawn_error / setMonth（E8）；确认关闭
 *       ActiveTasks；due_date 相关两项（E9）。
 *
 * Step 2：无论选哪一项，先做 read-only Pre-work Integrity Gate（W9），产出
 *   PASSED / BLOCKED / SCOPE MISMATCH 之一；PASSED 之后也先停。
 *
 * 在 Carson 明确授权之前，不 coding、不改 Production、不新增测试、不修已知
 * 问题。
 */

// ============================================================
// 六、新窗口必须先读取的文件（按顺序）
// ============================================================

/**
 * 1. 本文件。
 * 2. 00_Project_State.js：「六十二」→「六十六」（62 Slice 4 Reassessment；
 *    63 Priority Reconciliation；64 Recurring Monthly 事故 CLOSED，其附记含
 *    spawn_error / setMonth 的代码事实；65 Testing Coverage closure；66
 *    EventDefinitions 调查）。
 * 3. 00_ADR.js：ADR-2026-09-30-032、ADR-2026-10-06-033、ADR-2026-10-11-034。
 * 4. 00_Roadmap.js：文件头（LAST_UPDATED / PREVIOUS_UPDATE）、「三」候选
 *    （含第 4 项的 2026-10-11 状态更新）、「六」Testing Coverage、「七」。
 * 5. 00_Known_Limitations.js：「三」「十二」「十三」「十四」–「十八」。
 * 6. 若继续 EventDefinitions，再读：
 *    - 00_Project_Constitution.js 零之五（约第 485–593 行）、「(三)」「(五)」
 *      对账表（约第 925–1010 行）、P3（第 666 行）、P4（第 720–724 行）
 *    - 00_Event_Flow.js、00_Architecture.js 第 182 行、00_File_Map.js 第
 *      51–52 行
 *    - 02_EventBus.js（文件头、第 203 行、第 251–254 行）、
 *      10_ProjectionEngine.js（TIMELINE_ENTITY_MAP 第 100–137 行、dispatch
 *      第 141 行起）、20_TaskEngine.js（第 334、652、706 行）、
 *      28_WorkflowEngine.js（第 244、272 行）、43_ReminderConnector.js（第
 *      48、66 行）
 * 7. 若继续测试相关工作，再读：61–64 的文件头注释、60_Tests_Priority
 *    EngineBoundaries.js、00_Command_Reference.js（G2、V1–V5、V11–V13）、
 *    23/24/25/26 各自的 Engine Contract 文件头。
 * 8. 2026-09-30 handoff：仅用于查"候选池原文（「五」）"和更早已关闭的事项。
 * 不需要把整个仓库重新读一遍。
 */

// ============================================================
// 七、不要重复做的事 / 不要假设的事
// ============================================================

/**
 * 【不要重复做】
 *  - 不要重做 Testing Coverage 的 Pre-work / Scope 讨论，不要重开
 *    Priority Contract（ADR-032）。
 *  - 不要重做 EventDefinitions 的 Pre-work 与 Authority Investigation。数字
 *    可复现，方法：对非 00_*、非测试文件去注释后，用正则
 *    EventBus\s*\.\s*publish\s*\(\s*['"]([A-Z_]+)['"] 统计 Published；取
 *    10_ProjectionEngine.dispatch 的 case 作 Dispatcher；以 Constitution
 *    零之五 与 00_Event_Flow 里"── NAME"开头且 8 个字段齐全的块作 Formal
 *    Documentation。只有在代码相对 2026-10-03 快照变化之后才需要重算。
 *  - 不要为 BLOCKED 项补测试（Priority 3 类、Weekly/Monthly 内容、
 *    Recurring、TaskQuery Contract、CONVERTED/NOT_SELECTED）。
 *  - 不要为"没有测试"本身补测试（W2、W5）。
 *  - 不要修 60 的时区 helper、不要改 22_PriorityEngine。
 *  - 不要再追问"Weekly Dashboard 要不要修"——没有裁决，先不固化成 contract。
 *
 * 【不要假设】
 *  - 不要假设交付件已在真实项目里（先 Step 0）。
 *  - 不要把 SIM VERIFIED 当成 LIVE GAS VERIFIED。
 *  - 不要假设 13_EventDefinitions.js 存在（13_ 是 13_ActiveTasksEngine；
 *    04_EventDefinitions 从未创建，也没有被批准）。
 *  - 不要把 29 / 11 / 19、"部分事件没有测试"当作 implementation
 *    requirement 或 Roadmap Work Item。
 *  - 不要把 Roadmap 的"> 10"、Constitution 的"文件头放不下"、handoff 的
 *    "三个维度"任何一套当作唯一有效的触发标准。
 *  - 不要假设 ADR-2026-07-06-002 的内容（原文不在仓库）；不要假设 v5.0 存档
 *    里的 payload，不要从生产代码推导 19 个事件的 payload 并当作 contract。
 *  - 不要假设 00_Event_Flow.js / Constitution 的事件清单是完整的。
 *  - 不要假设 CONVERTED/NOT_SELECTED 应该算终态，或不应该——两边证据冲突，
 *    没有决定。
 *  - 不要假设 Test.gs 里的 key 是真实的 / 仍然 active / 已失效。绝不打印它。
 *  - 不要假设上面的排序意见（「一」末尾）是 Carson 批准的优先级。
 *  - 不要假设本文件里标"推断"的日期是 Carson 的日期，也不要假设 Carson 的
 *    时区。
 *  - 不要假设"候选条件满足"= 该做；W1。
 */

// ============================================================
// 八、交付文件清单与核对
// ============================================================

/**
 * md5 取前 12 位；wc -l 行数。"zip 基线"= Carson 上传的 2026-10-03 快照；
 * "中间版"= 本窗口较早交付过、但已被本次覆盖的版本。
 *
 *   文件                          最终 md5       行数   zip 基线 md5   中间版 md5
 *   00_ADR.js                     254ed3da51ff    2724  9a7c82ceb315   —
 *   00_Known_Limitations.js       514ebf0669fb     998  8708d64391b2   —
 *   00_Project_State.js           3960ecadd575    4105  0d08781a9984   4c0d04bac19a（仅含「六十五」）
 *   00_Roadmap.js                 613b8c42a1cf     375  1a7f0e3a743b   09ebb38243e1（仅 Metadata Sync）
 *   61_Tests_SearchEngine.js      701ab92a2e1a     317  （新文件）     —
 *   62_Tests_ViewEngine.js        48aab02b2cfb     409  （新文件）     —
 *   63_Tests_DashboardEngine.js   112dea65afc6     300  （新文件）     —
 *   64_Tests_AnalyticsEngine.js   0f2af26beea6     304  （新文件）     —
 *
 * 应当保持不变的参照（相对 zip）：22_PriorityEngine.js 127ca5c1b714、
 * 60_Tests_PriorityEngineBoundaries.js 4f624647bd03。
 *
 * 核对命令：Linux  md5sum 文件 | cut -c1-12；macOS  md5 -q 文件 | cut -c1-12。
 * 之前交付过 00_Project_State.js（含「六十五」）与 00_Roadmap.js（Metadata
 * Sync），本次的同名文件是它们的累积版本——应整体替换，不要只拿新增部分。
 */

// ============================================================
// 九、治理持久化对照（决定 / 事项 → 写在哪）
// ============================================================

/**
 *  Testing Coverage scope / 证据标准 / blocked 清单 / closure 决定
 *      → ADR-2026-10-06-033（Accepted，仅限本 Work Item）
 *      → Project State「六十五」（closure 与结果）
 *      → Roadmap「六」Testing Coverage 状态更新
 *  CONVERTED / NOT_SELECTED（BLOCKED）          → Known Limitations「十四」
 *  Priority 测试时区缺陷（DEFERRED）            → Known Limitations「十五」
 *  Weekly/Monthly Dashboard 疑点                → Known Limitations「十六」
 *  Event Vocabulary 治理空白与不一致             → Known Limitations「十七」
 *  EventDefinitions 调查结论与 P1–P6            → ADR-2026-10-11-034（NOT A
 *      DECISION / OPEN）→ Project State「六十六」→ Roadmap「三」第 4 项
 *  疑似凭证（FOLLOW-UP REQUIRED，无凭证内容）   → Known Limitations「十八」
 *  Known Limitations「十四」–「十八」的状态索引   → Roadmap「七」
 *  没有写进治理文件、只在本文件里的内容：候选排序意见、工作规则 W1–W9 的
 *  "是否通用"说明、下一步操作、观察清单（「十」）、附录。
 */

// ============================================================
// 十、本窗口发现、但没有处理的其它观察
// ============================================================

/**
 *  - 00_Roadmap.js「七」里关于 Known Limitation「三」的那条（"跟纯公式的
 *    suggestPriority()（能给到 CRITICAL）不对称"），仍沿用已被 Known
 *    Limitations「三」在 2026-09-30 更正的旧说法（suggestPriority() 没有
 *    CRITICAL 分支）。没有改——不在本次授权范围。
 *  - 00_File_Map.js 的测试清单没有 59、60，也没有 61–64；是否补登记没有
 *    决定。
 *  - 02_EventBus.js 文件头标题仍是 "Productivity OS v4.6"（Life OS v5.x 的
 *    变化没有反映到文件头）。
 *  - 仓库里有 26_AnalyticsEngine.txt 与 26_AnalyticsEngine.js 并存；还有 3 个
 *    11_ProjectionRebuilder__*.js 补丁片段文件（Drag Ordering ADR 记录的
 *    "补丁文件、贴进主文件"约定，不是意外）。
 *  - 00_ADR.js 文件头的 Changelog 只写到 v5.2，之后的 ADR 没有更新它（沿用
 *    既有惯例，本次也没改）；Known Limitations 文件头的 LAST_UPDATED 同样
 *    停在 2026-09-07（沿用既有惯例，没改）。
 *  - 共享 Events 表里还有 Core 的 Inventory 事件，不在本仓库的事件词汇范围
 *    内（Event Vocabulary 的 authority 讨论必须考虑这一点）。
 */

// ============================================================
// 附录 A：SIM 验证方法（可复现，不属于项目）
// ============================================================

/**
 * 方法：用 Node 的 vm 模块，把真实、未改动的 05_SheetUtils.js、
 * 22_PriorityEngine.js、23–26 四个 Engine、60 号测试、61–64 四个测试文件
 * 载入同一个 context；只 stub Logger / Session / Utilities（不读写任何
 * Sheet）；依次调用各 run...Gate()。换 TZ 环境变量可在不同时区重跑。
 * 预期结果：UTC / Asia/Taipei / Pacific/Auckland 下 2/2、10/10、13/13、
 * 6/6、9/9 全 PASS；America/New_York 下只有 60 的 Priority gate 是 1/2
 * （Known Limitations「十五」）。脚本（路径按需调整）：
 *
 *   // Scratch harness (NOT part of the project): loads REAL production files + new tests into one vm context.
 *   const vm = require('vm'), fs = require('fs'), path = require('path');
 *   const P = process.env.PROD_DIR || '/tmp/proj/70.Personal-Life-main';
 *   const T = process.env.TEST_DIR || '/mnt/user-data/outputs';
 *   const logs = [];
 *   const ctx = vm.createContext({
 *     Logger: { log: m => logs.push(String(m)) },
 *     Session: { getScriptTimeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone },
 *     Utilities: { formatDate: (d, tz, fmt) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d) },
 *     console
 *   });
 *   const load = (dir, f) => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
 *   ['05_SheetUtils.js', '22_PriorityEngine.js', '23_SearchEngine.js', '24_ViewEngine.js', '25_DashboardEngine.js', '26_AnalyticsEngine.js'].forEach(f => load(P, f));
 *   load(P, '60_Tests_PriorityEngineBoundaries.js');
 *   ['61_Tests_SearchEngine.js', '62_Tests_ViewEngine.js', '63_Tests_DashboardEngine.js', '64_Tests_AnalyticsEngine.js'].forEach(f => load(T, f));
 *   const gates = ['runPriorityEngineBoundaryGate','runSearchEngineCoverageGate','runViewEngineCoverageGate','runDashboardEngineCoverageGate','runAnalyticsEngineCoverageGate'];
 *   let allOk = true;
 *   gates.forEach(g => { const r = vm.runInContext(g + '()', ctx); allOk = allOk && r; });
 *   const summary = logs.filter(l => /PASS$|FAIL$|runs?.*Gate|❌/.test(l) || /Gate:/.test(l));
 *   if (process.env.VERBOSE) console.log(logs.join('\n')); else console.log(summary.join('\n'));
 *   console.log('TZ=' + (process.env.TZ || 'default') + ' ALL_OK=' + allOk);
 *   process.exit(allOk ? 0 : 1);
 *
 * 另有一次性探针（Weekly Dashboard 的"今日已完成"与"即将到来 (7天内)"，见
 * Known Limitations「十六」）：同样载入 05/22/23/24/25/26，再调用
 * DashboardEngine.buildWeeklyDashboard(tasks)，tasks 为 1 个今天到期且已 DONE
 * 的任务 + 1 个 20 天后到期的 PENDING 任务；结果为"今日已完成: 0""即将到来
 * (7天内): 1"。
 */

// ============================================================
// 附录 B：本窗口 assistant 自己更正过的说法（给新窗口一个"别再信旧说法"的清单）
// ============================================================

/**
 *  1. "deriveFromEvent 只有 8 个 case" → 实际 6 个按实体划分的函数合计 28 个
 *     事件；8 个只是 20_TaskEngine 那一份。
 *  2. Roadmap 的"28 种事件类型" → 重新核实为 29 种（口径：去注释后字面量
 *     EventBus.publish）。
 *  3. 首轮 mutation 检测脚本的判定逻辑有误（把"N/M PASS"当成全通过），报出
 *     "10 个全部未检出"——是脚本 bug，不是测试问题；修正后实际 9/10 检出，补
 *     一个边界用例后 10/10。
 *  4. 最初的"已文档化事件"扫描多算了一个 RESOLUTION（Known Limitations 的
 *     标题），已排除；正确值仍是 11。
 *  5. 追加 Project State「六十五」时，校验命令用了 sh 不支持的 process
 *     substitution 而报错——追加本身只发生一次且已核对，纯工具层面的临时
 *     错误，不是项目缺陷。
 *  6. 62_Tests_ViewEngine 的 upcoming 用例最初漏了"恰好 23:59:59.999"的边界，
 *     已补；63 的头部注释曾因 "*" + "/" 相连提前结束注释，已修正。
 */
