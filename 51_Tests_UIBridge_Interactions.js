/**
 * 51_Tests_UIBridge_Interactions.gs
 * Personal Life OS — UI-I1~I5 Interactions Regression Gate
 *
 * 覆盖 Carson Track 2 批准消息里的 6 项能力：UI-I1 Sort+Filter、
 * UI-I2 Edit Task/Edit Project、UI-I3 Priority、UI-I4 Done、UI-I5 Cancel
 * （见 00_Project_State.gs「十四」Track 2 一节）。跟 35/36/38 一样是
 * 真实环境集成测试（真的写 Sheet），用命名空间化的测试 chatId
 * （ui_interact_test_ + 时间戳）隔离。
 *
 * 【重要边界】UI-I1 的 Sort 是纯前端 JS（ui_index.html 里的
 * sortTasks/sortProjects），QueryEngine 本身不排序（既有决定，见
 * 00_Project_State.gs）——这部分逻辑跑在浏览器里，GAS 测试函数没有
 * 办法执行或断言它，这不是本文件的覆盖缺口，是这套测试体系本来就有
 * 的边界（同类先例：38_Tests_UIBridge.gs 的 Slice 3 Gate 也明确记录
 * "真实浏览器手动走一遍...这一步 Gate 测试覆盖不到，只能人工点"）。
 * 本文件只覆盖 Filter 的服务端一半（TaskQueryEngine/ProjectQueryEngine
 * 的精确匹配 filters，真实可测）。Sort 需要人工在浏览器里验证四个
 * 排序选项分别产生预期顺序。
 *
 * 【AI Mock】沿用 37_Tests_AIEngines.gs 第一次引入的 mock 先例——
 * 临时替换 AIConnector.callAIForJSON_，finally 里还原，让 UI-I3 的
 * 测试确定性、不依赖真实网络/AI 凭证。
 *
 * 单一入口 runUIBridgeInteractionsGate()。
 */

// ============================================================
// 一、UI-I2 Edit Task / Edit Project
// ============================================================

function testUIInteractions_UpdateTask_Success_() {
  Logger.log('--- testUIInteractions_UpdateTask_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('编辑前标题', { category: 'GENERAL', priority: 'MEDIUM' }, testChatId);

    var result = ui_updateTask(task.task_id, { title: '编辑后标题', category: 'SHOPPING' }, { chatId: testChatId });

    if (!result.ok) { Logger.log('❌ 合法编辑应该成功: ' + JSON.stringify(result)); pass = false; }
    else {
      if (result.task.title !== '编辑后标题') { Logger.log('❌ title 没有更新'); pass = false; }
      if (result.task.category !== 'SHOPPING') { Logger.log('❌ category 没有更新'); pass = false; }
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_UpdateTask_NotFound_() {
  Logger.log('--- testUIInteractions_UpdateTask_NotFound_ 开始 ---');
  var pass = true;
  try {
    var result = ui_updateTask('TSK-DOES-NOT-EXIST-XYZ', { title: 'x' }, { chatId: 'ui_interact_test_nf' });
    if (result.ok || result.code !== 'NOT_FOUND') {
      Logger.log('❌ 不存在的 taskId 应该返回 NOT_FOUND，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message); pass = false;
  }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_UpdateTask_NoChanges_() {
  Logger.log('--- testUIInteractions_UpdateTask_NoChanges_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('不会被改动的任务', {}, testChatId);
    // 传一个 UPDATABLE_FIELDS 不认得的字段——不是"没传 changes"，是
    // "传了但没有一个合法"，专门测这条区分 NOT_FOUND 的分支。
    var result = ui_updateTask(task.task_id, { totally_made_up_field: 'x' }, { chatId: testChatId });
    if (result.ok || result.code !== 'NO_CHANGES') {
      Logger.log('❌ 没有合法字段变化应该返回 NO_CHANGES（不是 NOT_FOUND），实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_UpdateProject_Success_() {
  Logger.log('--- testUIInteractions_UpdateProject_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var project;

  try {
    project = ProjectEngine.createProject('编辑前项目标题', {}, testChatId);
    var result = ui_updateProject(project.project_id, { title: '编辑后项目标题', description: '新描述' }, { chatId: testChatId });

    if (!result.ok) { Logger.log('❌ 合法编辑应该成功: ' + JSON.stringify(result)); pass = false; }
    else if (result.project.title !== '编辑后项目标题' || result.project.description !== '新描述') {
      Logger.log('❌ title/description 没有正确更新'); pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  } finally {
    try { if (project) ProjectEngine.cancelProject(project.project_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 二、UI-I3 Priority（AI 部分 mock，见文件头）
// ============================================================

/**
 * 最重要的一条：ui_suggestPriority 只产出建议、绝不自己改 priority
 * （= priority_user）——见 ADR-2026-07-24-009。
 */
function testUIInteractions_SuggestPriority_NeverAutoApplies_() {
  Logger.log('--- testUIInteractions_SuggestPriority_NeverAutoApplies_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;
  var originalAI = AIConnector.callAIForJSON_;

  try {
    // suggestPriorityWithAI_ 的合法值目前只有 HIGH/MEDIUM/LOW（不含
    // CRITICAL，见 00_Known_Limitations.gs「三」2026-08-21 补充——这是
    // 我自己发现并记录的限制，mock 必须遵守，不能拿真实校验通不过的
    // 值来测）。用 HIGH 跟任务起始的 LOW 仍然是有意义的不同值，足够
    // 验证"仅询问不生效"这条不变量。
    AIConnector.callAIForJSON_ = function () { return { priority: 'HIGH', reasoning: '模拟：截止日期很近' }; };

    task = TaskEngine.createTask('询问 AI 优先级的任务', { priority: 'LOW' }, testChatId);

    var result = ui_suggestPriority(task.task_id, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }
    else {
      if (result.priority !== 'HIGH') { Logger.log('❌ 建议值应该是 mock 返回的 HIGH'); pass = false; }
      if (result.current_priority !== 'LOW') { Logger.log('❌ current_priority 应该反映编辑前的真实值 LOW'); pass = false; }
    }

    var afterSuggest = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (afterSuggest.priority !== 'LOW') {
      Logger.log('❌ 仅仅"询问"AI 不应该改变 priority 本身，实际变成了: ' + afterSuggest.priority);
      pass = false;
    }
    if (afterSuggest.priority_ai_recommended !== 'HIGH') {
      Logger.log('❌ priority_ai_recommended 应该记录这次生成的建议，实际: ' + afterSuggest.priority_ai_recommended);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message + '\n' + e.stack); pass = false;
  } finally {
    AIConnector.callAIForJSON_ = originalAI;
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

/**
 * 采纳走的是跟手动改优先级完全一样的 ui_updateTask 写路径——这条测的
 * 是"采纳"这一步本身确实会正确落盘（priority + priority_ai_recommended
 * 都更新），前端 acceptAISuggestion() 调用的正是这个函数。
 */
function testUIInteractions_AcceptSuggestion_UpdatesBothFields_() {
  Logger.log('--- testUIInteractions_AcceptSuggestion_UpdatesBothFields_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('采纳建议的任务', { priority: 'LOW' }, testChatId);

    var result = ui_updateTask(task.task_id, { priority: 'HIGH', priority_ai_recommended: 'HIGH' }, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }

    var after = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (after.priority !== 'HIGH') { Logger.log('❌ 采纳后 priority 应该变成 HIGH'); pass = false; }
    if (after.priority_ai_recommended !== 'HIGH') { Logger.log('❌ priority_ai_recommended 应该同步记录'); pass = false; }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 三、UI-I4 Done（Task + Project）
// ============================================================

function testUIInteractions_CompleteTask_SuccessThenIdempotent_() {
  Logger.log('--- testUIInteractions_CompleteTask_SuccessThenIdempotent_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('标记完成的任务', {}, testChatId);

    var first = ui_completeTask(task.task_id, { chatId: testChatId });
    if (!first.ok) { Logger.log('❌ 第一次 Done 应该成功: ' + JSON.stringify(first)); pass = false; }

    var second = ui_completeTask(task.task_id, { chatId: testChatId });
    if (!second.ok || !second.already_done) {
      Logger.log('❌ 重复 Done 应该幂等成功（ok:true, already_done:true），实际: ' + JSON.stringify(second));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_CompleteTask_InvalidState_() {
  Logger.log('--- testUIInteractions_CompleteTask_InvalidState_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('先取消再尝试完成的任务', {}, testChatId);
    TaskEngine.cancelTask(task.task_id, testChatId);

    var result = ui_completeTask(task.task_id, { chatId: testChatId });
    if (result.ok || result.code !== 'INVALID_STATE') {
      Logger.log('❌ 已 CANCELLED 的 Task 标记完成应该返回 INVALID_STATE，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_CompleteProject_Success_() {
  Logger.log('--- testUIInteractions_CompleteProject_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var project;

  try {
    project = ProjectEngine.createProject('标记完成的项目', {}, testChatId);
    var result = ui_completeProject(project.project_id, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 四、UI-I5 Cancel（Task + Project）
// ============================================================

function testUIInteractions_CancelTask_SuccessThenIdempotent_() {
  Logger.log('--- testUIInteractions_CancelTask_SuccessThenIdempotent_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('取消的任务', {}, testChatId);

    var first = ui_cancelTask(task.task_id, { chatId: testChatId });
    if (!first.ok) { Logger.log('❌ 第一次 Cancel 应该成功: ' + JSON.stringify(first)); pass = false; }

    var second = ui_cancelTask(task.task_id, { chatId: testChatId });
    if (!second.ok || !second.already_cancelled) {
      Logger.log('❌ 重复 Cancel 应该幂等成功，实际: ' + JSON.stringify(second));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_CancelTask_NotFound_() {
  Logger.log('--- testUIInteractions_CancelTask_NotFound_ 开始 ---');
  var pass = true;
  try {
    var result = ui_cancelTask('TSK-DOES-NOT-EXIST-XYZ', { chatId: 'ui_interact_test_nf' });
    if (result.ok || result.code !== 'NOT_FOUND') {
      Logger.log('❌ 应该返回 NOT_FOUND，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }
  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_CancelProject_Success_() {
  Logger.log('--- testUIInteractions_CancelProject_Success_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var project;

  try {
    project = ProjectEngine.createProject('取消的项目', {}, testChatId);
    var result = ui_cancelProject(project.project_id, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 五、UI-I1 Filter（服务端一半；Sort 是前端 JS，见文件头说明）
// ============================================================

function testUIInteractions_FilterTasks_ByCategory_() {
  Logger.log('--- testUIInteractions_FilterTasks_ByCategory_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var t1, t2;

  try {
    t1 = TaskEngine.createTask('购物任务', { category: 'SHOPPING' }, testChatId);
    t2 = TaskEngine.createTask('健康任务', { category: 'HEALTH' }, testChatId);

    var result = ui_getConvertibleTasks({ category: 'SHOPPING' }, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }
    else {
      var ids = result.tasks.map(function (t) { return t.task_id; });
      if (ids.indexOf(t1.task_id) === -1) { Logger.log('❌ SHOPPING 任务应该出现在结果里'); pass = false; }
      if (ids.indexOf(t2.task_id) !== -1) { Logger.log('❌ HEALTH 任务不应该出现在 category=SHOPPING 的结果里'); pass = false; }
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message); pass = false;
  } finally {
    try { if (t1) TaskEngine.cancelTask(t1.task_id, testChatId); } catch (ignore) {}
    try { if (t2) TaskEngine.cancelTask(t2.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testUIInteractions_FilterProjects_ByStatus_() {
  Logger.log('--- testUIInteractions_FilterProjects_ByStatus_ 开始 ---');
  var pass = true;
  var testChatId = 'ui_interact_test_' + new Date().getTime();
  var p1, p2;

  try {
    p1 = ProjectEngine.createProject('DRAFT 项目', {}, testChatId); // 新建默认 DRAFT
    p2 = ProjectEngine.createProject('后面会切到 BLOCKED 的项目', {}, testChatId);
    ProjectEngine.transitionProjectStatus(p2.project_id, 'BLOCKED', testChatId);

    var result = ui_getActiveProjects({ status: 'BLOCKED' }, { chatId: testChatId });
    if (!result.ok) { Logger.log('❌ 应该成功: ' + JSON.stringify(result)); pass = false; }
    else {
      var ids = result.projects.map(function (p) { return p.project_id; });
      if (ids.indexOf(p2.project_id) === -1) { Logger.log('❌ BLOCKED 项目应该出现在结果里'); pass = false; }
      if (ids.indexOf(p1.project_id) !== -1) { Logger.log('❌ DRAFT 项目不应该出现在 status=BLOCKED 的结果里'); pass = false; }
    }
  } catch (e) {
    Logger.log('❌ 抛出异常: ' + e.message + '\n' + e.stack); pass = false;
  } finally {
    try { if (p1) ProjectEngine.cancelProject(p1.project_id, testChatId); } catch (ignore) {}
    try { if (p2) ProjectEngine.cancelProject(p2.project_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// ============================================================
// 六、单一入口
// ============================================================

function runUIBridgeInteractionsGate() {
  Logger.log('========== UI-I1~I5 Interactions Regression Gate 开始 ==========');
  Logger.log('范围：50_UIBridge.gs 新增 7 个函数（ui_updateTask/');
  Logger.log('ui_updateProject/ui_suggestPriority/ui_completeTask/');
  Logger.log('ui_cancelTask/ui_completeProject/ui_cancelProject）+');
  Logger.log('ui_getConvertibleTasks/ui_getActiveProjects 的 filters 扩展。');
  Logger.log('不含 Sort（纯前端 JS，需要人工浏览器验证，见文件头）。');
  Logger.log('');

  var results = {
    'I2 Positive: Update Task':                     testUIInteractions_UpdateTask_Success_(),
    'I2 Negative: Update Task Not Found':            testUIInteractions_UpdateTask_NotFound_(),
    'I2 Negative: Update Task No Valid Changes':     testUIInteractions_UpdateTask_NoChanges_(),
    'I2 Positive: Update Project':                   testUIInteractions_UpdateProject_Success_(),
    'I3 Integrity: AI Suggestion Never Auto-Applies': testUIInteractions_SuggestPriority_NeverAutoApplies_(),
    'I3 Positive: Accept Suggestion Updates Both Fields': testUIInteractions_AcceptSuggestion_UpdatesBothFields_(),
    'I4 Positive+Idempotent: Complete Task':          testUIInteractions_CompleteTask_SuccessThenIdempotent_(),
    'I4 Negative: Complete Task Invalid State':       testUIInteractions_CompleteTask_InvalidState_(),
    'I4 Positive: Complete Project':                  testUIInteractions_CompleteProject_Success_(),
    'I5 Positive+Idempotent: Cancel Task':            testUIInteractions_CancelTask_SuccessThenIdempotent_(),
    'I5 Negative: Cancel Task Not Found':             testUIInteractions_CancelTask_NotFound_(),
    'I5 Positive: Cancel Project':                    testUIInteractions_CancelProject_Success_(),
    'I1 Positive: Filter Tasks By Category':          testUIInteractions_FilterTasks_ByCategory_(),
    'I1 Positive: Filter Projects By Status':         testUIInteractions_FilterProjects_ByStatus_()
  };

  Logger.log('');
  Logger.log('========== UI-I1~I5 Interactions Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——UI-I2~I5 的服务端契约验证完成。下一步：真实浏览器' +
      '手动验证 UI-I1 Sort 的四个排序选项（Newest/Priority/Due date/' +
      'Title）分别产生预期顺序——这一步 Gate 测试覆盖不到，只能人工点。'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== UI-I1~I5 Interactions Gate 结束 ==========');

  return allPass;
}
