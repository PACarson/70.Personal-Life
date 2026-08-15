# Sprint 4 Recovery Audit — Life OS

**Report Date**: 2026-08-14
**Scope**: Sprint 3 → Sprint 4 baseline reconciliation, after the previous session hit its usage quota and the container filesystem was reset
**Method**: Static audit of the uploaded project snapshot (`70.Personal-Life-main.zip`, 47 files)。压缩包内没有 `.git`，所有文件 mtime 一致（zip 打包时间），时间戳不可用于判断先后——本报告所有结论均基于**内容交叉引用**（函数是否被定义、被谁调用、契约声明是否与调用方一致、治理文档是否真实存在对应条目），不依赖时间戳或记忆。

> **关于改名**：本报告标题采用你这次要求的新名字 **Life OS**。但代码库目前仍然处处写着 "Personal Life OS v5.2"（每个文件头、Library Identifier `PersonalLifeOS`、GAS 项目名等）——这次是 Audit-only，没有做任何改名相关的写入，也不建议在 baseline 还没重新稳定前顺手做一次全库 rename（那本身就是一次跨全部 47 个文件的修改，风险跟"直接续写 Sprint 4"是同一类）。改不改、什么时候改，留在 §7.7 作为一个独立决策项。

---

## TL;DR — 先回答你最关心的问题

> 这三个救回来的 Engine 到底能不能安全地接回 Sprint 3？

**可以，在代码契约层面可以。** 三个文件语法有效（`node --check` 通过）；它们调用的每一个外部符号——`AIConnector.callAIForJSON_`、`shallowCopy_`、`NoteQueryEngine.getOpenNotes`、下游的 `createProject`/`startWorkflow`/`createTask`——都真实存在于 Sprint 3 baseline 里，签名匹配。它们引用的每一条治理依据——ADR-2026-07-24-009、Architecture Principle 9（AI Suggests, Human Confirms）、Domain Boundary 里 Goal 归属 Life Execution OS 的判定、`workflow_shape` 的具体字段名（包括容易错的 `branch_group` vs `branch_group_label`）——逐条核对下来都是真实存在且准确的引用，不是凭空编造或记错。三个文件互相之间的契约（46↔22、46↔47、47↔41_BusinessRuleEngine）也是一致的。

**但"接回去能跑"不等于"Sprint 4 完成"。** 有一个需要你自己做判断的架构一致性问题（Finding F3，Domain 层直接依赖 Application 层），以及三项确认缺失、必须新建的工作（呈现层入口、测试覆盖、两份治理文档更新）。**没有发现 P0 级问题**——没有伪造的依赖、没有语法错误、没有会导致数据损坏的东西。

---

## 1. Current Project State

### 1.1 What is actually persisted

`00_Project_State.js` 里没有任何 Sprint 4 相关声明，「三、尚未开始」明确写着 "Sprint 4（AI）—— 未开始"，最后一次更新（六节）停在 "2026-07-29 Sprint 3 Gate 第二次真实运行：2/4 测试通过，两个真实 bug 已修，等 Carson 重新跑 `runSprint3AcceptanceGate()` 确认"。这与你给的恢复说明完全吻合——**`00_Project_State.js` 现在的内容就是纯 Sprint 3 baseline，没有任何 Sprint 4 修改的残留或损坏痕迹**。

### 1.2 What Sprint 3 contains

与记忆记录一致：NoteEngine、ReviewEngine、BusinessRuleEngine（三层模型）、ConversionEngine、ReminderConnector + Sprint 3 Acceptance Gate 测试套件（`36_Tests_Sprint3Acceptance.js`）。`40_ReviewEngine.js` 经过全文核对，是一个干净、自洽、没有任何半成品痕迹的 Sprint 3 文件（文件头明确标注 "Sprint 3"）。

### 1.3 What Sprint 4 artifacts currently exist

只有三个：`46_AIConnector.js`、`22_PriorityEngine.js`（Sprint 4 扩展部分）、`47_AIPlanningEngine.js`。全项目范围搜索 "Sprint 4" 字样，命中的文件只有这三个 + `40_ReviewEngine.js`（一处前瞻性占位注释，见 1.4）+ `00_Project_State.js`（一处"未开始"声明）+ `README.md`（一处部署顺序提及）。**没有找到任何其它 Sprint 4 代码或文档残留** —— 这意味着你转述的"其它 Sprint 4 内容也不能假设存在"这条判断，在能检索到的范围内是成立的。

### 1.4 Which files were modified/extended by Sprint 4 but are now reverted

- **`40_ReviewEngine.js`**：全文核对，唯一的 Sprint 4 相关内容是一段说明性注释——"AI Review Hook 是预留接口，不是已实现能力，`ai_review_notes` 本版本恒为空字符串"，并且文件末尾的 Notes 清楚写明未来只需要在 `_generate_()` 内部那一行填入真正的 AI 调用结果，其余部分不用动。这是一处**干净的、有意为之的占位**，不是 Sprint 4 代码被截断后留下的残骸——证据支持"Sprint 4 对本文件的修改确实没有被保留下来"，而不是"部分保留、部分损坏"。
- **`00_Project_State.js`**：同上，内容在结构上完整，没有 Sprint 4 章节的残缺片段（比如半截的标题、断开的列表）。是干净的 Sprint 3 版本，不是被截断的 Sprint 4 版本。

### 1.5 一处需要注意、但与本次崩溃无关的既有问题

`00_Roadmap.js` 最后更新停在 2026-07-13，内容还是 "Productivity OS v4.7" 时代的九引擎路线图，完全没有提到 Personal Life OS V2 的 Sprint 1/3/4 框架、没有提到 Note/Review/BusinessRule/Conversion/AI 任何一个后来的模块。**这份文件在 Personal Life OS V2 演进开始之后就没再更新过**，跟这次崩溃无关（不是本次事件造成的），但既然本次审计要求过一遍 design documents，就一并记录在案（见 §5、§6 的 P3 项）。另外，`00_ADR.js`、`00_File_Map.js`（除 22_PriorityEngine 一处过时描述外）也完全没有提到 Sprint 4——说明治理文档层面，Sprint 4 目前处于"没有正式立项记录"的状态（见 Finding F1、F2）。

---

## 2. Recovered Code Audit

### 2.1 `46_AIConnector.js`

| 检查项 | 结果 |
|---|---|
| Syntax | 通过（`node --check`） |
| Dependencies | `01_SecureConfig.gs`（`getKey`）+ GAS 内建 `UrlFetchApp`——两者均已存在于 Sprint 3 baseline |
| Function references | Public API 为 `callAI_(prompt, options)`、`callAIForJSON_(prompt, options)`，与 22/47 两个调用方的实际调用完全匹配 |
| API contracts | 自身声明 "Forbidden Dependencies: Sheet, Events"——本文件确实没有出现任何 Sheet/EventBus 调用，契约自洽 |
| Config requirements | 读取的 key（`AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL` 等，非本文件所有细节都逐字核对，但已确认走的是 `SecureConfig.getKey`）—— `01_SecureConfig.gs` 的 `getKey`/`setKey` 是完全通用的 key-value 包装，没有白名单限制，机制上没有问题；唯一的小瑕疵是该文件头部的用法示例注释还停在 `TELEGRAM_TOKEN`/`GEMINI_API_KEY` 等旧例子，没有把新 key 加进示例（纯文档细节，见 P3） |
| Compatibility with Sprint 3 architecture | 是——本文件不摸 Sheet/Events，符合"纯外部 I/O 桥接层"的自我定位，落在 Infrastructure 层的定义范围内（对照 `00_File_Map.gs` 现有 Infrastructure 分层里 `01_SecureConfig`/`02_EventBus` 等同类文件的特征） |
| Compatibility with existing engines | `03_Output.js` 里已经在用 `UrlFetchApp`（大概率是 Telegram Bot API），说明外部 HTTP 请求在这个项目里不是新能力，`script.external_request` 授权大概率已经存在，不是本文件引入的新风险点 |
| Naming conventions | 公开方法用尾缀下划线（`callAI_`），跟项目里其它"内部/受限调用"函数的命名习惯一致 |
| Error handling / Logging | 未见明显缺失（未逐行核查异常分支的完整性，标记为轻量核实） |
| Security/safety | API Key 走 `SecureConfig`，没有硬编码密钥；网络请求范围仅限于配置的 AI 供应商 endpoint |
| Test coverage | **零**——`34/35/36` 三个测试文件都没有引用 `AIConnector` |
| Completeness | 作为一个独立、职责单一的 Infrastructure 文件，功能完整、自洽 |

**结论：Keep。** 没有发现依赖缺失或契约不一致。

### 2.2 `22_PriorityEngine.js`

| 检查项 | 结果 |
|---|---|
| Syntax | 通过 |
| Dependencies | 新增部分依赖 `46_AIConnector.gs`（仅 `suggestPriorityWithAI_` 使用，文件自己在 Engine Contract 里就是这么声明的，范围声明准确）；沿用的 `shallowCopy_` 已确认定义在 `05_SheetUtils.js:370` |
| Function references | `AIConnector.callAIForJSON_(prompt)` 调用与 46 的实际导出完全匹配 |
| API contracts | 新函数 `suggestPriorityWithAI_` 只返回建议、不写入——符合文件自己重申的 "Decision Never Executes"（Architecture Principle 5）；写入职责留给调用方，这点在文件头有明确声明 |
| Config requirements | 无新增（沿用 46 的配置） |
| Compatibility with Sprint 3 architecture | `priority_ai_recommended` 字段已存在于 `15_Setup.js` 的 Tasks schema 里（Sprint 1 就建了列），`20_TaskEngine.js` 里也有对应的占位注释（"Sprint 1: 建列不建值，22_PriorityEngine 尚未接入"）——这次新增正好是在填这个坑，方向正确 |
| Compatibility with existing engines | 文件自己声明"既有 `computeUrgencyScore`/`computePriorityScore`/`suggestPriority`/`rankByPriority` 逐行核对，原样不变"——**这一条我没有办法用 diff 验证**（压缩包里没有保留 Sprint 3 时期这个文件的独立副本），只能确认现在这份文件内部自洽、跟其它文件对它的调用方式匹配，无法百分之百确认"原样不变"这个说法本身 |
| Naming conventions | 一致 |
| Error handling / Logging | 未见明显问题 |
| Security/safety | 同 46，无新增风险面 |
| Test coverage | **零** |
| Completeness | 完整；引用的治理依据 `ADR-2026-07-24-009` 经核实真实存在于 `00_ADR.js`，内容正是 "Priority 拆分为 `priority_user` + `priority_ai_recommended`"——引用准确，不是编造 |

**结论：Keep。** 唯一的保留意见是"既有函数原样不变"这个说法本身无法独立验证（见 §3 Category D）。

### 2.3 `47_AIPlanningEngine.js`

| 检查项 | 结果 |
|---|---|
| Syntax | 通过 |
| Dependencies | 文件自己声明 `46_AIConnector.gs`、`17_NoteQueryEngine.gs`——两者都真实存在，`NoteQueryEngine.getOpenNotes(chatId)` 的签名与实际调用完全匹配（`17_NoteQueryEngine.js:91`） |
| Function references | `suggestNewProject_(chatId)` 内部调用 `NoteQueryEngine.getOpenNotes`；`generateWorkflowSuggestion_(description)` 不查询任何数据，纯粹基于传入的自然语言描述——两者都跟公开 API 列表一致 |
| API contracts | 声明 "Forbidden Dependencies: 自动创建 Project/Workflow/Task"——核实函数体确实只 `return`，没有任何 `createProject`/`startWorkflow`/`createTask` 调用，契约成立 |
| Config requirements | 无新增 |
| Compatibility with Sprint 3 architecture | **一处需要你决定的问题，见下方 Finding F3**：`17_NoteQueryEngine.gs` 在 `00_File_Map.gs` 的 Architecture Layer Map 里被归类为 **Application** 层，而 `47_AIPlanningEngine.gs` 按其它同类 Engine（`22`/`29`/`40`/`41`/`42`）的归类惯例应属于 **Domain** 层——Domain 直接依赖 Application，在方向上跟 Architecture Principle 8（Dependency Direction: Presentation → Application → Domain → Infrastructure，只能向下）相反 |
| Compatibility with existing engines | `suggestNewProject_`/`generateWorkflowSuggestion_` 都只返回建议，不绕过 `27_ProjectEngine.createProject`/`28_WorkflowEngine.startWorkflow`/`20_TaskEngine.createTask`——三个下游函数经核实确实存在且签名一致（`title, meta, chatId`），没有绕过既有 Engine 自己重新实现创建逻辑 |
| Naming conventions | 一致 |
| Error handling | `generateWorkflowSuggestion_` 对 AI 回复做了校验（`tasks` 必须是非空数组，否则显式 `throw new Error('AI_RESPONSE_INVALID: ...')`），处理得比较仔细 |
| Security/safety | 无新增风险面 |
| Test coverage | **零** |
| **Completeness — 逐字段核实** | `generateWorkflowSuggestion_` 输出的字段（`local_id`/`title_template`/`relative_offset_days`/`sequence_index`/`parent_local_id`/`branch_group_label`/`branch_resolution_policy`）逐个对照 `41_BusinessRuleEngine.js` 的 `captureAsWorkflowTemplate` 实际代码——**完全匹配，包括容易搞混的两处**：`parent_local_id`（不是原始 Task 的 `parent_task_id`）、`branch_group_label`（不是原始 Task 的 `branch_group`）。这两处如果写错，会是那种"代码能跑、但产出的模板跟 BusinessRuleEngine 期望的形状对不上"的隐蔽 bug——核实下来**没有这个问题** |
| Domain boundary self-scoping | 文件头明确声明 "AI Goal Planning 不在本文件、也不在本项目范围——Goal 是 Life Execution OS 的对象"——核对 `00_Domain_Boundary.js`，Goal 确实被列在"Personal Life OS 绝对不能拥有"的清单里（第 77 行的归属表：`Goal \| Life Execution`）。这条边界判断是准确的 |

**结论：Keep，但 Finding F3 需要你明确表态。** 这是三个文件里唯一一处触及既有架构规则的地方，其余全部核实通过。

---

## 3. Missing Dependency Analysis

**Category A — 已存在于 Sprint 3 baseline**
- `shallowCopy_`（`05_SheetUtils.js`）
- `NoteQueryEngine.getOpenNotes(chatId)`（`17_NoteQueryEngine.js`）
- `Tasks.priority_ai_recommended` 列（`15_Setup.js`）
- `Reviews.ai_review_notes` 列（`15_Setup.js`）
- `ADR-2026-07-24-009`（`00_ADR.js`）
- Architecture Principle 9 "AI Suggests, Human Confirms"（`00_Project_Constitution.js`）
- `27_ProjectEngine.createProject` / `28_WorkflowEngine.startWorkflow` / `20_TaskEngine.createTask`
- `41_BusinessRuleEngine.js` 的 `workflow_shape` 字段定义（`00_Business_Rules.gs「三」`）
- `SecureConfig.getKey`/`setKey`（通用，无需专门为 AI key 改造）
- `script.external_request` 授权（`03_Output.js` 已在用 `UrlFetchApp`，大概率已经存在）

**Category B — recovered 文件本身提供**
- `AIConnector.callAI_` / `AIConnector.callAIForJSON_`
- `PriorityEngine.suggestPriorityWithAI_`
- `AIPlanningEngine.suggestNewProject_` / `generateWorkflowSuggestion_`

**Category C — 缺失，必须新建（不是"恢复"，是"从来没做过"或至少现在完全找不到证据）**
- **呈现层入口**：`06_TaskIntentParser.js` 里没有任何一处引用这三个新函数，`00_Command_Reference.js` 里也没有任何 AI 相关指令的记录。也就是说，就算把三个文件原样接回去，**目前没有任何用户可触达的方式去调用它们**——这是 Sprint 4 要"能用"还缺的最大一块
- **Sprint 4 测试/验收覆盖**：仿照 `35_Tests_Sprint1Acceptance.js`/`36_Tests_Sprint3Acceptance.js` 的模式，目前完全不存在
- `00_File_Map.js` 里 `46`/`47` 的条目（当前完全没有提到这两个文件）
- `00_Module_Responsibility.js` 里 `46`/`47` 的条目（同样完全没有）
- `40_ReviewEngine.js` 里 AI Review Hook 的真正接线（文件自己说清楚了只需要改 `_generate_` 内的一行）
- `00_Project_State.js` 的 Sprint 4 章节（要等 Sprint 4 真正有阶段性结论时再写）

**Category D — 不确定，需要你确认**
- **22_PriorityEngine.js 里"既有四个函数原样不变"的说法**——无法用 diff 验证，只能确认内部自洽，不能确认真的和 Sprint 3 时期完全一致
- **崩溃前那次会话除了这三个文件、以及对 40/00 的修改之外，是否还写过其它东西（比如已经开始改 `06_TaskIntentParser.js` 但没保存下来）？** 你转述的原始说明只提到 40/00 两个文件的修改丢失，但没有提到是否还有别的呈现层/测试改动也在那次会话范围内。按"不能假设 Sprint 4 内容原样存在"的要求，我不会替你假设"呈现层那部分本来是做过的"——但这值得你自己回忆确认一下，因为这会影响 §5 重建计划里"呈现层入口"这一项到底算"新建"还是"找回"
- **Sprint 3 Gate 是否已经在别的地方（比如你自己手动重新跑过、只是没来得及让上一个 session 把结果写回 `00_Project_State.js`）确认通过？** 见下方 Finding F1

---

## 4. Architecture Consistency Audit

逐项对照你要求检查的维度：

- **violations of existing architecture rules** → 有一处，见 **Finding F3**（下方展开）
- **duplicated infrastructure** → 没发现。`GEMINI_API_KEY` 只在 `01_SecureConfig.js` 的用法示例注释里出现过一次，代码里没有任何地方真的读取这个 key，不构成一条并行的、重复的 AI 调用路径
- **incorrect layer ownership** → `46_AIConnector.js` 本身的职责定义（"只负责怎么调 AI，不负责该问 AI 什么"、"Forbidden Dependencies: Sheet, Events"）干净地落在 Infrastructure 层的定义范围内，跟同层的 `01_SecureConfig`/`02_EventBus` 是同一种"纯粹外部 I/O 包装"性质。问题不在于它被错误分层了，而在于**它压根还没被写进 `00_File_Map.js` 的分层表**（这是文档缺失，不是分层错误，归到 Finding F2）
- **incorrect AI responsibility boundaries** → 核实通过。`47_AIPlanningEngine.js` 正确地把 "AI Goal Planning" 排除在自己范围外，理由（Goal 属于 Life Execution OS）跟 `00_Domain_Boundary.js` 的归属表一致
- **bypassing existing engines/services** → 没发现。所有实际的创建动作都委托给已有的 `27_ProjectEngine`/`28_WorkflowEngine`/`20_TaskEngine`，AI 层没有重新实现一遍创建逻辑
- **inconsistent interfaces** → 没发现。逐字段核对了最容易出问题的 `workflow_shape` 结构，字段名（包括 `branch_group_label` 这种容易跟原始 Task 字段名搞混的）完全匹配
- **hidden coupling** → 严格来说**不是"隐藏"耦合**：`47_AIPlanningEngine.js` 对 `17_NoteQueryEngine.js` 的依赖是在自己的 Engine Contract 头部明确声明的（"Dependencies: 46_AIConnector.gs、17_NoteQueryEngine.gs"），不是偷偷摸摸绕开声明去调用。问题在于这条**已声明的**依赖跟项目级别的分层文档（File_Map/Module_Responsibility）没有同步，以及它本身跟 Dependency Direction 原则的方向冲突——这是 F2 + F3，不是"hidden coupling"意义上的坏味道
- **changes that should have been made elsewhere** → 没发现明显错位的逻辑
- **technical debt introduced** → 主要是 F3（架构方向问题）和零测试覆盖（F4）

### Finding F3 — Domain → Application 依赖方向问题（需要你决定）

`00_Project_Constitution.js` 对 Dependency Direction 原则的说明非常明确：目前**唯一**记录在案的跨层例外是 `21_RecurringEngine.gs → 09_IdempotencyManager.gs`，原文特别标注"**已知例外（Known Exceptions，明确记录，不再新增第二个）**"。`00_File_Map.js` 里后来确实又出现了第二次应用（`28_WorkflowEngine → 09_TemporalParser`），但那次被明确定性为"跟 `21_RecurringEngine` 那条是**同一条例外原则的第二次应用**，不是新开一类例外"——关键在于，那两次例外的共同点是**复用一个narrow、纯计算性质的工具函数**（判重逻辑、日期计算），避免重新实现一遍。

`47_AIPlanningEngine.js → 17_NoteQueryEngine.js` 表面上是同一种"Domain 依赖 Application"的结构，但**性质不一样**：`NoteQueryEngine.getOpenNotes` 是一次真实的 Sheet 读取（I/O），不是一个 narrow 的纯计算工具。这跟 `22_PriorityEngine.js` 自己坚持的模式（`rankByPriority` 等既有函数只接收调用方已经读出来的数组，不自己去查）也不一致——`47_AIPlanningEngine.js` 完全可以把 `suggestNewProject_(chatId)` 改成 `suggestNewProject_(openNotes)`，由调用方（未来的呈现层）先查询、再传入，这样就完全不需要触碰 Dependency Direction 原则。

**这不是一个我可以替你判定对错的问题**——项目宪法里"不再新增第二个"的措辞，是要看你自己愿不愿意再做一次"这属于同一类例外"的判断（像 `28→09` 那次一样），还是宁可花一点重构成本把 `47_AIPlanningEngine` 也改成纯函数、由调用方注入数据。两条路都能收敛，但需要你明确选一条，并且把结论写回 `00_Project_Constitution.js`/`00_File_Map.js` 的"已知例外"清单（无论最后是"确认为第二次应用"还是"重构掉，不需要例外"）。

### Finding F1 — Sprint 4 在自己的既定流程之前就开始了（流程问题，不是代码问题）

`README.md` 记录的部署/验收顺序里，最后一步明确是"全部通过 → 报告结果 → 讨论是否正式进 Sprint 4（AI）"——也就是说，项目自己的文档把"Sprint 3 Gate 确认通过 + 讨论"设为进入 Sprint 4 的前置条件。但 `00_Project_State.js` 持久化的最新状态显示，Sprint 3 Gate 第二次运行还有 2/4 没过（后来虽然修了两个真实 bug，但"等 Carson 重新跑确认"这一步还没有被记录为已完成）。换句话说，**按项目自己留下的记录，Sprint 4 的三个文件是在它自己的前置条件被正式确认之前就被写出来的**。

这不代表这三个文件本身有问题（§2 的核实结果是干净的），但这是一个值得你自己确认的事实：Sprint 3 Gate 到底有没有在其它地方（比如你自己手动跑过）被确认通过？如果有，这条发现就只是"文档没同步"；如果没有，建议在继续 Sprint 4 之前先把这个循环补上——这也是你自己在治理理念里强调的"governance before code"。

---

## 5. Sprint 4 Reconstruction Map

| Item | Status | Evidence | Action |
|---|---|---|---|
| `46_AIConnector.js` | Recovered, verified | 语法通过；依赖（`01_SecureConfig`、`UrlFetchApp`）均存在；`UrlFetchApp` 在 `03_Output.js` 已有先例；无 Sheet/Event 写入，符合 Infrastructure 层定义 | **Keep** |
| `22_PriorityEngine.js` | Recovered, verified | 语法通过；`AIConnector.callAIForJSON_` 调用匹配；`shallowCopy_` 存在；`ADR-2026-07-24-009` 真实存在且内容一致；`priority_ai_recommended` 列已存在 | **Keep** |
| `47_AIPlanningEngine.js` | Recovered, verified（有一项待决问题） | 语法通过；`workflow_shape` 逐字段核对完全匹配；下游三个创建函数存在且签名一致；Domain Boundary 自我限定准确 | **Keep**，先解决 Finding F3 |
| `40_ReviewEngine.js` 的 Sprint 4 修改 | Missing（确认丢失） | 当前文件是干净的 Sprint 3 版本，AI Hook 占位注释完整、无残缺 | **Rebuild**——范围很小，文件自己的 Notes 已经写清楚只需要改 `_generate_()` 内一行 |
| `00_Project_State.js` 的 Sprint 4 章节 | Missing（确认丢失） | 当前文件在 Sprint 3 Gate 待确认处结束，无 Sprint 4 章节残留 | **Rebuild**——等 Sprint 4 有阶段性结论时再写，不用现在补 |
| 呈现层入口（`06_TaskIntentParser.js` 里调用三个新函数的指令处理） | Missing，且**不能确认此前是否存在过** | `06_TaskIntentParser.js`、`00_Command_Reference.js` 均无任何 AI 相关内容 | **Build**（Category C，视为新工作，不是"恢复"），除非你确认崩溃前的会话真的做过这部分 |
| Sprint 4 测试/验收套件 | Missing | `34/35/36` 三个测试文件均无 AI 相关引用 | **Build** |
| `00_File_Map.js` 的 `46`/`47` 条目 | Missing | 全文搜索确认 | **Update** |
| `00_Module_Responsibility.js` 的 `46`/`47` 条目 | Missing | 全文搜索确认 | **Update** |
| `00_Roadmap.js` | Stale（与本次崩溃无关的既有问题） | 最后更新 2026-07-13，仍是 "Productivity OS v4.7" 内容，完全没提 Sprint 框架 | **Update**（独立任务，不紧急） |
| `26_AnalyticsEngine.txt` / `34_Tests_ReminderPolicy.txt` | Stale 本地残留 | 与对应 `.js` 只差末尾换行符；`.clasp.json` 的 `scriptExtensions` 只认 `.js`/`.gs`，这两个 `.txt` 从未被真正 push 到线上项目 | **Delete**（可选，纯清理，无功能风险） |

---

## 6. Risk Ranking

**P0 — 无。** 没有发现会阻断执行、破坏数据完整性、或直接违反架构铁律（Single Source of Truth / Event is Fact 等）的问题。

**P1 — 必须在继续 Sprint 4 之前解决**
1. Finding F3：`47_AIPlanningEngine.js → 17_NoteQueryEngine.js` 的分层方向问题，需要你明确表态（接受为第二类例外 / 重构成纯函数）
2. Finding F1：确认 Sprint 3 Gate 是否已实际通过；如果还没有，建议先补上这一步，再正式恢复 Sprint 4
3. 呈现层入口完全缺失——三个新能力目前没有任何用户可触达的调用路径，这是 Sprint 4 要变成"能用的功能"而不只是"能跑的代码"的关键缺口
4. `00_File_Map.js` / `00_Module_Responsibility.js` 里 `46`/`47` 的条目缺失——这两份文档正是本该让"接手的人（包括下一个 session 的我）不用重新做一遍侦探工作"就能知道这两个文件存在、干什么用的地方

**P2 — 应该在 Sprint 4 完成前解决**
1. Sprint 4 测试覆盖（三个新函数目前零测试）
2. `40_ReviewEngine.js` 的 AI Hook 真正接线（范围很小，但目前是空的）
3. Architecture Principle 9 的 "HOW" 落地说明（`00_Project_Constitution.js`）目前只提到旧的 `/priority` 规则版流程，没有提到新的 AI 版——等呈现层接线做完后一并更新

**P3 — 可选改进**
1. `01_SecureConfig.js` 头部用法示例补上 `AI_PROVIDER`/`AI_API_KEY`/`AI_MODEL`（纯文档）
2. 清理 `26_AnalyticsEngine.txt`、`34_Tests_ReminderPolicy.txt` 两个过时的本地残留文件
3. `00_Roadmap.js` 更新到 Personal Life OS V2 / Life OS 的实际状态（与本次崩溃无关，独立任务）
4. `46_AIConnector.js` 里硬编码的默认模型字符串（`claude-sonnet-4-6`）本身可以被配置覆盖，不紧急，但值得记一笔避免以后忘记它可能过期

---

## 7. Summary

### 7.1 Recovery Status
三个 Sprint 4 文件（`46_AIConnector.js`、`22_PriorityEngine.js`、`47_AIPlanningEngine.js`）经全面核实，**可以安全接回 Sprint 3 baseline**——依赖齐全、契约一致、语法有效、引用的治理依据真实准确。`40_ReviewEngine.js` 和 `00_Project_State.js` 的 Sprint 4 修改确认丢失，且现存版本干净、无残缺，可以放心以当前内容作为 baseline 继续。

### 7.2 Recovered Files
`46_AIConnector.js`、`22_PriorityEngine.js`、`47_AIPlanningEngine.js` —— 三者均判定为 **Keep**。

### 7.3 Missing Files/Changes
`40_ReviewEngine.js` 的 AI Hook 接线、`00_Project_State.js` 的 Sprint 4 章节、呈现层入口（`06_TaskIntentParser.js`）、Sprint 4 测试套件、`00_File_Map.js`/`00_Module_Responsibility.js` 的对应条目。

### 7.4 Problems Found
F1（Sprint 4 早于自己流程规定的前置条件启动）、F2（两份核心治理文档未同步新文件）、F3（`47_AIPlanningEngine.js` 的分层方向需要你表态）。均非 P0。

### 7.5 Required Fixes
见 §6 的 P1 清单——按顺序建议：先确认/补跑 Sprint 3 Gate → 对 F3 做出决定并写回治理文档 → 补 File_Map/Module_Responsibility 条目 → 设计呈现层入口。

### 7.6 Sprint 4 Reconstruction Plan
1. 你确认 Finding F1（Gate 状态）和 Category D 里的两个开放问题
2. 就 F3 做决定（例外 or 重构），落到 `00_Project_Constitution.js`
3. 更新 `00_File_Map.js`/`00_Module_Responsibility.js`，把 46/47/22 的 Sprint 4 部分正式纳入治理文档
4. 设计并实现呈现层入口（`06_TaskIntentParser.js` 新增指令 + `00_Command_Reference.js` 记录）
5. 补 Sprint 4 测试（可参照 `35`/`36` 的既有模式）
6. `40_ReviewEngine.js` AI Hook 接线（范围很小，可以放在任何时候顺手做）
7. 跑一次 Sprint 4 Acceptance Gate，`00_Project_State.js` 写入正式的 Sprint 4 章节

### 7.7 Recommended Next Action
优先做 §7.6 的第 1-2 步——这两步是纯决策，不涉及写代码，而且会影响后面所有步骤怎么做。等你确认这两点，我可以直接开始第 3-4 步。

另外，关于改名成 **Life OS**：这次审计里我只在这份报告和记忆里采用了新名字，代码库本身（`Personal Life OS v5.2`、Library Identifier `PersonalLifeOS`、GAS 项目名等）都还没动。如果你希望做一次全库范围的正式改名，建议放在 baseline 重新稳定（也就是上面 1-2 步做完）之后再做一次独立、可回滚的改动，而不是跟 Sprint 4 续接混在一起——这样如果改名过程中出什么问题，不会跟"Sprint 4 到底有没有正确接回"这件事互相干扰，排查起来也更干净。要不要现在就定下改名的执行方式，还是先放着？
