/**
 * 59_Tests_DueTimePlainTextProtection.gs
 * Personal Life OS —— Known Limitation 11/12 的写入路径纯文本保护
 * 验收测试。2026-09-23 新增，配合 05_SheetUtils.js upsertRowByKey_ /
 * batchUpsertRowsByKey_ 新增的 plainTextColumns 参数一起交付。
 *
 * 覆盖范围：
 *   一、Task 的 due_time/due_datetime create/update 之后原样读回字符串
 *   二、Project 的 due_date/due_time/due_datetime 直接 create（不经过
 *      conversion）之后原样读回字符串——跟 55_Tests_TaskToProjectBlocked.js
 *      不同，那份的正向用例走的是 conversion 路径，这里补直接 create 路径
 *   三、Projection fallback（materializeTaskRow_/materializeProjectRow_
 *      直接调用）之后不会重新产生 Date coercion
 *   四、Projection rebuild（重建整张 ActiveTasks 表）之后不会重新产生
 *      Date coercion——故意没放进日常 Gate Runner，见下面单独说明
 *
 * 不覆盖（这次任务的 Scope Firewall，故意不测，不是漏测）：
 *   - Known Limitation 13（due_time 一旦已经被历史性误判成 Date 对象，
 *     canonicalize 补救时新加坡/马来西亚历史时区 ~65 分钟偏差）——这次
 *     任务不做历史数据自动修复，也不新增针对这个偏差本身的断言
 *   - Task→Project 正向转换的 due_date/due_time 映射——已经由
 *     55_Tests_TaskToProjectBlocked.js 覆盖，这里不重复
 *   - upsertRowByKey_/batchUpsertRowsByKey_ 不传 plainTextColumns 时的
 *     向后兼容行为，以及这两个函数内部 setNumberFormat 调用顺序/目标格
 *     计算是否正确——已经由 Node shim
 *     （/home/claude/verify_plaintext_shim.js，不是这个仓库的一部分，
 *     8 项断言全部 PASS）验证过，这里不重复
 *
 * 严格性原则跟 55_Tests_TaskToProjectBlocked.js 完全一致：read-back
 * 断言是直接字符串比较，这份文件里不允许出现 canonicalize/instanceof
 * Date 判断之类的容忍逻辑——测试的意义就是暴露生产代码的问题，不是把
 * 脏数据"看起来正确"地放过去。见 ADR-2026-09-18-031 追记二、
 * 55_Tests_TaskToProjectBlocked.js 2026-09-23 追记。
 *
 * 状态：STATIC VERIFIED（node --check 通过，逻辑经过人工审查）；
 * 下面每一个测试函数都还没有在真实 GAS + 真实 Google Sheet 上跑过一次，
 * LIVE GAS VERIFIED 与否完全没有事实依据，不要假设。
 */

// ============================================================
// 一、Task create/update：due_time / due_datetime
// ============================================================

function testTaskDueFields_StayStrings_AfterCreate_() {
  Logger.log('--- testTaskDueFields_StayStrings_AfterCreate_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_dtptp_' + new Date().getTime();
  try {
    var task = TaskEngine.createTask('验收测试-Task-due_time写入', {
      due_date: '2026-12-31', due_time: '14:30'
    }, testChatId);

    if (task.due_time !== '14:30' || task.due_datetime !== '2026-12-31T14:30:00') {
      Logger.log('❌ 内存返回值就不对: ' + JSON.stringify({ due_time: task.due_time, due_datetime: task.due_datetime }));
      pass = false;
    }

    var reloaded = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (!reloaded) {
      Logger.log('❌ 读不回来: ' + task.task_id);
      return false;
    }
    if (reloaded.due_time !== '14:30') {
      Logger.log('❌ due_time read-back 不一致，期望字符串 14:30，实际类型 ' +
        typeof reloaded.due_time + ' 值 ' + JSON.stringify(reloaded.due_time));
      pass = false;
    }
    if (reloaded.due_datetime !== '2026-12-31T14:30:00') {
      Logger.log('❌ due_datetime read-back 不一致，期望字符串 2026-12-31T14:30:00，实际类型 ' +
        typeof reloaded.due_datetime + ' 值 ' + JSON.stringify(reloaded.due_datetime));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testTaskDueFields_StayStrings_AfterCreate_ PASS' : '❌ testTaskDueFields_StayStrings_AfterCreate_ FAIL');
  return pass;
}

function testTaskDueFields_StayStrings_AfterUpdate_() {
  Logger.log('--- testTaskDueFields_StayStrings_AfterUpdate_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_dtptp_' + new Date().getTime();
  try {
    var task = TaskEngine.createTask('验收测试-Task-due_time更新', {}, testChatId);
    TaskEngine.updateTask(task.task_id, { due_date: '2027-01-15', due_time: '08:05' }, testChatId);

    var reloaded = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (!reloaded || reloaded.due_time !== '08:05' || reloaded.due_datetime !== '2027-01-15T08:05:00') {
      Logger.log('❌ update 之后 read-back 不一致: ' + JSON.stringify({
        due_time: reloaded && reloaded.due_time, due_datetime: reloaded && reloaded.due_datetime
      }));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testTaskDueFields_StayStrings_AfterUpdate_ PASS' : '❌ testTaskDueFields_StayStrings_AfterUpdate_ FAIL');
  return pass;
}

// ============================================================
// 二、Project 直接 create（不经过 conversion）：due_date/due_time/due_datetime
// ============================================================

function testProjectDueFields_StayStrings_AfterDirectCreate_() {
  Logger.log('--- testProjectDueFields_StayStrings_AfterDirectCreate_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_dtptp_' + new Date().getTime();
  try {
    var project = ProjectEngine.createProject('验收测试-Project-直接create', {
      due_date: '2026-12-31', due_time: '09:00'
    }, testChatId);

    var reloaded = ProjectQueryEngine.getProject(project.project_id, testChatId);
    if (!reloaded) {
      Logger.log('❌ 读不回来: ' + project.project_id);
      return false;
    }
    if (reloaded.due_date !== '2026-12-31' || reloaded.due_time !== '09:00' ||
        reloaded.due_datetime !== '2026-12-31T09:00:00') {
      Logger.log('❌ 直接 create 之后 read-back 不一致: ' + JSON.stringify({
        due_date: reloaded.due_date, due_time: reloaded.due_time, due_datetime: reloaded.due_datetime
      }));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testProjectDueFields_StayStrings_AfterDirectCreate_ PASS' : '❌ testProjectDueFields_StayStrings_AfterDirectCreate_ FAIL');
  return pass;
}

// ============================================================
// 三、Projection fallback —— materializeTaskRow_ / materializeProjectRow_
// 直接调用（正常情况下只有 projection_ok===false 才会走到，这里为了能
// 测到，直接调用这两个已经对外暴露的函数本身）
// ============================================================

function testDueFields_SurviveMaterializeFallback_() {
  Logger.log('--- testDueFields_SurviveMaterializeFallback_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_dtptp_' + new Date().getTime();
  try {
    var task = TaskEngine.createTask('验收测试-Task-fallback', {}, testChatId);
    TaskEngine.materializeTaskRow_(task.task_id, {
      task_id: task.task_id, status: 'PENDING', due_date: '2026-11-11',
      due_time: '16:45', due_datetime: '2026-11-11T16:45:00'
    });
    var reloadedTask = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (!reloadedTask || reloadedTask.due_time !== '16:45' || reloadedTask.due_datetime !== '2026-11-11T16:45:00') {
      Logger.log('❌ Task materialize fallback read-back 不一致: ' + JSON.stringify(reloadedTask));
      pass = false;
    }

    var project = ProjectEngine.createProject('验收测试-Project-fallback', {}, testChatId);
    ProjectEngine.materializeProjectRow_(project.project_id, {
      project_id: project.project_id, status: 'DRAFT', due_date: '2026-11-12',
      due_time: '17:00', due_datetime: '2026-11-12T17:00:00'
    });
    var reloadedProject = ProjectQueryEngine.getProject(project.project_id, testChatId);
    if (!reloadedProject || reloadedProject.due_date !== '2026-11-12' ||
        reloadedProject.due_time !== '17:00' || reloadedProject.due_datetime !== '2026-11-12T17:00:00') {
      Logger.log('❌ Project materialize fallback read-back 不一致: ' + JSON.stringify(reloadedProject));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testDueFields_SurviveMaterializeFallback_ PASS' : '❌ testDueFields_SurviveMaterializeFallback_ FAIL');
  return pass;
}

// ============================================================
// 四、Projection rebuild —— 会重建整张 ActiveTasks 表，比其它测试重得多，
// 故意不放进下面的 Gate Runner，需要单独手动跑，不要频繁跑
// ============================================================

function testDueFields_SurviveActiveTasksRebuild_() {
  Logger.log('--- testDueFields_SurviveActiveTasksRebuild_ 开始 ---');
  Logger.log('（会调用 rebuildActiveTasksProjection() 重建整张表，比较重，建议单独手动跑）');
  var pass = true;
  var testChatId = 'accept_test_dtptp_' + new Date().getTime();
  try {
    var task = TaskEngine.createTask('验收测试-Task-rebuild', {
      due_date: '2026-10-10', due_time: '13:13'
    }, testChatId);

    rebuildActiveTasksProjection(); // 11_ProjectionRebuilder.gs，全表重建

    var reloaded = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (!reloaded || reloaded.due_time !== '13:13' || reloaded.due_datetime !== '2026-10-10T13:13:00') {
      Logger.log('❌ rebuild 之后 read-back 不一致: ' + JSON.stringify({
        due_time: reloaded && reloaded.due_time, due_datetime: reloaded && reloaded.due_datetime
      }));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }
  Logger.log(pass ? '✅ testDueFields_SurviveActiveTasksRebuild_ PASS' : '❌ testDueFields_SurviveActiveTasksRebuild_ FAIL');
  return pass;
}

// ============================================================
// Gate Runner —— 日常验收跑这个；不含 rebuild 测试，那个单独手动跑
// ============================================================

function runDueTimePlainTextProtectionGate() {
  Logger.log('========== Due-Time Plain-Text Protection Gate 开始 ==========');
  Logger.log('范围：05_SheetUtils.js upsertRowByKey_/batchUpsertRowsByKey_ 新增');
  Logger.log('plainTextColumns 参数之后，Task 的 due_time/due_datetime 和 Project 的');
  Logger.log('due_date/due_time/due_datetime，在 create/update/fallback 路径下的');
  Logger.log('write-time 保护。Rebuild 路径的等价测试见');
  Logger.log('testDueFields_SurviveActiveTasksRebuild_()——因为会重建整张表，故意');
  Logger.log('不放进这个日常 Gate，需要单独手动跑。');
  Logger.log('');

  var results = {
    'Task: due_time/due_datetime 建立后原样读回': testTaskDueFields_StayStrings_AfterCreate_(),
    'Task: due_time/due_datetime 更新后原样读回': testTaskDueFields_StayStrings_AfterUpdate_(),
    'Project: 直接 create 之后三字段原样读回':      testProjectDueFields_StayStrings_AfterDirectCreate_(),
    'Fallback: materializeTaskRow_/materializeProjectRow_ 之后原样读回': testDueFields_SurviveMaterializeFallback_()
  };

  Logger.log('');
  Logger.log('========== Due-Time Plain-Text Protection Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass ? '✅✅✅ 全部通过' : '❌❌❌ 存在失败项，见上面详情');
  return allPass;
}
