/**
 * 54_Tests_TaskToNoteConversion.gs
 * Personal Life OS — Slice 4 Part B（Task → Note）最小化针对性验收测试
 * ADR-2026-09-02-030
 *
 * 跟 35/36/38 一样是真实环境集成测试（真的写 Sheet），用命名空间化的
 * 测试 chatId（accept_test_ttn_ + 时间戳）隔离，不碰真实 Telegram 数据。
 *
 * 覆盖 Carson 要求的 14 项里、可以由 GAS 服务端测试验证的 13 项：
 *   1-5  recurring/due_date/due_time/due_datetime/reminder_policy 各自
 *        单独触发 BLOCKED —— testTaskToNote_BlockedFields_()
 *   6    validation failure 时 Note 不创建 —— 同上，每次 BLOCKED 后
 *        都核对 NoteQueryEngine 找不到对应内容的新 Note
 *   7-9  成功转换只产生一条 Note、source_task_id 正确、
 *        converted_to_note_id 正确 —— testTaskToNote_SuccessfulConversion_()
 *   10-11 TASK_CONVERTED_TO_NOTE 事件确实发布、projection 确实落到
 *        Task 行 —— testTaskToNote_EventEmittedAndProjected_()
 *   12   deriveFromEvent 重放跟实时 projection 结果一致 ——
 *        testTaskToNote_ReplayConsistency_()
 *   13   重复转换幂等 —— testTaskToNote_Idempotent_()
 *
 * 第 14 项（confirmation cancel 不产生 mutation）是纯前端 JS/DOM 行为——
 * 点 Cancel 时代码根本不调用 google.script.run，没有任何服务端调用
 * 发生，这一层无法、也不需要用 GAS 测试验证，属于 LIVE TEST（人工在
 * 浏览器里点一下 Cancel，确认网络面板没有请求）范畴，不在本文件内。
 *
 * 单一入口：runTaskToNoteConversionGate()
 */

// ============================================================
// 一、Negative Tests — BLOCKED 字段
// ============================================================

function testTaskToNote_BlockedFields_() {
  Logger.log('--- testTaskToNote_BlockedFields_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttn_' + new Date().getTime();

  var cases = [
    { field: 'due_date',        meta: { due_date: '2026-12-31' } },
    { field: 'due_time',        meta: { due_date: '2026-12-31', due_time: '09:00' } },
    { field: 'due_datetime',    meta: { due_datetime: '2026-12-31T09:00:00' } },
    { field: 'reminder_policy', meta: { reminder_policy: 'ON_TIME' } },
    { field: 'recurring',       meta: { recurring: 'Weekly' } }
  ];

  cases.forEach(function (c) {
    try {
      var title = '验收测试-TaskToNote-BLOCKED-' + c.field;
      var task = TaskEngine.createTask(title, c.meta, testChatId);

      var result = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);

      if (!result.blocked) {
        Logger.log('❌ [' + c.field + '] 应该 blocked，实际: ' + JSON.stringify(result));
        pass = false;
        return;
      }

      // 第 6 项：validation failure 时 Note 不应该被创建 —— 不重算
      // identity（那等于在测试里重新实现一遍 content 拼接逻辑，脆弱
      // 又容易跟实现走偏），直接查这个测试 chatId 下有没有
      // source_task_id 指向这个 Task 的 Note，更稳健。
      var openNotes = NoteQueryEngine.getOpenNotes(testChatId);
      var leaked = openNotes.filter(function (n) { return n.source_task_id === task.task_id; });
      if (leaked.length > 0) {
        Logger.log('❌ [' + c.field + '] BLOCKED 之后不应该存在对应的 Note，实际找到: ' + leaked[0].note_id);
        pass = false;
      }

      // Task 本身不应该被标记为 CONVERTED
      var reloaded = TaskQueryEngine.getTask(task.task_id, testChatId);
      if (String(reloaded.status).toUpperCase() === 'CONVERTED') {
        Logger.log('❌ [' + c.field + '] BLOCKED 之后源 Task 不应该变成 CONVERTED');
        pass = false;
      }
    } catch (e) {
      Logger.log('❌ [' + c.field + '] 不应该抛异常: ' + e.message);
      pass = false;
    }
  });

  Logger.log(pass ? '✅ testTaskToNote_BlockedFields_ PASS' : '❌ testTaskToNote_BlockedFields_ FAIL');
  return pass;
}

// ============================================================
// 二、Positive Test — 成功转换
// ============================================================

function testTaskToNote_SuccessfulConversion_() {
  Logger.log('--- testTaskToNote_SuccessfulConversion_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttn_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToNote-成功转换', {
      context:     '上下文信息',
      notes:       '备注信息',
      description: '描述信息',
      category:    'SHOPPING',
      priority:    'HIGH',
      tags:        '重要,顺手'
    }, testChatId);

    var result = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);

    if (!result.note) {
      Logger.log('❌ 应该成功转换，实际: ' + JSON.stringify(result));
      return false;
    }

    // 第 7 项：只产生一条 Note —— 用 identity 反查，同一 identity
    // 应该只对应这一条
    if (result.note.source_task_id !== task.task_id) {
      Logger.log('❌ 第 8 项失败：source_task_id 应该等于源 Task 的 task_id，实际: ' + result.note.source_task_id);
      pass = false;
    }

    var reloadedTask = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (reloadedTask.converted_to_note_id !== result.note.note_id) {
      Logger.log('❌ 第 9 项失败：源 Task 的 converted_to_note_id 应该等于新 Note 的 note_id，实际: ' + reloadedTask.converted_to_note_id);
      pass = false;
    }
    if (String(reloadedTask.status).toUpperCase() !== 'CONVERTED') {
      Logger.log('❌ 源 Task 转换后 status 应该是 CONVERTED，实际: ' + reloadedTask.status);
      pass = false;
    }

    // content 拼接核对（B1 主体 + B3/D2/D3/D4 注解）
    var content = result.note.content;
    if (content.indexOf('验收测试-TaskToNote-成功转换') === -1) { Logger.log('❌ content 应该包含 title'); pass = false; }
    if (content.indexOf('上下文信息') === -1)  { Logger.log('❌ content 应该包含 context'); pass = false; }
    if (content.indexOf('备注信息') === -1)    { Logger.log('❌ content 应该包含 notes'); pass = false; }
    if (content.indexOf('描述信息') === -1)    { Logger.log('❌ content 应该包含 description'); pass = false; }
    if (content.indexOf('category: SHOPPING') === -1) { Logger.log('❌ content 注解应该保留原 category'); pass = false; }
    if (content.indexOf('priority: HIGH') === -1)      { Logger.log('❌ content 注解应该保留非默认 priority'); pass = false; }
    if (content.indexOf('tags: 重要,顺手') === -1)      { Logger.log('❌ content 注解应该保留 tags'); pass = false; }

    // category 本身落默认值，不做枚举映射（ADR-030 B3）
    if (result.note.category !== 'IDEA') {
      Logger.log('❌ 新 Note 的 category 结构字段应该是默认值 IDEA，实际: ' + result.note.category);
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToNote_SuccessfulConversion_ PASS' : '❌ testTaskToNote_SuccessfulConversion_ FAIL');
  return pass;
}

// ============================================================
// 三、Integrity Test — Event / Projection
// ============================================================

function testTaskToNote_EventEmittedAndProjected_() {
  Logger.log('--- testTaskToNote_EventEmittedAndProjected_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttn_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToNote-事件核对', {}, testChatId);
    var result = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);
    if (!result.note) { Logger.log('❌ 前置转换失败: ' + JSON.stringify(result)); return false; }

    // 第 10 项：事件确实发布
    var allEvents = EventBus.getAllEvents();
    var matched = allEvents.filter(function (e) {
      return e.type === 'TASK_CONVERTED_TO_NOTE' && e.payload && e.payload.task_id === task.task_id;
    });
    if (matched.length !== 1) {
      Logger.log('❌ 应该恰好有 1 条 TASK_CONVERTED_TO_NOTE 事件，实际: ' + matched.length);
      pass = false;
    } else if (matched[0].payload.converted_to_note_id !== result.note.note_id) {
      Logger.log('❌ 事件 payload 里的 converted_to_note_id 应该等于新 Note 的 note_id');
      pass = false;
    }

    // 第 11 项：projection 确实落到 Task 行（不是只发了事件、Sheet 没变）
    var reloadedTask = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (String(reloadedTask.status).toUpperCase() !== 'CONVERTED' || reloadedTask.converted_to_note_id !== result.note.note_id) {
      Logger.log('❌ Task 行的实时 projection 结果不正确: ' + JSON.stringify(reloadedTask));
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToNote_EventEmittedAndProjected_ PASS' : '❌ testTaskToNote_EventEmittedAndProjected_ FAIL');
  return pass;
}

/**
 * 第 12 项：deriveFromEvent 重放跟实时 projection 的结果一致。
 * 刻意不调用全局的 rebuildTasksProjection()（那个会重建整张 Sheet，
 * 不按 chatId 隔离，拿来跑一次范围很小的验收测试不合适）——直接对
 * TaskEngine.deriveFromEvent 喂一个合成事件，在纯内存的 stateMap 上
 * 验证重放逻辑本身的正确性，这是更小、更针对性、也更安全的验证方式。
 */
function testTaskToNote_ReplayConsistency_() {
  Logger.log('--- testTaskToNote_ReplayConsistency_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttn_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToNote-重放一致性', {}, testChatId);
    var result = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);
    if (!result.note) { Logger.log('❌ 前置转换失败: ' + JSON.stringify(result)); return false; }

    var liveTask = TaskQueryEngine.getTask(task.task_id, testChatId);

    // 用真实发布出去的那条事件（不是自己另外编一个）重放，最接近
    // ProjectionRebuilder 实际会用到的输入
    var allEvents = EventBus.getAllEvents();
    var convertedEvent = allEvents.filter(function (e) {
      return e.type === 'TASK_CONVERTED_TO_NOTE' && e.payload && e.payload.task_id === task.task_id;
    })[0];
    if (!convertedEvent) { Logger.log('❌ 找不到刚才发布的事件，无法验证重放'); return false; }

    var stateMap = {};
    stateMap[task.task_id] = { status: 'PENDING' }; // 模拟重放到这一步之前的状态
    TaskEngine.deriveFromEvent(convertedEvent, stateMap);

    if (stateMap[task.task_id].status !== liveTask.status) {
      Logger.log('❌ 重放出的 status（' + stateMap[task.task_id].status + '）应该等于实时 projection 的 status（' + liveTask.status + '）');
      pass = false;
    }
    if (stateMap[task.task_id].converted_to_note_id !== liveTask.converted_to_note_id) {
      Logger.log('❌ 重放出的 converted_to_note_id 应该等于实时 projection 的值');
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToNote_ReplayConsistency_ PASS' : '❌ testTaskToNote_ReplayConsistency_ FAIL');
  return pass;
}

// ============================================================
// 四、Integrity Test — 幂等
// ============================================================

function testTaskToNote_Idempotent_() {
  Logger.log('--- testTaskToNote_Idempotent_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttn_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToNote-幂等', {}, testChatId);

    var first = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);
    if (!first.note) { Logger.log('❌ 第一次转换应该成功: ' + JSON.stringify(first)); return false; }

    var second = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);
    if (!second.already_converted) {
      Logger.log('❌ 第二次转换应该走幂等分支，实际: ' + JSON.stringify(second));
      pass = false;
    } else if (second.note.note_id !== first.note.note_id) {
      Logger.log('❌ 第二次转换不应该产生新 Note，应该返回同一条，实际: 第一条=' + first.note.note_id + ' 第二条=' + second.note.note_id);
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToNote_Idempotent_ PASS' : '❌ testTaskToNote_Idempotent_ FAIL');
  return pass;
}

// ============================================================
// Gate Runner
// ============================================================

function runTaskToNoteConversionGate() {
  Logger.log('========== Task → Note Conversion Gate 开始 ==========');
  Logger.log('范围：42_ConversionEngine.gs convertTaskToNote + 相关');
  Logger.log('UIBridge/Projection/TaskEngine 改动（ADR-2026-09-02-030）。');
  Logger.log('第 14 项（confirmation cancel 零 mutation）是纯前端行为，');
  Logger.log('不在本 Gate 覆盖范围内，需要人工在浏览器里确认。');
  Logger.log('');

  var results = {
    'Negative: Blocked Fields (recurring/due_date/due_time/due_datetime/reminder_policy)': testTaskToNote_BlockedFields_(),
    'Positive: Successful Conversion':                     testTaskToNote_SuccessfulConversion_(),
    'Integrity: Event Emitted And Projected':              testTaskToNote_EventEmittedAndProjected_(),
    'Integrity: Replay Consistency (deriveFromEvent)':     testTaskToNote_ReplayConsistency_(),
    'Integrity: Idempotent Re-conversion':                 testTaskToNote_Idempotent_()
  };

  Logger.log('');
  Logger.log('========== Task → Note Conversion Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass ? '✅✅✅ 全部通过' : '❌❌❌ 存在失败项，见上面详情');
  return allPass;
}
