/**
 * 11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs
 * Personal Life OS — Track 1B Option A: Due-Date 存量数据迁移
 *
 * 状态：实施就绪，等待 Carson 在真实环境按顺序手动执行以下 5 步。
 * 批准依据：00_Due_Date_Canonicalization_Audit.md + Carson 2026-08-22
 * 批准消息（Option C + 明确的 dry-run → verify → write → read-back
 * 流程 + "迁移前后业务日期必须完全相同"这条不变量）。
 *
 * 跟既有 migrateSchemaDueTime() 的关系：那个函数（11_ProjectionRebuilder.js）
 * 解决的是"给 due_time/due_datetime 加列 + 设纯文本格式"，属于 Finding
 * DT-2 的修复，从来没有覆盖 due_date（Sprint 1 之前就存在的原始列）。
 * 本文件解决的是一个不同的问题："due_date 这一列已经存在、已经被 Google
 * Sheets 误判成 Date 类型的存量单元格值，需要读出来、按脚本真实时区转
 * 回业务日期字符串、再写回去"——这是数据值迁移，不是加列迁移，
 * setNumberFormat 本身不会回头改已经存的值（00_Due_Date_
 * Canonicalization_Audit.md「七」Option A 已经论证过这一点）。
 *
 * 范围：due_date + due_datetime 两列（都直接经
 * IdentityEngine.resolveIdentityDueValue 参与 identity 计算，见审计
 * 「四」）。不包含 due_time——那一列的格式保护已经随 migrateSchemaDueTime()
 * 上线过，且它不是 resolveIdentityDueValue 的输入，不在 Carson 这次
 * 批准的范围内；如果 Carson 想额外核实 due_time 的存量值，需要另外
 * 明确批准，这里不顺手扩大范围。
 *
 * 五步流程（必须按顺序手动执行，每步之间人工检查上一步的 Logger 输出）：
 *   Step 1  runDueDateMigration_Step1_Inventory()
 *   Step 2  runDueDateMigration_Step2_DryRun()
 *   Step 3  runDueDateMigration_Step3_Backup()
 *   Step 4  runDueDateMigration_Step4_Write('I_REVIEWED_DRYRUN_AND_BACKUP_CONFIRMED')
 *   Step 5  runDueDateMigration_Step5_ReadBackVerify()
 * 之后建议依次跑：
 *   runIdentityScopeKeyRegressionGate()   （Identity regression）
 *   runRecurringDueDateRegression_()      （Recurring regression，见
 *                                           53_Tests_DueDateCanonicalization.gs）
 *   runSprint3AcceptanceGate() / runUIBridgeSlice3Gate() /
 *   runUIBridgeInteractionsGate()          （Full Sprint regression）
 *
 * 所有中间状态持久化在一张新增的 Due_Date_Migration_Log 分页里（不是
 * 内存/单次执行状态）——因为 Apps Script 里分开手动点几次执行，中间
 * 完全可能是几次独立的 execution，不能假设上一步的变量还在。这张
 * 分页本身也是 Carson 要求的"checkpoint"记录的一部分。
 */

var DUE_DATE_MIGRATION_LOG_SHEET   = 'Due_Date_Migration_Log';
var DUE_DATE_MIGRATION_SHEETS      = ['Tasks', 'ActiveTasks', 'ArchiveTasks'];
var DUE_DATE_MIGRATION_COLUMNS     = ['due_date', 'due_datetime'];
var DUE_DATE_MIGRATION_LOG_HEADERS = [
  'log_row_id', 'sheet_name', 'data_row_number', 'task_id', 'column_name',
  'old_raw_value_display', 'old_business_date', 'predicted_new_value',
  'actual_written_value', 'read_back_value', 'status', 'last_updated'
];

/**
 * 拿到（必要时先创建）Due_Date_Migration_Log 这张分页。用
 * getSheet_('Tasks').getParent() 拿真正的 Spreadsheet 对象——这个项目
 * 是 standalone script，没有 getActiveSpreadsheet() 可用（见
 * 05_SheetUtils.getSheet_ 文件头说明），只能从一张已知存在的 Sheet
 * 反查它的 parent。
 */
function _getDueDateMigrationLogSheet_() {
  var anchorSheet = getSheet_('Tasks');
  var ss = anchorSheet.getParent();
  var logSheet = ss.getSheetByName(DUE_DATE_MIGRATION_LOG_SHEET);
  if (!logSheet) {
    logSheet = ss.insertSheet(DUE_DATE_MIGRATION_LOG_SHEET);
    logSheet.getRange(1, 1, 1, DUE_DATE_MIGRATION_LOG_HEADERS.length).setValues([DUE_DATE_MIGRATION_LOG_HEADERS]);
    logSheet.getRange(2, 1, logSheet.getMaxRows() - 1, DUE_DATE_MIGRATION_LOG_HEADERS.length).setNumberFormat('@');
    Logger.log('已创建 ' + DUE_DATE_MIGRATION_LOG_SHEET + ' 分页');
  }
  return logSheet;
}

function _readMigrationLogRows_() {
  var sheet = _getDueDateMigrationLogSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, DUE_DATE_MIGRATION_LOG_HEADERS.length).getValues();
  return values.map(function (row, i) {
    var obj = { _sheetRowIndex: i + 2 }; // 这行在 log sheet 里的真实行号，写回时要用
    DUE_DATE_MIGRATION_LOG_HEADERS.forEach(function (h, idx) { obj[h] = row[idx]; });
    return obj;
  });
}

function _writeMigrationLogRow_(sheet, sheetRowIndex, fields) {
  DUE_DATE_MIGRATION_LOG_HEADERS.forEach(function (h, idx) {
    if (fields.hasOwnProperty(h)) {
      sheet.getRange(sheetRowIndex, idx + 1).setValue(fields[h]);
    }
  });
  sheet.getRange(sheetRowIndex, DUE_DATE_MIGRATION_LOG_HEADERS.indexOf('last_updated') + 1)
    .setValue(new Date().toISOString());
}

// ============================================================
// Step 1 — Inventory
// ============================================================

/**
 * 扫描 Tasks/ActiveTasks/ArchiveTasks 三张表的 due_date/due_datetime
 * 两列，找出真的是 Date 对象（instanceof Date）的单元格，逐条记进
 * Due_Date_Migration_Log，status = 'candidate'。不写任何业务数据，
 * 只读 + 记录。可以重复运行——每次先清空旧的 log 分页内容再重新扫描
 * （幂等，不会重复累加）。
 */
function runDueDateMigration_Step1_Inventory() {
  Logger.log('========== Step 1: Inventory 开始 ==========');
  var logSheet = _getDueDateMigrationLogSheet_();

  // 幂等：每次 Inventory 重新扫描前，清空 log 分页的既有内容（保留表头）——
  // Inventory 只是"发现候选"，不是最终记录，重新跑一次不应该越堆越多。
  var existingLastRow = logSheet.getLastRow();
  if (existingLastRow > 1) {
    logSheet.getRange(2, 1, existingLastRow - 1, DUE_DATE_MIGRATION_LOG_HEADERS.length).clearContent();
  }

  var candidates = [];
  var logRowId = 0;

  DUE_DATE_MIGRATION_SHEETS.forEach(function (sheetName) {
    var sheet;
    try {
      sheet = getSheet_(sheetName);
    } catch (e) {
      Logger.log('⚠️ Sheet 不存在，跳过: ' + sheetName);
      return;
    }
    var headerMap = getHeaderMap_(sheet);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    DUE_DATE_MIGRATION_COLUMNS.forEach(function (col) {
      if (!(col in headerMap)) {
        Logger.log('  ⚠️ [' + sheetName + '] 列 "' + col + '" 不存在，跳过');
        return;
      }
      var colIndex = headerMap[col];
      var taskIdColIndex = headerMap['task_id'];
      var range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
      var values = range.getValues();

      values.forEach(function (row, i) {
        var cellValue = row[colIndex];
        if (cellValue instanceof Date) {
          logRowId++;
          candidates.push({
            log_row_id: logRowId,
            sheet_name: sheetName,
            data_row_number: i + 2, // 真实数据表里的行号
            task_id: row[taskIdColIndex] || '(unknown)',
            column_name: col,
            old_raw_value_display: cellValue.toISOString(),
            status: 'candidate'
          });
        }
      });
    });
  });

  if (candidates.length > 0) {
    var rows = candidates.map(function (c) {
      return DUE_DATE_MIGRATION_LOG_HEADERS.map(function (h) {
        return h === 'last_updated' ? new Date().toISOString() : (c[h] !== undefined ? c[h] : '');
      });
    });
    logSheet.getRange(2, 1, rows.length, DUE_DATE_MIGRATION_LOG_HEADERS.length).setValues(rows);
  }

  Logger.log('发现 ' + candidates.length + ' 个候选单元格（due_date/due_datetime 是 Date 对象而不是 string）。');
  var bySheet = {};
  candidates.forEach(function (c) { bySheet[c.sheet_name] = (bySheet[c.sheet_name] || 0) + 1; });
  Object.keys(bySheet).forEach(function (s) { Logger.log('  ' + s + ': ' + bySheet[s] + ' 个'); });
  Logger.log('详情已写入 "' + DUE_DATE_MIGRATION_LOG_SHEET + '" 分页，status=candidate。');
  Logger.log('========== Step 1: Inventory 结束 ==========');
  return candidates.length;
}

// ============================================================
// Step 2 — Dry-run
// ============================================================

/**
 * 对 Step 1 找到的每个候选单元格，重新读一次真实单元格当前值（不信任
 * Step 1 记录的展示字符串，直接读活的数据，避免任何信息损耗或
 * 两步之间数据又变了导致不一致），用 IdentityEngine.canonicalizeDueValue()
 * 算出"如果现在迁移，会写成什么"，记录 predicted_new_value 和
 * old_business_date（这里两者其实是同一次计算的结果——"旧值对应的
 * 业务日期"就是"新值应该写成什么"，canonicalize 函数本身就是把
 * Date 对象转回它所代表的业务日期字符串），status 改成
 * 'dry_run_computed'。不写入任何 Tasks/ActiveTasks/ArchiveTasks 的
 * 真实数据，只读、只算、只记录到 log 分页。
 *
 * Carson 要求的"迁移前后业务日期必须完全相同"这条不变量，在这一步
 * 就已经能验证：old_business_date 本来就是从旧的 Date 对象里正确
 * 提取出来的业务日期（不是拿 UTC 时间戳硬比），predicted_new_value
 * 是同一次计算的输出——两者定义上就是一致的，这里额外做了一次自检
 * （用 new Date(predicted_new_value) 重新解析回 Date，跟原始 Date
 * 对比同一个脚本时区下的日历日期是否相同），任何不一致都会在这一步
 * 就大声报错、不会带到 Step 4。
 */
function runDueDateMigration_Step2_DryRun() {
  Logger.log('========== Step 2: Dry-run 开始 ==========');
  var logSheet = _getDueDateMigrationLogSheet_();
  var rows = _readMigrationLogRows_().filter(function (r) { return r.status === 'candidate'; });

  if (rows.length === 0) {
    Logger.log('没有 status=candidate 的行——请先跑 runDueDateMigration_Step1_Inventory()。');
    Logger.log('========== Step 2: Dry-run 结束（无候选） ==========');
    return { total: 0, mismatches: 0 };
  }

  var tz = Session.getScriptTimeZone();
  var mismatches = 0;

  rows.forEach(function (r) {
    var sheet = getSheet_(r.sheet_name);
    var headerMap = getHeaderMap_(sheet);
    var colIndex = headerMap[r.column_name];
    var liveValue = sheet.getRange(r.data_row_number, colIndex + 1).getValue();

    if (!(liveValue instanceof Date)) {
      // 两步之间这个单元格已经不是 Date 了（比如被别的操作改动过）——
      // 不当成错误，标记跳过，Step 4 也会再次确认跳过。
      Logger.log('  ℹ️ [' + r.sheet_name + ' row ' + r.data_row_number + ' ' + r.column_name +
        '] 现在已经不是 Date 类型了，跳过。当前值: ' + JSON.stringify(liveValue));
      _writeMigrationLogRow_(logSheet, r._sheetRowIndex, {
        status: 'skipped_no_longer_date',
        old_business_date: '', predicted_new_value: ''
      });
      return;
    }

    var predicted = IdentityEngine.canonicalizeDueValue(liveValue);

    // 自检：predicted 重新解析回 Date，跟原始 liveValue 在脚本时区下
    // 是不是同一个日历日期（不比较时间戳，比较"业务日期"本身）。
    var reparsed = new Date(predicted.length === 10 ? predicted + 'T00:00:00' : predicted);
    var originalCalendarDate = Utilities.formatDate(liveValue, tz, 'yyyy-MM-dd');
    var reparsedCalendarDate = Utilities.formatDate(reparsed, tz, 'yyyy-MM-dd');
    var selfCheckOk = (originalCalendarDate === reparsedCalendarDate);

    if (!selfCheckOk) {
      mismatches++;
      Logger.log('  ❌ [' + r.sheet_name + ' row ' + r.data_row_number + ' task ' + r.task_id +
        '] 自检失败！旧业务日期=' + originalCalendarDate + '，新值重新解析后=' + reparsedCalendarDate +
        '——这一行不会进入可写入状态，需要人工排查。');
      _writeMigrationLogRow_(logSheet, r._sheetRowIndex, {
        status: 'DRY_RUN_MISMATCH', old_business_date: originalCalendarDate, predicted_new_value: predicted
      });
      return;
    }

    Logger.log('  ✅ [' + r.sheet_name + ' row ' + r.data_row_number + ' task ' + r.task_id + ' ' + r.column_name +
      ']  ' + r.old_raw_value_display + '  →  "' + predicted + '"  （业务日期 ' + originalCalendarDate + ' 不变）');

    _writeMigrationLogRow_(logSheet, r._sheetRowIndex, {
      status: 'dry_run_computed', old_business_date: originalCalendarDate, predicted_new_value: predicted
    });
  });

  Logger.log('');
  Logger.log('共处理 ' + rows.length + ' 行，自检失败 ' + mismatches + ' 行。');
  if (mismatches > 0) {
    Logger.log('❌ 存在自检失败的行——请先人工排查上面标 DRY_RUN_MISMATCH 的行，不要继续 Step 3/4。');
  } else {
    Logger.log('✅ 全部自检通过，业务日期在迁移前后一致。请人工检查上面完整的映射列表，确认无误后再进行 Step 3（Backup）。');
  }
  Logger.log('========== Step 2: Dry-run 结束 ==========');
  return { total: rows.length, mismatches: mismatches };
}

// ============================================================
// Step 3 — Backup / checkpoint
// ============================================================

/**
 * 对整张 Spreadsheet 做一次完整复制作为 checkpoint——这是"生产数据"，
 * 选最保守、最容易验证/回滚的方式（整表复制），不是只截取受影响的
 * 几行。复制出来的文件名里带时间戳，方便识别。
 */
function runDueDateMigration_Step3_Backup() {
  Logger.log('========== Step 3: Backup 开始 ==========');
  var anchorSheet = getSheet_('Tasks');
  var ss = anchorSheet.getParent();
  var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
  var backupName = '[Due-Date-Migration-Backup ' + timestamp + '] ' + ss.getName();

  var backupFile = ss.copy(backupName);

  Logger.log('✅ 已创建完整备份: "' + backupName + '"');
  Logger.log('备份文件 ID: ' + backupFile.getId());
  Logger.log('备份文件 URL: ' + backupFile.getUrl());
  Logger.log('请确认这个备份文件可以正常打开、数据完整，再进行 Step 4（Write）。');
  Logger.log('========== Step 3: Backup 结束 ==========');
  return backupFile.getUrl();
}

// ============================================================
// Step 4 — Write migration
// ============================================================

/**
 * 真正写入。要求显式传入确认字符串
 * 'I_REVIEWED_DRYRUN_AND_BACKUP_CONFIRMED'，防止误触发——这不是加密
 * 验证，只是强制一个"必须先读过 Step 2/3 输出、手动决定要不要继续"
 * 的动作，不是可以在没看结果的情况下顺手传对的东西。
 *
 * 只处理 status='dry_run_computed' 的行（不处理
 * DRY_RUN_MISMATCH/skipped_no_longer_date）。对每个受影响的列，写入
 * 前先确保该列纯文本格式（复用既有 _setPlainTextFormatForNewColumns_，
 * 不重新发明）——否则这次写进去的正确字符串，可能立刻又被 Sheets
 * 自动类型识别转换回 Date，白做。
 */
function runDueDateMigration_Step4_Write(confirmToken) {
  if (confirmToken !== 'I_REVIEWED_DRYRUN_AND_BACKUP_CONFIRMED') {
    Logger.log('❌ 未确认，不执行任何写入。请先完整看过 Step 2（Dry-run）和 Step 3（Backup）的输出，' +
      '确认无误后调用 runDueDateMigration_Step4_Write(\'I_REVIEWED_DRYRUN_AND_BACKUP_CONFIRMED\')。');
    return;
  }

  Logger.log('========== Step 4: Write 开始 ==========');

  // 先确保受影响的每张表、每一列都是纯文本格式，复用既有工具函数，
  // 不重复实现（跟 migrateSchemaDueTime() 用的是同一个函数）。
  DUE_DATE_MIGRATION_SHEETS.forEach(function (sheetName) {
    _setPlainTextFormatForNewColumns_(sheetName, DUE_DATE_MIGRATION_COLUMNS);
  });

  var logSheet = _getDueDateMigrationLogSheet_();
  var rows = _readMigrationLogRows_().filter(function (r) { return r.status === 'dry_run_computed'; });

  if (rows.length === 0) {
    Logger.log('没有 status=dry_run_computed 的行——请先跑 Step 2（Dry-run），并确认没有 mismatch。');
    Logger.log('========== Step 4: Write 结束（无可写入行） ==========');
    return 0;
  }

  var written = 0;
  rows.forEach(function (r) {
    var sheet = getSheet_(r.sheet_name);
    var headerMap = getHeaderMap_(sheet);
    var colIndex = headerMap[r.column_name];
    var cell = sheet.getRange(r.data_row_number, colIndex + 1);

    // 再读一次，双重确认现在仍然是 Date（防止 Step 2 到 Step 4 之间
    // 又被别的操作改动过）。
    var currentValue = cell.getValue();
    if (!(currentValue instanceof Date)) {
      Logger.log('  ℹ️ [' + r.sheet_name + ' row ' + r.data_row_number + '] 已经不是 Date，跳过写入。');
      _writeMigrationLogRow_(logSheet, r._sheetRowIndex, { status: 'skipped_no_longer_date' });
      return;
    }

    cell.setValue(r.predicted_new_value);
    written++;
    _writeMigrationLogRow_(logSheet, r._sheetRowIndex, {
      actual_written_value: r.predicted_new_value, status: 'written'
    });
  });

  Logger.log('✅ 已写入 ' + written + ' 个单元格（共 ' + rows.length + ' 个候选）。');
  Logger.log('接下来请运行 runDueDateMigration_Step5_ReadBackVerify() 确认读回结果。');
  Logger.log('========== Step 4: Write 结束 ==========');
  return written;
}

// ============================================================
// Step 5 — Read-back verification
// ============================================================

/**
 * 重新读一遍 Step 4 写过的每一个单元格，确认：
 *   1. 现在读回来是 string，不再是 Date（纯文本格式确实生效了）；
 *   2. 读回来的值跟 predicted_new_value 逐字节相等；
 *   3. Carson 要求的核心不变量——迁移前业务日期 == 迁移后业务日期
 *      （不是比较 Date 对象/时间戳，是比较 old_business_date 这个
 *      字符串本身是否等于新读回来的字符串里的日期部分）。
 * 任何一项不满足都标记 FAILED_VERIFICATION 并大声报错，不会静默通过。
 */
function runDueDateMigration_Step5_ReadBackVerify() {
  Logger.log('========== Step 5: Read-back Verification 开始 ==========');
  var logSheet = _getDueDateMigrationLogSheet_();
  var rows = _readMigrationLogRows_().filter(function (r) { return r.status === 'written'; });

  if (rows.length === 0) {
    Logger.log('没有 status=written 的行——请先跑 Step 4（Write）。');
    Logger.log('========== Step 5: Read-back Verification 结束（无待验证行） ==========');
    return { total: 0, failed: 0 };
  }

  var failed = 0;
  rows.forEach(function (r) {
    var sheet = getSheet_(r.sheet_name);
    var headerMap = getHeaderMap_(sheet);
    var colIndex = headerMap[r.column_name];
    var readBack = sheet.getRange(r.data_row_number, colIndex + 1).getValue();

    var isString = (typeof readBack === 'string');
    var exactMatch = (readBack === r.actual_written_value);
    var readBackBusinessDate = isString ? readBack.slice(0, 10) : '(not a string)';
    var businessDateMatch = (readBackBusinessDate === r.old_business_date);

    if (isString && exactMatch && businessDateMatch) {
      _writeMigrationLogRow_(logSheet, r._sheetRowIndex, { read_back_value: readBack, status: 'verified' });
    } else {
      failed++;
      Logger.log('  ❌ [' + r.sheet_name + ' row ' + r.data_row_number + ' task ' + r.task_id + ']  ' +
        'isString=' + isString + '  exactMatch=' + exactMatch +
        '  business_date: 迁移前=' + r.old_business_date + ' 迁移后=' + readBackBusinessDate +
        '（' + (businessDateMatch ? '一致' : '❌ 不一致，这是最不能接受的情况') + '）');
      _writeMigrationLogRow_(logSheet, r._sheetRowIndex, { read_back_value: readBack, status: 'FAILED_VERIFICATION' });
    }
  });

  Logger.log('');
  Logger.log('共验证 ' + rows.length + ' 行，失败 ' + failed + ' 行。');
  Logger.log(failed === 0
    ? '✅✅✅ 全部通过读回验证，迁移前后业务日期完全一致。接下来请依次跑 Identity regression → Recurring regression → Full Sprint regression。'
    : '❌ 存在验证失败的行——见上面 FAILED_VERIFICATION，需要人工排查，Due_Date_Migration_Log 分页里有完整记录可以回溯。');
  Logger.log('========== Step 5: Read-back Verification 结束 ==========');
  return { total: rows.length, failed: failed };
}
