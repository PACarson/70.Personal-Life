/**
 * 11_ProjectionRebuilder.gs
 * Productivity OS v4.7 — Projection Rebuilder（从 Events 全量重建 Read Model
 * ／每日常规维护 TaskStatistics）
 *
 * 【2026-07-17 新增，ADR-2026-07-17-009，Carson 批准】新增
 * migrateSchemaReminderPolicy()（既有部署迁移入口，模式跟
 * migrateSchemaDueTime() 一致）——给 Tasks/ActiveTasks/ArchiveTasks 三张表
 * 新增 reminder_policy 一列。不需要新的纯文本格式修复函数，复用既有的
 * _setPlainTextFormatForNewColumns_()。
 *
 * 【V4.7 新增，Due Time Support，00_Architecture_Review.gs「七、
 * Review #3」，Carson 2026-07-13 批准】新增 migrateSchemaDueTime()（既有
 * 部署迁移入口，模式跟 migrateSchemaV4() 一致）与配套的
 * _setPlainTextFormatForNewColumns_()（修复 Finding DT-2：
 * _addColumnsIfMissing_ 本身不会给新增列设纯文本格式，due_time 这种
 * 'HH:mm' 形状的值会被 Google Sheets 自动类型识别成 Time 类型）。
 * rebuildTasksProjection() / rebuildActiveTasksProjection() 两处 identity
 * 重算改用 IdentityEngine.resolveIdentityDueValue(task)，不再直接读
 * task.due_date。
 *
 * 【V4.6 新增 recomputeStatisticsFromTasks_()】第五轮外部审计 HIGH RISK 1
 * + HIGH RISK 4：TaskStatistics 不再由 10_ProjectionEngine.gs 同步增量
 * 维护（那样既有并发下的 lost update 风险，又是为一张没有查询路径依赖的
 * 表支付的纯浪费 I/O）。新增本函数，从 Tasks 表（不是 Events）按 chat_id
 * 重新聚合，由 15_Setup.gs 的每日触发器调用，成本远低于本文件其余函数
 * 那种"全量重放 Events"的方式。完整架构论证见 00_ADR.gs
 * ADR-2026-07-06-005。rebuildStatisticsProjection()（从 Events 重放）
 * 保留作为灾难恢复工具，两者的定位区别见各自的函数头注释。
 *
 * 【V4.4 配套修复 HIGH RISK 3：Events 全表扫描风险】rebuildAllProjections()
 * 开始前新增一行日志，用 EventBus.getEventCount_()（轻量，只读行数）报一下
 * Events 表规模——本文件的 rebuild／verify／compare 系列函数全部是"人工手动
 * 触发的 Operations 层操作"，允许全量扫描 Events（这本来就是它们存在的
 * 意义：从 Write Model 重建 Read Model），风险点在于"Events 表大了以后
 * 这些操作可能跑很久甚至超时"，完整的风险说明和范围界定见
 * 02_EventBus.gs 的 getAllEvents() 文件头注释。
 *
 * 使用场景（仅以下情况才运行，正常用户路径绝不调用）：
 *  - 首次上线迁移
 *  - Read Model 损坏（手动改坏了 Sheet）
 *  - 排查数据一致性问题
 *  - 运行 verifyProjection() 发现 Read Model 与 Events 对不上
 *
 * 使用方法：
 *  1. 先运行 migrateSchemaV4()  — 只需执行一次，添加 V4 新列 + 建新表
 *  2. 再运行 rebuildAllProjections()  — 从 Events 全量重建全部 Read Model
 *  3. 用 verifyProjection() 校验结果
 *
 * 【V4 修复】删除了 rebuildInventoryProjection() / _markRemovedItemsConsumed_()——
 * 这两个函数引用不存在于本项目的 deriveInventory()（Inventory 逻辑本该在
 * 2026-07-03 物理拆分时随 21_InventoryModule.gs 一起留在 Core 项目，但当时
 * 被漏删，见 00_Project_State.gs"已知Bug"）。只要有人在本项目运行
 * rebuildAllProjections()，之前会直接 ReferenceError 崩掉。Inventory Read
 * Model 重建请在 Core 项目自己的 11_ProjectionRebuilder.gs 副本里做。
 *
 * 【V4 新增】rebuildStatisticsProjection() / rebuildTaskFiltersProjection()，
 * 对应 10_ProjectionEngine.gs 新增维护的 TaskStatistics / TaskFilters 两张表。
 *
 * 依赖：02_EventBus, 05_SheetUtils, 07_IdentityEngine, 20_TaskEngine
 */

// ============ Step 1：列迁移 + 建表 ============

/**
 * 一次性迁移：在 Tasks/ActiveTasks/ArchiveTasks 添加 V4 所需的新列
 * （description/tags），并确保 identity/archived 列存在（沿用 V3 迁移）。
 *
 * 安全：幂等，列已存在时跳过，不修改任何现有数据。
 * 运行时机：V4 上线前运行一次即可（新装机走 15_Setup.gs 的 setupSheets()
 * 就已经带这些列，不需要再跑这个；只有从 V3 或更早版本迁移的老部署需要）。
 */
function migrateSchemaV4() {
  Logger.log('=== migrateSchemaV4 ===');
  _addColumnsIfMissing_('Tasks',        ['identity', 'archived', 'description', 'tags']);
  _addColumnsIfMissing_('ActiveTasks',  ['identity', 'description', 'tags']);
  _addColumnsIfMissing_('ArchiveTasks', ['identity', 'archived_at', 'description', 'tags']);
  Logger.log('✅ V4 列迁移完成。TaskStatistics/TaskFilters 两张新表请跑 15_Setup.setupSheets() 建立。');
}

/**
 * 保留 V3 函数名作为向后兼容别名（老交接文档/记忆可能还提这个名字）。
 */
function migrateAddIdentityColumns() {
  migrateSchemaV4();
}

/**
 * 如果 Sheet 缺少指定列名，在最右侧追加。
 */
function _addColumnsIfMissing_(sheetName, columnNames) {
  var sheet;
  try {
    sheet = getSheet_(sheetName);
  } catch (e) {
    Logger.log('⚠️ Sheet 不存在，跳过: ' + sheetName);
    return;
  }

  var headerMap = getHeaderMap_(sheet);
  var lastCol   = sheet.getLastColumn();

  columnNames.forEach(function (col) {
    if (col in headerMap) {
      Logger.log('  [' + sheetName + '] 列 "' + col + '" 已存在，跳过');
      return;
    }
    lastCol++;
    sheet.getRange(1, lastCol).setValue(col);
    Logger.log('  [' + sheetName + '] 添加列 "' + col + '" 在第 ' + lastCol + ' 列');
  });
}

/**
 * Due Time Support（V4.7，00_Architecture_Review.gs「七、Review #3」，
 * Carson 2026-07-13 批准）——existing 部署迁移入口。跟 migrateSchemaV4()
 * 同一种"一次性、幂等、只加列不改数据"模式，额外多做一步
 * _setPlainTextFormatForNewColumns_（Finding DT-2 的修复：
 * _addColumnsIfMissing_ 本身不会给新增列设纯文本格式，due_time 这种
 * 'HH:mm' 形状的值会被 Google Sheets 自动类型识别成 Time 类型，静默
 * 改变存储形式——这里补上 15_Setup._ensureSheet_() 对全新建表已经在做的
 * 同一件事）。
 */
function migrateSchemaDueTime() {
  Logger.log('=== migrateSchemaDueTime ===');
  _addColumnsIfMissing_('Tasks',        ['due_time', 'due_datetime']);
  _addColumnsIfMissing_('ActiveTasks',  ['due_time', 'due_datetime']);
  _addColumnsIfMissing_('ArchiveTasks', ['due_time', 'due_datetime']);
  _setPlainTextFormatForNewColumns_('Tasks',        ['due_time', 'due_datetime']);
  _setPlainTextFormatForNewColumns_('ActiveTasks',  ['due_time', 'due_datetime']);
  _setPlainTextFormatForNewColumns_('ArchiveTasks', ['due_time', 'due_datetime']);
  Logger.log('✅ due_time/due_datetime 列迁移完成（含纯文本格式修复）。存量行 due_time/due_datetime 为空字符串，等价于需求方"只有 due_date 时 due_time 视为 null"。');
}

/**
 * 【2026-07-17 新增，ADR-2026-07-17-009，Carson 批准】给已经存在的部署
 * 新增 reminder_policy 一列，不需要跑完整的 setupSheets()。幂等——多次
 * 运行、列已存在时会跳过。运行方式：Apps Script 编辑器里选中这个函数，
 * 手动执行一次。跟 migrateSchemaDueTime 是同一个模式——只是"加列"，不是
 * "填数据"：存量任务的 reminder_policy 留空即可，_parseJsonSafe_（
 * Reminder OS 那边）和本项目这边的 falsy 检查都会把空字符串当成 null
 * 处理，等价于"没有覆盖，用 Reminder OS 默认策略"，不需要额外回填。
 */
function migrateSchemaReminderPolicy() {
  Logger.log('=== migrateSchemaReminderPolicy ===');
  _addColumnsIfMissing_('Tasks',        ['reminder_policy']);
  _addColumnsIfMissing_('ActiveTasks',  ['reminder_policy']);
  _addColumnsIfMissing_('ArchiveTasks', ['reminder_policy']);
  _setPlainTextFormatForNewColumns_('Tasks',        ['reminder_policy']);
  _setPlainTextFormatForNewColumns_('ActiveTasks',  ['reminder_policy']);
  _setPlainTextFormatForNewColumns_('ArchiveTasks', ['reminder_policy']);
  Logger.log('✅ reminder_policy 列迁移完成（含纯文本格式修复——JSON 字符串通常不会被 Sheets 误判类型，这里只是保持跟 due_time/due_datetime 一致的防御性处理）。存量行 reminder_policy 为空字符串，等价于"没有覆盖，用 Reminder OS 默认策略"。');
}

/**
 * 【ADR-2026-09-18-031，Project Deadline Contract，Schema Model C】
 * Projects 是已有数据的表（真实环境曾确认 67 行，见
 * 00_Project_State.gs「四十八」），不是全新建表——不能照抄
 * TaskViewOrder 那种"_ensureSheet_ 自动整块设纯文本"的路径。
 *
 * 跟 migrateSchemaDueTime() 同一个模式，但有一处刻意不同：
 * migrateSchemaDueTime() 的纯文本调用只传了 due_time/due_datetime 两个
 * 字段，不含 due_date——因为 Tasks 的 due_date 是建表时就有的历史列，
 * 不是那次新加的列。这次 Projects 的三个字段（due_date/due_time/
 * due_datetime）全部是全新列，所以 _setPlainTextFormatForNewColumns_
 * 这一步三个字段都要传，不能照抄 Tasks 那次两列的参数列表——否则
 * due_date 这一列会在 Sheets 里被自动识别成 Date 类型，读回来的值需要
 * 经过 07_IdentityEngine._canonicalizeDueValue_ 才能安全使用，这里
 * 直接从根源上避免这个问题，不依赖下游兜底。
 *
 * 幂等：_addColumnsIfMissing_ 本身只在列缺失时才追加，重复运行安全。
 */
function migrateSchemaProjectDeadline() {
  Logger.log('=== migrateSchemaProjectDeadline ===');
  _addColumnsIfMissing_('Projects', ['due_date', 'due_time', 'due_datetime']);
  _setPlainTextFormatForNewColumns_('Projects', ['due_date', 'due_time', 'due_datetime']);
  Logger.log('✅ Projects due_date/due_time/due_datetime 列迁移完成（三列均按纯文本格式处理，不同于 Tasks 当年只处理两列——见函数注释）。存量 Project 行三列均为空字符串，等价于"没有 deadline"，行为不变。');
}

/**
 * 对指定列的既有数据区（不含表头行）设纯文本格式，防止 Google Sheets
 * 把形如 'HH:mm' / 'yyyy-MM-ddTHH:mm:ss' 的字符串自动识别成 Time/
 * DateTime 类型。只处理"迁移时已经存在的行"——迁移之后新建的行走
 * createTaskDirect_ → upsertRowByKey_ 正常写入路径，不经过这个函数。
 */
function _setPlainTextFormatForNewColumns_(sheetName, columnNames) {
  var sheet;
  try {
    sheet = getSheet_(sheetName);
  } catch (e) {
    Logger.log('⚠️ Sheet 不存在，跳过: ' + sheetName);
    return;
  }

  var headerMap = getHeaderMap_(sheet);
  var lastRow   = sheet.getLastRow();

  // 【2026-09-20，修复真实 GAS 环境发现的 bug，Project Deadline Real
  // GAS Verification Gate】原来这里只格式化 `lastRow - 1` 行——只覆盖
  // "迁移那一刻已经存在"的数据行。迁移之后新 appendRow 进来的行不在这
  // 个 range 里，没有纯文本保护，Sheets 会把日期/时间形状的字符串自动
  // 识别成 Date/Time 类型——真实环境已经证实：`due_date` 读回来变成
  // `Thu Dec 31 2026 00:00:00 GMT+0800`，`due_time` 变成
  // `Sat Dec 30 1899 09:00:00 GMT+0655`（Sheets 内部纯时间值的
  // 1899-12-30 epoch），`_computeDueDatetime_` 拿到这两个 Date 对象
  // 后用字符串拼接，产出了完全损坏的 due_datetime。
  //
  // 修复：跟 `_ensureSheet_` 对全新表的处理方式对齐——用
  // `getMaxRows()`（物理网格行数，通常比 `lastRow` 大得多，新建 Sheet
  // 默认一般有 1000 行）代替 `lastRow`，把还没有数据的预留行也提前
  // 格式化好，这样将来 appendRow 写进这些行时，纯文本格式已经就位，
  // 不会被重新自动识别。`Math.max(lastRow, maxRows)` 是防御性写法——
  // 不假设"maxRows 一定 >= lastRow"这个不变量在任何时候都成立，即使
  // 出现异常情况也不会算出比原来更小的范围。
  //
  // 【残留风险，如实记录，这次修复没有、也不需要消除它】如果这张表将来
  // 增长超过当前 maxRows（Sheets 会自动扩容网格），扩容出来的全新行
  // 同样不在这次格式化的 range 里，会重新暴露同一个问题——这跟
  // `_ensureSheet_` 自己对全新表的保护方式面临的是同一种、同一等级
  // 的残留风险，不是这次修复引入的新缺口，也不是这次要解决的范围
  // （真正杜绝需要在写入路径本身加保护，属于更大的改动，不在 Carson
  // 这次给的授权范围内）。
  //
  // 【边界情况处理】原来 `lastRow < 2`（空表/只有表头）时会直接跳过，
  // 完全不做任何格式化——这正是这次 bug 的根源之一：以为"没有数据就
  // 不用管"，但"没有数据"恰恰是最需要提前格式化的时候（后面新增的每
  // 一行都会命中这个洞）。改成基于 `maxRows` 计算之后，`lastRow < 2`
  // 不再是跳过条件，只在 `rowsToFormat <= 0`（比如 maxRows 异常小到
  // 1 或更小，这种情况正常 Sheet 几乎不会出现）时才跳过，避免算出
  // 非法的零行或负行 range。
  var maxRows      = sheet.getMaxRows();
  var rowsToFormat = Math.max(lastRow, maxRows) - 1;

  if (rowsToFormat <= 0) {
    Logger.log('  [' + sheetName + '] 行数异常小（lastRow=' + lastRow + ', maxRows=' + maxRows + '），跳过纯文本格式设置');
    return;
  }

  columnNames.forEach(function (col) {
    if (!(col in headerMap)) {
      Logger.log('  ⚠️ [' + sheetName + '] 列 "' + col + '" 不存在，跳过格式设置');
      return;
    }
    var colIndex = headerMap[col] + 1; // 转 1-based
    sheet.getRange(2, colIndex, rowsToFormat, 1).setNumberFormat('@');
    Logger.log('  [' + sheetName + '] 列 "' + col + '" 已设为纯文本格式（第 2 到第 ' + (rowsToFormat + 1) + ' 行，含尚无数据的预留行——原来只到第 ' + lastRow + ' 行）');
  });
}

// ============ Step 2：全量重建 ============

/**
 * 重建 Tasks Read Model。
 *
 * 流程：
 *  1. 从 EventBus 拿全部 Events
 *  2. 按 TaskEngine.deriveFromEvent 逻辑还原 stateMap
 *  3. 为每个 Task 计算 identity（旧 Events payload 里没有 identity 字段时在线算）
 *  4. 批量写回 Tasks Sheet（O(1)级Sheet I/O，跟数据量无关）
 *
 * ⚠️ 不清空 Tasks Sheet 里的行：upsert 是幂等的，已有行覆写，不存在的行追加。
 */
function rebuildTasksProjection() {
  Logger.log('=== rebuildTasksProjection ===');
  var events = EventBus.getAllEvents();
  var stateMap = {};

  events.forEach(function (e) {
    TaskEngine.deriveFromEvent(e, stateMap); // 20_TaskEngine.gs
  });

  var tasksToWrite = [];
  for (var id in stateMap) {
    var task = stateMap[id];

    if (!task.identity) {
      task.identity = IdentityEngine.generateTaskIdentity(
        task.chat_id   || '',
        task.title     || '',
        IdentityEngine.resolveIdentityDueValue(task),
        task.recurring || '',
        task.priority  || 'MEDIUM',
        task.category  || 'GENERAL'
      );
    }

    tasksToWrite.push(task);
  }

  // 【2026-09-23，Known Limitation 11/12 修复】全量重建之前完全没有
  // 走过任何纯文本保护——见 05_SheetUtils.js batchUpsertRowsByKey_ 的
  // plainTextColumns 参数说明，这是这次修复之前唯一被漏掉的真实写入点。
  var result = batchUpsertRowsByKey_('Tasks', 'task_id', tasksToWrite, ['due_time', 'due_datetime']); // 05_SheetUtils.gs
  var count = tasksToWrite.length;

  Logger.log('✅ 重建 Tasks 完成，共处理 ' + count + ' 个任务（更新 ' + result.updated + ' / 新增 ' + result.appended + '）');
  return count;
}

/**
 * 重建 ActiveTasks Read Model（工作台过滤视图）。
 *
 * ⚠️ 跟 rebuildTasksProjection 的关键差异：ActiveTasks 是过滤视图（只放
 * 非终态任务），upsert-only 没法清掉"曾经活着、后来终结了，但因为
 * ProjectionEngine.dispatch 失败而卡在 ActiveTasks 里没被删掉"的陈旧行。
 * 所以这里改成「清空数据行（保留表头）→ 把 Events 推导出的全部非终态任务
 * 一次性批量写回」。
 */
function rebuildActiveTasksProjection() {
  Logger.log('=== rebuildActiveTasksProjection ===');

  var sheet;
  try {
    sheet = getSheet_('ActiveTasks');
  } catch (e) {
    Logger.log('⚠️ ActiveTasks Sheet 不存在，跳过重建（先跑 setupSheets() 建表）');
    return 0;
  }

  var events = EventBus.getAllEvents();
  var stateMap = {};
  events.forEach(function (e) {
    TaskEngine.deriveFromEvent(e, stateMap); // 20_TaskEngine.gs
  });

  var terminalStatuses = { 'DONE': true, 'CANCELLED': true };
  var activeTasks = [];
  for (var id in stateMap) {
    var task = stateMap[id];
    var status = String(task.status || '').toUpperCase();
    if (terminalStatuses[status]) continue;

    if (!task.identity) {
      task.identity = IdentityEngine.generateTaskIdentity(
        task.chat_id   || '',
        task.title     || '',
        IdentityEngine.resolveIdentityDueValue(task),
        task.recurring || '',
        task.priority  || 'MEDIUM',
        task.category  || 'GENERAL'
      );
    }
    activeTasks.push(task);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  var count = 0;
  if (activeTasks.length > 0) {
    // 同上 rebuildTasksProjection 的修复说明。
    var result = batchUpsertRowsByKey_('ActiveTasks', 'task_id', activeTasks, ['due_time', 'due_datetime']);
    count = result.updated + result.appended;
  }

  Logger.log('✅ 重建 ActiveTasks 完成，共处理 ' + count + ' 个活跃任务');
  return count;
}

/**
 * 重建 TaskStatistics Read Model（从 Events 全量重放）。
 *
 * 跟 ActiveTasks 一样是"派生汇总视图"，先清空数据行再按 chat_id 分组重算，
 * 避免陈旧计数器残留（比如某个 chat_id 的任务全被删光了，旧的统计行还在）。
 *
 * 【V4.6 定位澄清】TaskStatistics 现在的常规维护方式是每日批量任务
 * recomputeStatisticsFromTasks_()（见下方，从 Tasks 表算，成本低得多），
 * 本函数（从 Events 全量重放算）保留作为"灾难恢复"工具——如果连 Tasks
 * 表本身都怀疑损坏、需要从最原始的事实来源（Events）重建一切时用这个；
 * 日常场景（比如每天的定时任务）应该用 recomputeStatisticsFromTasks_()，
 * 不需要为了刷新一张汇总表就重放全部历史 Events。两者算出来的结果应该
 * 一致（都是"当前 Tasks 状态的聚合"），只是数据来源和成本不同。
 */
function rebuildStatisticsProjection() {
  Logger.log('=== rebuildStatisticsProjection（从 Events 全量重放，灾难恢复用） ===');

  var sheet;
  try {
    sheet = getSheet_('TaskStatistics');
  } catch (e) {
    Logger.log('⚠️ TaskStatistics Sheet 不存在，跳过重建（先跑 setupSheets() 建表）');
    return 0;
  }

  var events = EventBus.getAllEvents();
  var stateMap = {};
  events.forEach(function (e) {
    TaskEngine.deriveFromEvent(e, stateMap);
  });

  var byChat = {};
  for (var id in stateMap) {
    var t = stateMap[id];
    var chatId = t.chat_id || '';
    if (!chatId) continue;

    if (!byChat[chatId]) {
      byChat[chatId] = {
        chat_id: chatId, total_count: 0, pending_count: 0, done_count: 0,
        cancelled_count: 0, recurring_count: 0, reminder_count_total: 0,
        last_updated_at: new Date().toISOString()
      };
    }
    var s = String(t.status || '').toUpperCase();
    byChat[chatId].total_count++;
    if (s === 'DONE') byChat[chatId].done_count++;
    else if (s === 'CANCELLED') byChat[chatId].cancelled_count++;
    else byChat[chatId].pending_count++;
    if (t.recurring) byChat[chatId].recurring_count++;
    byChat[chatId].reminder_count_total += Number(t.reminder_count) || 0;
  }

  var rows = Object.keys(byChat).map(function (k) { return byChat[k]; });

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  var count = 0;
  if (rows.length > 0) {
    var result = batchUpsertRowsByKey_('TaskStatistics', 'chat_id', rows);
    count = result.updated + result.appended;
  }

  Logger.log('✅ 重建 TaskStatistics 完成（Events重放），共处理 ' + count + ' 个 chat_id');
  return count;
}

/**
 * 【V4.6 新增】按 chat_id 分组，从 Tasks 表（不是 Events）重新聚合
 * TaskStatistics 每一行。这是 TaskStatistics 现在的常规维护方式，供
 * 15_Setup.gs 的每日触发器 triggerDailyStatisticsRecompute() 调用。
 *
 * 跟 rebuildStatisticsProjection()（从 Events 全量重放）的区别：本函数
 * 假设 Tasks 表本身是可信的——Tasks 自己有独立的一致性保障
 * （10_ProjectionEngine 同步维护 + rebuildTasksProjection() 兜底），只是
 * 把 Tasks 表现有数据重新聚合一遍写回 TaskStatistics，不需要读那张只增
 * 不减、随时间增长的 Events 表（见 02_EventBus.gs getAllEvents() 文件头
 * 关于 Events 表规模的警告）。
 *
 * 完整架构论证见 00_ADR.gs ADR-2026-07-06-005。
 *
 * @returns {number} 处理的 chat_id 数量
 */
function recomputeStatisticsFromTasks_() {
  Logger.log('=== recomputeStatisticsFromTasks_（从 Tasks 表聚合，每日常规维护用） ===');

  var statsSheet;
  try {
    statsSheet = getSheet_('TaskStatistics');
  } catch (e) {
    Logger.log('⚠️ TaskStatistics Sheet 不存在，跳过（先跑 setupSheets() 建表）');
    return 0;
  }

  var tasksSheet = getSheet_('Tasks');
  var headerMap = getHeaderMap_(tasksSheet);
  var lastRow = tasksSheet.getLastRow();

  var byChat = {};
  if (lastRow >= 2) {
    var rows = tasksSheet.getRange(2, 1, lastRow - 1, tasksSheet.getLastColumn()).getValues();
    rows.forEach(function (row) {
      var chatId = row[headerMap['chat_id']];
      if (!chatId) return;

      if (!byChat[chatId]) {
        byChat[chatId] = {
          chat_id: chatId, total_count: 0, pending_count: 0, done_count: 0,
          cancelled_count: 0, recurring_count: 0, reminder_count_total: 0,
          last_updated_at: new Date().toISOString()
        };
      }

      var status = String(row[headerMap['status']] || '').toUpperCase();
      byChat[chatId].total_count++;
      if (status === 'DONE') byChat[chatId].done_count++;
      else if (status === 'CANCELLED') byChat[chatId].cancelled_count++;
      else byChat[chatId].pending_count++;
      if (row[headerMap['recurring']]) byChat[chatId].recurring_count++;
      byChat[chatId].reminder_count_total += Number(row[headerMap['reminder_count']]) || 0;
    });
  }

  var statsRows = Object.keys(byChat).map(function (k) { return byChat[k]; });

  var statsLastRow = statsSheet.getLastRow();
  if (statsLastRow >= 2) {
    statsSheet.getRange(2, 1, statsLastRow - 1, statsSheet.getLastColumn()).clearContent();
  }

  var count = 0;
  if (statsRows.length > 0) {
    var result = batchUpsertRowsByKey_('TaskStatistics', 'chat_id', statsRows);
    count = result.updated + result.appended;
  }

  Logger.log('✅ recomputeStatisticsFromTasks_ 完成，共处理 ' + count + ' 个 chat_id（数据源：Tasks 表，未触碰 Events）');
  return count;
}

/**
 * 重建 TaskFilters Read Model（V4新增）。
 */
function rebuildTaskFiltersProjection() {
  Logger.log('=== rebuildTaskFiltersProjection ===');

  var sheet;
  try {
    sheet = getSheet_('TaskFilters');
  } catch (e) {
    Logger.log('⚠️ TaskFilters Sheet 不存在，跳过重建（先跑 setupSheets() 建表）');
    return 0;
  }

  var events = EventBus.getAllEvents();
  var stateMap = {};
  events.forEach(function (e) {
    TaskEngine.deriveFromEvent(e, stateMap);
  });

  var rows = [];
  for (var id in stateMap) {
    var t = stateMap[id];
    var searchableText = [t.title, t.description, t.notes, t.tags, t.category]
      .filter(function (v) { return !!v; })
      .join(' ')
      .toLowerCase();
    rows.push({
      task_id:         id,
      chat_id:         t.chat_id || '',
      searchable_text: searchableText,
      tags_csv:        t.tags || ''
    });
  }

  var count = 0;
  if (rows.length > 0) {
    var result = batchUpsertRowsByKey_('TaskFilters', 'task_id', rows);
    count = result.updated + result.appended;
  }

  Logger.log('✅ 重建 TaskFilters 完成，共处理 ' + count + ' 个任务');
  return count;
}

/**
 * 【2026-09-15 迁移合并，Recovery Completeness Fix】以下三个函数原本
 * 分别活在 11_ProjectionRebuilder__SPRINT1_ADDITIONS.gs（
 * rebuildProjectsProjection/rebuildWorkflowsProjection，Sprint 1 时新增）
 * 和 11_ProjectionRebuilder__UI_I6_ADDITIONS.gs（rebuildTaskViewOrderProjection，
 * UI-I6 时新增）——两份文件当时都明确要求"请把这些函数粘贴进
 * rebuildAllProjections()"，但那次粘贴动作实际上从未发生，
 * rebuildAllProjections() 一直只调用下面 Task 相关的四个，这是本次
 * 修复的起因（见对话记录 Decision 3）。现在把三个函数逐字迁移到这里
 * （只搬运位置，函数体一个字节都没有改），并从那两份 __ADDITIONS 文件里
 * 删除对应定义（避免同名函数在两个文件里各存一份，粘贴进真实 GAS 项目后
 * 后加载的文件会静默覆盖先加载的同名声明——见 05_SheetUtils.gs 文件头
 * 对这同一类风险的既有说明），那两份文件现在只保留没有被合并过来的部分
 * （migrateSchemaPersonalLifeOS/_appendMissingColumns_/
 * renameSheetsToPascalCase，以及一段"已合并"的指向说明）。
 */

/**
 * 【Everything Rebuildable】从 Events 表全量重放，重建 Projects。跟
 * rebuildTasksProjection 同一个模式——ProjectEngine.deriveFromEvent 折叠
 * 状态，ProjectEngine.materializeProjectRow_ 按 project_id 单行 upsert
 * （不是清空重写：Projects 不是像 ActiveTasks 那样的"过滤子集"视图，
 * 每一个存在的 project_id 永远对应一个 PROJECT_CREATED 事件，重放不会
 * 留下"表里有行但 Events 里推导不出"的孤行风险，用 upsert 就足够，不需要
 * 先清空）。
 */
function rebuildProjectsProjection() {
  Logger.log('=== rebuildProjectsProjection ===');
  var events = EventBus.getAllEvents();
  var state = {};
  events.forEach(function (e) {
    ProjectEngine.deriveFromEvent(e, state);
  });

  Object.keys(state).forEach(function (projectId) {
    ProjectEngine.materializeProjectRow_(projectId, state[projectId]);
  });

  Logger.log('✅ rebuildProjectsProjection 完成，共重建 ' + Object.keys(state).length + ' 个 Project');
  return Object.keys(state).length;
}

/**
 * 同上，Workflows 版本——WorkflowEngine.deriveFromEvent /
 * materializeWorkflowRow_，同一个"每个 entity 一份、按主键 upsert"模式，
 * 同样不需要先清空。
 */
function rebuildWorkflowsProjection() {
  Logger.log('=== rebuildWorkflowsProjection ===');
  var events = EventBus.getAllEvents();
  var state = {};
  events.forEach(function (e) {
    WorkflowEngine.deriveFromEvent(e, state);
  });

  Object.keys(state).forEach(function (workflowId) {
    WorkflowEngine.materializeWorkflowRow_(workflowId, state[workflowId]);
  });

  Logger.log('✅ rebuildWorkflowsProjection 完成，共重建 ' + Object.keys(state).length + ' 个 Workflow');
  return Object.keys(state).length;
}

/**
 * TaskViewOrder（UI-I6，ADR-2026-08-26-026）——跟上面两个不是同一个
 * 重放形状。Projects/Workflows 是"每个 entity_id 一行、互不相关"；
 * TaskViewOrder 的当前状态按 (chat_id, context_key) 分组，一组内的多行
 * 必须整体替换（跟 10_ProjectionEngine.gs 的 projectViewOrderUpdated_/
 * _replaceTaskViewOrderRows_ 是同一个"整体覆盖式重写"语义）——按
 * (chat_id, context_key) 分组，每组只保留时间上最后一个
 * VIEW_ORDER_UPDATED 事件的内容，最后一次性重建整张表。假设
 * EventBus.getAllEvents() 按时间顺序返回（Events 表只增不删，新事件
 * 永远追加在最后，读出来天然是时间顺序，跟本文件其它 rebuild*Projection
 * 的既有假设一致）。
 */
function rebuildTaskViewOrderProjection() {
  Logger.log('=== rebuildTaskViewOrderProjection ===');
  var events = EventBus.getAllEvents();
  var groups = {}; // key: chatId + '||' + contextKey → 最后一次事件的 payload（后面覆盖前面）

  events.forEach(function (e) {
    if (e.type !== 'VIEW_ORDER_UPDATED') return;
    var p = e.payload || {};
    if (!p.chat_id || !p.context_key || !p.ordered_task_ids) return;
    groups[p.chat_id + '||' + p.context_key] = p;
  });

  var sheet;
  try {
    sheet = getSheet_('TaskViewOrder');
  } catch (e) {
    Logger.log('⚠️ TaskViewOrder Sheet 不存在，跳过重建（先跑 setupSheets() 建表）');
    return 0;
  }

  var lastCol = sheet.getLastColumn();
  var headerMap = getHeaderMap_(sheet);

  var nowIso = new Date().toISOString();
  var finalRows = [];
  Object.keys(groups).forEach(function (key) {
    var p = groups[key];
    p.ordered_task_ids.forEach(function (taskId, idx) {
      var row = new Array(lastCol).fill('');
      row[headerMap['chat_id']]      = p.chat_id;
      row[headerMap['context_key']]  = p.context_key;
      row[headerMap['task_id']]      = taskId;
      row[headerMap['order_index']]  = idx;
      row[headerMap['updated_time']] = nowIso;
      finalRows.push(row);
    });
  });

  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  if (finalRows.length > 0) {
    sheet.getRange(2, 1, finalRows.length, lastCol).setValues(finalRows);
  }

  Logger.log('✅ rebuildTaskViewOrderProjection 完成，共重建 ' + Object.keys(groups).length +
    ' 个 (chat_id, context_key) 分组，' + finalRows.length + ' 行');
  return finalRows.length;
}

/**
 * 重建全部 Read Models。
 * 【V4修复】不再调用已删除的 rebuildInventoryProjection()（见文件头注释）。
 * 【V4.4 配套 HIGH RISK 3 修复】开始前先用 EventBus.getEventCount_()（轻量，
 * 只读行数不解析内容）报一下 Events 表当前规模——下面几个 rebuild* 函数
 * 各自都会完整读取一遍 Events（EventBus.getAllEvents() 内部超过阈值会
 * 自动打警告日志，见 02_EventBus.gs），这里提前给个总览，方便判断这次
 * 手动重建大概要花多久。
 *
 * 【2026-09-15 Recovery Completeness Fix，见对话记录 Decision 3】新增
 * 三行调用：rebuildProjectsProjection/rebuildWorkflowsProjection（Sprint 1
 * 就已经存在的函数，一直没有被这里调用过）+ rebuildTaskViewOrderProjection
 * （UI-I6 新增）。这是本次修复的全部内容——不是新功能，是让"已经存在、
 * 已经验证过安全的 rebuild 函数"被这个顶层 Recovery Entry Point 正确
 * 调用，让 rebuildAllProjections() 真正对得起"Everything Rebuildable"
 * 这条原则。
 *
 * 执行顺序说明（不是机械照抄 Carson 列的顺序，是核实过真实依赖关系后
 * 确认的）：这七个函数彼此之间没有真实依赖——每一个都独立从
 * EventBus.getAllEvents() 重新推导状态，只写自己负责的那张表，互不读取
 * 对方刚写完的结果（逐个核对过：rebuildStatisticsProjection/
 * rebuildTaskFiltersProjection 表面上"看起来"应该在 Tasks 重建之后跑，
 * 但两者实际都是独立重新从 Events 推导，不读 Tasks Sheet 本身——这条
 * 顺序依赖其实并不存在，只是历史上凑巧这么写）。新增的三个之间也没有
 * 依赖（TaskViewOrder 不校验引用的 task_id 是否存在，见
 * 00_Drag_Ordering_ADR.gs「H.3」Orphan behavior）。这里把新的三个放在
 * 已有四个之后（保留原有顺序不变，最大程度降低这次改动的影响面），
 * 三个新增之间按"核心实体（Projects/Workflows）先，跨领域的视图状态
 * （TaskViewOrder）后"排，纯粹是可读性考虑，不是正确性要求——任何顺序
 * 排列这七个调用，结果都应该相同（这条本身也是下面 Idempotency/Replay
 * 校验要验证的对象之一，不是本函数头注释里口头断言就算数）。
 *
 * getAllEvents() 有执行期内存缓存（02_EventBus.gs `_cachedEvents`），
 * 只有 publish() 写新事件时才失效——这次调用序列本身不写任何新事件，
 * 所以第一个 rebuild* 函数触发一次真实的 Sheet 读取后，后面六个都会拿到
 * 同一份缓存数组，不会出现"跑到一半 Events 又多了几行、七个函数看到的
 * 不是同一个快照"这种情况，这是这次七个函数能保证互相一致的一个关键、
 * 已经存在、不需要本次新增的机制。
 */
function rebuildAllProjections() {
  Logger.log('=== rebuildAllProjections ===');
  Logger.log('Events 表当前共 ' + EventBus.getEventCount_() + ' 行（下面每个 rebuild* 函数都会各自完整读一遍）');
  rebuildTasksProjection();
  rebuildActiveTasksProjection();
  rebuildStatisticsProjection();  // V4新增
  rebuildTaskFiltersProjection(); // V4新增
  rebuildProjectsProjection();       // 2026-09-15 补漏，Sprint 1 就已存在
  rebuildWorkflowsProjection();      // 2026-09-15 补漏，Sprint 1 就已存在
  rebuildTaskViewOrderProjection();  // 2026-09-15 补漏，UI-I6 新增
  Logger.log('✅ 所有 Productivity OS Projection 重建完成（Tasks/ActiveTasks/Statistics/TaskFilters/Projects/Workflows/TaskViewOrder，共 7 个）');
}

// ============ Step 3：校验 ============

/**
 * 快速校验：比较 Events 推导的状态 vs Tasks Sheet 当前内容。
 * 只做抽样级别的一致性检查（数量是否相符、PENDING 任务是否都在 Sheet 里）。
 * 不做全字段 diff（那太慢了）。
 */
function verifyProjection() {
  Logger.log('=== verifyProjection ===');

  var fromEvents = TaskEngine.deriveTaskState_(); // 20_TaskEngine.gs，全量 derive
  var pendingFromEvents = Object.keys(fromEvents).filter(function (id) {
    return fromEvents[id].status === 'PENDING';
  });

  Logger.log('Events 推导的 PENDING 任务数: ' + pendingFromEvents.length);

  var sheet;
  try {
    sheet = getSheet_('Tasks');
  } catch (e) {
    Logger.log('❌ Tasks Sheet 不存在');
    return;
  }

  var headerMap = getHeaderMap_(sheet);
  var lastRow   = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('❌ Tasks Sheet 是空的');
    return;
  }

  var statusColIdx = headerMap['status'];
  var taskIdColIdx = headerMap['task_id'];
  if (statusColIdx === undefined || taskIdColIdx === undefined) {
    Logger.log('❌ Tasks Sheet 缺少 status 或 task_id 列');
    return;
  }

  var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var pendingInSheet = rows.filter(function (row) {
    return String(row[statusColIdx] || '').toUpperCase() === 'PENDING';
  });

  Logger.log('Tasks Sheet 里的 PENDING 任务数: ' + pendingInSheet.length);

  var missing = [];
  pendingFromEvents.forEach(function (id) {
    var found = rows.some(function (row) {
      return String(row[taskIdColIdx]) === String(id);
    });
    if (!found) missing.push(id);
  });

  if (missing.length === 0) {
    Logger.log('✅ 校验通过：所有 PENDING 任务都在 Tasks Sheet 里');
  } else {
    Logger.log('❌ 校验失败：以下 task_id 在 Sheet 里缺失（运行 rebuildTasksProjection() 修复）:');
    missing.forEach(function (id) { Logger.log('   - ' + id); });
  }

  _verifyActiveTasksConsistency_(fromEvents);
}

/**
 * 校验 ActiveTasks 跟 Events 推导出的"非终态任务集合"是否一致。
 */
function _verifyActiveTasksConsistency_(fromEvents) {
  var nonTerminal = {};
  for (var id in fromEvents) {
    var status = String(fromEvents[id].status || '').toUpperCase();
    if (status !== 'DONE' && status !== 'CANCELLED') nonTerminal[id] = true;
  }

  var sheet;
  try {
    sheet = getSheet_('ActiveTasks');
  } catch (e) {
    Logger.log('⚠️ ActiveTasks Sheet 不存在，跳过 ActiveTasks 一致性校验');
    return;
  }

  var headerMap = getHeaderMap_(sheet);
  var taskIdColIdx = headerMap['task_id'];
  if (taskIdColIdx === undefined) {
    Logger.log('❌ ActiveTasks Sheet 缺少 task_id 列');
    return;
  }

  var lastRow = sheet.getLastRow();
  var idsInActiveTasks = {};
  if (lastRow >= 2) {
    var atRows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
    atRows.forEach(function (row) {
      idsInActiveTasks[String(row[taskIdColIdx])] = true;
    });
  }

  var missingFromActiveTasks = Object.keys(nonTerminal).filter(function (id) {
    return !idsInActiveTasks[id];
  });
  var staleInActiveTasks = Object.keys(idsInActiveTasks).filter(function (id) {
    return !nonTerminal[id];
  });

  Logger.log('ActiveTasks 校验：Events推导非终态任务 ' + Object.keys(nonTerminal).length +
             ' 个，ActiveTasks Sheet 里 ' + Object.keys(idsInActiveTasks).length + ' 个');

  if (missingFromActiveTasks.length === 0 && staleInActiveTasks.length === 0) {
    Logger.log('✅ ActiveTasks 一致性校验通过');
    return;
  }

  if (missingFromActiveTasks.length > 0) {
    Logger.log('❌ 以下非终态task_id缺失于ActiveTasks（运行 rebuildActiveTasksProjection() 修复）:');
    missingFromActiveTasks.forEach(function (id) { Logger.log('   - ' + id); });
  }
  if (staleInActiveTasks.length > 0) {
    Logger.log('❌ 以下task_id是ActiveTasks里的陈旧行，Events显示已终结（运行 rebuildActiveTasksProjection() 修复）:');
    staleInActiveTasks.forEach(function (id) { Logger.log('   - ' + id); });
  }
}

/**
 * 比较 Projection 与 Events：输出每个任务的 Events 状态 vs Sheet 状态。
 * 仅建议在调试时手动运行，输出量大。
 */
function compareProjectionWithEvents() {
  Logger.log('=== compareProjectionWithEvents ===');

  var fromEvents = TaskEngine.deriveTaskState_();
  var sheet;
  try {
    sheet = getSheet_('Tasks');
  } catch (e) {
    Logger.log('❌ Tasks Sheet 不存在');
    return;
  }

  var headerMap = getHeaderMap_(sheet);
  var lastRow   = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('Tasks Sheet 是空的'); return; }

  var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var sheetById = {};
  rows.forEach(function (row) {
    var id = String(row[headerMap['task_id']] || '');
    if (id) sheetById[id] = row;
  });

  var mismatch = 0;
  for (var id in fromEvents) {
    var evStatus    = (fromEvents[id].status || '').toUpperCase();
    var sheetRow    = sheetById[id];
    var sheetStatus = sheetRow ? String(sheetRow[headerMap['status']] || '').toUpperCase() : 'MISSING';

    if (evStatus !== sheetStatus) {
      Logger.log('❌ 不一致 [' + id + ']: Events=' + evStatus + ', Sheet=' + sheetStatus);
      mismatch++;
    }
  }

  if (mismatch === 0) {
    Logger.log('✅ 所有任务 status 一致（' + Object.keys(fromEvents).length + ' 个）');
  } else {
    Logger.log('共 ' + mismatch + ' 个不一致，运行 rebuildTasksProjection() 修复');
  }
}

/**
 * 修复 Projection（rebuildAllProjections 的别名，更符合「修复」语义）
 */
function repairProjection() {
  rebuildAllProjections();
}

/**
 * 【V4.6 新增】每日定时触发器入口，调用 recomputeStatisticsFromTasks_()。
 * 挂载见 15_Setup.gs 的 createTriggers()。命名跟 13_ActiveTasksEngine.gs
 * 的 triggerDailyArchive() 保持同一种"trigger 前缀 + 描述性名字"约定，
 * 方便在 Apps Script 触发器管理界面里辨认。
 */
function triggerDailyStatisticsRecompute() {
  recomputeStatisticsFromTasks_();
}
