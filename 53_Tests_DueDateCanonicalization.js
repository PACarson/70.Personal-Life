/**
 * 53_Tests_DueDateCanonicalization.gs
 * Personal Life OS — Track 1B Regression Gate: Due-Date Canonicalization
 *
 * 对应 00_Due_Date_Canonicalization_Audit.md「十一」提议的测试清单 +
 * Carson 2026-08-22 批准消息里要求的 Recurring regression 这一步。
 *
 * 前 5 项是纯函数单元测试（不需要真实 Sheet）；后面几项是真实环境
 * 集成测试（真的写 Sheet），用命名空间化的测试 chatId 隔离，风格跟
 * 39_Tests_IdentityScopeKey.gs 一致。
 *
 * 单一入口 runDueDateCanonicalizationGate()。Carson 的完整回归顺序：
 *   本文件 → runIdentityScopeKeyRegressionGate()（39，Identity
 *   regression）→ runSprint3AcceptanceGate() / runUIBridgeSlice3Gate() /
 *   runUIBridgeInteractionsGate()（Full Sprint regression）。
 */

// ============================================================
// 一、canonicalizeDueValue() 纯函数单元测试
// ============================================================

function testDueDate_CanonicalString_NoOp_() {
  Logger.log('--- testDueDate_CanonicalString_NoOp_ 开始 ---');
  var pass = true;
  var result = IdentityEngine.canonicalizeDueValue('2026-08-25');
  if (result !== '2026-08-25') {
    Logger.log('❌ canonical string 输入应该逐字节原样返回，实际: ' + JSON.stringify(result));
    pass = false;
  }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testDueDate_CanonicalDatetimeString_NoOp_() {
  Logger.log('--- testDueDate_CanonicalDatetimeString_NoOp_ 开始 ---');
  var pass = true;
  var result = IdentityEngine.canonicalizeDueValue('2026-08-25T09:00:00');
  if (result !== '2026-08-25T09:00:00') {
    Logger.log('❌ 带时间的 canonical string 应该逐字节原样返回，实际: ' + JSON.stringify(result));
    pass = false;
  }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

/**
 * 核心回归点——直接复现 Carson 真实环境诊断出的那个具体场景：
 * getTask() 读回 due_date = Date("2026-08-24T16:00:00.000Z")（脚本
 * 时区 +8 下代表 2026-08-25 00:00:00），canonicalize 必须正确还原成
 * "2026-08-25"，不能是 "2026-08-24"。
 */
function testDueDate_DateObject_RecoversOriginalBusinessDate_() {
  Logger.log('--- testDueDate_DateObject_RecoversOriginalBusinessDate_ 开始 ---');
  var pass = true;

  // Carson 真实环境诊断的具体数字是 due_date="2026-08-25" 被误判后读回
  // "2026-08-24T16:00:00.000Z"——那是因为他的脚本时区是 +8（
  // 2026-08-25 00:00:00 +08:00 换算成 UTC 正是这个值）。这里不直接
  // 硬编码这个 UTC 字符串（那只在脚本时区恰好是 +8 时才等价于午夜，
  // 换一个时区跑这个测试会不成立），改用本地时区构造——在真实 GAS
  // 里，"本地"就是 Session.getScriptTimeZone()，这个构造在任何单一
  // 脚本时区下都正确代表"这一天的午夜"，不依赖某个具体时区。
  var midnightAug25 = new Date(2026, 7, 25, 0, 0, 0);
  var result = IdentityEngine.canonicalizeDueValue(midnightAug25);

  if (result !== '2026-08-25') {
    Logger.log('❌ 应该还原成 "2026-08-25"，实际: ' + JSON.stringify(result));
    pass = false;
  }
  if (result.indexOf('2026-08-24') === 0) {
    Logger.log('❌❌❌ 这正是本次 bug 的错误答案——用 UTC 表示法误判了业务日期，回归失败！');
    pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testDueDate_DateObjectWithTime_PreservesTimeComponent_() {
  Logger.log('--- testDueDate_DateObjectWithTime_PreservesTimeComponent_ 开始 ---');
  var pass = true;
  var tz = Session.getScriptTimeZone();
  // 构造一个"脚本时区下 2026-08-25 09:00:00"的 Date，不管脚本时区是
  // 什么，都用 Utilities.formatDate 反向构造，不硬编码某个时区偏移。
  var probe = new Date(Date.UTC(2026, 7, 25, 9, 0, 0));
  var localHour = Number(Utilities.formatDate(probe, tz, 'H'));
  // 只要不是恰好午夜就行——用这个探测值直接测，不用关心具体是几点。
  if (localHour === 0) {
    Logger.log('ℹ️ 探测值恰好落在脚本时区的午夜，跳过这条时间保留断言（极小概率的时区巧合，不影响其他测试）。');
    Logger.log(pass ? '✅ PASS（跳过）' : '❌ FAIL');
    return pass;
  }
  var result = IdentityEngine.canonicalizeDueValue(probe);
  if (result.indexOf('T') === -1) {
    Logger.log('❌ 带时间的 Date 对象应该转成带 "T" 的完整 datetime 字符串，实际: ' + JSON.stringify(result));
    pass = false;
  }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testDueDate_EmptyNullUndefined_ReturnsEmptyString_() {
  Logger.log('--- testDueDate_EmptyNullUndefined_ReturnsEmptyString_ 开始 ---');
  var pass = true;
  if (IdentityEngine.canonicalizeDueValue('') !== '') { Logger.log('❌ 空字符串应该返回空字符串'); pass = false; }
  if (IdentityEngine.canonicalizeDueValue(null) !== '') { Logger.log('❌ null 应该返回空字符串'); pass = false; }
  if (IdentityEngine.canonicalizeDueValue(undefined) !== '') { Logger.log('❌ undefined 应该返回空字符串'); pass = false; }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 二、真实 Sheet 集成测试
// ============================================================

/**
 * 这就是此前失败的 testIdentityScope_UpdateTaskPreservesScope_ 那个
 * 场景——canonicalization 上线后，这条应该重新变成 PASS（不需要改
 * 39_Tests_IdentityScopeKey.gs 里那条测试本身的期望值，错的一直是被
 * 测代码缺一层归一化，不是测试期望值錯）。这里额外单独留一条，只
 * 聚焦"只给日期没给时间"这个最常见场景，避免以后重构时被误认为是
 * 39 那边的重复代码而删掉。
 */
function testDueDate_UpdateTaskEditPreservesBusinessDate_() {
  Logger.log('--- testDueDate_UpdateTaskEditPreservesBusinessDate_ 开始 ---');
  var pass = true;
  var testChatId = 'due_date_canon_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('canonicalization 回归：待编辑', {
      due_date: '2026-08-25', priority: 'MEDIUM', category: 'GENERAL'
    }, testChatId);

    var identityBeforeEdit = task.identity;

    var updated = TaskEngine.updateTask(task.task_id, { title: 'canonicalization 回归：已编辑' }, testChatId);
    if (!updated || !updated.identity) {
      Logger.log('❌ updateTask 应该返回带 identity 的 payload');
      pass = false;
    } else {
      // 编辑没有碰 due_date，重算出来的 identity 里的 due 值分量应该
      // 还原成跟创建时同一个业务日期——用同样的 7 参数手工重算一次来
      // 验证，而不是直接比较 identity 字符串本身（title 变了，identity
      // 本来就应该不同；这里验证的是"due 值分量没有跑偏"）。
      var existing = TaskQueryEngine.getTask(task.task_id, testChatId);
      var expectedIdentity = IdentityEngine.generateTaskIdentity(
        existing.chat_id, 'canonicalization 回归：已编辑',
        IdentityEngine.resolveIdentityDueValue({ due_date: '2026-08-25' }),
        existing.recurring || '', existing.priority || 'MEDIUM',
        existing.category || 'GENERAL', existing.workflow_id || ''
      );
      if (updated.identity !== expectedIdentity) {
        Logger.log('❌ 编辑后 identity 应该等于"新标题 + 原业务日期"重算结果，实际不等——canonicalization 没有生效？');
        Logger.log('   updated.identity=' + updated.identity);
        Logger.log('   expectedIdentity=' + expectedIdentity);
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message + '\n' + e.stack); pass = false;
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

/**
 * Recurring regression（Carson 明确要求的独立一步）。
 * 21_RecurringEngine.spawnNextIfNeeded 目前"没出错"完全是靠
 * String(Date)→new Date(string) 这条 JS 隐式转换链条侥幸撑住的（见
 * 审计「四」第 4 条）——canonicalization 上线后，resolveIdentityDueValue
 * 内部直接处理 Date 输入，不再依赖这条巧合链条。这条测试直接验证：
 * 喂一个 due_date 是真实 Date 对象（不是 string）的 task 快照进去，
 * 算出来的"下一次到期日"仍然正确。
 */
function testDueDate_RecurringEngineHandlesDateObject_() {
  Logger.log('--- testDueDate_RecurringEngineHandlesDateObject_ 开始 ---');
  var pass = true;
  var tz = Session.getScriptTimeZone();

  // new Date(y, m, d, 0, 0, 0) 在真实 GAS 里就是"脚本时区下那一天的
  // 午夜"——Apps Script 的整个运行时是按 Session.getScriptTimeZone()
  // 配置的，不像 Node 那样"本地时区构造"和"Intl 时区格式化"可能是
  // 两个不同的时区来源，这里不需要额外判断，直接构造即可。
  var fakeTaskWithDateObject = { due_date: new Date(2026, 7, 25, 0, 0, 0), recurring: 'Daily' };

  var resolvedDueValue = IdentityEngine.resolveIdentityDueValue(fakeTaskWithDateObject);
  var nextDueValue = computeNextDueDateFromLabel(resolvedDueValue, 'Daily');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDueValue)) {
    Logger.log('❌ Daily 续期应该产出纯日期格式 yyyy-MM-dd，实际: ' + JSON.stringify(nextDueValue));
    pass = false;
  } else if (nextDueValue !== '2026-08-26') {
    Logger.log('❌ Daily 续期应该是原日期 8/25 的下一天 8/26，实际: ' + nextDueValue);
    pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 三、单一入口
// ============================================================

function runDueDateCanonicalizationGate() {
  Logger.log('========== Due-Date Canonicalization Regression Gate 开始 ==========');
  Logger.log('对应 00_Due_Date_Canonicalization_Audit.md「十一」+ Carson');
  Logger.log('2026-08-22 批准消息的 Recurring regression 要求。');
  Logger.log('');

  var results = {
    '1. Canonical string 原样返回':          testDueDate_CanonicalString_NoOp_(),
    '2. 带时间 canonical string 原样返回':    testDueDate_CanonicalDatetimeString_NoOp_(),
    '3. Date 对象还原成正确业务日期（核心回归点）': testDueDate_DateObject_RecoversOriginalBusinessDate_(),
    '4. 带时间的 Date 对象保留时间分量':       testDueDate_DateObjectWithTime_PreservesTimeComponent_(),
    '5. 空值/null/undefined 处理':            testDueDate_EmptyNullUndefined_ReturnsEmptyString_(),
    '6. updateTask 编辑后业务日期不变':        testDueDate_UpdateTaskEditPreservesBusinessDate_(),
    '7. Recurring regression（RecurringEngine 处理 Date 输入）': testDueDate_RecurringEngineHandlesDateObject_()
  };

  Logger.log('');
  Logger.log('========== Due-Date Canonicalization Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过。接下来请依次跑 runIdentityScopeKeyRegressionGate()' +
      '（Identity regression）→ runSprint3AcceptanceGate() /' +
      ' runUIBridgeSlice3Gate() / runUIBridgeInteractionsGate()' +
      '（Full Sprint regression），完成 Carson 要求的完整回归顺序。'
    : '❌ 有测试未通过——请把完整 Logger 输出发回去，不要继续后续回归步骤。');
  Logger.log('========== Due-Date Canonicalization Gate 结束 ==========');

  return allPass;
}
