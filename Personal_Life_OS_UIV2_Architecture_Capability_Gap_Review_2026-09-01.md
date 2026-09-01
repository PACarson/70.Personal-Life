# Personal Life OS UI V2 — Architecture & Capability Gap Review

**2026-09-01｜承接 `UI_Enhancement_Architecture_Audit_2026-08-31.md`，本文档不重复取证，只把已经验证过的证据整理成决策格式。仍然是 audit/planning 阶段，本文档完成前不做大规模 UI 改动。**

分类口径：
- **Already Exists** — Engine/Domain 层已经支持，缺口只在 UI 没接上
- **UI Missing** — 纯 UI 层缺口，Engine/Domain 不需要改
- **Domain Missing** — Engine/Domain 层本身就没有这个能力，需要新写
- **Contract Required** — 需要先有一个明确的、写下来的决定，才能开始做，不管最后是不是要写代码
- **Blocked** — 依赖另一个还没批准的决定，本身不该单独推进

---

## 总表

| # | 项目 | 分类 | 需要 ADR？ | 可以立即 implementation？ |
|---|---|---|---|---|
| 1 | source_domain / OS Contract | UI Missing + Contract Required | 是 | 决定落地后可以 |
| 2 | Overall Dashboard | Task 侧 UI Missing；Project 侧 Blocked | 建议（轻量） | Task-only 部分可以；Project 部分不可以 |
| 3 | Unified Create/Edit | UI Missing | 否 | 是 |
| 4 | Note Edit | Domain Missing | 否（小的、对称扩展） | 是 |
| 5 | Conversion Matrix / no-silent-loss | 见 5.1-5.4 分项 | Task→Note 是；其余否 | Task→Project 的告警/BLOCKED 修复可以；Task→Note 不可以（先 ADR） |
| 6 | Create/Edit Performance | Domain Missing（量化）+ UI Missing（修复） | 否 | Instrumentation + 乐观 UI 可以；根因量化需要 Carson 实跑 |
| 7 | Enter / textarea | 基本 Already Exists，小范围 UI Missing | 否 | 是 |
| 8 | Project Deadline dependency | Blocked（本身就是阻塞源，不是新能力） | 已有草案，缺的是批准 | 否——按设计就该等 |

---

## 1. source_domain / OS Contract

**分类：UI Missing（字段已存在但休眠）+ Contract Required（语义/取值/可编辑性都还没定）**

**Recommendation：** 复用 `source_domain`，不新增字段。需要显式定下来五件事，缺一不可：

1. **合法枚举从哪来** —— 不应该是 UI 自己发明一份列表，应该指向平台已有的 OS Registry（这个项目自己注册的 Library Identifier 是 `PersonalLifeOS`；`00_Data_Ownership.js` 里 `source_domain` 现有的示例取值 `'Personal Life'/'Property'/'Rider'/'Investment'/'News'` 需要改成跟这个命名约定一致的 `PersonalLifeOS/PropertyOS/RiderOS/InvestmentOS/NewsOS` 形式）。
2. **Personal Life OS 自己算不算一个 OS/domain** —— 算。它是默认值，不是例外；现状里 100% 的既有记录本来就该被理解为 `OS=PersonalLifeOS`，这不需要迁移,只是重新解读。
3. **User 能不能在 UI 改** —— 建议能改（生活里的事情，归类经常需要事后调整），但这是产品决定，不是纯技术判断，需要 Carson 自己拍板——这一点上次审计已经指出过，这里正式列为待决项，不预设答案。
4. **新 OS 出现时怎么扩展** —— 应该有唯一一个注册点（比如一个 Config/Registry 列表），UI 下拉框和治理文档都从这一个地方读,不要出现"UI 一份、文档一份"两边手抄不同步的情况。
5. **AI 建议 Task 时怎么记** —— 按 Carson 自己举的例子：`source_domain` 记这件事本身属于哪个 OS（比如 `PropertyOS`），`creator='AI'` + `source_module`（比如 `PersonalAICore`）记是谁/什么产生的建议——这两组字段本来就是分开的，不需要新增，只需要在文档里把这条分工写清楚，避免以后 `category`/`source_module`/`source_domain` 三个字段又开始各自表达"这属于哪个 OS"。

**Trade-off：** 复用 `source_domain` 避免了 schema 膨胀，但意味着要把这个字段的文档语义从"创建时不可变的 provenance"正式改写成"可能可编辑的业务归类"——这是一次真实的语义变更，不是无痛的。

**Migration impact：** 低。目前没有任何代码真的读取 `source_domain` 做业务判断（100% 休眠，全部是默认值 `'Personal Life'`），重新定义语义不会破坏任何现有行为；既有记录的默认值retroactively 解释成 `OS=PersonalLifeOS` 也是站得住的（因为它们现在确实都是 Personal Life OS 产生的）。

**Acceptance criteria：** (a) 存在唯一的 OS Registry 数据源，UI 和文档都从这里读；(b) `00_Data_Ownership.js` 的 Metadata Standard 部分重写 `source_domain` 的语义+可编辑性决定；(c) Create 和 Edit 两处都能设置这个字段；(d) 有一份写清楚的说明,区分 `category`/`source_module`/`source_domain` 各自的职责。

**ADR needed：是。** 这是对一个既有字段语义和可变性的正式变更，按这个项目自己的惯例（schema/identity 相邻的决定要走 ADR）应该有一份。

**立即可实现？** 决定本身（上面 5 条）落地之后，UI 接线是直接的小工作；卡住的是决定，不是工程量。

---

## 2. Overall Dashboard

**分类：Task 侧 = UI Missing（Domain capability 已经存在）；Project 侧 = Blocked（卡在第 8 项）**

**先澄清一个措辞问题，避免误读成要跨越 Domain/Execution 边界：** "跨 OS 的执行总览"这个说法需要精确一下——它指的是"把 Personal Life OS 自己拥有的 Task，按它们各自的 OS/Domain 标签分组展示"，**不是**"直接去读 Property OS/Investment OS 自己的数据库"。只要 Overall 读取的所有行都还是 Personal Life OS 自己拥有、存储的数据（现状确实如此——Property OS/Investment OS 目前都还没有自己独立跑起来的系统），Overall 在架构上仍然是 `00_Domain_Boundary.js「四」`定义的 **Domain Dashboard**，不是 Execution Dashboard，不需要、也不应该去跨读其它系统。这跟"Domain owns its own data，Execution 只持有 Reference"完全一致——只是这里的"跨"是"跨标签"，不是"跨系统"。这一点建议写进最终的 Overall Dashboard Contract 里，避免以后有人真的按字面意思去接 Property OS 的数据源。

**Recommendation：** 按 Carson 的拆法来——Task Overall View 现在可以做（Domain capability 已经确认存在，见上次审计 1.1）；Project Overall Due View 继续 Blocked，不因为要做 Overall 就偷偷给 Project 加 due_date。

**Trade-off：** 先做 Task-only 意味着 Projects 在新首页里暂时不可见,直到 Project Deadline Contract 落地——这好过为了凑齐"Task+Project 都显示"而临时糊弄一个日期字段。

**Migration impact：** Task-only 版本没有——纯新增的只读聚合层,不改 schema。Project Deadline Contract 一旦批准,Overall 需要一次跟进扩展,不需要推倒重做。

**Acceptance criteria：** 输出结构化 JSON（不是文本）；Overdue/Today/Tomorrow/ThisWeek/Upcoming/Critical/HighPriority/Recurring 全部覆盖；按 OS/Domain 标签分组；跨 bucket 去重（同一个任务只出现在一个桶里，不是"逾期"又出现在"本周"里）；点击直接可以 Edit/Done/Cancel；遵守 Dashboard 永不落盘的既有约束（`ADR-2026-07-06`）；上线前先修掉上次审计发现的 `_isNonTerminal_` 缺口（否则已转换/已落选的 Task 会漏进 Overall）。

**ADR needed：** 建议有一份轻量的（主要是把"Overall/Home 是 Domain Dashboard、目前 Task-only、按 OS/Domain 标签分组"正式记下来），但也可以只作为 `00_Project_State` 的一条决定记录,不一定要走完整 ADR 流程。

**立即可实现？** Task-only 部分可以。Project 参与的部分不可以，卡在第 8 项。

---

## 3. Unified Create/Edit

**分类：UI Missing（Engine 层已经支持绝大部分字段,纯粹是 UI 层的对称性问题）**

**Recommendation：** 采用一份共享的 Field Schema 来同时渲染 Create 和 Edit 两个表单,而不是像现在这样两份手写 HTML 各自维护——这样才能从结构上防止"Create 加了新字段、Edit 忘记加"再次发生（这正是上次审计发现的现状：Edit 表单 title/category/due_date 三个字段，比 Create 表单的九个字段薄得多，Engine 层其实早就支持全部）。`status`/lifecycle 继续排除在这份共享 schema 之外，只能走 Done/Cancel/Reopen 这几个正式 Command，不能通过普通 Edit 保存路径改动。

**Trade-off：** 共享 schema 需要一次性重构现在两份独立手写的表单,比逐个字段打补丁的工作量大一点,但能避免同样的不对称在下次加字段时重演。

**Migration impact：** 无。纯前端改动,不涉及数据迁移;Engine 层零改动,因为需要的字段全部已经在 `UPDATABLE_FIELDS` 里。

**Acceptance criteria：** Title/OS/Category/Priority/Due date/Due time/Recurring/Context/Notes/Description/Tags/Project 在 Task 的 Create 和 Edit 两处都能设置；Project 自己的字段集合做同样的对齐检查（比如 `execution_mode`）；status/lifecycle 的改动继续只走 Done/Cancel/Reopen，不进入普通 Edit 保存路径。

**ADR needed：否。** 这是 UI 层实现方式,不是 Domain/架构决定。

**立即可实现？是。**

---

## 4. Note Edit

**分类：Domain Missing（`29_NoteEngine.js` 完全没有 update 函数,Engine/Bridge/UI 三层都没有）**

**Recommendation：** 按上次审计提出的形状——新增 `NoteEngine.updateNote(noteId, changes, chatId)`，白名单只有 `content`/`category`；改动时按 `updateTask`/`updateProject` 已经验证过的模式重算 identity；新增 `NOTE_UPDATED` 事件；`UIBridge` 新增 `ui_updateNote`；UI 加一个跟 Task/Project 同款的内联 Edit 表单——不让 UI 直接写 Sheet。

**Trade-off：** 基本没有——这是对一个已经验证过两次（Task、Project）的模式做第三次对称扩展，风险很低。

**Migration impact：** 无——纯新增函数和事件类型，不改动既有行为。

**Acceptance criteria：** `content`/`category` 可编辑；`due_date`/`due_time`/`due_datetime`/`reminder_policy` 继续被 `FORBIDDEN_FIELDS` 拒绝（这条边界不能因为要做 Edit 就打开）；identity 在 content/category 改动时正确重算；有一套跟 Task/Project 同级别的回归测试。

**ADR needed：否**（对称扩展一个已批准的模式），但建议在 `00_Project_State` 里记一笔。

**立即可实现？是。**

---

## 5. Conversion Matrix / No-Silent-Loss Principle

**新确立的原则（建议写进 `00_Business_Rules.js`，作为跟既有转换原则并列的一条通用规则）：任何 Conversion 都不能静默丢失用户已经存在的数据。**

### 5.1 Task → Project — Already Exists，但违反了上面这条新原则

现状（上次审计已确认）：`due_date`/`due_time`/`due_datetime` 会被完全静默丢弃，因为 Project 目前没有地方存。**分类：Contract Required（修复本身很小，但需要先决定用哪种处理方式）。**

Recommendation：在 Project Deadline Contract 落地之前，二选一——(a) 转换前明确告诉用户"这个任务的截止日期暂时无法带过去，确定要继续吗？"，或 (b) 遇到带日期的 Task 时直接返回 `BLOCKED`。个人倾向 (a)：强迫用户自己先删掉日期才能"解锁"转换，体验比清楚告知更差；但两种都合理，这是 Carson 的决定，这里只列出取舍，不替他选。

Trade-off：(a) 给带日期的转换多加一步确认，换来的是彻底消除刚发现的静默丢失。

Migration impact：无——纯 UI 层在调用既有转换前多一次检查。

Acceptance criteria：源 Task 带非空 `due_date`/`due_time` 时，转换不再无声无息地完成；要么有显式确认，要么返回 `BLOCKED`。

ADR needed：否（小修复,原则本身值得写进 Business Rules，但这条具体修复不需要单独 ADR）。

立即可实现？是。

### 5.2 Task → Note — Domain Missing，Contract Required，明确要求先 ADR 再写代码

**分类：Domain Missing。** 现状确认不存在（`ConversionEngine`/`UIBridge`/UI 三层都没有）。

Recommendation：采纳"新建 Note + 明确处理原 Task"而不是"原地把 Task 变成 Note"——跟既有 Note→Task/Note→Project 的非破坏性先例对称（标记源为 `CONVERTED`，物理行永不删除）。需要在 ADR 里明确回答的具体问题（上次审计已经point出但没有下定论）：Task 目前只有单一用途的 `converted_to_project_id`，没有 Note 那种通用的 `converted_to_type`/`converted_to_id` 一对字段——这次要不要新增；新 Note 的 `source_task_id` 要不要指回源 Task（`convertNoteToTask` 处理反向血缘时明确说"血缘走事件本身，不填 source_task_id"，这次是否沿用同样的窄口径）。

Trade-off：非破坏性（保留原 Task，只是标记）比直接删除更安全，但意味着"已转换"的 Task 会继续占着 Tasks 表的一行，需要 UI 上明确区分展示（不能让它看起来像还是个待办）。

Migration impact：全新增，无迁移。

Acceptance criteria：ADR 先写完、review 过，再动代码；新 Note 正确携带 Task 的标题/notes；源 Task 标记为终态且不再出现在任何 Due/Overall 视图里（这也是第 1 节那个 `_isNonTerminal_` 缺口需要先修的另一个理由）。

**ADR needed：是——这是 Carson 明确要求的，先 ADR，不直接写代码。**

立即可实现？否。

### 5.3 Project → Task — Already Exists，不需要改动

上次审计已确认资格校验、幂等性都完整；`decision_owner` fallback 到 `chat_id` 是既有、已经被代码自己注释过的技术债，不在本轮处理范围。

### 5.4 Project → Workflow/Template、Workflow → Task

上次审计已指出：这两个不是"转换"，是"模板抽象/实例化"（`41_BusinessRuleEngine.js`），机制上跟上面三个完全不同，不需要用同一套 contract 去套。现状已经支持，本轮不需要改动。

---

## 6. Create/Edit Performance

**分类：Domain Missing（缺量化数据）+ UI Missing（缺乐观更新这个具体修复）**

**关于"量化"这一点需要先说清楚一个限制**：上次审计能确认的是架构层面"时间流向哪几个阶段"（RPC 往返、Dedup 整列扫描、前端等待完整响应才反馈），但**真实的毫秒级数字，需要 Carson 在真实线上环境跑出来**——这份审计是基于静态代码读的，没有能力在 Carson 的实际 Google Sheets/Apps Script 环境里实际执行、计时。

**Recommendation（两步）：**

**第一步——加轻量计时埋点**：在 `UIBridge` 入口、Dedup 检查前后、Engine 写入前后、EventBus/Projection 前后、`UIBridge` 返回前，各打一个 `Logger.log` 时间戳。这样 Carson 跑几次真实 Create 就能拿到每一段真实耗时，确认（或修正）三个已识别原因里到底哪个占大头。

**第二步——实现乐观 UI**：这是唯一完全在前端可控、不碰 Idempotency/Event/Projection 的修复。点 Save 后立刻用一个临时对象把新任务加进列表、清空表单、把焦点移回标题输入框；服务器真实响应回来后用真实对象替换临时对象；如果失败，移除临时对象并提示错误。**这也直接回应了原始六项审计第 3 项里"用户按 Save → UI 尽快反馈成功 → 自动准备下一条输入"这条要求**——不需要另外再做什么。

**Trade-off：** 明确不做"Quick Add"绕过路径（已经确认过不要）意味着后端延迟下限（RPC + Dedup 扫描）不会变——乐观 UI 只是让"感觉起来"快，不减少服务器真实工作量。如果 Tasks 表随着时间累积得非常大，Dedup 扫描的成本会继续线性增长，那会是一个独立的、未来的架构问题（比如维护一个 identity→行号的旁路索引），不属于这一轮。

**Migration impact：** 计时埋点——无（`Logger.log` 不影响数据）。乐观 UI——无（纯前端，不改 schema/后端）。

**Acceptance criteria：** 计时日志存在，且 Carson 至少真实跑过一次拿到过真实数字；乐观 UI 让新 Task/Project 在点击 Save 后立刻出现在列表里、表单立刻清空；服务器真实响应到达后用真实数据覆盖；失败时干净回滚并提示；能证明 Idempotency/Event/Projection/Metadata 这几条后端路径完全没有被改动（同样的函数、同样的调用顺序）。

**ADR needed：否**（性能实现方式，不是架构决定，只要不碰 Idempotency）。

**立即可实现？** 计时埋点和乐观 UI 都可以立即做。真实量化数字需要 Carson 自己跑，不是我能从静态代码产出的。

---

## 7. Enter / Textarea 行为

**分类：基本 Already Exists（Notes 输入框已经完全正确）+ 小范围 UI Missing（其它地方还没接上，但不是 bug）**

**Recommendation：** 按输入类型分开定规则，而不是想找一条通用规则套所有输入框——**Textarea（多行）**：Enter = 换行（现状已经是这样，因为整份文件里没有 `<form>`）；Ctrl/Cmd+Enter = Save（目前只有 Notes 输入框接了，需要照抄到 `taskCreateNotes`/`projectCreateDescription`/两个内联 Edit 表单的多行字段上）。**普通单行 input（比如 title）**：Enter = Save 可以直接接受，这样单行字段可以用键盘快速连续录入。

**顺带指出一个连接点**：如果 Carson 实际体验到的是"打完一行 → Enter → 保存 → 自动出现下一行"，这其实不是 Enter/textarea 的问题，而是第 6 项乐观 UI 里"保存后自动把焦点移回标题框"这个行为——两件事现在被分开列成第 5 项和第 7 项，但落地的时候是同一个修复,不需要重复做两次。

**Trade-off：** 无明显代价，风险很低的一致性改动。

**Migration impact：** 无。

**Acceptance criteria：** 所有多行输入框都接上 Ctrl/Cmd+Enter=Save，普通 Enter 永远只换行；所有 Create/Edit 的单行标题类输入框接上 Enter=触发 Save。

**ADR needed：否。**

**立即可实现？是。**

---

## 8. Project Deadline Contract 依赖

**分类：Blocked——这本身就是前面好几项的阻塞源，不是一个新能力。**

**Recommendation：** 继续保持完全独立,不因为 Overall Dashboard 或 Conversion Matrix 想要这个能力就推着它抄近路。实际需要的下一步没有变过：Carson 需要对已有的 Identity Impact Review 给出的 Model C（schema 形状）+ Model B（identity：只有 due_date 算）做最终批准或者修改意见。

**Trade-off：** 继续卡住意味着 Overall/Conversion 都会带着一个明确、可见的"Project 暂不参与"缺口上线,而不是用一个凑出来的临时方案糊弄过去——这跟这个项目一直以来"schema/identity 相关的决定宁可慢也要对"的取向一致。

**Migration impact：** 批准前不适用；一旦批准，此前的 Schema Impact Audit 已经把迁移风险评估为低（新增可空列，append-only 惯例）。

**Acceptance criteria：** Carson 的明确批准（或修改意见）先记录进 `00_Architecture_Review.md`/`00_ADR.js`，然后才能做以下任何一件事：Project schema 加日期字段、Task→Project 转换加日期映射、Overall Dashboard 加 Project Due View。

**ADR needed：** 草案已经写好了（Review #4 + Identity Impact Review），缺的是批准，不是缺文档。

**立即可实现？否——按设计就应该继续等，不应该被绕过。**

---

## 建议的执行顺序（照搬 Carson 提出的 Phase 划分，未改动）

```
Phase A — Architecture / Contract
├─ OS / source_domain Contract（本文档第 1 项）
├─ Overall Dashboard Contract（第 2 项）
├─ Project Deadline Contract（第 8 项，独立线程，继续等批准）
├─ Conversion Matrix / no-silent-loss rule（第 5 项）
└─ Note Update Contract（第 4 项）
        ↓
Phase B — UI
├─ Unified Create/Edit（第 3 项）
├─ OS selector
├─ Overall Task Dashboard（Task-only）
├─ Note Edit
├─ Done/Cancel
└─ Sort/Filter
        ↓
Phase C — Performance（第 6 项：先埋点量化，再乐观 UI）
        ↓
Phase D — Conversion（Task→Note 需要先有 ADR；Task→Project 加告警/BLOCKED；Project→Task 不动）
        ↓
Phase E — Drag Ordering（等 Track 3 的 ADR 被批准之后）
```

Project Deadline Contract 和 Drag Ordering ADR 继续各自独立，不因为 UI 想要而提前替 Domain 做决定。
