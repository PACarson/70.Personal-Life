/**
 * 57_Tests_TaskToProjectPrecheck.gs
 * Personal Life OS — Known Limitation 8 修复验收测试
 *
 * 【2026-09-08】验证 `42_ConversionEngine.convertTaskToProject` 的
 * pre-check-before-create 修复（见 `00_Known_Limitations.gs`「八」、
 * `00_Project_State.gs` 对应交付章节）。
 *
 * Carson 指定的 Idempotency/Duplicate Safety 四个 case 里：
 *   - Case 1（首次转换成功）/ Case 2（重复转换幂等，不建第二个
 *     Project）已经被既有 `36_Tests_Sprint3Acceptance.
 *     testBidirectionalConversion_` 和 `38_Tests_UIBridge.
 *     testUIBridge_ConvertTaskToProject_NoDuplicateOnRetry_` 覆盖，
 *     这次修复没有改动这两条路径经过的代码（都在既有幂等检查那一步
 *     就短路返回，根本不会走到新加的两条 pre-check），不重复造。
 *   - Case 3（"pre-check 阻止创建"要直接证明 createProject 没被调用，
 *     不能只看最终结果）——本文件用
 *     `ProjectQueryEngine.getProjects(chatId,{source_task_id})`
 *     直接查"这个 Task 名下有没有 Project"，不是只看返回值里有没有
 *     project 字段：即使 convertTaskToProject 返回值没有 project，
 *     如果 createProject 其实被调用过、只是返回值被后面某处丢弃，
 *     这个查询仍然能抓到那个孤儿 Project。
 *   - Case 4（failed/cancelled 既有语义）——这次修复没有新增任何
 *     cancellation 行为，不适用，不测。
 *
 * 覆盖：
 *   1  终态 Task（CANCELLED）不能转 Project，零孤儿 Project——
 *      Known Limitation 8 原始描述的场景
 *      —— testTaskToProject_TerminalBlocked_NoOrphan_()
 *   2  已经转换成 Note 的 Task 不能再转 Project，零孤儿 Project，
 *      原有 converted_to_note_id 不被覆盖——分析阶段发现的同根问题
 *      （现有幂等检查的 `&&` 条件对这种情况不会短路）
 *      —— testTaskToProject_AlreadyConvertedToNote_NoOrphan_()
 *   3  正常（非终态、未转换）Task 转换仍然成功——最小复核这次修复
 *      没有误伤正常路径
 *      —— testTaskToProject_NormalConversion_StillWorks_()
 *
 * 全链路核对：本次没有引入任何新字段，两条新 pre-check 复用的都是
 * 已存在的字段（status/converted_to_project_id/converted_to_note_id）
 * 和 `markTaskConverted_`/`convertTaskToNote` 已经在用的同一份
 * terminalStatuses 清单，不涉及 schema/migration，不适用 NEW_TASK_
 * COLUMNS 那类风险。
 *
 * 单一入口：runTaskToProjectPrecheckGate()
 */

function testTaskToProject_TerminalBlocked_NoOrphan_() {
  var testChatId = 'accept_test_ttpp_' + new Date().getTime();
  var pass = true;

  try {
    var task = TaskEngine.createTask('验收测试-Precheck-终态', {}, testChatId);
    TaskEngine.cancelTask(task.task_id, testChatId); // → CANCELLED，终态

    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.invalid_state) {
      Logger.log('❌ 终态 Task 应该返回 invalid_state，实际: ' + JSON.stringify(result));
      pass = false;
    }
    if (result.project) {
      Logger.log('❌ 被 pre-check 挡下来的这次调用不应该返回 project 字段: ' + JSON.stringify(result));
      pass = false;
    }

    // 直接证明没有孤儿 Project 被创建——不是只看返回值
    var orphans = ProjectQueryEngine.getProjects(testChatId, { source_task_id: task.task_id });
    if (orphans.length !== 0) {
      Logger.log('❌ 应该零 Project，实际存在 ' + orphans.length + ' 个: ' + JSON.stringify(orphans));
      pass = false;
    }

    var taskAfter = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (taskAfter.status !== 'CANCELLED') {
      Logger.log('❌ 源 Task 状态不应该被这次被拒绝的转换尝试改动: ' + taskAfter.status);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_TerminalBlocked_NoOrphan_ PASS' : '❌ testTaskToProject_TerminalBlocked_NoOrphan_ FAIL');
  return pass;
}

function testTaskToProject_AlreadyConvertedToNote_NoOrphan_() {
  var testChatId = 'accept_test_ttpp_' + new Date().getTime();
  var pass = true;

  try {
    var task = TaskEngine.createTask('验收测试-Precheck-已转Note', {}, testChatId);
    var noteConversion = ConversionEngine.convertTaskToNote(task.task_id, {}, testChatId);
    if (!noteConversion.note) {
      Logger.log('❌ 测试前置条件失败：Task→Note 本身没转换成功: ' + JSON.stringify(noteConversion));
      Logger.log('❌ testTaskToProject_AlreadyConvertedToNote_NoOrphan_ FAIL（前置条件）');
      return false;
    }
    var noteId = noteConversion.note.note_id;

    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.invalid_state) {
      Logger.log('❌ 已转 Note 的 Task 应该返回 invalid_state，实际: ' + JSON.stringify(result));
      pass = false;
    }

    var orphans = ProjectQueryEngine.getProjects(testChatId, { source_task_id: task.task_id });
    if (orphans.length !== 0) {
      Logger.log('❌ 应该零 Project，实际存在 ' + orphans.length + ' 个: ' + JSON.stringify(orphans));
      pass = false;
    }

    var taskAfter = TaskQueryEngine.getTask(task.task_id, testChatId);
    if (taskAfter.converted_to_note_id !== noteId) {
      Logger.log('❌ 原有 converted_to_note_id 被这次被拒绝的转换尝试改动了: ' + JSON.stringify(taskAfter));
      pass = false;
    }
    if (taskAfter.converted_to_project_id) {
      Logger.log('❌ converted_to_project_id 不应该被设置: ' + taskAfter.converted_to_project_id);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_AlreadyConvertedToNote_NoOrphan_ PASS' : '❌ testTaskToProject_AlreadyConvertedToNote_NoOrphan_ FAIL');
  return pass;
}

function testTaskToProject_NormalConversion_StillWorks_() {
  var testChatId = 'accept_test_ttpp_' + new Date().getTime();
  var pass = true;

  try {
    var task = TaskEngine.createTask('验收测试-Precheck-正常路径复核', {}, testChatId);
    var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

    if (!result.project) {
      Logger.log('❌ 正常（非终态、未转换）Task 应该转换成功，实际: ' + JSON.stringify(result));
      pass = false;
    } else {
      var taskAfter = TaskQueryEngine.getTask(task.task_id, testChatId);
      if (taskAfter.status !== 'CONVERTED' || taskAfter.converted_to_project_id !== result.project.project_id) {
        Logger.log('❌ 源 Task 转换后状态不对，这次修复不应该影响正常路径: ' + JSON.stringify(taskAfter));
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testTaskToProject_NormalConversion_StillWorks_ PASS' : '❌ testTaskToProject_NormalConversion_StillWorks_ FAIL');
  return pass;
}

function runTaskToProjectPrecheckGate() {
  Logger.log('========== Task→Project Pre-check (Known Limitation 8) Gate 开始 ==========');
  Logger.log('范围：42_ConversionEngine.gs convertTaskToProject 新增的两条');
  Logger.log('pre-check（终态拒绝 + 已转 Note 拒绝），以及正常路径最小复核。');
  Logger.log('');

  var results = {
    'Negative: Terminal Task Blocked, No Orphan Project':      testTaskToProject_TerminalBlocked_NoOrphan_(),
    'Negative: Already-Converted-to-Note, No Orphan Project':  testTaskToProject_AlreadyConvertedToNote_NoOrphan_(),
    'Positive: Normal Conversion Still Works (no regression)': testTaskToProject_NormalConversion_StillWorks_()
  };

  Logger.log('');
  Logger.log('========== Task→Project Pre-check Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——下一步：真实环境重跑既有 Task→Project 测试' +
      '（36_Tests_Sprint3Acceptance.testBidirectionalConversion_、' +
      '38_Tests_UIBridge 的三个 ConvertTaskToProject 测试、' +
      '55_Tests_TaskToProjectBlocked.runTaskToProjectBlockedGate），' +
      '确认这次改动没有破坏任何既有行为'
    : '❌❌❌ 存在失败项，见上面详情');
  Logger.log('========== Task→Project Pre-check Gate 结束 ==========');
  return allPass;
}
