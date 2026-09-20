# _setPlainTextFormatForNewColumns_ Bug Fix —— 真实环境清理 + 重测协议

**2026-09-20。跟上一份 Verification Plan 一样：我这边没有任何方式访问真实 GAS/Spreadsheet，下面 Phase 0 和 Phase 3 全部是协议，一次都没有执行。Phase 1（helper 修复）和 Phase 2（调用面审查）已经在代码层面 + Node.js 模拟环境完成，详情见 `00_ADR.js` 本次追记和 `00_Project_State.js`「五十四」，这份文档只覆盖需要你在真实环境做的两段。**

---

## Phase 0 — 清理本轮测试数据（先做，不要跳过）

### 已知的 4 条测试记录（来自你贴的真实执行日志）

| # | 类型 | 标题 | chat_id | ID（如日志里有） | 是否损坏 due 字段 |
|---|---|---|---|---|---|
| 1 | Task | `验收测试-TaskToProject-仅due_date` | `accept_test_ttpb_1789838098288` | `TSK-20260920-8506E1D0` | 是（due_date） |
| 1 | Project | `验收测试-TaskToProject-仅due_date` | 同上 | `PRJ-20260920-DE2DA964` | 是（due_date） |
| 2 | Task | `验收测试-TaskToProject-date+time` | `accept_test_ttpb_1789838107475` | `TSK-20260920-C9E2D8C1` | 是（due_date+due_time） |
| 2 | Project | `验收测试-TaskToProject-date+time` | 同上 | `PRJ-20260920-E2EA0B11` | 是（due_date+due_time） |
| 3 | Task | `验收测试-TaskToProject-无日期` | `accept_test_ttpb_*`（日志未打印具体值） | 未知 | 否（无 due 字段，不损坏，仅是测试数据） |
| 3 | Project | `验收测试-TaskToProject-无日期` | 同上 | 未知 | 否 |
| 4 | Project | `验收测试-ProjectToTask-反向不映射` | `accept_test_ttpb_*`（日志未打印具体值） | 未知 | 是（due_date+due_time，创建时直接带的，不是转换产生的） |
| 4 | Task（转换产物） | `验收测试-ProjectToTask-反向不映射` | 同上 | 未知 | 否（测试本身就是确认没有映射 due 字段） |

第 3、4 条我这边没有它们的具体 ID/chat_id（日志里这两项显示 PASS，没有打印详情）——下面第一步的"列候选"脚本会把它们都找出来，不需要你自己猜。

### 0.1 列出候选（只读，不删除任何东西）

```js
function _cleanup_0_1_list_candidates() {
  var chatId_prefix = 'accept_test_ttpb_';
  var ss = SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID'));

  ['Projects', 'Tasks'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var chatIdCol = header.indexOf('chat_id');
    var titleCol = header.indexOf('title');
    var idCol = header.indexOf(sheetName === 'Projects' ? 'project_id' : 'task_id');

    Logger.log('===== ' + sheetName + ' 候选（chat_id 以 "' + chatId_prefix + '" 开头） =====');
    for (var r = 2; r <= lastRow; r++) {
      var row = sheet.getRange(r, 1, 1, lastCol).getValues()[0];
      var chatId = String(row[chatIdCol]);
      if (chatId.indexOf(chatId_prefix) === 0) {
        Logger.log('行' + r + ': id=' + row[idCol] + ' title=' + row[titleCol] +
          ' chat_id=' + chatId + ' due_date=' + JSON.stringify(row[header.indexOf('due_date')] !== undefined ? row[header.indexOf('due_date')] : 'N/A') +
          (sheetName === 'Projects' ? ' due_time=' + JSON.stringify(row[header.indexOf('due_time')]) : ''));
      }
    }
  });
}
```

- **验证目标**：把两张表里所有 chat_id 以 `accept_test_ttpb_` 开头的行完整列出来，人工核对是不是这次测试产生的（题目/字段都对得上上面表格）。
- **操作步骤**：运行，把输出完整看一遍。**预期正好是 8 行左右**（Projects 4 行 + Tasks 4 行，如果多出来别的行、或者哪一行的标题不是"验收测试-..."开头，先停下来，不要往下删——那可能是别的时间跑的测试遗留数据，或者巧合命中了真实数据，需要另外单独核对，不要归到这批一起处理）。
- **是否修改真实数据**：不会，纯读取。
- **验证证据**：完整输出文本。

### 0.2 逐条核对（人工步骤，不是代码）

对着 0.1 的输出和上面的表格，逐行确认标题、chat_id、id 三者互相对得上，尤其是第 3、4 条你之前没见过具体 ID 的——如果标题不是"验收测试-TaskToProject-..."或"验收测试-ProjectToTask-..."开头，**不要**当成这批的候选。

### 0.3 删除已确认的行（只删你在 0.2 里逐条确认过的）

安全起见，建议直接在 Google Sheets 界面里手动删除这几行（选中整行 → 右键 → 删除行），而不是写一个"按 chat_id 前缀自动删"的脚本——手动删除每一步都能亲眼看到删的是哪一行，出错的代价最小。删除顺序建议先删 Projects 再删 Tasks（没有强制先后要求，只是习惯上先删"下游"）。

- **是否修改真实数据**：会——这是这次任务里第二个"设计上就会改真实数据"的步骤（第一个是上次的 migration 本身）。只删 0.2 里逐条确认过的行，不做模糊批量删除。
- **清理前后记录**：删除前截一次图（或复制一次 0.1 的完整输出），删除后再跑一次 0.1（这时候应该没有任何候选行输出了），两次的对比就是这一步的证据。

---

## Phase 3 — 真实环境重测（Phase 0 清理完之后再做）

### 3.1 Migration 前后 schema 核对 + 连续两次幂等

跟上一份协议的 1.2/1.3/1.5 完全一样，重新跑一遍，重点看这次修复后 `_setPlainTextFormatForNewColumns_` 的效果——但**这一步本身不会重新新增列**（Projects 已经有这三列了，`_addColumnsIfMissing_` 会跳过），主要是确认：

```js
function _retest_3_1_migration_again() {
  migrateSchemaProjectDeadline(); // 现在跑的是修复后的版本
  var sheet = SpreadsheetApp.openById(SecureConfig.getKey('SPREADSHEET_ID')).getSheetByName('Projects');
  Logger.log('当前 Projects lastRow: ' + sheet.getLastRow() + '  maxRows: ' + sheet.getMaxRows());
  Logger.log('Sheet 内容跟迁移前应该完全一致（没有新增列，只是重新设置了格式范围）');
}
```

- **预期结果**：不报错；`lastRow`/`maxRows` 输出的数字合理（`maxRows` 应该明显大于 `lastRow`，这正是修复要用到的那部分余量）；跑完之后手动检查一下 Projects 表格里现有数据没有任何变化（这一步不改数据，只改格式元数据）。

### 3.2 新建测试 Project，真实验证纯文本格式生效

这是这次真正要验证的核心——用**新的**隔离测试数据（跟 Phase 0 清理掉的那批完全区分开，用今天的新时间戳）：

```js
function _retest_3_2_create_after_fix() {
  var chatId = 'retest_fix_' + new Date().getTime();

  var p1 = ProjectEngine.createProject('[RETEST-FIX] 仅date-' + new Date().getTime(), { due_date: '2027-03-15' }, chatId);
  Logger.log('创建结果(内存): ' + JSON.stringify(p1));
  var p1_read = ProjectQueryEngine.getProject(p1.project_id, chatId);
  Logger.log('read-back: ' + JSON.stringify(p1_read));
  Logger.log('due_date 类型检查——typeof: ' + typeof p1_read.due_date + '  (期望 string，不是 object)');
  Logger.log('due_date 是否等于原始字符串: ' + (p1_read.due_date === '2027-03-15') + '  (期望 true)');

  var p2 = ProjectEngine.createProject('[RETEST-FIX] date+time-' + new Date().getTime(), { due_date: '2027-03-15', due_time: '14:30' }, chatId);
  var p2_read = ProjectQueryEngine.getProject(p2.project_id, chatId);
  Logger.log('read-back: ' + JSON.stringify(p2_read));
  Logger.log('due_time typeof: ' + typeof p2_read.due_time + '  (期望 string)');
  Logger.log('due_time 是否等于原始字符串: ' + (p2_read.due_time === '14:30') + '  (期望 true)');
  Logger.log('due_datetime 是否正确派生: ' + (p2_read.due_datetime === '2027-03-15T14:30:00') + '  (期望 true)');

  Logger.log('=== 本次测试 ID，供事后清理 ===');
  Logger.log(p1.project_id + ', ' + p2.project_id);
}
```

- **验证目标**：这就是上次真实失败的两个场景（仅 due_date、due_date+due_time），修复之后重新在真实环境跑一次。
- **预期结果**：全部 `typeof ... === 'string'`、值跟原始输入逐字相同、`due_datetime` 派生正确——**如果这里还是失败（typeof 是 'object' 或值变成了 Date 字符串形状），说明修复在真实环境没有生效，立即 HARD STOP，把完整输出报给我**，不要往下继续 3.3 之后的步骤。
- **是否修改真实数据**：不会，只创建 `[RETEST-FIX]` 前缀的隔离数据。

### 3.3 更新 / 清除 deadline，Identity 验证

用 3.2 建的 `p2`，跟上一份协议 Phase 2 里 2.3/2.4/2.5 完全一样的逻辑重新跑一遍（改 due_date、同一天改 due_time、清除），这次要额外确认每一步 read-back 的 `typeof due_date`/`typeof due_time` 都是 `string`：

```js
function _retest_3_3_update_and_identity(projectId, chatId) {
  var before = ProjectQueryEngine.getProject(projectId, chatId);
  var updated = ProjectEngine.updateProject(projectId, { due_time: '20:00' }, chatId);
  var after = ProjectQueryEngine.getProject(projectId, chatId);
  Logger.log('更新前 due_time: ' + JSON.stringify(before.due_time) + '  类型: ' + typeof before.due_time);
  Logger.log('更新后 due_time: ' + JSON.stringify(after.due_time) + '  类型: ' + typeof after.due_time + '  (期望都是 string)');
  Logger.log('due_datetime 重算: ' + after.due_datetime);
  Logger.log('identity 是否变化: ' + (after.identity !== before.identity) + '  (期望 true，Identity Model B)');
}
```
（把 3.2 里 `p2.project_id` 和 `chatId` 传进来跑。）

### 3.4 Task→Project 重跑

```js
function _retest_3_4_conversion() {
  var chatId = 'retest_fix_conv_' + new Date().getTime();
  var t = TaskEngine.createTask('[RETEST-FIX] 转换测试', { due_date: '2027-04-01', due_time: '10:00' }, chatId);
  var c = ConversionEngine.convertTaskToProject(t.task_id, {}, chatId);
  var reread = ProjectQueryEngine.getProject(c.project.project_id, chatId);
  Logger.log('转换后 read-back: ' + JSON.stringify(reread));
  Logger.log('due_date/due_time 类型: ' + typeof reread.due_date + ' / ' + typeof reread.due_time + '  (期望都是 string)');
}
```

### 3.5 重跑既有 Gate（真实环境）

```
runTaskToProjectBlockedGate()
```
这次应该**全部 4 项 PASS**（上次失败的两项就是这个 bug）。同时按上一份协议 Phase 4 的表格，重跑 `runTaskToProjectPrecheckGate()` 和 `testBidirectionalConversion_()`，确认没有引入新的回归。

### 3.6 清理这次的重测数据

同 Phase 0 的方式，跑完确认结果后，手动清理 `[RETEST-FIX]`/`retest_fix_*` 前缀的测试数据。

---

## 如果 3.2 或 3.5 在真实环境还是失败

立即停下来，把完整 read-back 输出（尤其是 `typeof` 那几行）发给我——这意味着 `getMaxRows()` 在你真实 Projects 表上的实际数值可能跟预期不一样（比如这张表被手动缩小过物理网格），需要另外诊断，不是这份协议能预先覆盖的场景，不要自己猜原因继续往下跑。

---

## 完成后

按 `00_Project_State.js`「五十四」结尾的要求，把 Phase 0/3 的真实结果补一条新记录（建议编号「五十五」，「五十三」留给你之前那次 Real GAS Verification Plan 的结果，不要复用同一个编号）。
