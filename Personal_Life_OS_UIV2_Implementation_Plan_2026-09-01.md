# Personal Life OS UI V2 — Implementation Plan

**2026-09-01｜承接 `Personal_Life_OS_UIV2_Architecture_Capability_Gap_Review_2026-09-01.md`。本文档只规划已经解除 BLOCKED 的项目，仍然不写代码。批准后按 Slice 逐个实现，每个 Slice 验证完再进入下一个，不一次性整份 UI V2 写完。**

**范围排除声明（不因为本轮实现而改动或绕过）：** Project Deadline Contract（仍等 Carson 批准 Model C/Model B）、Track 3 Drag Ordering ADR（仍 Proposed，等批准）。这两条独立于本 Plan，本 Plan 里任何一个 Slice 都不得因为想要某个能力就反过来替它们下决定——包括不能因为 Slice 2 想让 Project 出现在 Overall 里，就顺手给 `27_ProjectEngine.js`/`00_Sheets_Structure.js` 加日期字段。

**跨 Slice 依赖：** Slice 2 的 OS 分组、Slice 4 的 no-silent-loss 判断，都要读 `source_domain`，所以 Slice 1（把 `source_domain` 接成可读可写）必须先完成。Slice 3（Note Edit）和 Slice 5（Performance）跟其它 Slice 相对独立，理论上可以跟 Slice 2/4 并行，但建议还是按 1→2→3→4→5 顺序走，保持每次验证的范围单一。

---

## Slice 1 — Core UI Consistency

**范围：** Unified Create/Edit（共享 Field Schema）、OS selector、Priority、Due date/time、Enter/focus 行为。Done/Cancel 不改动内部逻辑，只确认它们继续独立于共享 schema 之外。

**改哪些文件：**

| 文件 | 改动 |
|---|---|
| `ui_index.html` | 把 Create/Edit 两个表单改成从同一份 Field Schema 渲染；Edit 表单补齐 priority/due_time/notes/tags/project_id/recurring（现状只有 title/category/due_date）；新增 OS selector 下拉；所有 textarea 加 Ctrl/Cmd+Enter；所有单行 title 类 input 加 Enter=Save；Create 成功后把焦点移回标题输入框 |
| `50_UIBridge.js` | `ui_createTask` 的转发字段列表补上 `description`/`context`/`budget`/`source_domain`（现状 Engine 已支持，Bridge 没转发）；`ui_createProject` 同理补 `source_domain` |
| `20_TaskEngine.js` | `UPDATABLE_FIELDS` 新增 `'source_domain'`（现状它只在创建时由 `_resolveMetadata_` 写一次，不在更新白名单里——要做成 OS selector 可编辑，这是必需的最小 Engine 改动，不是纯 UI 工作） |
| `27_ProjectEngine.js` | 视决定而定：OS/Domain 是否也适用于 Project，如果适用，`UPDATABLE_FIELDS` 同样加 `'source_domain'`——**这一点 Gap Review 没有明确覆盖 Project，建议 Slice 1 开始前先确认范围，不要默认它自动适用** |
| `00_Data_Ownership.js` | 重写 `source_domain` 的语义（provenance → 业务归类）+ 取值改成 `PersonalLifeOS`/`PropertyOS`/... 命名约定 |

**哪些文件不能动：** `07_IdentityEngine.js`（`source_domain` 不应该、也不会被加进 `IDENTITY_AFFECTING_FIELDS`——这条本身就是这个 Slice 的一条验收标准，不是"顺便别动"）；`09_IdempotencyManager.js`/`08_DeduplicationEngine.js`（这个 Slice 不碰 Create 的性能路径，那是 Slice 5 的范围）。

**可以直接复用的 Domain Engine 能力：** `TaskEngine.createTaskDirect_`/`updateTask` 本身的字段处理逻辑（不需要重写，只是白名单+转发列表的扩展）；`IdentityEngine` 的现有 identity 计算完全不变。

**需要新增的 UIBridge：** 无全新函数，`ui_createTask`/`ui_updateTask` 都是扩展既有函数，不新增函数名。

**Test Gate：** 创建一个带 `description`/`context`/`budget`/`source_domain` 的 Task，读回确认四个字段都存进去了；编辑一个既有 Task 的 `priority`/`due_time`/`notes`/`tags`/`project_id`/`source_domain`，确认能改且 identity 不变（`source_domain` 改动前后 identity hash 应该完全相同——这是防止它被误加进 identity 的直接回归测试）。

**Regression Gate：** 重跑 Track 2（UI-I1~I5）既有的 14/14 用例，确认全部通过；确认 Done/Cancel 两个按钮触发的仍然是 `completeTask`/`cancelTask` 这两个正式 Command，没有被共享 schema 重构带偏到普通 Edit 保存路径里。

**需要 migration 吗：** 不需要——纯新增可空字段的转发/白名单扩展，既有行不受影响。

**完成后需要更新：** `00_Project_State.js` 新增一条 "Slice 1 delivered"；`00_ADR.js` 新增 source_domain 语义/可编辑性那份 ADR（Gap Review 第 1 项已经建议要写，这里正式落地，标记 Accepted）；`00_Data_Ownership.js` 的 Metadata Standard 部分同步更新；如果拆出了新的共享渲染辅助函数，`00_File_Map.js`/`Module_Responsibility` 补充记录。

---

## Slice 2 — Overall Dashboard（Task-only）

**范围：** Overdue/Today/Tomorrow/ThisWeek/Upcoming/Critical/HighPriority/Recurring，按 `source_domain` 分组。**Project 不在这个 Slice 里——继续 Blocked，见开头的范围排除声明。**

**改哪些文件：**

| 文件 | 改动 |
|---|---|
| `24_ViewEngine.js` | 修 `_isNonTerminal_`：把 `CONVERTED`/`NOT_SELECTED` 也纳入终态排除（现状只排除 `DONE`/`CANCELLED`）——这个修复本身也让既有 Track 2 的 Sort/Filter 受益，不只是给 Overall 用 |
| `12_TaskQueryEngine.js` | 新增一个组合函数（如 `getOverallTaskView(chatId)`），调用既有的 `today/tomorrow/thisWeek/upcoming/overdue/recurring/highPriority`，做跨 bucket 去重（逾期>今天>明天>本周剩余>即将到来的优先级），按 `source_domain` 分组，返回 JSON 而不是文本 |
| `50_UIBridge.js` | 新增 `ui_getOverallDashboard(chatId)` |
| `ui_index.html` | 新增 Overall/Home 导航项（建议放最前面，替换 Notes 成为默认落地页），渲染上面这个 JSON |

**哪些文件不能动：** `25_DashboardEngine.js`——**建议完全冻结不动**，它是 Telegram 用的文本 Dashboard，跟 Web UI 的 Overall 是两个不同的输出契约，混在一起改容易互相影响；`27_ProjectEngine.js`/`00_Sheets_Structure.js`——不得因为这个 Slice 加任何日期字段（这是范围排除声明的具体落地）。

**可以直接复用的 Domain Engine 能力：** `24_ViewEngine.js` 的全部八个视图函数（today/tomorrow/thisWeek/thisMonth/upcoming/overdue/recurring/highPriority）——原样调用，不重写内部逻辑，只在 `_isNonTerminal_` 这一个共享判定上打补丁。

**需要新增的 UIBridge：** `ui_getOverallDashboard(chatId)`。

**Test Gate：** 一个 3 天后到期的任务只出现在一个 bucket 里，不会同时出现在 ThisWeek 和 Upcoming；一个 `CONVERTED` 或 `NOT_SELECTED` 状态的任务不出现在 Overall 任何地方（`_isNonTerminal_` 修复的直接回归测试）；按 `source_domain` 分组结果正确（依赖 Slice 1 已经把这个字段接上）。

**Regression Gate：** 既有 `/today`、`/week` 等 Telegram 指令（走 `25_DashboardEngine.js`）改动前后输出完全一致，因为这个文件没被动；既有 Track 2 的 Sort/Filter 在 `_isNonTerminal_` 修复后行为不变（这个修复只影响 CONVERTED/NOT_SELECTED 这两种边缘状态，不应该改变任何现有通过用例的预期结果）。

**需要 migration 吗：** 不需要——纯新增只读聚合层。

**完成后需要更新：** `00_Project_State.js` 新增记录；`00_Known_Limitations.js` 里"Dashboard 只能是 Telegram 文本"这条限制需要修正为"仅 Telegram 指令路径如此，Web UI 已有结构化版本"；建议补一条轻量 ADR 或 Project_State 记录，把"Overall/Home 是 Domain Dashboard、目前 Task-only、按 source_domain 分组"正式写下来（对应 Gap Review 第 2 项的建议）。

---

## Slice 3 — Note

**范围：** Note Edit（`updateNote`）+ Note 的 Create/Edit 行为跟 Slice 1 的模式对齐。

**改哪些文件：**

| 文件 | 改动 |
|---|---|
| `29_NoteEngine.js` | 新增 `updateNote(noteId, changes, chatId)`，白名单只有 `content`/`category`；改动时用 `07_IdentityEngine.js` 重算 identity；沿用既有的 `FORBIDDEN_FIELDS` 校验（`due_date`/`due_time`/`due_datetime`/`reminder_policy`必须继续被拒绝） |
| `10_ProjectionEngine.js` | 新增 `NOTE_UPDATED` 事件的 Projection case（每个既有实体的 update 事件都有对应 case，Note 这次要补上） |
| `50_UIBridge.js` | 新增 `ui_updateNote(noteId, changes, chatId)` |
| `ui_index.html` | Note 卡片新增内联 Edit 表单，跟 Task/Project 现有的内联 Edit 同款；textarea 接 Ctrl/Cmd+Enter（沿用 Slice 1 的模式） |

**哪些文件不能动：** Note 的 `FORBIDDEN_FIELDS` 校验逻辑本身不能被绕过——这不是"别碰哪个文件"，而是新 `updateNote` 必须复用同一套校验，不能因为要做 Edit 就单独开一个后门。

**可以直接复用的 Domain Engine 能力：** `07_IdentityEngine.js` 的 content+category 哈希（无需改动）；`updateTask`/`updateProject` 已经验证过的整体模式（结构复用，不是代码复制）。

**需要新增的 UIBridge：** `ui_updateNote(noteId, changes, chatId)`。

**Test Gate：** 改 `content`/`category` 正确重算 identity，`note_id` 不变；尝试通过 `updateNote` 设置 `due_date` 等禁止字段被正确拒绝，报错行为跟 Create 时一致；`NOTE_UPDATED` 事件正确落到 Sheet 行。

**Regression Gate：** 既有 Note 的 create/archive/convert（Note→Task/Note→Project/Note→GoalCandidate）不受影响，重跑一遍确认。

**需要 migration 吗：** 不需要——纯新增。

**完成后需要更新：** `00_Project_State.js` 新增记录；`00_Command_Reference.js` 补上 `updateNote` 这个新 Command 的条目。

---

## Slice 4 — Conversion

**范围分两部分。Part A（可以直接做）：** Project→Task 的 UI 整合确认、Task→Project 的 no-silent-loss 修复。**Part B（需要先有 ADR）：** Task→Note。

### Part A

**改哪些文件：**

| 文件 | 改动 |
|---|---|
| `50_UIBridge.js` | `ui_convertTaskToProject` 前置检查：源 Task 带非空 `due_date`/`due_time` 时，返回一个"需要确认"的结果供 UI 弹确认框，或直接返回 `BLOCKED`（二选一，这是 Carson 的决定，Gap Review 5.1 已经列出取舍，这里不预设）；`ui_convertProjectToTask` 先确认现状 UI 是否已有完整触发入口——如果有，只需要把 `BLOCKED` 结果的展示样式跟其它地方统一，不需要新逻辑 |
| `ui_index.html` | Convert-to-Project 流程加确认弹窗（如果 Carson 选告警而不是硬 BLOCKED）；确认/补齐 Convert-to-Task 的按钮入口 |

**哪些文件不能动：** `27_ProjectEngine.js` 的 `checkEligibleForTaskDemotion_`/`markProjectConvertedToTask_`——这条既有资格校验逻辑完整且正确，不因为这次改动而调整；`42_ConversionEngine.js` 的 `convertTaskToProject`/`convertProjectToTask` 核心映射逻辑本身不变，只是调用前多一层检查。

**可以直接复用的 Domain Engine 能力：** 两个方向既有的转换函数、既有的资格校验、既有的幂等性检查——全部原样复用。

**需要新增的 UIBridge：** 不新增函数名，在既有 `ui_convertTaskToProject` 里加前置检查逻辑。

**顺手修一处文档：** `00_Domain_Boundary.js「三」`引用的 `ADR-2026-07-24-006` 已经过期（跟实际双向转换的 `ADR-015` 矛盾），这个 Slice 顺便把引用改过来。

### Part B（Task→Note，需要先有 ADR，不在这个 Slice 直接写代码）

先产出一份 Conversion ADR，回答：Task 是否需要一对通用的 `converted_to_type`/`converted_to_id`（现状只有单一用途的 `converted_to_project_id`）；新 Note 的 `source_task_id` 是否指回源 Task。ADR 通过后才进入下一轮实现（`42_ConversionEngine.js` 新增 `convertTaskToNote`、`29_NoteEngine.js` 新增对应的 `createNoteFromConversion_`、`50_UIBridge.js` 新增 `ui_convertTaskToNote`、UI 新增"Convert to Note"入口）。

**Test Gate（Part A）：** 带日期的 Task 转 Project 不再无声完成，要么弹确认要么 BLOCKED；不带日期的 Task 转 Project 行为跟现状完全一致，没有多余摩擦。

**Regression Gate：** 重跑既有 Task↔Project/Note↔Task/Note↔Project 转换测试，确认无日期的转换路径零回归。

**需要 migration 吗：** Part A 不需要。Part B 如果 ADR 决定要加 `converted_to_type`/`converted_to_id`，是新增可空列，不需要迁移既有数据。

**完成后需要更新：** `00_ADR.js` 补充/修正引用；`00_Project_State.js` 记录 Part A 完成、Part B 的 ADR 状态。

---

## Slice 5 — Performance

**范围：** 真实 latency instrumentation → Carson 实跑拿真实数字 → 再决定优化什么 → Regression Gate。

**改哪些文件：**

| 文件 | 改动 |
|---|---|
| `50_UIBridge.js` | 在 `ui_createTask`/`ui_createProject`/`ui_createNote`/`ui_updateTask`/`ui_updateNote` 里，Dedup 检查前后、Engine 写入前后、Event/Projection 前后、函数返回前，各打一个 `Logger.log` 时间戳 |
| `ui_index.html` | 实现乐观 UI：点 Save 后立刻用临时对象更新列表+清空表单+聚焦标题；真实响应回来后用真实对象替换；失败时移除临时对象+提示错误；同时确保按钮在真实响应回来之前保持禁用，防止乐观显示掩盖了双击导致的重复真实请求 |

**哪些文件不能动：** `09_IdempotencyManager.js`、`08_DeduplicationEngine.js`、`07_IdentityEngine.js`——明确不能为了"感觉更快"而改动这几个文件；如果实跑数字显示 Dedup 扫描确实是主要瓶颈，那是一个独立的、需要自己 ADR 的未来优化（比如维护 identity→行号旁路索引），不在这个 Slice 里顺手做。

**可以直接复用的 Domain Engine 能力：** 全部——这个 Slice 刻意不改动任何 Domain/Engine 层的业务逻辑,只加日志和纯前端乐观更新。

**需要新增的 UIBridge：** 无新函数，只在既有函数内部加日志。

**Test Gate：** 计时日志正确覆盖每个阶段边界；乐观 UI 在成功时正确用真实数据替换临时对象，失败时（包括被 Dedup 判定为重复的情况）正确回滚且不留下幽灵重复行；快速连续两次点击 Save 不会产生两条真实的重复记录（哪怕 UI 已经乐观显示了）。

**Regression Gate：** 完整重跑既有 Idempotency/Identity 测试套件，确认全部通过、行为未变。

**需要 migration 吗：** 不需要。

**完成后需要更新：** `00_Project_State.js` 记录 Carson 实跑拿到的真实数字，以及基于数字做了什么优化；`00_Known_Limitations.js` 里"Create 慢"这条根据实际发现更新或移除。

---

## 全部 Slice 完成后的治理收尾

不是每个 Slice 各自单独收尾，而是 5 个 Slice 全部验证通过后，做一次统一整理：`00_File_Map.js`/`Module_Responsibility` 补齐这一轮新增/改动的文件清单；`00_Roadmap.js` 移除已经完成的相关条目；确认 `00_Known_Limitations.js` 里跟这轮相关的几条限制（Dashboard 文本化、Edit 字段不全、Create 慢）都已经如实更新或移除，不留过期记录。

**再次确认：Project Deadline Contract、Track 3 Drag Ordering ADR，这两条在以上任何一个 Slice 里都不得被提前实现或绕过。**
