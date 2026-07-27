/**
 * 35_Tests_Sprint1Acceptance.gs
 * Personal Life OS — Sprint 1 Acceptance Gate
 *
 * 完整设计见设计包 00_ADR.gs ADR-2026-07-24-019。单一入口
 * runSprint1AcceptanceGate()，跑六项测试，Logger.log 输出清晰的
 * PASS/FAIL 摘要。
 *
 * 范围说明（重要）：本 Gate 只验证 Sprint 1 实际交付的模块（Identity/
 * Task/Project/Workflow/Query/Projection/Timeline）。Business Rule/
 * Workflow Template 场景、Task⇄Project 转换测试属于 Sprint 3（
 * 41_BusinessRuleEngine.gs / 42_ConversionEngine.gs 落地之后），本文件
 * 不测试尚不存在的模块，完整论证见 ADR-2026-07-24-019 Context 段落。
 *
 * 使用方式：在 Apps Script 编辑器里选中 runSprint1AcceptanceGate 执行，
 * 看 Logger（查看 → 日志，或 Ctrl+Enter）里的完整输出。每个子测试会在
 * 真实 Sheet 里创建"验收测试-"开头的数据，测试内部会尽量自行清理
 * （cancel 掉），但不保证 100% 干净——如果想要一个全新环境跑测试，建议
 * 用独立的测试用 chat_id（本文件全部用带时间戳的临时 chat_id，不会
 * 混进真实数据）。
 */

// ============================================================
// 一、Migration Test
// ============================================================

function testMigration_() {
  Logger.log('--- testMigration_ 开始 ---');
  var pass = true;

  try {
    var id = SecureConfig.getKey('SPREADSHEET_ID');
    var ss = SpreadsheetApp.openById(id);

    // migrateSchemaPersonalLifeOS 本身是幂等的，重复跑不会有副作用
    migrateSchemaPersonalLifeOS();

    ['Tasks', 'ActiveTasks', 'ArchiveTasks'].forEach(function (sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        Logger.log('❌ Sheet 不存在: ' + sheetName);
        pass = false;
        return;
      }
      var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      LIFE_TASK_NEW_COLUMNS.forEach(function (col) {
        if (headers.indexOf(col) === -1) {
          Logger.log('❌ ' + sheetName + ' 缺少新列: ' + col);
          pass = false;
        }
      });
    });

    ['LIFE_PROJECTS', 'LIFE_WORKFLOWS', 'LIFE_TIMELINE', 'LIFE_NOTES',
      'LIFE_REVIEWS', 'LIFE_BUSINESS_RULES', 'LIFE_WORKFLOW_TEMPLATES'].forEach(function (name) {
      if (!ss.getSheetByName(name)) {
        Logger.log('❌ 找不到 Sheet: ' + name);
        pass = false;
      }
    });

  } catch (e) {
    Logger.log('❌ testMigration_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testMigration_ PASS' : '❌ testMigration_ FAIL');
  return pass;
}

// ============================================================
// 二、Existing Data Compatibility Test
// ============================================================

/**
 * 直接往 Tasks 表插入一行"只有旧列、新列全空"的数据（绕开
 * TaskEngine，模拟一条真正在 v5.1 之前就存在的历史数据），验证：
 *  (a) TaskQueryEngine 能正常读到它，新列读出来是空字符串而不是报错
 *  (b) TaskEngine.completeTask 能正常处理它（即使它从来没有走过
 *      createTaskDirect_ 那套新字段初始化逻辑）
 */
function testExistingDataCompatibility_() {
  Logger.log('--- testExistingDataCompatibility_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_compat_' + new Date().getTime();
  var fakeOldTaskId = 'TSK-LEGACY-' + Utilities.getUuid().split('-')[0].toUpperCase();

  try {
    var id = SecureConfig.getKey('SPREADSHEET_ID');
    var ss = SpreadsheetApp.openById(id);
    var sheet = ss.getSheetByName('Tasks');
    var headerMap = getHeaderMap_(sheet);
    var numCols = sheet.getLastColumn();

    var rowArray = new Array(numCols).fill('');
    var oldStyleTask = {
      task_id:  fakeOldTaskId,
      timestamp: new Date().toISOString(),
      title:    '验收测试-模拟迁移前旧数据',
      category: 'GENERAL',
      status:   'PENDING',
      chat_id:  testChatId,
      identity: 'fake_legacy_identity_' + fakeOldTaskId
    };
    for (var field in oldStyleTask) {
      if (headerMap.hasOwnProperty(field)) {
        rowArray[headerMap[field]] = oldStyleTask[field];
      }
    }
    sheet.appendRow(rowArray);

    var readBack = TaskQueryEngine.getTask(fakeOldTaskId, testChatId);
    if (!readBack) {
      Logger.log('❌ 读不到模拟旧数据行');
      pass = false;
    } else if (readBack.project_id !== '' && readBack.project_id != null) {
      Logger.log('❌ 新列 project_id 期望是空，实际: ' + JSON.stringify(readBack.project_id));
      pass = false;
    }

    var completeResult = TaskEngine.completeTask(fakeOldTaskId, testChatId);
    if (completeResult.not_found || completeResult.invalid_state) {
      Logger.log('❌ completeTask 对旧数据行处理失败: ' + JSON.stringify(completeResult));
      pass = false;
    }

    var afterComplete = TaskQueryEngine.getTask(fakeOldTaskId, testChatId);
    if (!afterComplete || String(afterComplete.status).toUpperCase() !== 'DONE') {
      Logger.log('❌ 旧数据行 complete 后 status 不是 DONE: ' + JSON.stringify(afterComplete && afterComplete.status));
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ testExistingDataCompatibility_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testExistingDataCompatibility_ PASS' : '❌ testExistingDataCompatibility_ FAIL');
  return pass;
}

// ============================================================
// 三、Workflow Test（洗衣流程场景）
// ============================================================

function testWorkflowScenario_() {
  Logger.log('--- testWorkflowScenario_ 开始（洗衣流程：Project→Workflow→Task→Timeline）---');
  var pass = true;
  var testChatId = 'accept_test_workflow_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试-家务', {}, testChatId);
    if (!project) { Logger.log('❌ 创建 Project 失败'); return false; }

    var workflow = WorkflowEngine.startWorkflow('验收测试-洗衣流程', {
      project_id: project.project_id,
      workflow_type: 'SEQUENTIAL'
    }, testChatId);
    if (!workflow || workflow.status !== 'IN_PROGRESS') {
      Logger.log('❌ startWorkflow 后状态应为 IN_PROGRESS，实际: ' + JSON.stringify(workflow && workflow.status));
      pass = false;
    }

    var t1 = TaskEngine.createTask('洗衣', { project_id: project.project_id, workflow_id: workflow.workflow_id, sequence_index: 1 }, testChatId);
    var t2 = TaskEngine.createTask('晾衣', { project_id: project.project_id, workflow_id: workflow.workflow_id, sequence_index: 2 }, testChatId);
    var t3 = TaskEngine.createTask('收衣', { project_id: project.project_id, workflow_id: workflow.workflow_id, sequence_index: 3 }, testChatId);

    TaskEngine.completeTask(t1.task_id, testChatId);
    var mid = WorkflowQueryEngine.getWorkflow(workflow.workflow_id);
    if (mid.status === 'COMPLETED') {
      Logger.log('❌ 只完成第一个 Task，Workflow 就被误判为 COMPLETED（应该等三个都完成）');
      pass = false;
    }

    TaskEngine.completeTask(t2.task_id, testChatId);
    TaskEngine.completeTask(t3.task_id, testChatId);

    var finalWorkflow = WorkflowQueryEngine.getWorkflow(workflow.workflow_id);
    if (!finalWorkflow || finalWorkflow.status !== 'COMPLETED') {
      Logger.log('❌ 全部 Task 完成后 Workflow 没有自动 FINISHED，实际: ' + JSON.stringify(finalWorkflow && finalWorkflow.status));
      pass = false;
    }

    var tasksInWorkflow = TaskQueryEngine.getTasksByWorkflow(workflow.workflow_id);
    if (tasksInWorkflow.length !== 3) {
      Logger.log('❌ getTasksByWorkflow 应返回 3 条，实际: ' + tasksInWorkflow.length);
      pass = false;
    }

    ProjectEngine.cancelProject(project.project_id, testChatId);

  } catch (e) {
    Logger.log('❌ testWorkflowScenario_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testWorkflowScenario_ PASS' : '❌ testWorkflowScenario_ FAIL');
  return pass;
}

// ============================================================
// 四、Timeline Integrity Test
// ============================================================

function testTimelineIntegrity_() {
  Logger.log('--- testTimelineIntegrity_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_timeline_' + new Date().getTime();

  try {
    var project = ProjectEngine.createProject('验收测试-Timeline项目', {}, testChatId);
    ProjectEngine.completeProject(project.project_id, testChatId);

    var timeline = TimelineQueryEngine.getTimelineForEntity('PROJECT', project.project_id);

    if (timeline.length < 2) {
      Logger.log('❌ 期望至少 2 条 Timeline 记录（CREATED + COMPLETED），实际: ' + timeline.length);
      pass = false;
    } else {
      for (var i = 1; i < timeline.length; i++) {
        if (new Date(timeline[i].timestamp) < new Date(timeline[i - 1].timestamp)) {
          Logger.log('❌ Timeline 顺序不是按时间正序排列');
          pass = false;
          break;
        }
      }

      timeline.forEach(function (entry) {
        if (!entry.source_event_id) {
          Logger.log('❌ Timeline 条目缺少 source_event_id（不可追溯回 Events）: ' + JSON.stringify(entry));
          pass = false;
        }
        if (String(entry.entity_id) !== String(project.project_id)) {
          Logger.log('❌ entity_id 不匹配: ' + JSON.stringify(entry));
          pass = false;
        }
      });

      if (timeline[0].event_type !== 'PROJECT_CREATED') {
        Logger.log('❌ 第一条应该是 PROJECT_CREATED，实际: ' + timeline[0].event_type);
        pass = false;
      }
    }

  } catch (e) {
    Logger.log('❌ testTimelineIntegrity_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testTimelineIntegrity_ PASS' : '❌ testTimelineIntegrity_ FAIL');
  return pass;
}

// ============================================================
// 五、Metadata Traceability Test
// ============================================================

function testMetadataTraceability_() {
  Logger.log('--- testMetadataTraceability_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_metadata_' + new Date().getTime();

  try {
    var userTask = TaskEngine.createTask('验收测试-用户创建', {}, testChatId);
    if (userTask.creator !== 'User' || userTask.approval_status !== 'APPROVED' || userTask.decision_owner !== testChatId) {
      Logger.log('❌ User 创建路径 Metadata 不对: creator=' + userTask.creator +
        ' approval_status=' + userTask.approval_status + ' decision_owner=' + userTask.decision_owner);
      pass = false;
    }

    var aiTask = TaskEngine.createTask('验收测试-AI创建', { creator: 'AI', suggested_by: 'Claude', source_module: 'AcceptanceTest' }, testChatId);
    if (aiTask.creator !== 'AI' || aiTask.approval_status !== 'PENDING') {
      Logger.log('❌ AI 创建路径 Metadata 不对: creator=' + aiTask.creator + ' approval_status=' + aiTask.approval_status);
      pass = false;
    }

    if (!userTask.created_time || !userTask.updated_time) {
      Logger.log('❌ created_time/updated_time 未填充');
      pass = false;
    }

    Utilities.sleep(1000); // 确保 updated_time 前后有可检测的差异
    TaskEngine.updateTask(userTask.task_id, { notes: '验收测试备注' }, testChatId);
    var afterUpdate = TaskQueryEngine.getTask(userTask.task_id, testChatId);
    if (afterUpdate.updated_time === userTask.updated_time) {
      Logger.log('❌ updateTask 之后 updated_time 没有变化');
      pass = false;
    }

    var project = ProjectEngine.createProject('验收测试-Metadata项目', {}, testChatId);
    if (project.creator !== 'User' || project.approval_status !== 'APPROVED') {
      Logger.log('❌ Project 的 User 创建路径 Metadata 不对');
      pass = false;
    }

    TaskEngine.cancelTask(userTask.task_id, testChatId);
    TaskEngine.cancelTask(aiTask.task_id, testChatId);
    ProjectEngine.cancelProject(project.project_id, testChatId);

  } catch (e) {
    Logger.log('❌ testMetadataTraceability_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testMetadataTraceability_ PASS' : '❌ testMetadataTraceability_ FAIL');
  return pass;
}

// ============================================================
// 六、Reference Contract Mock Test（评审要求新增的一项）
// ============================================================

/**
 * 不依赖 Life Execution OS 真实存在——用本项目已有的
 * CanonicalRepresentation.composeCanonicalIdentity_ +
 * TaskQueryEngine 模拟"Execution 构造 Reference → resolve →
 * Domain 侧数据变化 → 重新 resolve 看到最新值"这条契约（见 00_ADR.gs
 * ADR-2026-07-24-012）。提前暴露 Reference 结构本身是否够用，不需要
 * 等 Execution 真正开始实现才发现契约有问题。
 */
function testReferenceContractMock_() {
  Logger.log('--- testReferenceContractMock_ 开始（模拟 Execution 侧 Reference 契约）---');
  var pass = true;
  var testChatId = 'accept_test_reference_' + new Date().getTime();

  try {
    // 1. Producer 侧：创建一个 Task
    var task = TaskEngine.createTask('验收测试-Reference契约', {}, testChatId);

    // 2. 模拟 Execution 侧构造 Reference
    var identity = CanonicalRepresentation.composeCanonicalIdentity_('TASK', task.task_id);
    var mockReference = {
      reference_id:    Utilities.getUuid(),
      source_os:       identity.domain,
      entity_type:     identity.entity_type,
      entity_id:       identity.entity_id,
      snapshot:        { status: task.status, canonical_status: CanonicalRepresentation.mapTaskStatusToCanonical_(task.status) },
      last_sync_time:  new Date().toISOString()
    };

    if (mockReference.source_os !== 'PERSONAL_LIFE' || mockReference.entity_type !== 'TASK' ||
        mockReference.entity_id !== task.task_id) {
      Logger.log('❌ 构造 Reference 时 Canonical Identity 字段不对: ' + JSON.stringify(mockReference));
      pass = false;
    }

    if (mockReference.snapshot.canonical_status !== 'READY') {
      Logger.log('❌ 初始 Canonical Status 应为 READY，实际: ' + mockReference.snapshot.canonical_status);
      pass = false;
    }

    // 3. 第一次 resolve：Execution 用 Reference 里的 entity_id 反查 Domain
    var resolved1 = TaskQueryEngine.getTask(mockReference.entity_id, testChatId);
    if (!resolved1 || resolved1.task_id !== task.task_id) {
      Logger.log('❌ 第一次 resolve 失败');
      pass = false;
    }

    // 4. Producer 侧发生变化（Domain 自己完成了这个 Task——注意这里没有
    //    任何"Execution 改 Domain 数据"的操作，完全是 Domain 自己触发）
    TaskEngine.completeTask(task.task_id, testChatId);

    // 5. 第二次 resolve：必须看到最新状态，而不是停留在旧 snapshot——
    //    这正是 Reference Integrity 的核心契约：Execution 不能假设
    //    snapshot 会自动刷新，必须重新 resolve。
    var resolved2 = TaskQueryEngine.getTask(mockReference.entity_id, testChatId);
    if (!resolved2 || String(resolved2.status).toUpperCase() !== 'DONE') {
      Logger.log('❌ 第二次 resolve 没有看到最新状态，实际: ' + JSON.stringify(resolved2 && resolved2.status));
      pass = false;
    }

    var newCanonicalStatus = CanonicalRepresentation.mapTaskStatusToCanonical_(resolved2.status);
    if (newCanonicalStatus !== 'COMPLETED') {
      Logger.log('❌ 更新后 Canonical Status 应为 COMPLETED，实际: ' + newCanonicalStatus);
      pass = false;
    }

  } catch (e) {
    Logger.log('❌ testReferenceContractMock_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testReferenceContractMock_ PASS' : '❌ testReferenceContractMock_ FAIL');
  return pass;
}

// ============================================================
// 七、单一入口
// ============================================================

function runSprint1AcceptanceGate() {
  Logger.log('========== Sprint 1 Acceptance Gate 开始 ==========');
  Logger.log('范围：只验证 Sprint 1 实际交付的模块（Identity/Task/Project/');
  Logger.log('Workflow/Query/Projection/Timeline）。Business Rule/Workflow');
  Logger.log('Template/Task⇄Project 转换属于 Sprint 3，不在这里测——');
  Logger.log('完整论证见 00_ADR.gs ADR-2026-07-24-019。');
  Logger.log('');

  var results = {
    'Migration Test':                    testMigration_(),
    'Existing Data Compatibility Test':  testExistingDataCompatibility_(),
    'Workflow Test（洗衣流程场景）':        testWorkflowScenario_(),
    'Timeline Integrity Test':             testTimelineIntegrity_(),
    'Metadata Traceability Test':          testMetadataTraceability_(),
    'Reference Contract Mock Test':        testReferenceContractMock_()
  };

  Logger.log('');
  Logger.log('========== Sprint 1 Acceptance Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——Sprint 1 Foundation 可视为 Reference Certified，可以讨论是否正式进入 Sprint 3'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去，先修好再考虑进 Sprint 3');
  Logger.log('========== Sprint 1 Acceptance Gate 结束 ==========');

  return allPass;
}
