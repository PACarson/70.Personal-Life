/**
 * 60_ReminderRequestConsumer_Tests.js
 * Reminder OS — 23_ReminderRequestConsumer.js 的测试
 *
 * 跟 50_ReminderEngine_Tests.js 同款风格：手动 Logger.log PASS/FAIL，不
 * 引入新的测试框架依赖；同样依赖 mocks.js 提供的内存版 GAS shim（真实
 * 21_SheetUtils.js 源码 eval 进去，不是重新手写一份简化逻辑），只能通过
 * Node 沙盒运行（本地跑法见 run_reminder_request_consumer_tests.js），
 * 不支持直接贴进 Apps Script 编辑器。
 */

function runReminderRequestConsumerTests() {
  if (typeof global === 'undefined' || typeof global.__resetStore !== 'function') {
    var envMsg = '[ReminderRequestConsumerTests] 这份测试套件只能通过 Node 沙盒运行' +
      '（node run_reminder_request_consumer_tests.js），不支持直接在 GAS 编辑器里跑——' +
      '原因同 50_ReminderEngine_Tests.js 文件头说明。';
    Logger.log('❌ ' + envMsg);
    throw new Error(envMsg);
  }

  var pass = 0, fail = 0;

  function check(label, actual, expected) {
    var a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a === e) { pass++; } else { fail++; Logger.log('❌ FAIL: ' + label + '\n   期望: ' + e + '\n   实际: ' + a); }
  }
  function checkTrue(label, actual) {
    if (actual === true) { pass++; } else { fail++; Logger.log('❌ FAIL: ' + label + ' (期望 true, 实际 ' + actual + ')'); }
  }

  var EVENTS_HEADERS = ['event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source'];
  var RULES_HEADERS = ['rule_id', 'task_id', 'chat_id', 'offset_minutes', 'offset_label',
    'channels', 'rule_status', 'source', 'resolved_fire_ats', 'created_at'];

  function reminderRequestedRow(eventId, taskId, offsets, opts) {
    opts = opts || {};
    return {
      event_id: eventId,
      timestamp: opts.timestamp || new Date().toISOString(),
      type: 'REMINDER_REQUESTED',
      chat_id: opts.eventChatId || 'evt-chat-should-not-be-used',
      payload: JSON.stringify({
        entity_type: opts.entityType || 'TASK',
        entity_id: taskId,
        reminder_policy: { offsets: offsets }
      }),
      source: 'ReminderConnector'
    };
  }

  function setUp(tasks) {
    global.__resetStore();
    global.__seedSheet('Events', EVENTS_HEADERS, []);
    global.__seedSheet('ReminderRules', RULES_HEADERS, []);
    global.__mockPendingTasks = tasks || [];
    // 清空 watermark，模拟全新脚本执行（PropertiesService mock 本身是
    // 跨 setUp 共用的模块级变量，必须显式清空，否则会串场）。
    var props = global.PropertiesService.getScriptProperties();
    props.deleteProperty('REMINDER_REQUEST_CONSUMER_LAST_ROW');
  }

  function appendEvents(rows) {
    var sheet = global.SpreadsheetApp.openById().getSheetByName('Events');
    rows.forEach(function (r) {
      sheet.appendRow([r.event_id, r.timestamp, r.type, r.chat_id, r.payload, r.source]);
    });
  }

  Logger.log('========== ReminderRequestConsumer 测试开始 ==========');

  // ---- 场景 A：首次运行 + 正常登记（单 offset）----
  (function () {
    setUp([{ task_id: 'T1', chat_id: 'C1', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-1', 'T1', [{ value: 30, unit: 'minutes' }])]);

    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景A：processed=1', result.processed, 1);

    var rules = global.__readSheetRows('ReminderRules');
    check('场景A：生成1条规则', rules.length, 1);
    check('场景A：task_id正确', rules[0].task_id, 'T1');
    check('场景A：chat_id来自Task权威行而不是事件payload', rules[0].chat_id, 'C1');
    check('场景A：offset_minutes正确', rules[0].offset_minutes, 30);
    check('场景A：source标记为event_registered', rules[0].source, 'event_registered');
  })();

  // ---- 场景 B：多个 offset——一个 offset 一行 ----
  (function () {
    setUp([{ task_id: 'T2', chat_id: 'C2', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-2', 'T2', [
      { value: 1, unit: 'days' }, { value: 30, unit: 'minutes' }
    ])]);

    ReminderRequestConsumer.consumeReminderRequests();
    var rules = global.__readSheetRows('ReminderRules').filter(function (r) { return r.task_id === 'T2'; });
    check('场景B：2个offset生成2条规则', rules.length, 2);
    var minutesSet = rules.map(function (r) { return r.offset_minutes; }).sort(function (a, b) { return a - b; });
    check('场景B：offset换算正确（1天=1440分钟）', minutesSet, [30, 1440]);
  })();

  // ---- 场景 C：entity_type=PROJECT——跳过，不生成规则，水位仍推进 ----
  (function () {
    setUp([{ task_id: 'T3', chat_id: 'C3', status: 'PENDING' }]);
    appendEvents([
      reminderRequestedRow('EVT-3', 'P1', [{ value: 30, unit: 'minutes' }], { entityType: 'PROJECT' }),
      reminderRequestedRow('EVT-4', 'T3', [{ value: 15, unit: 'minutes' }])
    ]);

    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景C：PROJECT事件计入skippedNotTask', result.skippedNotTask, 1);
    check('场景C：紧跟着的TASK事件正常处理', result.processed, 1);
    var rules = global.__readSheetRows('ReminderRules');
    checkTrue('场景C：没有为PROJECT生成任何规则', rules.every(function (r) { return r.task_id !== 'P1'; }));
  })();

  // ---- 场景 D：幂等核心——相同 task_id + 相同 policy 重复登记，
  //             不删不插，rule_id 和 resolved_fire_ats 原样保留 ----
  (function () {
    setUp([{ task_id: 'T4', chat_id: 'C4', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-5', 'T4', [{ value: 30, unit: 'minutes' }])]);
    ReminderRequestConsumer.consumeReminderRequests();

    var rulesBefore = global.__readSheetRows('ReminderRules');
    // 模拟"这条规则已经真正发送过一次提醒"——resolved_fire_ats 不再是空对象
    var sheet = global.SpreadsheetApp.openById().getSheetByName('ReminderRules');
    var headerMap = { rule_id: 0, task_id: 1, chat_id: 2, offset_minutes: 3, offset_label: 4, channels: 5, rule_status: 6, source: 7, resolved_fire_ats: 8, created_at: 9 };
    sheet.getRange(2, headerMap.resolved_fire_ats + 1).setValue(JSON.stringify({ telegram: '2026-08-27T10:00:00.000Z' }));

    // 同一个 task_id、同一个 policy，再来一次（模拟事件重复/水位重跑）
    appendEvents([reminderRequestedRow('EVT-6', 'T4', [{ value: 30, unit: 'minutes' }])]);
    var result = ReminderRequestConsumer.consumeReminderRequests();

    check('场景D：unchanged计数命中', result.unchanged, 1);
    var rulesAfter = global.__readSheetRows('ReminderRules');
    check('场景D：规则行数不变（没有堆积）', rulesAfter.length, 1);
    check('场景D：rule_id没有变化', rulesAfter[0].rule_id, rulesBefore[0].rule_id);
    check('场景D：resolved_fire_ats（已发送历史）原样保留，没有被重置',
      rulesAfter[0].resolved_fire_ats, JSON.stringify({ telegram: '2026-08-27T10:00:00.000Z' }));
  })();

  // ---- 场景 E：policy 真的变了——替换（Carson 批准的 Option 1）----
  (function () {
    setUp([{ task_id: 'T5', chat_id: 'C5', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-7', 'T5', [{ value: 30, unit: 'minutes' }])]);
    ReminderRequestConsumer.consumeReminderRequests();
    var oldRuleId = global.__readSheetRows('ReminderRules')[0].rule_id;

    appendEvents([reminderRequestedRow('EVT-8', 'T5', [{ value: 2, unit: 'hours' }])]);
    var result = ReminderRequestConsumer.consumeReminderRequests();

    check('场景E：processed计入替换', result.processed, 1);
    var rulesAfter = global.__readSheetRows('ReminderRules');
    check('场景E：仍然只有1条规则（旧的被删，不是堆积）', rulesAfter.length, 1);
    checkTrue('场景E：rule_id已经不是旧的（真正替换，不是复用）', rulesAfter[0].rule_id !== oldRuleId);
    check('场景E：offset_minutes更新为新policy（2小时=120分钟）', rulesAfter[0].offset_minutes, 120);
  })();

  // ---- 场景 F：Stale——entity_id 查无此 pending Task，事件已超过阈值 ----
  (function () {
    setUp([]); // 没有任何 pending task
    var oldTimestamp = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3小时前，超过2小时阈值
    appendEvents([reminderRequestedRow('EVT-9', 'T-GONE', [{ value: 30, unit: 'minutes' }], { timestamp: oldTimestamp })]);

    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景F：计入stale', result.stale, 1);
    check('场景F：不生成任何规则', global.__readSheetRows('ReminderRules').length, 0);
  })();

  // ---- 场景 G：entity_id 查无此 Task，但事件还在容忍窗口内——等待重试，
  //             水位不越过这一行 ----
  (function () {
    setUp([]);
    var recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5分钟前，在2小时阈值内
    appendEvents([reminderRequestedRow('EVT-10', 'T-NOT-YET', [{ value: 30, unit: 'minutes' }], { timestamp: recentTimestamp })]);

    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景G：计入pendingRetry', result.pendingRetry, 1);
    check('场景G：不生成任何规则', global.__readSheetRows('ReminderRules').length, 0);

    // 下一轮：task 出现了，应该能正常处理，且水位没有跳过这一行
    global.__mockPendingTasks = [{ task_id: 'T-NOT-YET', chat_id: 'C-NEW', status: 'PENDING' }];
    var result2 = ReminderRequestConsumer.consumeReminderRequests();
    check('场景G：task出现后下一轮正常登记', result2.processed, 1);
  })();

  // ---- 场景 H：空/无效 policy——判定无效，不生成规则，水位仍推进 ----
  (function () {
    setUp([{ task_id: 'T6', chat_id: 'C6', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-11', 'T6', [])]); // offsets 为空数组

    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景H：不计入processed', result.processed, 0);
    check('场景H：不生成任何规则', global.__readSheetRows('ReminderRules').length, 0);
  })();

  // ---- 场景 I：增量水位——已处理过的事件不会被重新扫描 ----
  (function () {
    setUp([{ task_id: 'T7', chat_id: 'C7', status: 'PENDING' }]);
    appendEvents([reminderRequestedRow('EVT-12', 'T7', [{ value: 10, unit: 'minutes' }])]);
    ReminderRequestConsumer.consumeReminderRequests();

    // 第二轮：没有新事件——不应该重新处理 EVT-12
    var result = ReminderRequestConsumer.consumeReminderRequests();
    check('场景I：无新事件时processed=0', result.processed, 0);
    check('场景I：无新事件时unchanged=0（没有重新扫描旧行）', result.unchanged, 0);
  })();

  Logger.log('========== ReminderRequestConsumer 测试结束：' + pass + ' passed, ' + fail + ' failed ==========');
  return { pass: pass, fail: fail };
}
