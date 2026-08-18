/**
 * 38_Tests_UIBridge.gs
 * Personal Life OS — UI Vertical Slice 1 + 2 + 3 Tests（Note→Task,
 * Task↔Project, Project→Template→Instance）
 *
 * 跟 35/36 一样是真实环境集成测试（真的写 Sheet），用命名空间化的测试
 * chatId（accept_test_ui_ + 时间戳）隔离，不碰真实 Telegram 数据。
 * 结构对照 UI_Architecture_Audit_Phase0.md「Testing Requirements」：
 * Positive / Negative / Integrity 三类。
 *
 * 三个独立入口：runUIBridgeSlice1Gate()、runUIBridgeSlice2Gate()、
 * runUIBridgeSlice3Gate()。
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
// 五、Slice 2 Positive Tests（Task ↔ Project，ADR-2026-07-24-015）
// ============================================================

function testUIBridge_ConvertTaskToProject_Success_() {
  Logger.log('--- testUIBridge_ConvertTaskToProject_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var testOwner = 'test-ui@example.com';

  try {
    var task = TaskEngine.createTask('验收测试：这个任务长大了要拆项目', {}, testChatId);

    var converted = ui_convertTaskToProject(task.task_id, { chatId: testChatId, decisionOwner: testOwner });
    if (!converted.ok) {
      Logger.log('❌ 转换应该成功，实际: ' + JSON.stringify(converted));
      pass = false;
    } else {
      if (converted.project.title !== task.title) { Logger.log('❌ Project 标题应该继承 Task 标题'); pass = false; }
      if (converted.project.decision_owner !== testOwner) { Logger.log('❌ decision_owner 没有正确转发，实际: ' + converted.project.decision_owner); pass = false; }
      if (converted.project.created_method !== 'Converted') { Logger.log('❌ created_method 应该是 Converted'); pass = false; }
    }

    try { TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
    if (converted.ok && converted.project) { try { ProjectEngine.archiveProject(converted.project.project_id, testChatId); } catch (ignore) {} }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertTaskToProject_Success_ PASS' : '❌ testUIBridge_ConvertTaskToProject_Success_ FAIL');
  return pass;
}

function testUIBridge_ConvertProjectToTask_Success_EmptyProject_() {
  Logger.log('--- testUIBridge_ConvertProjectToTask_Success_EmptyProject_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试：空 Project 应该能降级', {}, testChatId);

    var converted = ui_convertProjectToTask(project.project_id, { chatId: testChatId });
    if (!converted.ok) {
      Logger.log('❌ 没有 Sub-Project、没有未完成 Task 的空 Project 应该允许降级，实际: ' + JSON.stringify(converted));
      pass = false;
    }

    if (converted.ok && converted.task) { try { TaskEngine.cancelTask(converted.task.task_id, testChatId); } catch (ignore) {} }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertProjectToTask_Success_EmptyProject_ PASS' : '❌ testUIBridge_ConvertProjectToTask_Success_EmptyProject_ FAIL');
  return pass;
}

// ============================================================
// 六、Slice 2 Negative Tests
// ============================================================

function testUIBridge_ConvertTaskToProject_InvalidOrMissingId_() {
  Logger.log('--- testUIBridge_ConvertTaskToProject_InvalidOrMissingId_ 开始 ---');
  var pass = true;

  var missing = ui_convertTaskToProject(null, { chatId: 'accept_test_ui_x' });
  if (missing.ok || missing.code !== 'MISSING_TASK_ID') { Logger.log('❌ 缺 taskId 应该返回 MISSING_TASK_ID: ' + JSON.stringify(missing)); pass = false; }

  var invalid = ui_convertTaskToProject('TASK-DOES-NOT-EXIST-99999', { chatId: 'accept_test_ui_x' });
  if (invalid.ok || invalid.code !== 'NOT_FOUND') { Logger.log('❌ 不存在的 taskId 应该返回 NOT_FOUND: ' + JSON.stringify(invalid)); pass = false; }

  Logger.log(pass ? '✅ testUIBridge_ConvertTaskToProject_InvalidOrMissingId_ PASS' : '❌ testUIBridge_ConvertTaskToProject_InvalidOrMissingId_ FAIL');
  return pass;
}

function testUIBridge_ConvertProjectToTask_InvalidOrMissingId_() {
  Logger.log('--- testUIBridge_ConvertProjectToTask_InvalidOrMissingId_ 开始 ---');
  var pass = true;

  var missing = ui_convertProjectToTask(null, { chatId: 'accept_test_ui_x' });
  if (missing.ok || missing.code !== 'MISSING_PROJECT_ID') { Logger.log('❌ 缺 projectId 应该返回 MISSING_PROJECT_ID: ' + JSON.stringify(missing)); pass = false; }

  var invalid = ui_convertProjectToTask('PRJ-DOES-NOT-EXIST-99999', { chatId: 'accept_test_ui_x' });
  if (invalid.ok || invalid.code !== 'NOT_FOUND') { Logger.log('❌ 不存在的 projectId 应该返回 NOT_FOUND: ' + JSON.stringify(invalid)); pass = false; }

  Logger.log(pass ? '✅ testUIBridge_ConvertProjectToTask_InvalidOrMissingId_ PASS' : '❌ testUIBridge_ConvertProjectToTask_InvalidOrMissingId_ FAIL');
  return pass;
}

// ============================================================
// 七、Slice 2 Integrity / Business Rule Tests（ADR-015 核心）
// ============================================================

function testUIBridge_ConvertProjectToTask_BlockedByIncompleteTask_() {
  Logger.log('--- testUIBridge_ConvertProjectToTask_BlockedByIncompleteTask_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试：底下还有活没干完', {}, testChatId);
    var childTask = TaskEngine.createTask('验收测试：子任务，故意不做完', { project_id: project.project_id }, testChatId);

    var result = ui_convertProjectToTask(project.project_id, { chatId: testChatId });
    if (result.ok) {
      Logger.log('❌ 还有未完成子 Task 的 Project 不应该允许降级，但成功了');
      pass = false;
    } else if (result.code !== 'BLOCKED' || result.message.indexOf('未完成的 Task') === -1) {
      Logger.log('❌ 应该是 BLOCKED + "未完成的 Task" 原因，实际: ' + JSON.stringify(result));
      pass = false;
    }

    try { TaskEngine.cancelTask(childTask.task_id, testChatId); } catch (ignore) {}
    try { ProjectEngine.archiveProject(project.project_id, testChatId); } catch (ignore) {}
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertProjectToTask_BlockedByIncompleteTask_ PASS' : '❌ testUIBridge_ConvertProjectToTask_BlockedByIncompleteTask_ FAIL');
  return pass;
}

function testUIBridge_ConvertProjectToTask_BlockedBySubProject_() {
  Logger.log('--- testUIBridge_ConvertProjectToTask_BlockedBySubProject_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var parent = ProjectEngine.createProject('验收测试：有子项目的父项目', {}, testChatId);
    var child = ProjectEngine.createProject('验收测试：子项目', { parent_project_id: parent.project_id }, testChatId);

    var result = ui_convertProjectToTask(parent.project_id, { chatId: testChatId });
    if (result.ok) {
      Logger.log('❌ 还有 Sub-Project 的 Project 不应该允许降级，但成功了');
      pass = false;
    } else if (result.code !== 'BLOCKED' || result.message.indexOf('Sub-Project') === -1) {
      Logger.log('❌ 应该是 BLOCKED + "Sub-Project" 原因，实际: ' + JSON.stringify(result));
      pass = false;
    }

    try { ProjectEngine.archiveProject(child.project_id, testChatId); } catch (ignore) {}
    try { ProjectEngine.archiveProject(parent.project_id, testChatId); } catch (ignore) {}
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertProjectToTask_BlockedBySubProject_ PASS' : '❌ testUIBridge_ConvertProjectToTask_BlockedBySubProject_ FAIL');
  return pass;
}

function testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_() {
  Logger.log('--- testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试：Task→Project 重复提交检查', {}, testChatId);

    var first = ui_convertTaskToProject(task.task_id, { chatId: testChatId });
    var second = ui_convertTaskToProject(task.task_id, { chatId: testChatId });

    if (!first.ok || !second.ok) {
      Logger.log('❌ 两次调用都应该成功返回: ' + JSON.stringify(first) + ' / ' + JSON.stringify(second));
      pass = false;
    } else if (first.project.project_id !== second.project.project_id) {
      Logger.log('❌ 重复转换产生了两个不同的 Project——duplicate entity bug');
      pass = false;
    } else if (!second.already_converted) {
      Logger.log('❌ 第二次应该标记 already_converted:true');
      pass = false;
    }

    try { TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
    if (first.ok && first.project) { try { ProjectEngine.archiveProject(first.project.project_id, testChatId); } catch (ignore) {} }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_ PASS' : '❌ testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_ FAIL');
  return pass;
}

// ============================================================
// 八、单一入口
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

function runUIBridgeSlice2Gate() {
  Logger.log('========== UI Vertical Slice 2 Gate 开始 ==========');
  Logger.log('范围：50_UIBridge.gs 新增 4 个函数 + Task↔Project 双向');
  Logger.log('完整闭环，重点覆盖 ADR-2026-07-24-015 的降级前置校验。');
  Logger.log('');

  var results = {
    'Positive: Convert Task to Project Success':      testUIBridge_ConvertTaskToProject_Success_(),
    'Positive: Convert Empty Project to Task Success': testUIBridge_ConvertProjectToTask_Success_EmptyProject_(),
    'Negative: Task→Project Invalid/Missing ID':       testUIBridge_ConvertTaskToProject_InvalidOrMissingId_(),
    'Negative: Project→Task Invalid/Missing ID':       testUIBridge_ConvertProjectToTask_InvalidOrMissingId_(),
    'Integrity: Blocked by Incomplete Child Task':     testUIBridge_ConvertProjectToTask_BlockedByIncompleteTask_(),
    'Integrity: Blocked by Sub-Project':               testUIBridge_ConvertProjectToTask_BlockedBySubProject_(),
    'Integrity: No Duplicate Project on Retry':        testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_()
  };

  Logger.log('');
  Logger.log('========== UI Vertical Slice 2 Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——Task↔Project 双向闭环 + ADR-015 降级校验验证完成。' +
      '下一步：真实浏览器手动点一遍 Tasks/Projects 两个面板'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== UI Vertical Slice 2 Gate 结束 ==========');

  return allPass;
}

// ============================================================
// 九、Slice 3 Positive Tests（Project → Workflow → Task，三层模型）
// ============================================================

function testUIBridge_CaptureProjectAsTemplate_Success_() {
  Logger.log('--- testUIBridge_CaptureProjectAsTemplate_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var ruleName = '验收测试规则_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试：待拍照的 Project', {}, testChatId);
    TaskEngine.createTask('验收测试：里面的任务', { project_id: project.project_id }, testChatId);

    var result = ui_captureProjectAsTemplate(project.project_id, ruleName);
    if (!result.ok) {
      Logger.log('❌ Capture 应该成功，实际: ' + JSON.stringify(result));
      pass = false;
    } else {
      if (result.template.version !== 1) { Logger.log('❌ 第一次 Capture 版本应该是 1，实际: ' + result.template.version); pass = false; }
      if (result.template.captured_from_project_id !== project.project_id) { Logger.log('❌ captured_from_project_id 应该指回源 Project'); pass = false; }
      var shape = JSON.parse(result.template.workflow_shape);
      if (!shape.tasks || shape.tasks.length !== 1) { Logger.log('❌ workflow_shape 应该捕获到 1 个 task，实际: ' + JSON.stringify(shape)); pass = false; }

      try { BusinessRuleEngine.deprecateWorkflowTemplate(result.template.template_id); } catch (ignore) {}
    }

    try { ProjectEngine.archiveProject(project.project_id, testChatId); } catch (ignore) {}
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_CaptureProjectAsTemplate_Success_ PASS' : '❌ testUIBridge_CaptureProjectAsTemplate_Success_ FAIL');
  return pass;
}

function testUIBridge_InstantiateTemplate_Success_() {
  Logger.log('--- testUIBridge_InstantiateTemplate_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var ruleName = '验收测试规则_' + new Date().getTime();
  var sourceProject, template, instantiated;

  try {
    sourceProject = ProjectEngine.createProject('验收测试：源 Project', {}, testChatId);
    TaskEngine.createTask('验收测试：源任务A', { project_id: sourceProject.project_id }, testChatId);
    TaskEngine.createTask('验收测试：源任务B', { project_id: sourceProject.project_id }, testChatId);

    var captured = ui_captureProjectAsTemplate(sourceProject.project_id, ruleName);
    if (!captured.ok) { Logger.log('❌ 前置 Capture 失败'); return false; }
    template = captured.template;

    instantiated = ui_instantiateTemplate(template.template_id, { chatId: testChatId });
    if (!instantiated.ok) {
      Logger.log('❌ Instantiate 应该成功，实际: ' + JSON.stringify(instantiated));
      pass = false;
    } else {
      // 三层不能混淆：新 Project 不是源 Project，新 Task 不是源 Task，
      // 但 Task 数量应该跟模板一致（2 个）。
      if (instantiated.project.project_id === sourceProject.project_id) {
        Logger.log('❌ 应该生成全新的 Project，而不是复用源 Project');
        pass = false;
      }
      if (instantiated.tasks.length !== 2) {
        Logger.log('❌ 应该生成 2 个新 Task（跟模板一致），实际: ' + instantiated.tasks.length);
        pass = false;
      }
      if (!instantiated.workflow || !instantiated.workflow.workflow_id) {
        Logger.log('❌ 应该生成一个新 Workflow');
        pass = false;
      }
      instantiated.tasks.forEach(function (t) {
        if (t.workflow_id !== instantiated.workflow.workflow_id || t.project_id !== instantiated.project.project_id) {
          Logger.log('❌ 新 Task 应该同时挂在新 Project 和新 Workflow 下面');
          pass = false;
        }
      });
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    try { if (template) BusinessRuleEngine.deprecateWorkflowTemplate(template.template_id); } catch (ignore) {}
    try { if (sourceProject) ProjectEngine.archiveProject(sourceProject.project_id, testChatId); } catch (ignore) {}
    if (instantiated && instantiated.ok) {
      instantiated.tasks.forEach(function (t) { try { TaskEngine.cancelTask(t.task_id, testChatId); } catch (ignore) {} });
      try { ProjectEngine.archiveProject(instantiated.project.project_id, testChatId); } catch (ignore) {}
    }
  }

  Logger.log(pass ? '✅ testUIBridge_InstantiateTemplate_Success_ PASS' : '❌ testUIBridge_InstantiateTemplate_Success_ FAIL');
  return pass;
}

// ============================================================
// 十、Slice 3 Negative Tests
// ============================================================

function testUIBridge_CaptureProjectAsTemplate_MissingRuleName_() {
  Logger.log('--- testUIBridge_CaptureProjectAsTemplate_MissingRuleName_ 开始 ---');
  var pass = true;

  [['', 'MISSING_RULE_NAME'], ['   ', 'MISSING_RULE_NAME'], [null, 'MISSING_RULE_NAME']].forEach(function (pair) {
    var result = ui_captureProjectAsTemplate('PRJ-ANYTHING', pair[0]);
    if (result.ok || result.code !== pair[1]) {
      Logger.log('❌ ruleName=' + JSON.stringify(pair[0]) + ' 应该返回 MISSING_RULE_NAME: ' + JSON.stringify(result));
      pass = false;
    }
  });

  Logger.log(pass ? '✅ testUIBridge_CaptureProjectAsTemplate_MissingRuleName_ PASS' : '❌ testUIBridge_CaptureProjectAsTemplate_MissingRuleName_ FAIL');
  return pass;
}

function testUIBridge_CaptureProjectAsTemplate_InvalidProjectId_() {
  Logger.log('--- testUIBridge_CaptureProjectAsTemplate_InvalidProjectId_ 开始 ---');
  var pass = true;

  var result = ui_captureProjectAsTemplate('PRJ-DOES-NOT-EXIST-99999', '验收测试：不存在的项目');
  if (result.ok || result.code !== 'NOT_FOUND') {
    Logger.log('❌ 不存在的 projectId 应该返回 NOT_FOUND: ' + JSON.stringify(result));
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_CaptureProjectAsTemplate_InvalidProjectId_ PASS' : '❌ testUIBridge_CaptureProjectAsTemplate_InvalidProjectId_ FAIL');
  return pass;
}

function testUIBridge_InstantiateTemplate_InvalidTemplateId_() {
  Logger.log('--- testUIBridge_InstantiateTemplate_InvalidTemplateId_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();

  var missing = ui_instantiateTemplate(null, { chatId: testChatId });
  if (missing.ok || missing.code !== 'MISSING_TEMPLATE_ID') { Logger.log('❌ 缺 templateId 应该返回 MISSING_TEMPLATE_ID: ' + JSON.stringify(missing)); pass = false; }

  var invalid = ui_instantiateTemplate('TPL-DOES-NOT-EXIST-99999', { chatId: testChatId });
  if (invalid.ok || invalid.code !== 'NOT_FOUND') { Logger.log('❌ 不存在的 templateId 应该返回 NOT_FOUND: ' + JSON.stringify(invalid)); pass = false; }

  Logger.log(pass ? '✅ testUIBridge_InstantiateTemplate_InvalidTemplateId_ PASS' : '❌ testUIBridge_InstantiateTemplate_InvalidTemplateId_ FAIL');
  return pass;
}

// ============================================================
// 十一、Slice 3 Integrity Tests（三层模型不能混淆）
// ============================================================

function testUIBridge_RecaptureSameProject_CreatesNewVersion_() {
  Logger.log('--- testUIBridge_RecaptureSameProject_CreatesNewVersion_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var ruleName = '验收测试规则_' + new Date().getTime();
  var project, v1, v2;

  try {
    project = ProjectEngine.createProject('验收测试：会被拍两次的 Project', {}, testChatId);

    v1 = ui_captureProjectAsTemplate(project.project_id, ruleName);
    v2 = ui_captureProjectAsTemplate(project.project_id, ruleName); // 同一个 rule name 再拍一次

    if (!v1.ok || !v2.ok) {
      Logger.log('❌ 两次 Capture 都应该成功: ' + JSON.stringify(v1) + ' / ' + JSON.stringify(v2));
      pass = false;
    } else {
      if (v1.template.business_rule_id !== v2.template.business_rule_id) {
        Logger.log('❌ 同一个 rule name 应该复用同一个 BusinessRule，不是新建一个');
        pass = false;
      }
      if (v2.template.version !== v1.template.version + 1) {
        Logger.log('❌ 第二次应该是版本 ' + (v1.template.version + 1) + '，实际: ' + v2.template.version);
        pass = false;
      }
      if (v1.template.template_id === v2.template.template_id) {
        Logger.log('❌ 两次 Capture 应该产生两个不同的 template_id（不同版本是不同实体）');
        pass = false;
      }
    }

    try { if (v1 && v1.ok) BusinessRuleEngine.deprecateWorkflowTemplate(v1.template.template_id); } catch (ignore) {}
    try { if (v2 && v2.ok) BusinessRuleEngine.deprecateWorkflowTemplate(v2.template.template_id); } catch (ignore) {}
    try { ProjectEngine.archiveProject(project.project_id, testChatId); } catch (ignore) {}
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUIBridge_RecaptureSameProject_CreatesNewVersion_ PASS' : '❌ testUIBridge_RecaptureSameProject_CreatesNewVersion_ FAIL');
  return pass;
}

function testUIBridge_InstantiateTwice_NoCrossContamination_() {
  Logger.log('--- testUIBridge_InstantiateTwice_NoCrossContamination_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ui_' + new Date().getTime();
  var ruleName = '验收测试规则_' + new Date().getTime();
  var project, template, first, second;

  try {
    project = ProjectEngine.createProject('验收测试：会被实例化两次的模板源', {}, testChatId);
    TaskEngine.createTask('验收测试：模板任务', { project_id: project.project_id }, testChatId);

    var captured = ui_captureProjectAsTemplate(project.project_id, ruleName);
    if (!captured.ok) { Logger.log('❌ 前置 Capture 失败'); return false; }
    template = captured.template;

    first = ui_instantiateTemplate(template.template_id, { chatId: testChatId });
    second = ui_instantiateTemplate(template.template_id, { chatId: testChatId });

    if (!first.ok || !second.ok) {
      Logger.log('❌ 两次 Instantiate 都应该成功（同一个模板可以反复用）');
      pass = false;
    } else if (first.project.project_id === second.project.project_id ||
               first.workflow.workflow_id === second.workflow.workflow_id ||
               first.tasks[0].task_id === second.tasks[0].task_id) {
      Logger.log('❌ 两次 Instantiate 应该产生完全独立的 Project/Workflow/Task，不能互相污染');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    try { if (template) BusinessRuleEngine.deprecateWorkflowTemplate(template.template_id); } catch (ignore) {}
    try { if (project) ProjectEngine.archiveProject(project.project_id, testChatId); } catch (ignore) {}
    [first, second].forEach(function (r) {
      if (r && r.ok) {
        r.tasks.forEach(function (t) { try { TaskEngine.cancelTask(t.task_id, testChatId); } catch (ignore) {} });
        try { ProjectEngine.archiveProject(r.project.project_id, testChatId); } catch (ignore) {}
      }
    });
  }

  Logger.log(pass ? '✅ testUIBridge_InstantiateTwice_NoCrossContamination_ PASS' : '❌ testUIBridge_InstantiateTwice_NoCrossContamination_ FAIL');
  return pass;
}

// ============================================================
// 十二、单一入口
// ============================================================

function runUIBridgeSlice3Gate() {
  Logger.log('========== UI Vertical Slice 3 Gate 开始 ==========');
  Logger.log('范围：50_UIBridge.gs 新增 2 个函数 + Capture/Instantiate');
  Logger.log('闭环，重点覆盖三层模型（BusinessRule/WorkflowTemplate/');
  Logger.log('Workflow Instance）不互相混淆。');
  Logger.log('');

  var results = {
    'Positive: Capture Project as Template Success': testUIBridge_CaptureProjectAsTemplate_Success_(),
    'Positive: Instantiate Template Success':         testUIBridge_InstantiateTemplate_Success_(),
    'Negative: Missing Rule Name':                    testUIBridge_CaptureProjectAsTemplate_MissingRuleName_(),
    'Negative: Invalid Project ID':                   testUIBridge_CaptureProjectAsTemplate_InvalidProjectId_(),
    'Negative: Invalid Template ID':                  testUIBridge_InstantiateTemplate_InvalidTemplateId_(),
    'Integrity: Recapture Creates New Version':       testUIBridge_RecaptureSameProject_CreatesNewVersion_(),
    'Integrity: Instantiate Twice, No Cross-Contamination': testUIBridge_InstantiateTwice_NoCrossContamination_()
  };

  Logger.log('');
  Logger.log('========== UI Vertical Slice 3 Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——三层模型闭环验证完成，Capture/Instantiate 互不' +
      '污染。下一步：真实浏览器手动走一遍 Capture as Template → ' +
      'Instantiate Now 这条交互'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== UI Vertical Slice 3 Gate 结束 ==========');

  return allPass;
}
