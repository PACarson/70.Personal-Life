# Project Deadline Contract（ADR-2026-09-18-031）—— Real GAS Verification Plan

**2026-09-19。范围：本文件只是验证协议本身。我这边没有任何方式访问 Carson 的真实 Google Apps Script 项目或真实 Google Spreadsheet——没有已连接的 Google Sheets/Apps Script 工具，也没有任何能代替你在真实环境点"运行"的手段。下面 Phase 1-5 的每一项，状态都是 `LIVE TEST PENDING`：协议已经设计好、代码已经核对过，但一次都没有在你的真实环境跑过。这不是"看起来应该没问题"，是"完全没跑"，请按这份清单自己在 Apps Script 编辑器里逐项执行，不要读到"预期结果"就当成已经验证。**

---

## Phase 0 — 核对当前实现（已完成，基于当前 repo 副本重新读取，非旧分析）

以下签名/名称是刚才重新读取当前文件确认的，不是沿用上一轮的记忆：

| 项目 | 确认结果 |
|---|---|
| Projects Sheet 真实名称 | `'Projects'`（`LifeProjectConfig.PROJECTS_SHEET_NAME`，`27_ProjectEngine.js:41` 附近） |
| 迁移函数 | `migrateSchemaProjectDeadline()`，`11_ProjectionRebuilder.js` |
| Identity 函数 | `IdentityEngine.generateProjectIdentity(chatId, title, parentProjectId, dueValue)`——4 参数，`dueValue` 缺省安全 |
| due 值解析 | `IdentityEngine.resolveIdentityDueValue(obj)` —— 取 `obj.due_datetime \|\| obj.due_date \|\| ''` |
| Identity-affecting fields | `LifeProjectConfig.IDENTITY_AFFECTING_FIELDS` = `['title','parent_project_id','due_date','due_time']` |
| 可更新字段 | `LifeProjectConfig.UPDATABLE_FIELDS` 含 `'due_date','due_time'`（不含 `due_datetime`，派生字段） |
| 创建入口 | `ProjectEngine.createProject(title, meta, chatId)` → 内部转发 `IdempotencyManager.createProjectIfNotExists` |
| 更新入口 | `ProjectEngine.updateProject(projectId, changes, chatId)` |
| 读取入口 | `ProjectQueryEngine.getProject(projectId, chatId)` / `getProjects(filters, chatId)` |
| 正向转换入口 | `ConversionEngine.convertTaskToProject(taskId, projectMeta, chatId)` |
| 反向转换入口（**未改动，未映射 due 字段**） | `ConversionEngine.convertProjectToTask(projectId, taskMeta, chatId)` |
| 本 ADR 专属测试入口 | `runTaskToProjectBlockedGate()`（`55_Tests_TaskToProjectBlocked.js`，文件名/函数名保留，内容已改写为验证成功转换） |
| 相关既有回归测试入口 | `runTaskToProjectPrecheckGate()`（Known Limitation 8）、`testBidirectionalConversion_()`（`36_Tests_Sprint3Acceptance.js`，也可用 `runSprint3AcceptanceGate()` 但那会连带跑 Note/BusinessRule/Reminder 无关测试） |
| Dashboard 只读展示位 | `12_TaskQueryEngine.js` 的 `getTaskDashboard().project_due_view`——**本次 ADR 未改**，仍是硬编码 `BLOCKED_PENDING_PROJECT_DEADLINE_CONTRACT` 文案 |
| Project 创建/编辑表单 | `ui_index.html` **没有** due_date/due_time 输入元素——已知、本次不新增 |

核对结论：没有发现代码跟 ADR-031 实质冲突，也没有出现新的未决业务决策。唯一的开放项（UI 缺输入表单）是已知项，不是本轮新发现。

---

## Phase 1 — Schema / Migration Gate

### 1.1 确认 Sheet 名称

- **验证目标**：确认 Projects 的真实 Sheet 名称是 `Projects`，不是 `LIFE_PROJECTS` 或别的名字。
- **实际执行入口**：Apps Script 编辑器，临时函数或直接在执行记录里跑：
  ```js
  function _verify_1_1() {
    Logger.log(LifeProjectConfig.PROJECTS_SHEET_NAME);
    Logger.log(SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID')).getSheetByName('Projects') ? 'FOUND' : 'NOT FOUND');
  }
  ```
- **前置条件**：`01_SecureConfig.gs` 已配置好 `SPREADSHEET_ID`（应该早就是这样，不是本次新增前置条件）。
- **操作步骤**：粘贴上面函数，选中它，点运行，看执行记录（View → Logs 或 Execution log）。
- **预期结果**：第一行输出 `Projects`；第二行输出 `FOUND`。
- **验证证据**：执行记录截图/文本粘贴。
- **是否修改真实数据**：不会，纯读取。
- **清理/回滚**：不需要。

### 1.2 迁移前基线快照（先做，别跳过）

- **验证目标**：在跑迁移之前，先记录当前列结构和几行真实数据，作为"之后对比"的基线，也是防止误判"数据被清空"的唯一办法。
- **实际执行入口**：
  ```js
  function _verify_1_2_snapshot_before() {
    var sheet = SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID')).getSheetByName('Projects');
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    Logger.log('行数(含表头): ' + lastRow + '  列数: ' + lastCol);
    Logger.log('表头: ' + JSON.stringify(sheet.getRange(1, 1, 1, lastCol).getValues()[0]));
    // 抽样：第 2、3 行（如果存在）——不要抽真正重要的 Project，随便挑最前面两条
    for (var r = 2; r <= Math.min(3, lastRow); r++) {
      Logger.log('第' + r + '行: ' + JSON.stringify(sheet.getRange(r, 1, 1, lastCol).getValues()[0]));
    }
  }
  ```
- **前置条件**：无。
- **操作步骤**：运行，把输出完整保存下来（复制到别处，不要只留在执行记录里，执行记录会过期）。
- **预期结果**：表头里目前**没有** `due_date`/`due_time`/`due_datetime`（如果已经有了，说明这三列已经存在过，下面 1.3 的"迁移是否新增列"这条判断要跟着调整——先看到这个结果再继续，不要假设）。
- **验证证据**：保存下来的表头 + 抽样行文本。
- **是否修改真实数据**：不会。
- **清理/回滚**：不需要（这本身就是留档）。

### 1.3 运行迁移，read-back 确认

- **验证目标**：`migrateSchemaProjectDeadline()` 真实执行后，三列存在、无重复、格式正确、旧数据没被清空/覆盖。
- **实际执行入口**：`migrateSchemaProjectDeadline()`（`11_ProjectionRebuilder.gs`，Apps Script 编辑器里选中直接运行）。
- **前置条件**：已完成 1.2 的基线快照。
- **操作步骤**：
  1. 运行 `migrateSchemaProjectDeadline()`。
  2. 运行下面的 read-back：
     ```js
     function _verify_1_3_after() {
       var sheet = SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID')).getSheetByName('Projects');
       var lastRow = sheet.getLastRow();
       var lastCol = sheet.getLastColumn();
       var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
       Logger.log('表头: ' + JSON.stringify(header));
       Logger.log('due_date 出现次数: ' + header.filter(function(h){return h==='due_date';}).length);
       Logger.log('due_time 出现次数: ' + header.filter(function(h){return h==='due_time';}).length);
       Logger.log('due_datetime 出现次数: ' + header.filter(function(h){return h==='due_datetime';}).length);
       for (var r = 2; r <= Math.min(3, lastRow); r++) {
         Logger.log('第' + r + '行(迁移后): ' + JSON.stringify(sheet.getRange(r, 1, 1, lastCol).getValues()[0]));
       }
     }
     ```
  3. 把第 2/3 行迁移后的内容跟 1.2 的基线逐字段比较（除了新增的三列，其它字段应该完全一样）。
- **预期结果**：三列各出现 1 次（不是 0 次也不是 2 次）；旧行除新增三列外其它字段不变；新增列上旧行的值是空字符串。
- **验证证据**：本步骤的完整输出 + 跟 1.2 的对比结果。
- **是否修改真实数据**：**会**——会给 Projects 表结构性追加三列。这是本次唯一一个"设计上就会改真实 Sheet 结构"的步骤，属于 ADR-031 本身要求的动作，不是意外。追加列本身不删除、不覆盖任何既有单元格的值。
- **清理/回滚**：如果需要撤销，手动删除这三列（Google Sheets 里选中列右键删除）；没有代码层面的自动回滚函数，这是结构性变更，回滚需要手动操作，操作前请再截一次图确认要删的是新加的三列而不是别的列。

### 1.4 纯文本格式确认

- **验证目标**：确认 `_setPlainTextFormatForNewColumns_` 真的把三列设成了纯文本，不会被 Sheets 自动识别成 Date/Time 类型。
- **实际执行入口**：在 Google Sheets 界面（不是代码）里，选中 due_date 列的任意有值单元格（或先手动填一个 `2026-12-31` 测试），看单元格格式菜单显示的是不是"纯文本"/"Plain text"。
- **前置条件**：已完成 1.3。
- **操作步骤**：Sheets 菜单 → 格式 → 数字 → 查看当前选中区域显示的格式；或者直接在 due_date 列任意行手打 `2026-12-31`，回车后看它是左对齐（文本特征）还是右对齐（数字/日期特征）。
- **预期结果**：左对齐，格式菜单显示纯文本。
- **验证证据**：截图。
- **是否修改真实数据**：如果手动填测试值来验证，会修改那一格——建议在 Phase 2 建的隔离测试 Project 行上做这个检查，不要在真实业务 Project 行上手打测试值。
- **清理/回滚**：如果在真实行上测试了，测试完手动清空该格。

### 1.5 幂等性

- **验证目标**：连续跑两次 `migrateSchemaProjectDeadline()`，第二次不产生额外变化。
- **实际执行入口**：同 1.3 的 `migrateSchemaProjectDeadline()`。
- **前置条件**：已完成 1.3（第一次已经跑过）。
- **操作步骤**：再跑一次 `migrateSchemaProjectDeadline()`，然后重新跑一次 1.3 的 read-back 函数，跟第一次迁移后的表头/抽样行逐字比较。
- **预期结果**：完全一致，没有出现第二组重复列，没有任何行的值发生变化。
- **验证证据**：两次 read-back 输出的对比。
- **是否修改真实数据**：设计上不会（`_addColumnsIfMissing_` 只在列缺失时才追加），但仍建议实际跑一次确认，不要只信代码逻辑。
- **清理/回滚**：不适用。

### 1.6 执行日志留档

- **验证目标**：把 1.1-1.5 的完整执行记录留档，供 Phase 6 引用。
- **操作步骤**：把 Apps Script 执行记录（Executions 面板）里这几次运行的日志导出或截图保存。
- **验证证据**：即上述留档本身。
- **是否修改真实数据**：不会。

---

## Phase 2 — Project Deadline CRUD / Identity Gate（隔离测试数据）

**统一约定**：所有测试 Project 标题都带 `[TEST-ADR031]` 前缀 + 时间戳，chat_id 用 `'live_verify_' + new Date().getTime()`，跟真实业务数据完全隔离，方便事后筛选清理。**全程不要对任何真实业务 Project 做写入/清除/更新操作。**

一个可以直接复制运行、覆盖 2.1-2.7 的脚本骨架（每个 `Logger.log` 的输出就是需要记录的"执行结果/read-back/identity 前后值"）：

```js
function _verify_phase2_all() {
  var chatId = 'live_verify_' + new Date().getTime();
  var results = {};

  // 2.1 仅 due_date
  var p1 = ProjectEngine.createProject('[TEST-ADR031] 仅date-' + new Date().getTime(), { due_date: '2026-12-31' }, chatId);
  Logger.log('2.1 创建结果: ' + JSON.stringify(p1));
  var p1_read = ProjectQueryEngine.getProject(p1.project_id, chatId);
  Logger.log('2.1 read-back: ' + JSON.stringify(p1_read));

  // 2.2 due_date + due_time
  var p2 = ProjectEngine.createProject('[TEST-ADR031] date+time-' + new Date().getTime(), { due_date: '2026-12-31', due_time: '18:00' }, chatId);
  Logger.log('2.2 创建结果: ' + JSON.stringify(p2));
  var p2_read = ProjectQueryEngine.getProject(p2.project_id, chatId);
  Logger.log('2.2 read-back: ' + JSON.stringify(p2_read));
  Logger.log('2.2 identity(创建时): ' + p2.identity);

  // 2.3 更新 due_date
  var p2_upd_date = ProjectEngine.updateProject(p2.project_id, { due_date: '2027-01-15' }, chatId);
  Logger.log('2.3 更新结果: ' + JSON.stringify(p2_upd_date));
  var p2_read_after_date = ProjectQueryEngine.getProject(p2.project_id, chatId);
  Logger.log('2.3 read-back: ' + JSON.stringify(p2_read_after_date));
  Logger.log('2.3 identity 是否变化: ' + (p2_read_after_date.identity !== p2.identity) + '  (期望 true)');

  // 2.4 同一天只改 due_time —— ADR-031 Identity Model B 的核心断言
  var beforeTimeChange = p2_read_after_date.identity;
  var p2_upd_time = ProjectEngine.updateProject(p2.project_id, { due_time: '20:00' }, chatId);
  Logger.log('2.4 更新结果: ' + JSON.stringify(p2_upd_time));
  var p2_read_after_time = ProjectQueryEngine.getProject(p2.project_id, chatId);
  Logger.log('2.4 read-back: ' + JSON.stringify(p2_read_after_time));
  Logger.log('2.4 due_datetime 是否正确重算: ' + p2_read_after_time.due_datetime + '  (期望 2027-01-15T20:00:00)');
  Logger.log('2.4 identity 是否变化: ' + (p2_read_after_time.identity !== beforeTimeChange) +
    '  (期望 true —— 这是 resolveIdentityDueValue() 用 due_datetime||due_date 的直接后果，' +
    '不是"Project 只看 due_date"，如果这里是 false，跟 ADR-031 不符，请 HARD STOP 并报告)');

  // 2.5 清除 deadline
  var p2_cleared = ProjectEngine.updateProject(p2.project_id, { due_date: '', due_time: '' }, chatId);
  Logger.log('2.5 清除结果: ' + JSON.stringify(p2_cleared));
  var p2_read_cleared = ProjectQueryEngine.getProject(p2.project_id, chatId);
  Logger.log('2.5 read-back: ' + JSON.stringify(p2_read_cleared) +
    '  (确认 due_date/due_time/due_datetime 都变回空字符串)');

  // 2.6 非法输入 —— 当前实现不做格式校验，预期是"原样存入"，不是报错；
  //     这里是为了确认这一点，不是假设它会拒绝
  var p3 = ProjectEngine.createProject('[TEST-ADR031] 非法输入-' + new Date().getTime(), { due_date: 'not-a-date', due_time: '25:99' }, chatId);
  Logger.log('2.6 非法输入创建结果: ' + JSON.stringify(p3) +
    '  (记录实际行为即可：是原样存入、静默处理、还是抛异常——如果抛异常，本项标 LIVE VERIFIED 但备注"拒绝非法输入"；如果原样存入，标 LIVE VERIFIED 但备注"当前不做格式校验，跟 Task 现有行为是否一致需要另外确认，不在本次 ADR 范围内自行判断")');

  // 2.7 无 due_time 时 due_datetime 的 fallback
  var p4 = ProjectEngine.createProject('[TEST-ADR031] 仅date无time-' + new Date().getTime(), { due_date: '2026-11-01' }, chatId);
  Logger.log('2.7 due_datetime fallback: ' + JSON.stringify(p4.due_datetime) + '  (期望空字符串，不是自动补午夜)');

  // 2.9(a) identity 一致性：无关字段改动不应该改变 identity
  var p5 = ProjectEngine.createProject('[TEST-ADR031] identity稳定性-' + new Date().getTime(), { due_date: '2026-10-01', due_time: '09:00' }, chatId);
  var p5_upd = ProjectEngine.updateProject(p5.project_id, { description: '只改描述' }, chatId);
  var p5_read = ProjectQueryEngine.getProject(p5.project_id, chatId);
  Logger.log('2.9(a) 无关字段改动后 identity 是否不变: ' + (p5_read.identity === p5.identity) + '  (期望 true)');

  // 2.9(b) 无 deadline 的旧 Project identity 行为不变（向后兼容）
  var p6 = ProjectEngine.createProject('[TEST-ADR031] 无deadline旧行为-' + new Date().getTime(), {}, chatId);
  var p6_directIdentity = IdentityEngine.generateProjectIdentity(chatId, p6.title, '');
  Logger.log('2.9(b) 无 deadline Project 的 identity 跟 3 参数旧调用是否一致: ' + (p6.identity === p6_directIdentity) + '  (期望 true)');

  Logger.log('=== 全部测试 Project ID，供后续清理核对 ===');
  Logger.log([p1.project_id, p2.project_id, p3.project_id, p4.project_id, p5.project_id, p6.project_id].join(', '));
}
```

- **验证目标**：见脚本内每一段注释，对应 Carson 要求的 2.1-2.9 全部子项。
- **实际执行入口**：`_verify_phase2_all()`（临时函数，跑完可删）。
- **前置条件**：Phase 1 迁移已完成（Projects 表已有三列）。
- **操作步骤**：粘贴、运行、把完整 Logger 输出保存下来逐条核对"期望"括号里的内容。
- **预期结果**：见每行 `(期望 ...)` 注释，其中 **2.4 是本次最关键的单项断言**——同一天只改 due_time，identity 必须变化，这是 Identity Model B（Task-Parity）跟"简化版本"的分界线。
- **验证证据**：完整 Logger 输出文本 + 每项断言的实际 true/false 结果。
- **是否修改真实数据**：不会——全部操作只针对本次创建的 6 个 `[TEST-ADR031]` 前缀测试 Project，不触碰任何真实业务 Project。
- **清理状态**：跑完后记录下 6 个测试 `project_id`，如果不方便用代码删除 Sheet 行，至少手动在 Sheet 里筛选 `[TEST-ADR031]` 前缀，把这 6 行整行删除（**不要**删除任何不带这个前缀的行）；或者保留但在标题上标注"仅测试，可忽略"，两种方式都行，哪种更符合你日常清理习惯就用哪种，只要别跟真实数据混在一起就行。

---

## Phase 3 — Task → Project Conversion Gate（隔离测试数据）

```js
function _verify_phase3_all() {
  var chatId = 'live_verify_conv_' + new Date().getTime();

  // 3.1/3.2 仅 due_date 的 Task 转换
  var t1 = TaskEngine.createTask('[TEST-ADR031] 转换测试-仅date', { due_date: '2026-12-25' }, chatId);
  var c1 = ConversionEngine.convertTaskToProject(t1.task_id, {}, chatId);
  Logger.log('3.1 转换结果: ' + JSON.stringify(c1));
  Logger.log('3.1 read-back: ' + JSON.stringify(ProjectQueryEngine.getProject(c1.project.project_id, chatId)));

  // date+time
  var t2 = TaskEngine.createTask('[TEST-ADR031] 转换测试-date+time', { due_date: '2026-12-25', due_time: '08:30' }, chatId);
  var c2 = ConversionEngine.convertTaskToProject(t2.task_id, {}, chatId);
  Logger.log('3.2 转换结果: ' + JSON.stringify(c2));

  // 无日期回归
  var t3 = TaskEngine.createTask('[TEST-ADR031] 转换测试-无日期', {}, chatId);
  var c3 = ConversionEngine.convertTaskToProject(t3.task_id, {}, chatId);
  Logger.log('3.3(回归) 转换结果: ' + JSON.stringify(c3) + '  (期望成功，due_* 三个字段都是空字符串)');

  // 3.3/3.4 BLOCKED 场景改用"已转换过"触发（due_date 本身已经不会 BLOCKED 了，
  // 这是本 ADR 明确要验证的——用终态 Task 验证 BLOCKED 路径完好，跟 due_date 无关）
  var t4 = TaskEngine.createTask('[TEST-ADR031] 转换测试-终态Task', {}, chatId);
  TaskEngine.cancelTask(t4.task_id, chatId); // 假设有这个函数；若名字不同请对照 20_TaskEngine.js 调整
  var beforeBlockedAttempt_taskState = TaskQueryEngine.getTask(t4.task_id, chatId);
  var c4 = ConversionEngine.convertTaskToProject(t4.task_id, {}, chatId);
  Logger.log('3.4 终态Task转换结果(期望invalid_state): ' + JSON.stringify(c4));
  var afterBlockedAttempt_taskState = TaskQueryEngine.getTask(t4.task_id, chatId);
  Logger.log('3.4 源Task状态改动前后是否一致(期望true，即没被意外改动): ' +
    (beforeBlockedAttempt_taskState.status === afterBlockedAttempt_taskState.status));

  // 3.5 反向确认没有映射（明确禁止实现/测试反向映射，这里只是确认"没做"这件事本身）
  var p5 = ProjectEngine.createProject('[TEST-ADR031] 反向不映射-' + new Date().getTime(), { due_date: '2026-12-31', due_time: '09:00' }, chatId);
  var c5 = ConversionEngine.convertProjectToTask(p5.project_id, {}, chatId);
  Logger.log('3.5 反向转换结果: ' + JSON.stringify(c5));
  Logger.log('3.5 目标 Task 是否没有 due 字段(期望true): ' + (!c5.task.due_date && !c5.task.due_time));

  Logger.log('=== 本 Phase 全部测试 ID ===');
  Logger.log('Tasks: ' + [t1.task_id, t2.task_id, t3.task_id, t4.task_id].join(', '));
  Logger.log('Projects: ' + [c1.project.project_id, c2.project.project_id, c3.project.project_id, p5.project_id].join(', '));
}
```

- **验证目标**：正向映射（含/不含 due 字段）、BLOCKED 路径完好（终态 Task，不是 due_date 触发）、反向确认无映射。
- **实际执行入口**：`_verify_phase3_all()`（临时函数）。**`TaskEngine.cancelTask` 的确切函数名请先用 `20_TaskEngine.js` 的 Public API 核对一遍，不同名字会导致这一小段报错——这是我在这份计划里唯一不能 100% 保证准确的函数名，因为没有在这次改动范围内重新核对 TaskEngine 完整 Public API，其余全部函数名已核对。**
- **前置条件**：Phase 1 迁移完成。
- **预期结果**：见每行注释。
- **验证证据**：完整 Logger 输出。
- **是否修改真实数据**：不会，全部用 `[TEST-ADR031]` 前缀的隔离数据。
- **清理状态**：同 Phase 2，记录测试 ID，事后清理或标注。

---

## Phase 4 — Regression Gate（真实环境重跑既有 Gate）

| Gate | 入口 | 跟这次改动的关系 | 状态（Carson 填） |
|---|---|---|---|
| 本 ADR 专属测试 | `runTaskToProjectBlockedGate()` | 直接针对这次改动重写 | `[ ]` LIVE VERIFIED / LIVE TEST FAILED / BLOCKED / NOT TESTED |
| Known Limitation 8 既有测试 | `runTaskToProjectPrecheckGate()` | ConversionEngine 被这次改动碰过 | `[ ]` |
| 双向转换既有回归 | `testBidirectionalConversion_()`（单独调，不建议跑整个 `runSprint3AcceptanceGate()`，那个会顺带跑无关的 Note/BusinessRule/Reminder 测试） | TaskEngine/ProjectEngine/ConversionEngine 共享文件 | `[ ]` |
| Identity Scope Key 回归（可选，非必须） | `runIdentityScopeKeyRegressionGate()` | IdentityEngine 被改动，但测的是完全不同的 scopeKey 参数，不是 due 值——跑不跑都行，不是这次改动的直接验证对象 | `[ ]`（可标 NOT TESTED，理由：不相关） |
| Dashboard/Projection/Replay 专属回归 | **不存在**——这个代码库里没有单独的 Projection/Replay Gate 文件，Projection/Replay 正确性目前只通过上面几个 Gate 里的 read-back 断言间接验证 | — | 建议标 `NOT TESTED`，备注"无对应专属 Gate，覆盖依赖上面几项的 read-back" |

- **验证目标**：确认这次改动没有破坏任何既有行为。
- **实际执行入口**：见上表。
- **前置条件**：Phase 1-3 完成。
- **操作步骤**：逐个在 Apps Script 编辑器里运行，看 Logger 输出的 PASS/FAIL 汇总。
- **预期结果**：全部 PASS。
- **验证证据**：每个 Gate 的完整执行记录。
- **是否修改真实数据**：这几个 Gate 内部会创建自己的隔离测试数据（都带独立 `test_chat_...`/时间戳前缀，跟这次的 `[TEST-ADR031]` 前缀不冲突），不会碰真实业务数据——但仍建议实际观察一下，不要只信函数名字暗示的"应该是隔离的"。
- **清理/回滚**：各 Gate 内部一般会自行创建/遗留测试数据，跟 Phase 2/3 一样，事后可以按各自的测试前缀筛选清理。
- **重要提醒**：Node.js GAS-shim 跑过的结果（上一轮已完成）**不能替代**这里的真实环境重跑——这四行状态目前应该全部是空的，不能抄上一轮 Node 环境"23 项全部通过"的结论填在这里。

---

## Phase 5 — Dashboard / UI 验证边界

- **验证目标**：确认真实部署的 UI 跟这次的 repo 版本一致；确认 Dashboard/Project read path 能正确读取 deadline 字段（即使目前没有输入界面）。
- **实际执行入口**：
  1. 打开真实 Web App，进 Dashboard 面板，肉眼确认没有报错、`project_due_view` 那块文案跟之前一样能正常显示（本次没有改这段文案，预期完全没变化）。
  2. 打开真实 Apps Script 编辑器里的 `ui_index.html`，对照这次提交的版本，重点看第 300 行附近的 Notes/Tasks/Projects nav-item、以及 Project 相关的 JS 部分（这次改动没有碰 `ui_index.html`，预期真实环境跟 repo 版本在这些地方完全一致——如果不一致，说明真实环境本身已经跟 repo 有历史性偏差，跟这次 ADR 无关，按老办法记录成独立问题，不要当成这次改动引入的）。
  3. 如果 Phase 2 建了带 due_date 的测试 Project，去 Projects 面板看列表/详情里有没有任何地方**意外**展示或报错——预期是"完全没有任何 UI 元素提到 due_date"，因为 UI 目前没有读取/展示这个字段的代码，这是已知状态，不是 bug。
- **前置条件**：Phase 1-2 完成（需要有带 due_date 的测试 Project 才能做第 3 点）。
- **预期结果**：Dashboard 正常；`ui_index.html` 跟 repo 一致（或如实记录差异，不归因于本次 ADR）；Projects 面板不会因为新字段而报错或展示任何东西。
- **验证证据**：截图 + 对照结果文字记录。
- **是否修改真实数据**：不会，纯查看。
- **明确边界**：本 Phase **不新增** Project deadline 输入 UI；"没有输入入口"是已知状态，请标注为 `NOT TESTED`（原因：功能不存在，不是"BLOCKED"——BLOCKED 意味着本该测但测不了，这里是本来就没有这个功能可测）。

---

## Phase 6 — Evidence / Governance Closeout（Carson 执行完 Phase 1-5 后，填这个模板）

建议按下面结构更新 `00_Project_State.js`（新增一条"五十二"，追记形式，不改动已有内容）：

```
五十三、Project Deadline Contract —— Real GAS Verification（ADR-2026-09-18-031）
1. 验证日期：____________　真实执行环境：Carson 本人在真实 Apps Script 编辑器 + 真实 Spreadsheet
2. 实际执行的函数/测试入口：migrateSchemaProjectDeadline() / _verify_phase2_all() /
   _verify_phase3_all() / runTaskToProjectBlockedGate() / runTaskToProjectPrecheckGate() /
   testBidirectionalConversion_()（逐项填实际跑了哪些）
3. 每项结果及证据：（引用 Phase 1-5 各自保存的 Logger 输出/截图，或另存附件）
4. Schema migration 前后 read-back：（Phase 1.2 基线 vs 1.3 迁移后，逐字段对比结论）
5. CRUD/Identity/Conversion 实际结果：（Phase 2/3 每条 (期望...) 断言的实际 true/false）
6. Regression Gate 结果：（Phase 4 表格填好的四行）
7. 未覆盖项/风险/清理状态：ui_index.html 无输入表单（已知，未测）；
   Identity Scope Key 回归（可选未跑，说明原因）；Projection/Replay 无专属 Gate（已知边界）；
   测试数据清理状态（Phase 2/3 的 [TEST-ADR031] 前缀数据是否已清理）
8. STATIC 与 LIVE 区分：本条记录的全部是 LIVE VERIFIED 或 LIVE TEST FAILED——区别于
   上一轮 Node.js GAS-shim 的"STATIC VERIFIED + Node 环境 LIVE-EXECUTED（非真实环境）"
9. 新 Decision Gate：（如果 Phase 0-5 任何一步 HARD STOP 过，在这里记录；如果没有，写"无"）
```

---

## 如果任何一步发现代码跟 ADR-031 不一致、或出现新的业务判断

按 Carson 的执行纪律：立即停在那一步，不要继续往后跑，把具体差异（哪个函数、哪一行、实际输出 vs 预期输出）报给我，不要自己决定怎么改。这份计划本身没有替你做任何判断——所有"期望"都是基于当前 repo 代码逐字推导出来的，如果真实环境的结果跟"期望"不一致，那正是需要 HARD STOP 的信号，不是这份计划写错了就可以忽略。
