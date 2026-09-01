# UI Enhancement Architecture & UX Audit — 2026-08-31

**范围**：本次审计针对 `70_Personal-Life-main`（Personal Life OS v5.2）实际代码，覆盖 Carson 指定的 6 项 + 追加的 Note Edit 能力。**Audit-only，本轮未修改任何生产代码**，全部结论均来自直接读取以下文件后的实际验证，不是基于既有文档或记忆的推断：

`00_Sheets_Structure.js` `00_Domain_Boundary.js` `00_Data_Ownership.js` `07_IdentityEngine.js` `20_TaskEngine.js` `27_ProjectEngine.js` `28_WorkflowEngine.js` `29_NoteEngine.js` `12_TaskQueryEngine.js` `14_ProjectQueryEngine.js` `16_WorkflowQueryEngine.js` `17_NoteQueryEngine.js` `24_ViewEngine.js` `25_DashboardEngine.js` `42_ConversionEngine.js` `41_BusinessRuleEngine.js` `22_PriorityEngine.js` `21_RecurringEngine.js` `09_IdempotencyManager.js` `08_DeduplicationEngine.js` `50_UIBridge.js` `ui_index.html`

也对照了 `00_Session_Handoff_Checkpoint_2026-08-30.js` 记录的上一轮状态（Project Deadline Contract 仍 pending Carson 批准；Track 3 Drag Ordering 仍 BLOCKED_PENDING_ARCHITECTURE_DECISION）——本轮发现好几处直接挂在这条还没批的决定上，会在对应小节指出。

---

## 1. Personal Life OS Overall Dashboard

### 1.1 现状核实：QueryEngine 层其实比预期更接近够用

`12_TaskQueryEngine.js` 已经有 `getTodayTasks / getTomorrowTasks / getWeekTasks / getMonthTasks / getUpcomingTasks / getOverdueTasks / getRecurringTasks / getPriorityTasks / getDashboard`，全部委托给两个纯函数 Engine：

- `24_ViewEngine.js`（`today/tomorrow/thisWeek/thisMonth/upcoming/overdue/recurring/highPriority`，输入是已读出的 task 数组，日历相对计算）
- `25_DashboardEngine.js`（组合 ViewEngine + PriorityEngine + AnalyticsEngine，拼成 `today/weekly/monthly/statistics` 四种 Dashboard 文案）

`00_Known_Limitations.js` 记录的"QueryEngine 不支持排序"是真的，但那只是 Sort 这一件事——**Due-bucketing（今天/明天/本周/本月/即将到来/逾期/recurring）这一层实际上已经存在**，不是从零开始。这跟直觉相反，值得先澄清，避免重新发明一遍已经有的东西。

### 1.2 但现有实现是给 Telegram 用的，不能直接当 Overall 用

`25_DashboardEngine.js` 的输出是 `lines.join('\n')`——纯文本、带 emoji 图标、按 category 动态拼板块，是给 Telegram 消息用的格式，不是结构化数据。Web UI 的 Overall 需要的是 JSON 对象数组，不是格式化字符串。这一层需要新写，不是复用。

### 1.3 Project 目前完全没法出现在任何 Due View 里——这不是 QueryEngine 的缺口，是 Schema 的缺口

`00_Sheets_Structure.js` 的 `LIFE_PROJECTS` 定义、以及 `27_ProjectEngine.js` 的 `createProjectDirect_`/`UPDATABLE_FIELDS`，都确认 **Project 目前没有 `due_date`/`due_time`/`due_datetime` 任何一个字段**。`14_ProjectQueryEngine.js` 也没有任何 Today/Overdue 类的函数。

这条链路直接接到仍然 pending 的 **Project Deadline Contract**（Identity Impact Review 已推荐 Model B，还在等 Carson 批准）——在那个决定落地之前，"Project 也应该能够出现在适当的 Due View 中"这条要求在架构上是**做不到的**，不是"还没写"，是"还没有地方存"。这次审计只记录这个依赖关系，不建议绕过去用其它字段模拟。

### 1.4 把 Today/ThisWeek/Upcoming 直接拼在一起会重复计数

`ViewEngine` 的这几个视图函数是互相独立的过滤器，**不是互斥分区**：一个 3 天后到期的任务同时满足 `thisWeek()` 和 `upcoming()`（`upcoming()` 对"多远的未来"没有上限）。`DashboardEngine.buildTodayDashboard` 已经有一个局部去重模式（`shownIds`，只覆盖 Today/Overdue/Tomorrow，不含 ThisWeek/Upcoming）。

Overall 视图如果直接把这几个 bucket 摆在一起，需要新的 UI-aggregation 层去重逻辑（比如"逾期 > 今天 > 明天 > 本周剩余 > 即将到来"的优先级去重），**这是 UI aggregation 层的新工作，QueryEngine/ViewEngine 不需要也不应该改**——ViewEngine 保持"过滤器"语义本身没有问题。

### 1.5 发现一个真实的一致性 Bug（跟这次审计目标直接相关）

`ViewEngine._isNonTerminal_` 的判定只排除 `DONE`/`CANCELLED` 两种状态：

```js
function _isNonTerminal_(task) {
  var s = String(task.status || '').toUpperCase();
  return s !== 'DONE' && s !== 'CANCELLED';
}
```

但 `20_TaskEngine.js` 里其它地方（比如 `markTaskConverted_` 的 `terminalStatuses = ['DONE', 'CANCELLED', 'NOT_SELECTED']`）明确把 `NOT_SELECTED`（Branch 里没被选中的分支）也当终态；`CONVERTED`（已经转成 Project 的 Task）单独处理但显然也该算终态。**结论：一个已经转换成 Project、或者 Branch 里落选的 Task，理论上仍然会出现在 Today/Overdue/ThisWeek/Upcoming/Recurring/HighPriority 里**（只要它凑巧有个 due_date 落在范围内）。Overall Dashboard 会把这个已经存在但目前不显眼的问题第一次摆到最显眼的位置——建议在做 Overall 之前先把 `_isNonTerminal_` 的判定补齐成跟 TaskEngine 实际终态集合一致。

### 1.6 顺手发现一个跟这次无关但确实存在的旧 Bug

`buildWeeklyDashboard` 把一个数字标成"即将到来 (7天内)"，但它调用的是 `ViewEngine.upcoming(allTasks).length`——而 `upcoming()` 没有 7 天上限，是"今天之后所有有 due_date 的"。这个标签跟它实际算出来的东西不一致，是既有代码里的一个小 bug，顺手记一笔，不在本次范围内处理。

### 1.7 Priority View：AI 建议目前上限只到 HIGH

`22_PriorityEngine.js`：`suggestPriority()`（纯公式）和 `suggestPriorityWithAI_()`（真调 AI）**都** 只会返回 `HIGH/MEDIUM/LOW`——`validPriorities = ['HIGH', 'MEDIUM', 'LOW']` 硬编码，没有 `CRITICAL`。用户自己手动设置 Task 的 `priority` 字段时可以选 `CRITICAL`（`ui_index.html` 的下拉框有这个选项），但两条建议路径都不会推荐 CRITICAL——这是既有、已经被记录过的缺口（不是这次新发现），Overall 的 Priority View 如果要展示"AI 建议"跟"用户优先级"的对照，需要知道这个不对称。

### 1.8 "未来 recurring activity"目前不存在

`21_RecurringEngine.spawnNextIfNeeded` 只在 `completeTask` 时**被动**生成下一次实例，没有任何"预览未来 N 次 recurring 会怎样"的函数。`ViewEngine.recurring()` 也只是"当前这个未终结、标了 recurring 的任务"，不是预测。如果 Carson 要的"未来 recurring activity"是指后者（预测式预览），这是全新能力，不是现有 `recurring()` 的自然延伸。

### 1.9 架构检查：Overall 没有越界

`00_Domain_Boundary.js「四」`（Dashboard Ownership 原则）：Dashboard 的归属由它读取的数据决定，不由名字决定；只要一个 Dashboard 只读自己 Domain 的表，就是 Domain Dashboard，不是 Execution Dashboard。Overall/Home 按 Carson 描述的范围（Personal Life OS 自己的 Task + Project），**没有跨读其它 Domain 的数据，因此仍然是合法的 Domain Dashboard**，不需要、也不应该做成 Execution Dashboard。

另外一条硬性架构约束会直接延续到 Overall：`25_DashboardEngine.js` 的 Engine Contract 引用 `ADR-2026-07-06`——Dashboard 不满足 Projection 的性质（同一份 Events 历史重放两次结果不该变），所以**禁止落盘成物理 Sheet，必须永远按需即时计算**。Overall 沿用同一条约束。

### 1.10 分层结论（按要求拆开，不混在一起）

| 层 | 结论 |
|---|---|
| UI aggregation | 需要新写：JSON 化输出、跨 bucket 去重排序、Project 一旦有 due_date 后的合并展示 |
| QueryEngine capability | Task 侧已存在（Today/Tomorrow/Week/Month/Upcoming/Overdue/Recurring/HighPriority）；Project 侧完全没有 |
| Domain capability（Personal Life OS） | Task 完整支持到期追踪；Project 不支持，因为 schema 里没有日期字段 |
| Life Execution OS capability | 不涉及——Overall 按当前范围仍是 Domain Dashboard，没有触发跨 Domain 聚合 |

---

## 2. OS / Domain Ownership

### 2.1 已经有一个字段，语义上几乎就是 Carson 要的东西

`00_Data_Ownership.js「三」`（Metadata Standard）定义的 `source_domain`：

> `source_domain | 'Personal Life' | 'Property' | 'Rider' | 'Investment' | 'News' | ...（开放字符串，不用枚举锁死）| 创建时一次性写入，不可变；本项目产生的记录固定填 'Personal Life'`

`20/27/28/29/41` 五个 Engine 的 `_resolveMetadata_` 全部一致：`source_domain: meta.source_domain || 'Personal Life'`。**这个字段目前 100% 处于休眠状态**——没有任何调用路径真的传过 `'Property'`/`'Investment'` 等值，所有记录清一色是 `'Personal Life'`。

它的设计意图（看枚举取值本身，不看字段名字面意思）本来就是"这条记录属于哪个 Domain/OS"，跟 `category`（`MAINTENANCE/SHOPPING/ADMIN/HEALTH/GENERAL/PROJECT`，纯粹是活动类型，不是 OS 归属）、`source_module`（哪个内部模块创建/建议的，纯 provenance）是三件不同的事。**审计结论：不需要新增字段，`source_domain` 已经是最接近的候选。**

### 2.2 但直接拿来用之前，有两处需要显式决定，不能沿用现状

**(a) 命名约定不一致。** 平台里其它地方引用 OS 都是 `PersonalLifeOS`/`PropertyOS`/`InvestmentOS` 这种带 "OS" 后缀、无空格的写法（本项目自己注册的 Library Identifier 就是 `PersonalLifeOS`）；但 `source_domain` 目前的取值是 `'Personal Life'`/`'Property'`（带空格、无 OS 后缀）。如果它要正式承担"OS/Domain"这个角色，取值需要跟平台已有的 OS 命名约定对齐，否则将来真的接入 Property OS/Investment OS 时会出现两套不一致的名字。

**(b) 语义上，"provenance"（谁产生的）和"ongoing classification"（现在归哪个 OS 管）不是同一件事，Carson 自己举的例子正好说明了这一点：**

> Personal AI Core 帮我建议一个 Property Task：`OS = PropertyOS, Source = PersonalAICore`

这里 OS 和 Source 不相等——`source_domain` 目前的文档语义是"创建时一次性写入，不可变"，更接近"provenance"（这条记录是哪个域的流程产生的），而不是"这件事现在归哪个 OS 管"这种可能需要事后调整的分类。两者在 99% 情况下数值相同（Property OS 自己创建的东西显然是 Property 域的），但 Carson 的例子正是那 1% 会分叉的场景。

`creator`/`suggested_by`/`source_module`/`decision_owner` 已经完整覆盖"谁创建/谁建议"这条 provenance 线，不需要改动，也不应该跟 OS/Domain 字段混在一起——这正是 Carson 要求的"这两个概念不能混为一谈"，现有字段已经满足这个分离，只是 OS/Domain 那一半目前是空的。

### 2.3 推荐

1. **不新增字段**，复用 `source_domain`。
2. 在 `00_Data_Ownership.js` 里把它的语义重新写清楚：从"创建 provenance"改为"这条记录的业务归属 OS/Domain"，并把取值改成跟平台 OS 命名约定一致（`PersonalLifeOS`/`PropertyOS`/`InvestmentOS`/...）。
3. **显式决定它是否可编辑**——这直接决定第 3 节字段矩阵里这一行该填什么。个人倾向是"应该可编辑"（生活里的事情，归类经常需要事后调整），但这是一个需要 Carson 自己拍板的产品决定，不是纯技术判断，这份审计不替他做这个决定。
4. 设置者：User 手动打标签、以及未来真的存在的 Domain OS 自己创建时都应该能设置；AI（Personal AI Core）建议时，比照 Priority 已经确立的"AI Suggests, Human Confirms"模式（`ADR-2026-07-24-009`），大概率也不该允许 AI 静默改写——这一点同样是产品决定，这里只指出对称性，不替他决定。

---

## 3. Create / Edit UX

### 3.1 为什么慢——三个真实、可验证的原因，不是猜测

**原因一：google.script.run 本身的往返延迟。** 平台特性，GAS 的 RPC 往返通常就有 1 秒以上的固有开销，这不是代码问题，也无法通过改代码消除。

**原因二：每次 Create 都会扫一遍 identity 整列（Carson 自己列的候选原因里说中了）。** `08_DeduplicationEngine.js` 的 `_findRowByIdentity_`：

```js
var identityValues = sheet.getRange(2, identityColIdx + 1, lastRow - 1, 1).getValues();
for (var i = 0; i < identityValues.length; i++) { ... }
```

`09_IdempotencyManager.js` 的每一个 `createXxxIfNotExists`（Task/Project/Workflow/Note/BusinessRule 全部一样）在真正写入之前都会先跑这个函数——读整个 identity 列到内存、线性扫描找有没有重复。这个开销**随 Sheet 里累计的历史行数线性增长**，不是随当前活跃行数——已经 DONE/CANCELLED 很久的行也会被读进这次扫描（`_findRowByIdentity_` 本身不做状态过滤，状态过滤是调用它的 `findExistingTask` 之后才做的）。这是幂等性设计必要的代价，**不建议绕开**，但这确实是"变慢"的一个真实、会随时间累积的来源。

**原因三：前端在拿到完整响应之前什么都不做。** `ui_index.html` 里 `submitCreateTask`/`submitCreateProject` 和文件里**每一个**其它动作（`addNote`/`done`/`cancel`/`convert`/`capture`/`instantiate`/accept-AI）都是同一个模式：禁用按钮 → 显示"Saving…" → 等 `google.script.run` 完整回调 → 才清空表单/移除卡片/重新启用按钮。**没有任何一处做了乐观更新（optimistic UI）。** 这是唯一一个纯前端、不涉及 Idempotency/Event/Projection 的环节，也是这次唯一该动的地方。

**排除的候选原因：** AI call 不参与 Create（只有"Ask AI Priority"单独按钮会调 AI，Create 路径完全不碰 `AIConnector`）；UI 初始化只在页面加载时跑一次（`loadNotes()/loadTasks()/loadProjects()`，`ui_index.html` 最后三行），不是每次 Create 都重新初始化；QueryEngine 不在 Create 路径里（Create 直接走 `IdempotencyManager → Engine.createXDirect_`，不经过 Query 层）。

**推荐：只做乐观 UI**——用户点 Save 后立刻（用一个临时占位对象）把新任务加进列表、清空表单、重新聚焦标题输入框；等真实响应回来后用服务器返回的真实对象替换占位对象；如果服务器返回失败，再把占位对象移除并提示错误。这不改变后端任何一条 Idempotency/Event/Projection/Metadata 路径，只改变浏览器"看起来多快"，完全符合"不允许绕过 Engine/Command/Event/Projection 换速度"的要求。

### 3.2 Create vs Edit 字段矩阵（Task）—— 以实际代码为准

依据：`ui_createTask`（`50_UIBridge.js`）、Task 的内联 Edit 表单（`ui_index.html` 的 `renderTasks`，`save-edit-btn` 的实际提交内容）、`20_TaskEngine.js` 的 `UPDATABLE_FIELDS`。

| Field | Create | Edit | Should Edit? |
|---|---|---|---|
| title | ✅ 表单有 | ✅ 表单有 | 已满足 |
| description | ❌ Bridge 不转发，表单没有（Engine 支持） | ❌ 表单没有（Engine `UPDATABLE_FIELDS` 支持） | **是——Create/Edit 两边都缺** |
| OS / Domain | 尚不存在（见第 2 节） | 尚不存在 | 一旦引入，建议可编辑 |
| priority | ✅ 表单有（含 CRITICAL） | ❌ **表单完全没有** | **是——明显的缺口** |
| due_date | ✅ | ✅ | 已满足 |
| due_time | ✅ 表单有 | ❌ 表单没有 | 是 |
| due_datetime | ❌（派生字段） | ❌（派生字段） | **否**——应该继续保持"由 due_date/due_time 自动派生"，不应该直接可编辑 |
| recurring | ✅ 表单有 | ❌ 表单没有 | 是 |
| context | ❌（Engine 支持，Bridge/表单都没接） | ❌（`UPDATABLE_FIELDS` 支持，表单没有） | 是 |
| budget | ❌（同 context） | ❌（同 context） | 是（前提是这个字段本身还在用） |
| notes | ✅ 表单有 | ❌ **表单完全没有** | **是** |
| tags | ✅ 表单有 | ❌ **表单完全没有** | **是** |
| project_id | ✅ 表单有（下拉选择） | ❌ **表单完全没有**——创建后无法换 Project | **是**——目前唯一能"挪 Project"的方式是走 Convert，那是完全不同的操作 |
| workflow_id | ✅ 表单有（手动文本，代码注释明确写"Workflows 面板还没做前的过渡方案"） | ❌ 表单没有 | 待 Workflows 面板做出来之后再一起补 |

`sequence_index`/`parent_task_id`/`depends_on_task_ids`/`branch_group`/`branch_resolution_policy`/`priority_ai_recommended` 在 `UPDATABLE_FIELDS` 里但 Create/Edit 表单都没暴露——这些是 Workflow/Branch 内部结构字段，本来就该由系统在转换/实例化时设置，不建议做成普通表单输入，这不算缺口。

**核心发现**：Edit 表单（`title`/`category`/`due_date` 三个字段，UI-I2 于 2026-08-21 交付）明显比 Create 表单（2026-08-24 后补的九个字段）简陋得多——不是"Edit 故意做得更严格"，纯粹是 Edit 做得早、Create 做得晚，后者做完之后没有回头把 Edit 补齐。这正是 Carson 描述的"Create 能定义的字段，Edit 原则上也该能改"这条原则目前实际违反最明显的地方，也是这次审计里优先级最高的一条具体建议。

### 3.3 Project 的对应缺口（简要）

Create 表单：`title`/`description`/`parent_project_id`/`execution_mode`。Edit 表单只有 `title`/`description`。`execution_mode` 是 Engine 层 `UPDATABLE_FIELDS` 支持、Edit 表单没做的缺口，跟 Task 那条同类。`parent_project_id` 更进一步——它**根本不在** `ProjectEngine.UPDATABLE_FIELDS`（`['title', 'description', 'depends_on_project_ids', 'execution_mode']`）里，也就是说"创建后把 Project 挪到另一个父级下"这件事目前在 Engine 层就不支持，不只是表单缺失，需要先决定要不要开放这个能力，再谈表单。

### 3.4 Lifecycle：Done/Cancel 已经符合要求；Reopen 完全不存在

`ui_completeTask/ui_cancelTask/ui_completeProject/ui_cancelProject` 都是走正式 Command（`TaskEngine.completeTask`/`cancelTask`，`ProjectEngine.completeProject`/`cancelProject`），不是塞进 `updateTask`——**这条已经是对的，不需要改**。

但 **"Reopen"在 Engine / Bridge / UI 三层都不存在**——没有 `reopenTask`/`reopenProject`，没有对应的 `ui_reopenTask`，UI 上也没有这个按钮。Carson 提到 Reopen 时暗示了这应该存在；现状是完全没有。如果需要，应该新增一个跟 `completeTask`/`cancelTask` 同等级别的正式 Command，不建议通过普通 Edit 达成——这与 Carson 自己的原则完全一致，这里只是确认现状是"零"，不是"有缺陷"。

---

## 4. Conversion Matrix

`42_ConversionEngine.js` 目前的完整公开 API：`convertTaskToProject / convertProjectToTask / convertNoteToTask / convertNoteToProject / convertNoteToGoalCandidate`。"Project → Workflow/Template"和"Workflow → Task"**不在这个 Engine 里**，而是 `41_BusinessRuleEngine.js` 的 `captureAsWorkflowTemplate`/`instantiateFromTemplate`——这是两种架构上完全不同的操作，先说明这一点，避免用同一套"标记源为 CONVERTED、产出一个目标"的心智模型套错地方。

| 转换 | 状态 | 说明 |
|---|---|---|
| Note → Task | ✅ 已支持 | `convertNoteToTask`，非破坏性——源 Note 标记 `CONVERTED`（`converted_to_type='TASK'`），不删除 |
| Note → Project | ✅ 已支持 | 同上，`converted_to_type='PROJECT'` |
| Note → Goal Candidate | ✅ 已支持（只发信号） | 不在本项目创建 Goal，只标记 Note，Goal 完全是 Life Execution OS 的职责 |
| Task → Project | ✅ 已支持 | 见 4.2，发现一个具体数据丢失点 |
| Project → Task | ✅ 已支持 | 见 4.3，有资格校验+已知不对称 |
| Task → Note | ❌ **未实现** | 见 4.1，提出 contract 建议 |
| Project → Template（Capture） | ✅ 已支持 | 不消耗源 Project，纯"抽象另存" |
| Template → Project+Workflow+Tasks（Instantiate） | ✅ 已支持 | 不是"Workflow → Task"，是"从模板批量生成一整套新实体" |

### 4.1 Task → Note：应该允许，建议采用跟 Note→Task 对称的非破坏性 contract

现状：完全不存在，`ConversionEngine`/`UIBridge`/UI 三层都没有。

已经证明可行的既有模式（`convertNoteToTask`/`convertNoteToProject`）：**非破坏性**——源实体标记为 `CONVERTED`（连带 `converted_to_type`/`converted_to_id`），物理行永不删除；目标实体正常创建，`created_method='Converted'`。建议 Task→Note 采用完全对称的方向：

- 源 Task：标记 `CONVERTED`（需要决定：复用现有的单一用途 `converted_to_project_id` 字段不够，因为这次目标类型是 Note 不是 Project——Task 目前没有 Note 那种通用的 `converted_to_type`/`converted_to_id` 一对字段，这是一个需要先决定的 schema 问题，不只是加一行转换函数）
- 目标 Note：正常创建，`content` 取 Task 的 `title`（+ 可选带上 `notes`），`created_method='Converted'`
- lineage（血缘）：`convertNoteToTask` 处理反向 lineage 时明确注释"Note 不是 Task，没有 source_task_id 可填，血缘走 NOTE_CONVERTED 事件本身"——这次反过来，新 Note 要不要把 `source_task_id` 设成源 Task 的 ID，这取决于 `source_task_id` 这个字段的本意到底是"这条记录跟哪个 Task 有关"（那应该填），还是更窄的其它含义（既有代码里没有把它反过来用过，需要 Carson 或后续实现者明确一次，这里不替他下定论）
- 幂等：跟既有 5 个转换一样的模式（已经 CONVERTED 且目标 ID 相同 → 直接返回既有目标，不重复创建）
- **不建议**做成"删除 Task"——那会破坏既有"只增不删"的既定约定（`00_Data_Ownership.js「五」`），也会让"这条 Note 曾经是个 Task"这条历史直接消失

### 4.2 Task → Project：解决了一个悬而未决的问题——due_datetime 静默丢失

`convertTaskToProject`（`42_ConversionEngine.js`）把源 Task 映射到新 Project 时：`title→title`、`notes`/传入描述 → `description`、`parent_project_id`/`execution_mode` 透传、`source_task_id` 记血缘、`decision_owner` 正确转发。

**`due_date`/`due_time`/`due_datetime` 完全没有出现在这个函数里任何一处**——因为 Project 的 schema 里根本没有这些字段（跟第 1、2 节是同一个根因）。这正好回答了 2026-08-30 checkpoint 里悬而未决的 **Open Decision #2**（"Task↔Project 转换时 due_datetime 该怎么映射"）：**答案是目前完全没有映射，这条信息会被直接静默丢弃，不会进入 description，也不会记在任何地方。** 这是 Project Deadline Contract 决定迟迟没有落地的一个具体、可感知的后果——如果 Carson 需要一个理由推进那个决定，这算一个。

### 4.3 Project → Task：资格校验完整，但有一处已知的不对称

`createTaskFromConversion_`（`20_TaskEngine.js`）：`title→title`、`description→notes`、新 Task 的 `project_id` = 源 Project 的 `parent_project_id`（新 Task"接替"源 Project 原来的位置）、`source_project_id` 记血缘。**没有映射**：`priority`（Project 没有这个字段）、`depends_on_project_ids` → 没有转成 Task 的 `depends_on_task_ids`（依赖关系被静默丢弃，值得留意，即使目前触发这条转换的前提——"没有非终态子任务/子项目"——多少降低了实际影响）。

资格校验：`checkEligibleForTaskDemotion_` 拦下"还有非终态子 Project 或子 Task"的情况，`50_UIBridge.js` 明确把这个结果转成 `{ok:false, code:'BLOCKED'}` 而不是裸错误——**这条实现是完整、正确的**。幂等性同样完整（已转换过直接返回既有 Task）。

已知不对称（代码自己的注释已经写明，这次审计只是确认属实）：这个方向转换出来的 Task，`decision_owner` 固定 fallback 成 `chat_id`，拿不到 Web Identity——跟 Task→Project、Note→Task 两个方向不一样。这是既有、已经被记录的技术债，不在本次范围内处理，只确认它还在。

### 4.4 顺手发现一处文档过期

`00_Domain_Boundary.js「三」`（范围声明）还写着"本次只要求 Task 可以转去 Project，没有要求反向操作"，引用的是 `ADR-2026-07-24-006`。但实际代码已经实现了 Project→Task（见 4.3），`42_ConversionEngine.js` 自己的文件头引用的是 `ADR-2026-07-24-015（双向）`作为依据——`00_Domain_Boundary.js` 这一处显然是在"双向化"决定之后没有跟着更新，建议下次touch这个文件时一并修正引用。

---

## 5. Enter / Form Input UX

### 5.1 实际检查结果跟预期不完全一致，需要如实说明

`ui_index.html` 整个文件里**没有任何 `<form>` 标签**——所有"保存"动作都是普通 `<div>` 卡片 + `<button type="button">` 加 `click` 监听器，不是原生表单提交。这意味着"Enter 意外 submit 表单"这个具体故障模式，在这份文件里**没有可以发生的机制**——没有 `<form>` 就没有原生 submit-on-Enter 行为。

整个文件唯一的 `keydown` 监听器在 Notes 输入框上（`inputEl`）：

```js
inputEl.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) addNote(); });
```

只在 `Ctrl/Cmd+Enter` 时触发保存；普通 Enter 完全没有被拦截，textarea 的默认行为（换行）保持原样。**这一处已经完全符合 Carson 的要求。**

其它所有多行/单行输入框——`taskCreateNotes`、`taskCreateTitle`、`projectCreateTitle`、`projectCreateDescription`、以及两个内联 Edit 表单的所有输入——**都没有任何 keydown 处理**。普通 Enter 在这些字段里目前不会做任何事（安全，但也没有 Ctrl/Cmd+Enter 快捷保存，跟 Notes 输入框不一致）。

### 5.2 需要提醒的一点

历史记录（2026-08-23/24 的 session）显示过一次：Carson 实际部署/上传的 `ui_index.html` 跟当时交付的版本不是同一份文件。如果 Carson 在实际使用中确实遇到了"Enter 提交了"的情况，值得先确认现在线上跑的到底是不是这份 zip 里的这个文件——按这份文件的实际代码,这个具体故障没有办法复现。

### 5.3 建议

不需要"防止误 submit"（本来就不会发生），但**建议把 Notes 输入框已经验证过的 Ctrl/Cmd+Enter 模式，原样复制到 `taskCreateNotes`、`projectCreateDescription`，以及两个内联 Edit 表单的对应输入框上**，让整个 UI 的保存快捷键行为一致，而不是只有 Notes 一处有。

---

## 6. Overall UI + Navigation Architecture

现状（`ui_index.html`）：`Notes`（默认激活）/ `Tasks` / `Projects` / `Workflows`（禁用，"soon"）/ `Review`（禁用，"soon"）/ `Search`（禁用，"soon"）——6 个入口，3 个可用。**目前没有 Overall/Home 入口，Notes 是默认落地页。**

Carson 提出的结构（Overall/Home → Tasks/Projects/Workflows/Notes）在机制上很直接：等第 1 节的 Overall 视图有内容可渲染后，加一个新的 `nav-item`（建议放在最前面，并把默认激活面板从 Notes 换成 Overall/Home）即可，不需要改动现有导航切换逻辑（`document.querySelectorAll('.nav-item.enabled')` 那套代码本身是通用的，加一项就自动生效）。按 OS/Domain、Priority、Status、Due 切片，依赖第 1、2 节里各自的能力先落地。

---

## 附：Note Edit 能力（追加项）

`29_NoteEngine.js` 的完整公开 API 是 `createNote / createNoteDirect_ / archiveNote / markNoteConverted_`——**没有 `updateNote`，在 Engine / Bridge / UI 任何一层都没有**。这不是部分缺口，是完全没有。

有利的地方：Note 的 schema 里已经有 `updated_time` 字段（目前没人写它，说明设计时就留了口子）；Note 的 identity 由 `content + category`（`07_IdentityEngine.js`）算出，意味着未来的 `updateNote` 可以完全照搬 `updateTask`/`updateProject` 已经验证过的模式——改动 identity-affecting 字段时重算 identity、`note_id` 不变、发一个新的 `NOTE_UPDATED` 事件。

**必须遵守的既有边界**：Note 有一组明确的 `FORBIDDEN_FIELDS`（`due_date`/`due_time`/`due_datetime`/`reminder_policy`）——"如果这件事需要提醒/截止日期，应该建 Task 或 Project，不是 Note"，这是有意的架构约束。Note 的 Edit 能力必须只覆盖 `content`/`category`，不能因为要做 Edit 就顺便打开这几个禁止字段。

**建议的形状（本轮不实现）**：`NoteEngine.updateNote(noteId, changes, chatId)`——白名单只有 `content`/`category`；改动时按现有 `updateTask` 的模式重算 identity；`UIBridge` 新增 `ui_updateNote`；UI 在 Note 卡片上加一个跟 Task/Project 同款的内联 Edit 表单。

---

## 小结：本次审计里可以立刻验证/推进的几件事

1. **Item 2 不需要新字段**——`source_domain` 已经是对的候选，只需要重新写清楚语义 + 对齐命名约定 + 明确是否可编辑。
2. **Item 3 的 Edit 表单缺口是本次最具体、最容易验证的一条**——`priority`/`due_time`/`notes`/`tags`/`project_id` 在 Task Edit 表单里完全不存在，但 Engine 层早就支持。
3. **Item 4 解决了一个悬而未决的问题**——Task→Project 转换目前会静默丢弃 due_date/due_time/due_datetime，这是 Project Deadline Contract 决定尚未落地的直接后果。
4. **Item 5 的前提本身需要跟 Carson 核对**——这份文件里没有 `<form>`，"Enter 意外 submit"按现有代码无法复现，值得先确认线上部署的是不是这份文件。
5. **Note Edit 完全空白**，形状可以直接照抄 Task/Project 已经验证过的 update 模式，只是要守住 FORBIDDEN_FIELDS 这条线。
6. **Item 1 的 Project 参与 Due View、以及 Item 4 的 due_datetime 映射，两条都指向同一个根因**：Project Deadline Contract（Model B）还没有被批准。这两件事都在等同一个决定。
