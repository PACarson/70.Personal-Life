/**
 * 55_Tests_TaskToProjectBlocked.gs
 * Personal Life OS —— Task → Project 的 due_date/due_time 字段映射
 * 验收测试，ADR-2026-09-18-031（Project Deadline Contract）
 *
 * 【2026-09-18，改写】文件名/单一入口函数名 `runTaskToProjectBlockedGate()`
 * 保留不变（`57_Tests_TaskToProjectPrecheck.gs` 的操作提示字符串、
 * `00_Project_State.gs`/`00_Known_Limitations.gs` 的历史记录都按这个
 * 名字引用它，改名会让那些引用变成错误指向，不是本次范围），但测试
 * 内容整体改写——这个文件原本验证"带 due_date/due_time 的 Task 应该被
 * BLOCKED，不能转换成 Project"（ADR-2026-09-02-028），现在 Project
 * Deadline Contract 已经批准（ADR-2026-09-18-031），这条 BLOCKED 检查
 * 本身已经从 `42_ConversionEngine.convertTaskToProject` 里移除，
 * 原来验证 BLOCKED 的测试内容已经不适用，改为验证"成功转换 + 字段
 * 映射正确"。
 *
 * 覆盖范围（新）：
 *   1. 源 Task 只带 due_date（无 due_time）→ 转换成功，Project.due_date
 *      跟源一致，due_time/due_datetime 都是空字符串（不自动补午夜）。
 *   2. 源 Task 带 due_date + due_time → 转换成功，Project 三个字段
 *      都跟源一致，due_datetime 按公式正确派生。
 *   3. 源 Task 完全不带日期字段 → 转换成功，Project 三个字段都是空
 *      字符串（回归确认：这次改动没有影响"不带日期"这条既有路径）。
 *   4. 转换后立刻用 ProjectQueryEngine.getProject 重新读一遍（不是只看
 *      convertTaskToProject 的直接返回值）——确认 Create→Read-back 一致，
 *      也间接确认 Projection/Replay 层（10_ProjectionEngine.
 *      projectProjectCreated_，本次未改动，通用 key-value upsert）
 *      正确落地了这三个字段。
 *   5. Project → Task 反方向**没有**新增 due 字段映射的负向确认——
 *      ADR-2026-09-18-031 的治理追记明确记录这是 Carson 否决的对称性
 *      提案，这里验证 `createTaskFromConversion_` 确实维持原状。
 *
 * 刻意排除（如实记录，不是遗漏）：
 *   - "已经转换过的 Task 之后被打上 due_date，再次调用应该走幂等分支"
 *     ——跟改写前的文件一样，本次同样不测这个更复杂的场景，原因不变
 *     （updateTask 对已 CONVERTED 的 Task 的行为本次未验证）。
 *   - 终态 Task / 已转换成 Note 的 Task 的 BLOCKED 路径——这两条跟
 *     due_date 无关，本次未改动，已经由 `57_Tests_TaskToProjectPrecheck.gs`
 *     覆盖，这里不重复造。
 *   - Identity 在 due_time 变化时的重算行为——这是 Project 自己的
 *     Identity Model B 行为，不是 Conversion 本身的行为，由
 *     单独的 Node.js 验证脚本覆盖（见交付说明），这里不重复。
 *
 * 单一入口：runTaskToProjectBlockedGate()（名字保留，见上）
 *
 * 【2026-09-20 追记】真实 GAS 环境跑这份文件时，前两项一度真实 FAIL——
 * 根因是 `sourceTask.due_date`/`due_time` 经 `TaskQueryEngine.getTask()`
 * 裸读回来可能是 Google Sheets 自动识别出的 Date 对象，`convertTaskToProject`
 * 当时直接拿 Date 对象往下传，没有 canonicalize。已在
 * `42_ConversionEngine.js`（`convertTaskToProject` 内部新增私有
 * `_canonicalizeDueTimeForConversion_`，`due_date` 复用既有
 * `IdentityEngine.canonicalizeDueValue()`）修复这一处映射边界，`
 * TaskQueryEngine.getTask()` 裸读架构本身未改。**下面这 4 项测试的
 * 逻辑本身不需要改——它们本来就是端到端读真实 read-back，一旦
 * 真实环境里 sourceTask.due_date/due_time 真的是 Date 对象，这 4
 * 项测试自然会在真实环境里验证这次的边界修复是否生效，不需要另外
 * 构造一个"故意注入 Date 对象"的测试**（GAS 测试文件没有合法途径
 * 通过公开 API 让 `TaskEngine.createTask` 存进去一个 Date 对象或
 * Invalid Date——这类白盒场景的验证只能在 Node.js GAS-shim 环境里
 * 直接操作内存数据做到，真实环境测不了这么细，如实标注这个边界，
 * 不假装能测）。
 */

// ============================================================
// 一、Positive Tests —— due_date/due_time 正确映射
// ============================================================

function testTaskToProject_DueDateOnly_MapsCorrectly_() {
  Logger.log('--- testTaskToProject_DueDateOnly_MapsCorrectly_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttpb_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToProject-仅due_date', { due_date: '2026-12-31' }, testChatId);
    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.project) {
      Logger.log('❌ 应该转换成功，实际: ' + JSON.stringify(result));
      return false;
    }

    if (result.project.due_date !== '2026-12-31') {
      Logger.log('❌ due_date 映射不对，期望 2026-12-31，实际: ' + result.project.due_date);
      pass = false;
    }
    if (result.project.due_time !== '') {
      Logger.log('❌ due_time 应该是空字符串，实际: ' + JSON.stringify(result.project.due_time));
      pass = false;
    }
    if (result.project.due_datetime !== '') {
      Logger.log('❌ 只有 due_date 没有 due_time，due_datetime 不应该自动补午夜，应该是空字符串，实际: ' + result.project.due_datetime);
      pass = false;
    }

    // Create → Read-back 一致，间接确认 Projection/Replay 正确落地
    var reloaded = ProjectQueryEngine.getProject(result.project.project_id, testChatId);
    if (!reloaded || reloaded.due_date !== '2026-12-31' || reloaded.due_time !== '' || reloaded.due_datetime !== '') {
      Logger.log('❌ Read-back 不一致: ' + JSON.stringify(reloaded));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_DueDateOnly_MapsCorrectly_ PASS' : '❌ testTaskToProject_DueDateOnly_MapsCorrectly_ FAIL');
  return pass;
}

function testTaskToProject_DueDateAndTime_MapsCorrectly_() {
  Logger.log('--- testTaskToProject_DueDateAndTime_MapsCorrectly_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttpb_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToProject-date+time',
      { due_date: '2026-12-31', due_time: '09:00' }, testChatId);
    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.project) {
      Logger.log('❌ 应该转换成功，实际: ' + JSON.stringify(result));
      return false;
    }

    if (result.project.due_date !== '2026-12-31' || result.project.due_time !== '09:00' ||
        result.project.due_datetime !== '2026-12-31T09:00:00') {
      Logger.log('❌ 三个字段映射不对，实际: due_date=' + result.project.due_date +
        ' due_time=' + result.project.due_time + ' due_datetime=' + result.project.due_datetime);
      pass = false;
    }

    var reloaded = ProjectQueryEngine.getProject(result.project.project_id, testChatId);
    if (!reloaded || reloaded.due_datetime !== '2026-12-31T09:00:00') {
      Logger.log('❌ Read-back 不一致: ' + JSON.stringify(reloaded));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_DueDateAndTime_MapsCorrectly_ PASS' : '❌ testTaskToProject_DueDateAndTime_MapsCorrectly_ FAIL');
  return pass;
}

function testTaskToProject_NoDueDate_StillWorksUnaffected_() {
  Logger.log('--- testTaskToProject_NoDueDate_StillWorksUnaffected_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttpb_' + new Date().getTime();

  try {
    var task = TaskEngine.createTask('验收测试-TaskToProject-无日期', {}, testChatId);
    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.project) {
      Logger.log('❌ 应该转换成功（回归），实际: ' + JSON.stringify(result));
      return false;
    }
    if (result.project.due_date !== '' || result.project.due_time !== '' || result.project.due_datetime !== '') {
      Logger.log('❌ 不带日期时三个字段都应该是空字符串，实际: ' + JSON.stringify(result.project));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_NoDueDate_StillWorksUnaffected_ PASS' : '❌ testTaskToProject_NoDueDate_StillWorksUnaffected_ FAIL');
  return pass;
}

// ============================================================
// 二、Negative Test —— Project → Task 反方向确认没有新增映射
// ============================================================

function testProjectToTask_NoDueFieldReverseMapping_() {
  Logger.log('--- testProjectToTask_NoDueFieldReverseMapping_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttpb_' + new Date().getTime();

  try {
    // 先造一个带 due_date 的 Project（走 createProject 直接创建，不
    // 经过 Task→Project，避免跟上面几个测试耦合）。
    var project = ProjectEngine.createProject('验收测试-ProjectToTask-反向不映射',
      { due_date: '2026-12-31', due_time: '09:00' }, testChatId);

    if (project.due_date !== '2026-12-31') {
      Logger.log('❌ 测试前置条件失败：Project 创建时 due_date 没有生效: ' + JSON.stringify(project));
      return false;
    }

    var result = ConversionEngine.convertProjectToTask(project.project_id, {}, testChatId);
    if (!result.task) {
      Logger.log('❌ 应该转换成功，实际: ' + JSON.stringify(result));
      return false;
    }

    // ADR-2026-09-18-031 治理追记：反向映射明确未获批准，
    // createTaskFromConversion_ 应该维持原状，新 Task 不应该有任何
    // due_date/due_time 值。
    if (result.task.due_date || result.task.due_time) {
      Logger.log('❌ 反方向不应该映射 due 字段（这是明确否决的提案），实际: ' +
        JSON.stringify({ due_date: result.task.due_date, due_time: result.task.due_time }));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testProjectToTask_NoDueFieldReverseMapping_ PASS' : '❌ testProjectToTask_NoDueFieldReverseMapping_ FAIL');
  return pass;
}

// ============================================================
// Gate Runner
// ============================================================

function runTaskToProjectBlockedGate() {
  Logger.log('========== Task → Project due_date/due_time Gate 开始 ==========');
  Logger.log('范围：42_ConversionEngine.gs convertTaskToProject 在');
  Logger.log('ADR-2026-09-18-031 之后的 due_date/due_time 字段映射行为');
  Logger.log('（此前 ADR-2026-09-02-028 的 BLOCKED 检查已移除）。');
  Logger.log('成功转换路径的其它既有断言已经由 36_Tests_Sprint3Acceptance.gs 的');
  Logger.log('testBidirectionalConversion_ 覆盖，本 Gate 不重复。');
  Logger.log('');

  var results = {
    'Positive: due_date only maps correctly':          testTaskToProject_DueDateOnly_MapsCorrectly_(),
    'Positive: due_date + due_time maps correctly':    testTaskToProject_DueDateAndTime_MapsCorrectly_(),
    'Regression: no due_date still works unaffected':  testTaskToProject_NoDueDate_StillWorksUnaffected_(),
    'Negative: Project→Task has no reverse due mapping': testProjectToTask_NoDueFieldReverseMapping_()
  };

  Logger.log('');
  Logger.log('========== Task → Project due_date/due_time Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass ? '✅✅✅ 全部通过' : '❌❌❌ 存在失败项，见上面详情');
  return allPass;
}
