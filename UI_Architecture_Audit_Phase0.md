# Personal Life OS — UI Architecture Audit（Phase 0）

**范围**：只做 Audit + Proposal，不写任何 UI 代码，不改任何现有文件。所有
"Proposed"章节都是提案，不是已经落地的治理文档。
**前提**：Sprint 1、Sprint 3 均已 Reference Certified（2026-08-16 重新跑
Gate 全部通过），Sprint 4 三个 AI 文件 Contract Verified / Integration
Pending。本次 Audit 的对象是 Personal Life OS 项目自身的代码库；**我没有
Personal AI Core 项目的代码可看**——涉及 Core 的判断全部标注为"推断/需要
你确认"，不是"核实过"。

---

## TL;DR

Read Path / Write Path 两条规则（UI → Query/Projection → UI；UI →
Command/Engine → Event → Projection → UI）在现有代码库里**不需要新造**——
QueryEngine 层（12/14/16/17/18/19/44）、Command 层（Engine 的
create/convert 系列公开函数）、Event/Projection 层（02_EventBus +
10_ProjectionEngine）全部已经存在、已经跑过两轮 Gate 验证。Vertical Slice
1（Note → Task）需要的两个动作——`NoteEngine.createNote` 和
`ConversionEngine.convertNoteToTask`——都已经是 Sprint 3 baseline 里现成的
公开函数，不需要新写一行 Engine 代码。

**真正缺的只有一层**：HtmlService/doGet/google.script.run 这一整层完全
不存在（全项目搜索零命中），需要从零搭。搭这一层之前，有一个我没办法替你
决定的架构分叉，详见「五」。

---

## 1. UI Architecture Audit（逐项核对你列的 11 个问题）

**1. 是否已有 HtmlService / Web App / Sidebar / HTML 文件**
否。全项目（47 个文件）搜索 `HtmlService`/`createHtmlOutput`/`SidebarApp`/
任何 `.html` 文件，零命中。

**2. 是否已有 doGet() / HTML Service entry point**
否。零命中。也没有 `doPost()`——确认了 Telegram webhook 的入口不在这个
项目里（大概率在 Personal AI Core 或独立的 webhook 中转项目，本项目的
`06_TaskIntentParser.handleTaskIntent(rawText, chatId)` 是一个被外部调用
的处理函数，不是自己监听 HTTP 请求的入口）。

**3. 是否已有 "google.script.run" pattern**
否——这个 API 只在前端 HTML/JS 里出现，既然连 HTML 文件都不存在，这个
自然也不存在。

**4. 是否已有 UI Service / Controller / Command layer**
没有专门叫这个名字的文件。但"Command layer"在概念上已经存在，只是没有
被抽成一个独立文件——每个 Engine 自己暴露的 create*/convert*/update*
系列公开函数，实质上就是 Command。真正缺的是"HTTP 请求 → 该调用哪个
Command"这一层路由/适配代码。

**5. QueryEngine 如何向 UI 提供数据**
现在的消费方是 Telegram 指令层（06_TaskIntentParser.js），不是 UI，但
调用方式对 UI 同样适用——QueryEngine 一律返回**原始 JS 对象/数组**（比如
`TaskQueryEngine.getTasks(chatId)` 返回 task 对象数组），不是格式化好的
文本。这对 UI 是好消息：Telegram 层自己把这些对象转成聊天文案
（`24_ViewEngine`/`25_DashboardEngine` 那一层"拼字符串"的逻辑），UI 不需要
复用那层，可以直接拿 QueryEngine 的原始对象自己渲染 HTML。已确认的
QueryEngine 公开读接口：
  - `12_TaskQueryEngine`: getTask, getTasks, getPendingTasks,
    getCompletedTasks, getTodayTasks, getTomorrowTasks, getWeekTasks,
    getMonthTasks, getUpcomingTasks, getOverdueTasks, getRecurringTasks,
    getCancelledTasks, getArchivedTasks(Inline) 等
  - `14_ProjectQueryEngine`: getProject, getProjects, getActiveProjects,
    getProjectsByParent
  - `16_WorkflowQueryEngine`: getWorkflow, getWorkflows,
    getWorkflowWithTasks
  - `17_NoteQueryEngine`: getNote, getOpenNotes 等（Sprint 4 审计时核实过）
  - `44_TimelineQueryEngine`: getTimelineForEntity

**6. ProjectionEngine 当前如何提供读取模型**
这里要澄清一个措辞：`10_ProjectionEngine.gs` 的 Public API **只有一个**——
`dispatch(event)`。它是纯写入侧组件（Events → Tasks/Projects/Workflows/
Timeline 等 Read Model 表），不提供任何读接口，UI/Telegram 都不会直接调用
它。"读 Projection"实际上是"读 QueryEngine，QueryEngine 再去读
ProjectionEngine 维护的那些 Read Model 表"——两步，不是一步。「五」的
Read Path 建议会把这个措辞订正一下。

**7. Task / Project / Workflow 的 Command / Engine entry points**
确认存在且都已过 Gate 验证：`20_TaskEngine.createTask`、
`27_ProjectEngine.createProject`、`28_WorkflowEngine.startWorkflow`
（Sprint4 审计时核实过签名）；Vertical Slice 1 额外需要的
`29_NoteEngine.createNote(content, meta, chatId)` 和
`42_ConversionEngine.convertNoteToTask(noteId, taskMeta, chatId)` 这次
逐行读过，都是干净、幂等、已在 Sprint 3 Gate 里跑过的公开函数（Note
Lifecycle Test 覆盖了创建/归档/转换）。

**8. 现有 Dashboard / Operator Console 是否存在可复用 pattern**
存在，但**只是"组合哪些 QueryEngine/计算哪些统计数字"这个逻辑可以复用，
输出格式不能直接复用**。`25_DashboardEngine.build(type, allTasks)` 明确
是纯函数、返回值是 `lines.join('\n')` 拼出来的一整块文本（emoji + 换行，
为聊天气泡设计），不是结构化 JSON。UI 应该复用的是"调用
`ViewEngine.today/overdue/tomorrow` + `AnalyticsEngine.computeStatistics`
+ `PriorityEngine.rankByPriority`"这个组合思路，自己写一层薄的、返回结构化
对象（不是字符串）的等价函数，不要直接把 DashboardEngine 的文本输出塞进
网页。

**9. Spreadsheet-bound deployment architecture**
**Personal Life OS 是 standalone（非 container-bound）脚本**——
`02_EventBus._spreadsheet_()` 用 `SpreadsheetApp.openById(SecureConfig.
getKey('SPREADSHEET_ID'))`，不是 `getActiveSpreadsheet()`（文件注释明确
对比了这一点跟 Personal AI Core 项目的差异："Core 是 container-bound
脚本...Productivity OS 是独立（standalone）脚本"）。这跟你的
[[jarvis]] 记录一致：多个 GAS 项目通过 Apps Script Library 互相连接，
共享同一张 Spreadsheet 作为数据层。**这一点直接影响「五」的部署位置问题**，
展开在那一节。

**10. Authentication / authorization / user identity pattern**
项目里没有任何基于 GAS `Session.getActiveUser()`/`getEffectiveUser()`的
身份判断——目前唯一的"身份"概念是 `chatId`（Telegram），作为参数显式
传遍所有 Engine，也作为字段存在实体自己身上（比如 Note 的 `chat_id`）。
这是单用户场景下合理的简化，但 Web App 没有"chatId"这个概念，需要一个
新的身份来源，见「五」的建议。

**11. 是否存在任何 UI → Spreadsheet 直接访问，若存在记录为 legacy pattern**
**不存在，而且不只是"UI 不存在所以不存在"这个平凡意义上的不存在**——
更值得记录的是：全项目直接调用 `SpreadsheetApp` 的文件只有
`05_SheetUtils.js`（Infrastructure 层，唯一被设计允许碰 Sheet 的模块）、
`02_EventBus.js`（Events 表专用写入口）、`15_Setup.js`（建表脚本）、
`11_ProjectionRebuilder__SPRINT1_ADDITIONS.js`（批量重建工具）、
`35_Tests_Sprint1Acceptance.js`（测试用真实数据清理）。**没有任何 Domain/
Application 层的 Engine 绕过这一层直接摸 Sheet**——这条纪律本来就已经
被严格执行，UI 只需要延续同一条规则（UI 只调用 QueryEngine/Command，
永远不直接 `SpreadsheetApp.openById(...)`），不存在需要"戒掉"的 legacy
习惯。

---

## 2. Existing UI Components

无。见「一、1-4」。

## 3. Reusable Components

- 全部 QueryEngine 读接口（「一、5」列出的那些）——直接可用，返回结构化
  对象
- 全部 Command/Engine 公开写接口（create*/convert*/update* 系列）——
  直接可用，已过 Gate
- `02_EventBus` + `10_ProjectionEngine` 的 Event→Projection 闭环——UI
  发起写操作后，不需要自己维护"写完之后怎么让读到最新数据"这件事，
  正常调用 Command 就会自动触发 Projection，UI 下一次调用对应
  QueryEngine 拿到的就是最新数据（不需要额外的"刷新"机制，`dispatch()`
  是同步调用，`publish()` 返回时 Projection 已经跑完）
- `25_DashboardEngine`/`24_ViewEngine`/`26_AnalyticsEngine` 的**组合逻辑**
  （不是输出格式）——今日/本周/逾期这类过滤条件、统计口径，UI 应该
  调同一批底层函数，不要重新发明一套"什么算 overdue"的定义
- Metadata Standard（11 字段）+ Priority Standard（双轨）——`00_Data_
  Ownership.gs「三」「四」`已经把 UI 新文档要求的 Metadata Visibility/
  Priority 字段逐条定义好了，核对下来**完全对得上**（UI 文档要的 12 项：
  Creator/Suggested By/Source Domain/Source Module/Source Event ID/
  Created Method/Decision Owner/Approval Status/Priority/AI Recommended
  Priority/Created Time/Updated Time——对应既有 11 个 Metadata 字段 +
  Priority Standard 的 2 个字段，一个不多一个不少，只是既有标准里还有
  一个 `source_task_id` 没被 UI 文档单列，可以并进"Source"分组里展示，
  不算矛盾）
- 测试方法论——Sprint 1/3 的"真实环境集成测试 + Logger.log + 单一入口
  汇总"这套模式，以及这次 Sprint 4 引入的"外部/不确定性依赖临时替换"
  技巧，都可以原样搬到 UI 的 Positive/Negative/Integrity Tests

## 4. Missing Components

1. **HtmlService 前端 shell**（doGet + 至少一个 .html 文件）——完全不
   存在，需要新建
2. **一层"UI-facing 适配层"**——不是重新实现业务逻辑，是把
   `google.script.run` 调进来的请求路由到正确的 QueryEngine/Command，
   并且做两件 QueryEngine/Command 自己不做的事：(a) 把 Sheet 列名
   （比如 `priority` 实际存的是 `priority_user` 这个概念，「三」的
   Data Ownership 迁移说明里写了"倾向保留原名"）转成 UI 文档要求的
   干净字段名；(b) 把裸 `Error` 异常转成前端能展示的结构化错误——现有
   Engine 抛的都是 `throw new Error('XXX_YYY: 人话说明')`这种格式，UI
   适配层需要 catch 住、转成 `{ok:false, code, message}` 这类返回给
   前端的形状，不能让原始异常裸传到 `google.script.run` 的失败回调
3. **前端 JS 的状态管理**——文档里"Server-side Projection remains
   authoritative"这条原则现有代码天然满足（因为写操作走 Command 会
   自动触发 Projection），但"UI refresh 应该能从 Projection/Query
   重新构建"这件事本身（哪些数据要在写操作后重新拉取）需要新写
4. **身份来源**——见「一、10」
5. **部署位置决定**——见「五」，这不是"缺一个文件"，是缺一个决定
6. 治理文档：`00_File_Map.gs`/`00_Module_Responsibility.gs`/
   `00_Data_Ownership.gs` 都还没有任何 UI 相关条目（合理，因为还没有
   代码可记）——「六」「七」「八」给出可以直接采纳的草案

---

## 5. Recommended UI Boundary

Read Path / Write Path 两条规则，落到这个代码库的具体说法：

```
Read Path:   UI (HTML/JS)
               → google.script.run
               → [新] UI 适配层函数（薄，只做路由+字段清洗+错误包装）
               → 对应 QueryEngine（12/14/16/17/18/19/44，读 Sheet）
               → UI

Write Path:  UI (HTML/JS)
               → google.script.run
               → [新] UI 适配层函数
               → 对应 Command（Engine 的 create*/convert* 公开函数）
               → EventBus.publish()（Engine 内部已经在做）
               → ProjectionEngine.dispatch()（EventBus 内部同步触发）
               → 下一次 Read Path 查询自然拿到最新数据
```

这条路径**跟现有 Telegram 指令走的路径是同一条**（06_TaskIntentParser
现在也是"解析指令 → 调 Command → Command 内部发 Event → Projection
同步更新"），UI 只是换了一个新的入口触发同一套底层逻辑，不是另开一条
平行的写入通道——这正是 Ownership 那条规则（"Domain 是 Business State
Producer，UI 是 Consumer"）在结构上的自然结果，不需要额外强制。

**唯一一处需要你决定、我没法替你定的分叉**：这个 UI 适配层 + doGet
应该部署在**哪个 GAS 项目里**？

- **选项 A：部署在 Personal Life OS 自己的项目里**（新增几个文件，比如
  `50_UIBridge.gs` + doGet.html，本项目自己发布一次 Web App 部署）。
  优点：跟现有代码同一个项目，函数内直接调用，没有跨项目调用的复杂度；
  缺点：如果未来 Rider OS / Property OS 也要各自做 UI，会变成 N 个
  独立 Web App、N 个 URL，将来想做"跨 Domain 统一入口"时还要再做一次
  整合。
- **选项 B：部署在 Personal AI Core 项目里**，Core 通过 Apps Script
  Library 方式调用 Personal Life OS 暴露出来的函数（[[jarvis]] 记录
  显示项目间本来就是 Library 集成，不是纯粹靠共享 Spreadsheet）。
  优点：跟"Personal AI Core 位于 Domain OS Family 之上，是天然的协调层"
  这个已确认的平台架构一致，未来多个 Domain OS 的 UI 可以共享同一个
  入口/同一次登录；缺点：我完全没有 Core 项目的代码，不知道它现在有没有
  已经在用的 doGet、有没有已经占用的 URL/部署配置，贸然假设"Core 现在
  是空的、可以随便加"是没有证据支持的猜测。

我倾向于选项 B 更符合已经确认的平台设计意图，但**这只是根据现有证据的
判断，不是核实结论**——建议先确认 Core 项目现状（有没有已有 Web App
部署、有没有已经在跑的 doGet），再决定 Vertical Slice 1 具体从哪个项目
的 GAS 编辑器开始写。如果不确定，选项 A 是更保守、回滚成本更低的起点
（Vertical Slice 1 只是验证闭环，即使先在 A 里做，之后要挪到 B 也只是
"换一个部署位置调用同一批已经写好的适配层函数"，不是推倒重写）。

**身份**（「一、10」）：单用户场景下，最省事、最安全的选择是 Web App
部署设置为"Execute as: Me / Who has access: Only myself"——不需要新写
任何登录逻辑，GAS 平台层面就保证了只有你自己能访问。UI 适配层不需要
引入新的 identity 概念，写入 Note/Task 时沿用某个固定值当"chatId 等价物"
即可（比如继续用你现有的 Telegram chatId 常量，保持跟既有数据的
decision_owner 语义一致）。

---

## 6. Proposed File Map（草案，不是已落地的 00_File_Map.gs 修改）

```
50_UIBridge.gs          [新，Application 层]
  → doGet 路由到的所有 google.script.run 可调用函数
  → 依赖：对应 QueryEngine（读）+ 对应 Engine（写），不依赖 Sheet/Events

ui/index.html            [新，Presentation 层，纯前端]
ui/*.html (Vertical Slice 逐步增加)
```

Layer Map 归类建议：`50_UIBridge.gs` 应该跟现有 `06_TaskIntentParser.gs`
同属 **Presentation** 层（性质相同：把某种外部输入——Telegram 指令文本 /
HTTP 请求——转成对内部 Command/QueryEngine 的调用），不是 Application
层——这样 Presentation 层就有两个文件，而不是继续保持"只有
06_TaskIntentParser 一个文件"的现状，需要在 `00_File_Map.gs`「三」
Architecture Layer Map 里把 Presentation 一行从单文件改成两个文件。

## 7. UI Module Responsibility（草案，13 字段格式，仿现有 Engine Contract）

```
Responsibilities : 把 HTTP/google.script.run 请求路由到正确的
                    QueryEngine/Command，做字段清洗和错误包装
Owns              : 请求路由表；Sheet 列名 → UI 字段名的映射；
                    Error → {ok, code, message} 的转换规则
Reads             : 视 Vertical Slice 而定（Slice 1: NoteQueryEngine,
                    TaskQueryEngine）
Writes            : none（自己不发 Event，全部通过调用既有 Command）
Public API        : 视 Slice 而定（Slice 1 至少需要
                    ui_createNote(content, chatId),
                    ui_convertNoteToTask(noteId, taskMeta, chatId),
                    ui_getOpenNotes(chatId)）
Dependencies      : 对应 QueryEngine + 对应 Engine（不直接依赖
                    05_SheetUtils/02_EventBus——跟 06_TaskIntentParser
                    现在的依赖范围一致）
Forbidden Deps    : Sheet 直接读写、Events 直接发布——一律通过既有
                    QueryEngine/Command 间接完成
Pure Function     : NO
Side Effects      : YES（间接，通过调用 Command）
Notes             : 这是"照抄一份 06_TaskIntentParser 的角色，换一种
                    输入方式"，不是重新设计一层新的架构
```

## 8. Data Ownership（UI 视角，草案）

UI 适配层**不新增任何一张表的写入权**——所有写操作最终落到既有
Command，既有 Command 已经是各自表的唯一写入者（`00_Data_Ownership.gs
「一」`矩阵不需要变）。UI 只是多了一个"发起写请求"的入口，跟
Telegram 指令层是并列关系，不是替代关系。

Metadata Standard 对齐（「三」已核对过，见上）：UI 的 Detail View /
Inspector 展示这 11+2 个字段时，直接读 QueryEngine 返回对象上的同名
属性即可，不需要新的字段映射——**除了 `priority` 这一个字段**，UI
展示时应该标注为"User Priority"（对应文档要求的"Priority"），
`priority_ai_recommended` 标注为"AI Recommended Priority"，避免用户
以为 `priority` 字段名本身就是"最终优先级"以外的什么特殊含义。

---

## 9. Risks

- **部署位置未定（「五」）**——如果先斩后奏部署在 A，后续如果确认应该在
  B，UI 适配层函数需要搬家，前端 JS 里 `google.script.run` 的调用不受
  影响（前端不知道后端函数具体部署在哪个项目），但 doGet 的 URL 会变，
  已经收藏的书签/快捷方式需要更新——这不是灾难性风险，但值得现在就想清楚
  再动手，回滚成本比"UI 适配层函数写错了"高一个量级
- **Sheet 列名 ≠ UI 字段名**（`priority`/`priority_user` 那个例子）——
  如果 UI 适配层疏忽直接透传 QueryEngine 返回的原始对象，前端字段名会
  跟文档要求的术语对不上，容易在后续 Slice 里被当成"这个字段是不是丢了"
  之类的假警报
- **DashboardEngine 输出格式的诱惑**——如果图省事直接把
  `DashboardEngine.build()` 的文本结果塞进网页 `<pre>` 标签，短期看起来
  能用，但完全违背"结构化数据渲染"这个 UI 应该有的样子，也没办法支持
  文档要求的 List View → Detail View 交互，需要在 Slice 1 就用正确的
  模式（返回对象数组），不要因为"能跑"就先绕过去，以后改起来比重新写
  一次成本更高

## 10. Migration / Compatibility Considerations

- 现有 Telegram 指令层和未来的 UI 是两个并行的 Presentation 入口，
  互不影响、互不替代——Sprint 3 Gate 验证过的 Note/Task/Project/
  Workflow 行为，UI 只是换一种方式触发同一套 Command，不需要重新验证
  Command 本身的正确性（那已经被 Gate 覆盖），UI 层新增的测试应该聚焦
  在"适配层路由/字段转换/错误包装对不对"，不需要重新测一遍
  `NoteEngine.createNote`内部逻辑
- Sprint 4 的三个 AI 函数（Vertical Slice 4 才会用到）现在状态是
  Integration Pending——Slice 4 开始时它们已经是 Contract Verified 的
  状态，不需要重新审计，只需要设计"UI 适配层怎么调它们、怎么展示
  AI Recommendation vs User Priority"这一层

---

## 11. Vertical Slice 1 可行性确认（Note → Task）

逐步核对文档要求的每一条：

- "不直接写 Sheet" —— 适配层调 `NoteEngine.createNote`/
  `ConversionEngine.convertNoteToTask`，两者都不直接摸 Sheet（都通过
  EventBus/其它 Engine），确认可行
- "使用现有 Engine" —— 确认，两个函数都是 Sprint 3 baseline 现成的
- "使用现有 Event/Projection pattern" —— 确认，`NOTE_CREATED`/
  `NOTE_CONVERTED`/`TASK_CREATED` 都已经在 `10_ProjectionEngine.dispatch`
  里有对应 case（Sprint 3 Gate 的 Note Lifecycle Test 覆盖过这条链路）
- "保留 Source/Creator/Created Method metadata" —— 确认，
  `ConversionEngine.convertNoteToTask` 内部已经设置
  `created_method: 'Converted'`、`source_module: 'ConversionEngine.
  convertNoteToTask'`，不需要 UI 适配层自己补
- "支持错误处理" —— 需要适配层自己做（现有函数抛的是裸 `Error`，
  见「四、2」）
- "不产生 duplicate entity" —— `IdempotencyManager.createNoteIfNotExists`
  + `ConversionEngine` 的幂等检查（"已经转换过直接返回既有目标"）已经
  覆盖，不需要 UI 层重新实现判重
- "Conversion 必须保持既有 ADR 定义" —— `convertNoteToTask` 内部逻辑
  没有改动空间（适配层只是调用，不重新实现），天然满足

**结论：Vertical Slice 1 在 Engine 层面已经 100% ready，唯一要写的新
代码是 UI 适配层（「六」「七」）+ 前端两个页面（Note 输入框 + Note
列表带"Convert to Task"按钮）+ 部署位置决定（「五」）。**

---

## 12. Recommended Next Action

1. 你确认「五」的部署位置（A/B），以及是否需要先看一眼 Core 项目现状
   再决定
2. 确认后，我可以开始写 Slice 1 需要的 `50_UIBridge.gs`（3 个函数：
   `ui_createNote`/`ui_convertNoteToTask`/`ui_getOpenNotes`）+ 最小的
   `index.html`（一个输入框 + 一个列表 + 转换按钮），以及对应的
   Positive/Negative/Integrity 测试
3. 「六」「七」「八」的草案在 Slice 1 代码写完、你过一遍之后，再正式
   写回 `00_File_Map.gs`/`00_Module_Responsibility.gs`/
   `00_Data_Ownership.gs`（同 Sprint 4 那次的顺序：先写代码、跑通，
   再补治理文档，不是反过来）
