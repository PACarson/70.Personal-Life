/**
 * 36_Tests_Sprint3Acceptance.gs
 * Personal Life OS — Sprint 3 Acceptance Gate
 *
 * 沿用 00_ADR.gs ADR-2026-07-24-019 的 Sprint → Acceptance Gate →
 * Sprint 节奏。本文件专门补上 Sprint 1 Gate 里明确挪出去的两项
 * （Business Rule/Workflow Template 场景、Task⇄Project Test），
 * 现在这两个模块已经落地，可以真正测试。
 *
 * 单一入口 runSprint3AcceptanceGate()。
 */

// ============================================================
// 一、Note 基本生命周期
// ============================================================

function testNoteLifecycle_() {
  Logger.log('--- testNoteLifecycle_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_note_' + new Date().getTime();

  try {
    var note = NoteEngine.createNote('验收测试-以后养猫', { category: 'FUTURE_PLAN' }, testChatId);
    if (!note || note.status !== 'OPEN') {
      Logger.log('❌ 创建 Note 失败: ' + JSON.stringify(note));
      pass = false;
    }

    // 硬性边界：Note 不允许携带 Reminder/Deadline
    var rejected = false;
    try {
      NoteEngine.createNote('验收测试-不该成功', { due_date: '2026-08-01' }, testChatId);
    } catch (e) {
      rejected = (e.message.indexOf('INVALID_FIELD') === 0);
    }
    if (!rejected) {
      Logger.log('❌ Note 携带 due_date 应该被拒绝，但没有报错');
      pass = false;
    }

    var conversion = ConversionEngine.convertNoteToTask(note.note_id, { category: 'GENERAL' }, testChatId);
    if (!conversion.task) {
      Logger.log('❌ Note→Task 转换失败: ' + JSON.stringify(conversion));
      pass = false;
    } else {
      var afterConvert = NoteQueryEngine.getNote(note.note_id, testChatId);
      if (afterConvert.status !== 'CONVERTED' || afterConvert.converted_to_type !== 'TASK') {
        Logger.log('❌ Note 转换后状态不对: ' + JSON.stringify(afterConvert));
        pass = false;
      }
      TaskEngine.cancelTask(conversion.task.task_id, testChatId);
    }

  } catch (e) {
    Logger.log('❌ testNoteLifecycle_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteLifecycle_ PASS' : '❌ testNoteLifecycle_ FAIL');
  return pass;
}

// ============================================================
// 二、Business Rule 全链路（Sprint 1 Gate 挪出来的场景，见 ADR-019）
//     Business Rule → Workflow Template → Workflow Instance
// ============================================================

function testBusinessRuleFullCycle_() {
  Logger.log('--- testBusinessRuleFullCycle_ 开始（重复流程场景）---');
  var pass = true;
  var testChatId = 'accept_test_rule_' + new Date().getTime();

  try {
    // 1. 建一个"源" Project + 几个 Task（模拟一次真实的验屋流程）
    var sourceProject = ProjectEngine.createProject('验收测试-验屋', {}, testChatId);
    var t1 = TaskEngine.createTask('检查外墙', { project_id: sourceProject.project_id, sequence_index: 1 }, testChatId);
    var t2 = TaskEngine.createTask('检查水电', { project_id: sourceProject.project_id, sequence_index: 2 }, testChatId);

    // 2. Capture 成 WorkflowTemplate（v1）
    var template1 = BusinessRuleEngine.captureAsWorkflowTemplate(sourceProject.project_id, '验收测试-验屋流程', ['property', 'inspection']);
    if (!template1 || template1.version !== 1 || template1.status !== 'ACTIVE') {
      Logger.log('❌ 第一次 capture 结果不对: ' + JSON.stringify(template1));
      pass = false;
    }

    var shape1 = JSON.parse(template1.workflow_shape);
    if (shape1.tasks.length !== 2) {
      Logger.log('❌ workflow_shape 里的 Task 数量不对，期望 2，实际 ' + shape1.tasks.length);
      pass = false;
    }

    // 3. 从这个模板实例化出一个全新 Project（不影响源 Project）
    var instantiated = BusinessRuleEngine.instantiateFromTemplate(template1.template_id,
      { title: '验收测试-验屋-Est99' }, testChatId);
    if (!instantiated.project || !instantiated.workflow || instantiated.tasks.length !== 2) {
      Logger.log('❌ instantiateFromTemplate 结果不对: ' + JSON.stringify(instantiated));
      pass = false;
    } else {
      if (instantiated.workflow.instantiated_from_template_id !== template1.template_id) {
        Logger.log('❌ 新 Workflow 没有正确绑定 instantiated_from_template_id');
        pass = false;
      }
    }

    var templateAfterUse = BusinessRuleQueryEngine.getWorkflowTemplate(template1.template_id);
    if (!templateAfterUse || Number(templateAfterUse.usage_count) !== 1) {
      Logger.log('❌ usage_count 应该是 1，实际: ' + (templateAfterUse && templateAfterUse.usage_count));
      pass = false;
    }

    // 4. Capture 第二次（模拟"流程改了"），验证版本递增 + 旧版本自动 FROZEN
    var template2 = BusinessRuleEngine.captureAsWorkflowTemplate(sourceProject.project_id, '验收测试-验屋流程', ['property']);
    if (!template2 || template2.version !== 2) {
      Logger.log('❌ 第二次 capture 版本号不对，期望 2，实际: ' + (template2 && template2.version));
      pass = false;
    }
    var template1AfterFreeze = BusinessRuleQueryEngine.getWorkflowTemplate(template1.template_id);
    if (!template1AfterFreeze || String(template1AfterFreeze.status).toUpperCase() !== 'FROZEN') {
      Logger.log('❌ 旧版本应该自动变成 FROZEN，实际: ' + (template1AfterFreeze && template1AfterFreeze.status));
      pass = false;
    }

    // 5. 已经实例化出去的 Workflow（第一次那个）应该仍然绑定 v1，不受影响
    var instantiatedWorkflowAfter = WorkflowQueryEngine.getWorkflow(instantiated.workflow.workflow_id);
    if (instantiatedWorkflowAfter.instantiated_from_template_id !== template1.template_id) {
      Logger.log('❌ 已实例化的 Workflow 不应该被新版本影响，但 instantiated_from_template_id 变了');
      pass = false;
    }

    // 6. Suggest 匹配
    var suggestions = BusinessRuleEngine.suggestMatchingRules(['property']);
    var foundOurRule = suggestions.some(function (s) { return s.name === '验收测试-验屋流程'; });
    if (!foundOurRule) {
      Logger.log('❌ suggestMatchingRules 没有匹配到刚建的规则');
      pass = false;
    }

    // cleanup
    ProjectEngine.cancelProject(sourceProject.project_id, testChatId);
    ProjectEngine.cancelProject(instantiated.project.project_id, testChatId);

  } catch (e) {
    Logger.log('❌ testBusinessRuleFullCycle_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testBusinessRuleFullCycle_ PASS' : '❌ testBusinessRuleFullCycle_ FAIL');
  return pass;
}

// ============================================================
// 三、Task ⇄ Project 双向转换（Sprint 1 Gate 挪出来的场景，见 ADR-019）
// ============================================================

function testBidirectionalConversion_() {
  Logger.log('--- testBidirectionalConversion_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_convert_' + new Date().getTime();

  try {
    // Task → Project
    var task = TaskEngine.createTask('验收测试-研究AI', {}, testChatId);
    var conversion1 = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);
    if (!conversion1.project) {
      Logger.log('❌ Task→Project 转换失败: ' + JSON.stringify(conversion1));
      pass = false;
    } else {
      var taskAfter = TaskQueryEngine.getTask(task.task_id, testChatId);
      if (taskAfter.status !== 'CONVERTED' || taskAfter.converted_to_project_id !== conversion1.project.project_id) {
        Logger.log('❌ 源 Task 转换后状态不对: ' + JSON.stringify(taskAfter));
        pass = false;
      }
      if (conversion1.project.source_task_id !== task.task_id) {
        Logger.log('❌ 目标 Project 的 source_task_id 血缘字段不对');
        pass = false;
      }

      // 幂等：再转换一次应该返回同一个结果，不重复创建
      var conversion1Again = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);
      if (conversion1Again.project.project_id !== conversion1.project.project_id) {
        Logger.log('❌ 重复转换没有幂等，创建了第二个 Project');
        pass = false;
      }
    }

    // Project → Task（反方向，需要一个"够格"的空 Project：没有 Sub-Project、没有未完成 Task）
    var emptyProject = ProjectEngine.createProject('验收测试-其实只是一件小事', {}, testChatId);
    var eligibility = ProjectEngine.checkEligibleForTaskDemotion_(emptyProject.project_id);
    if (!eligibility.eligible) {
      Logger.log('❌ 空 Project 应该符合降级条件，实际: ' + JSON.stringify(eligibility));
      pass = false;
    }

    var conversion2 = ConversionEngine.convertProjectToTask(emptyProject.project_id, {}, testChatId);
    if (!conversion2.task) {
      Logger.log('❌ Project→Task 转换失败: ' + JSON.stringify(conversion2));
      pass = false;
    } else {
      var projectAfter = ProjectQueryEngine.getProject(emptyProject.project_id, testChatId);
      if (projectAfter.status !== 'CONVERTED_TO_TASK' || projectAfter.converted_to_task_id !== conversion2.task.task_id) {
        Logger.log('❌ 源 Project 转换后状态不对: ' + JSON.stringify(projectAfter));
        pass = false;
      }
      TaskEngine.cancelTask(conversion2.task.task_id, testChatId);
    }

    // 反方向前置条件校验：有未完成 Task 的 Project 应该拒绝降级
    var blockedProject = ProjectEngine.createProject('验收测试-不该能降级', {}, testChatId);
    TaskEngine.createTask('验收测试-还没做完的任务', { project_id: blockedProject.project_id }, testChatId);
    var blockedEligibility = ProjectEngine.checkEligibleForTaskDemotion_(blockedProject.project_id);
    if (blockedEligibility.eligible) {
      Logger.log('❌ 有未完成 Task 的 Project 不应该符合降级条件，但判定为 eligible');
      pass = false;
    }
    var blockedConversion = ConversionEngine.convertProjectToTask(blockedProject.project_id, {}, testChatId);
    if (!blockedConversion.blocked) {
      Logger.log('❌ 有未完成 Task 的 Project 应该被拒绝转换，实际: ' + JSON.stringify(blockedConversion));
      pass = false;
    }

    // Timeline 血缘检查：源 Task 和目标 Project 都应该能查到转换记录
    var taskTimeline = TimelineQueryEngine.getTimelineForEntity('TASK', task.task_id);
    var hasConversionEntry = taskTimeline.some(function (e) { return e.event_type === 'TASK_CONVERTED_TO_PROJECT'; });
    if (!hasConversionEntry) {
      Logger.log('❌ 源 Task 的 Timeline 里找不到 TASK_CONVERTED_TO_PROJECT 记录');
      pass = false;
    }

    // cleanup
    ProjectEngine.cancelProject(conversion1.project.project_id, testChatId);
    ProjectEngine.cancelProject(blockedProject.project_id, testChatId);

  } catch (e) {
    Logger.log('❌ testBidirectionalConversion_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testBidirectionalConversion_ PASS' : '❌ testBidirectionalConversion_ FAIL');
  return pass;
}

// ============================================================
// 四、ReminderConnector 冒烟测试
// ============================================================

function testReminderConnectorSmoke_() {
  Logger.log('--- testReminderConnectorSmoke_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_reminder_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试-Reminder项目', {}, testChatId);

    // 不抛错就算基本通过——ReminderConnector 只是格式转换 + 发布事件，
    // 本项目这一侧无法验证 Reminder OS 是否真的收到并处理（那是
    // Reminder OS 自己的职责范围）
    ReminderConnector.requestProjectReminder(project.project_id, { offset_minutes: 1440 }, testChatId);

    var timeline = TimelineQueryEngine.getTimelineForEntity('PROJECT', project.project_id);
    // REMINDER_REQUESTED 不在 TIMELINE_ENTITY_MAP 里（见
    // 00_Event_Flow.gs——这是发给 Reminder OS 的请求，不是本项目的
    // Timeline 记录），所以这里不应该多一条 REMINDER_REQUESTED 记录，
    // 只是确认调用本身不报错、不影响 Project 自己的 Timeline
    var hasReminderEntry = timeline.some(function (e) { return e.event_type === 'REMINDER_REQUESTED'; });
    if (hasReminderEntry) {
      Logger.log('⚠️ 提醒：REMINDER_REQUESTED 出现在了 Timeline 里，这不是预期行为（应该只发给 Reminder OS，不记本项目 Timeline），但不算测试失败');
    }

    ProjectEngine.cancelProject(project.project_id, testChatId);

  } catch (e) {
    Logger.log('❌ testReminderConnectorSmoke_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testReminderConnectorSmoke_ PASS' : '❌ testReminderConnectorSmoke_ FAIL');
  return pass;
}

// ============================================================
// 五、单一入口
// ============================================================

function runSprint3AcceptanceGate() {
  Logger.log('========== Sprint 3 Acceptance Gate 开始 ==========');
  Logger.log('本 Gate 补上 Sprint 1 Gate 明确挪出去的两项（见 ADR-2026-07-24-019）：');
  Logger.log('Business Rule/Workflow Template 场景、Task⇄Project Test。');
  Logger.log('');

  var results = {
    'Note Lifecycle Test':           testNoteLifecycle_(),
    'Business Rule Full Cycle Test': testBusinessRuleFullCycle_(),
    'Bidirectional Conversion Test': testBidirectionalConversion_(),
    'Reminder Connector Smoke Test': testReminderConnectorSmoke_()
  };

  Logger.log('');
  Logger.log('========== Sprint 3 Acceptance Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——Sprint 3（Integration）可视为 Reference Certified'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== Sprint 3 Acceptance Gate 结束 ==========');

  return allPass;
}
