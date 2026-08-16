/**
 * 38_Tests_UIBridge.gs
 * Personal Life OS — UI Vertical Slice 1 Tests（Note → Task）
 *
 * 跟 35/36 一样是真实环境集成测试（真的写 Sheet），用命名空间化的测试
 * chatId（accept_test_ui_ + 时间戳）隔离，不碰真实 Telegram 数据。
 * 结构对照 UI_Architecture_Audit_Phase0.md「Testing Requirements」：
 * Positive / Negative / Integrity 三类。
 *
 * 单一入口 runUIBridgeSlice1Gate()。
 */

// ============================================================
// 一、Positive Tests
// ============================================================

function testUIBridge_CreateNote_Success_() {
  Logger.log('--- testUIBridge_CreateNote_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var testOwner = 'test-ui@example.com';

  try {
    var result = ui_createNote('验收测试：跟进 Developer defect', { chatId: testChatId, decisionOwner: testOwner });

    if (!result.ok) {
      Logger.log('❌ 合法输入应该成功，实际: ' + JSON.stringify(result));
      pass = false;
    } else {
      if (result.note.content !== '验收测试：跟进 Developer defect') { Logger.log('❌ content 不对'); pass = false; }
      if (result.note.decision_owner !== testOwner) { Logger.log('❌ decision_owner 没有正确落到 Web Identity，实际: ' + result.note.decision_owner); pass = false; }
      if (result.note.chat_id !== testChatId) { Logger.log('❌ chat_id 不对'); pass = false; }
      if (result.note.created_method !== 'Manual') { Logger.log('❌ created_method 应该是 Manual，实际: ' + result.note.created_method); pass = false; }
      if (result.note.creator !== 'User') { Logger.log('❌ creator 应该是 User'); pass = false; }
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常（Bridge 应该 catch 住并返回 ok:false）: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_CreateNote_Success_ PASS' : '❌ testUIBridge_CreateNote_Success_ FAIL');
  return pass;
}

function testUIBridge_GetOpenNotes_ReflectsCreatedNote_() {
  Logger.log('--- testUIBridge_GetOpenNotes_ReflectsCreatedNote_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var created = ui_createNote('验收测试：买洗衣液', { chatId: testChatId });
    if (!created.ok) { Logger.log('❌ 前置创建失败: ' + JSON.stringify(created)); return false; }

    var listResult = ui_getOpenNotes({ chatId: testChatId });
    if (!listResult.ok) { Logger.log('❌ 查询失败: ' + JSON.stringify(listResult)); pass = false; }
    else {
      var found = listResult.notes.some(function (n) { return n.note_id === created.note.note_id; });
      if (!found) {
        Logger.log('❌ 写完之后立刻查询应该能看到——Projection 没有同步刷新，或者查询走错了 chatId');
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_GetOpenNotes_ReflectsCreatedNote_ PASS' : '❌ testUIBridge_GetOpenNotes_ReflectsCreatedNote_ FAIL');
  return pass;
}

function testUIBridge_ConvertNoteToTask_Success_() {
  Logger.log('--- testUIBridge_ConvertNoteToTask_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var testOwner = 'test-ui@example.com';

  try {
    var created = ui_createNote('验收测试：研究新的 DJI 相机', { chatId: testChatId, decisionOwner: testOwner });
    if (!created.ok) { Logger.log('❌ 前置创建失败'); return false; }

    var converted = ui_convertNoteToTask(created.note.note_id, { chatId: testChatId, decisionOwner: testOwner });
    if (!converted.ok) {
      Logger.log('❌ 转换应该成功，实际: ' + JSON.stringify(converted));
      pass = false;
    } else {
      if (converted.task.title !== '验收测试：研究新的 DJI 相机') { Logger.log('❌ Task 标题应该继承 Note 内容'); pass = false; }
      if (converted.task.decision_owner !== testOwner) {
        Logger.log('❌ 转换出来的 Task 应该保持跟源 Note 一样的 decision_owner，实际: ' + converted.task.decision_owner);
        pass = false;
      }
      if (converted.task.created_method !== 'Converted') { Logger.log('❌ created_method 应该是 Converted'); pass = false; }
      if (converted.already_converted) { Logger.log('❌ 第一次转换不应该是 already_converted'); pass = false; }
    }

    // Cleanup（跟 35/36 同惯例，能收尾就收尾）
    if (converted.ok && converted.task && converted.task.task_id) {
      try { TaskEngine.cancelTask(converted.task.task_id, testChatId); } catch (ignore) {}
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertNoteToTask_Success_ PASS' : '❌ testUIBridge_ConvertNoteToTask_Success_ FAIL');
  return pass;
}

// ============================================================
// 二、Negative Tests
// ============================================================

function testUIBridge_CreateNote_EmptyOrWhitespace_() {
  Logger.log('--- testUIBridge_CreateNote_EmptyOrWhitespace_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  [['', 'EMPTY_CONTENT'], ['   ', 'EMPTY_CONTENT'], [null, 'EMPTY_CONTENT']].forEach(function (pair) {
    var result = ui_createNote(pair[0], { chatId: testChatId });
    if (result.ok || result.code !== pair[1]) {
      Logger.log('❌ 输入 ' + JSON.stringify(pair[0]) + ' 应该返回 ' + pair[1] + '，实际: ' + JSON.stringify(result));
      pass = false;
    }
  });

  Logger.log(pass ? '✅ testUIBridge_CreateNote_EmptyOrWhitespace_ PASS' : '❌ testUIBridge_CreateNote_EmptyOrWhitespace_ FAIL');
  return pass;
}

function testUIBridge_ConvertNoteToTask_MissingId_() {
  Logger.log('--- testUIBridge_ConvertNoteToTask_MissingId_ 开始 ---');
  var pass = true;

  [undefined, null, ''].forEach(function (badId) {
    var result = ui_convertNoteToTask(badId, { chatId: 'accept_test_ui_x' });
    if (result.ok || result.code !== 'MISSING_NOTE_ID') {
      Logger.log('❌ noteId=' + JSON.stringify(badId) + ' 应该返回 MISSING_NOTE_ID，实际: ' + JSON.stringify(result));
      pass = false;
    }
  });

  Logger.log(pass ? '✅ testUIBridge_ConvertNoteToTask_MissingId_ PASS' : '❌ testUIBridge_ConvertNoteToTask_MissingId_ FAIL');
  return pass;
}

function testUIBridge_ConvertNoteToTask_InvalidId_() {
  Logger.log('--- testUIBridge_ConvertNoteToTask_InvalidId_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  var result = ui_convertNoteToTask('NOTE-DOES-NOT-EXIST-99999', { chatId: testChatId });
  if (result.ok || result.code !== 'NOT_FOUND') {
    Logger.log('❌ 不存在的 noteId 应该返回 NOT_FOUND（不是裸异常），实际: ' + JSON.stringify(result));
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertNoteToTask_InvalidId_ PASS' : '❌ testUIBridge_ConvertNoteToTask_InvalidId_ FAIL');
  return pass;
}

// ============================================================
// 三、Integrity Tests
// ============================================================

function testUIBridge_ConvertNoteToTask_NoDuplicateOnRetry_() {
  Logger.log('--- testUIBridge_ConvertNoteToTask_NoDuplicateOnRetry_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var created = ui_createNote('验收测试：重复提交检查', { chatId: testChatId });
    if (!created.ok) { Logger.log('❌ 前置创建失败'); return false; }

    var first = ui_convertNoteToTask(created.note.note_id, { chatId: testChatId });
    var second = ui_convertNoteToTask(created.note.note_id, { chatId: testChatId }); // 模拟用户手滑点两下

    if (!first.ok || !second.ok) {
      Logger.log('❌ 两次调用都应该成功返回（第二次是幂等返回，不是报错）: ' + JSON.stringify(first) + ' / ' + JSON.stringify(second));
      pass = false;
    } else {
      if (first.task.task_id !== second.task.task_id) {
        Logger.log('❌ 重复转换产生了两个不同的 Task——duplicate entity bug: ' + first.task.task_id + ' vs ' + second.task.task_id);
        pass = false;
      }
      if (!second.already_converted) {
        Logger.log('❌ 第二次应该标记 already_converted:true');
        pass = false;
      }
    }

    if (first.ok && first.task && first.task.task_id) {
      try { TaskEngine.cancelTask(first.task.task_id, testChatId); } catch (ignore) {}
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertNoteToTask_NoDuplicateOnRetry_ PASS' : '❌ testUIBridge_ConvertNoteToTask_NoDuplicateOnRetry_ FAIL');
  return pass;
}

function testUIBridge_ConvertedNote_NoLongerInOpenList_() {
  Logger.log('--- testUIBridge_ConvertedNote_NoLongerInOpenList_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var created = ui_createNote('验收测试：转换后应该从 Open 列表消失', { chatId: testChatId });
    if (!created.ok) { Logger.log('❌ 前置创建失败'); return false; }

    var converted = ui_convertNoteToTask(created.note.note_id, { chatId: testChatId });
    if (!converted.ok) { Logger.log('❌ 前置转换失败'); return false; }

    var listAfter = ui_getOpenNotes({ chatId: testChatId });
    var stillOpen = listAfter.ok && listAfter.notes.some(function (n) { return n.note_id === created.note.note_id; });
    if (stillOpen) {
      Logger.log('❌ 已转换的 Note 不应该继续出现在 Open 列表里，否则前端会显示两次"Convert to Task"');
      pass = false;
    }

    if (converted.task && converted.task.task_id) {
      try { TaskEngine.cancelTask(converted.task.task_id, testChatId); } catch (ignore) {}
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertedNote_NoLongerInOpenList_ PASS' : '❌ testUIBridge_ConvertedNote_NoLongerInOpenList_ FAIL');
  return pass;
}

// ============================================================
// 四、单一入口
// ============================================================

function runUIBridgeSlice1Gate() {
  Logger.log('========== UI Vertical Slice 1 Gate 开始 ==========');
  Logger.log('范围：50_UIBridge.gs 三个函数 + Note→Task 完整闭环。不覆盖');
  Logger.log('真实浏览器里的前端交互（ui_index.html 需要手动点一遍确认）。');
  Logger.log('');

  var results = {
    'Positive: Create Note Success':            testUIBridge_CreateNote_Success_(),
    'Positive: Open Notes Reflects Creation':    testUIBridge_GetOpenNotes_ReflectsCreatedNote_(),
    'Positive: Convert Note to Task Success':    testUIBridge_ConvertNoteToTask_Success_(),
    'Negative: Empty/Whitespace Content':        testUIBridge_CreateNote_EmptyOrWhitespace_(),
    'Negative: Missing Note ID':                 testUIBridge_ConvertNoteToTask_MissingId_(),
    'Negative: Invalid Note ID':                 testUIBridge_ConvertNoteToTask_InvalidId_(),
    'Integrity: No Duplicate Task on Retry':     testUIBridge_ConvertNoteToTask_NoDuplicateOnRetry_(),
    'Integrity: Converted Note Leaves Open List': testUIBridge_ConvertedNote_NoLongerInOpenList_()
  };

  Logger.log('');
  Logger.log('========== UI Vertical Slice 1 Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——Engine/Bridge 层闭环验证完成。下一步：部署 Web App，' +
      '手动走一遍真实浏览器界面（Bridge 层测试不能替代真实点击）'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== UI Vertical Slice 1 Gate 结束 ==========');

  return allPass;
}
