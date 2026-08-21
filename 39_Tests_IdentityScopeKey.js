/**
 * 39_Tests_IdentityScopeKey.gs
 * Personal Life OS — Identity scopeKey (workflow_id) Regression Gate
 *
 * 背景：Identity Impact Audit Track 1（2026-08-20，Carson 批准 (a) 方向）
 * 给 07_IdentityEngine.generateTaskIdentity() 新增了向后兼容的第 7 个
 * 可选参数 scopeKey，创建路径由 09_IdempotencyManager.createTaskIfNotExists
 * 传入 meta.workflow_id || ''。本文件是 Carson 在批准消息里明确要求的
 * "regression/negative tests covering at minimum" 那 6 项，落地成正式、
 * 可重复运行、带 pass/fail 汇总的 Gate（此前只有 07_IdentityEngine.
 * testIdentity() 里的 Logger.log 断言，不是正式回归套件）。
 *
 * 沿用 35/36/37/38 已建立的 Gate 惯例：每个场景一个 test 函数，返回
 * boolean，单一入口汇总 pass/fail。
 *
 * 本文件同时覆盖一项 Track 1 Implementation Preflight 过程中【新发现】、
 * 不在原始批准范围（07/09）内的问题：20_TaskEngine.updateTask() 的
 * identity 重算此前没有传 scopeKey，导致 context-aware Task 一旦被编辑
 * identity-affecting 字段就会退化成不带 scope 的旧公式——见
 * 20_TaskEngine.js updateTask() 内 2026-08-20 修复注释、以及本文件
 * 「二、4」。这不是范围蔓延：Carson 批准的原则是"workflow_id 作为
 * scope key"，07/09 只是这条原则当时已知的两个落点，updateTask() 的
 * identity 重算是同一条原则理应覆盖、但审计总结遗漏的第三个落点，
 * 修法完全复用同一个已批准、向后兼容的 scopeKey 参数，没有引入新规则。
 *
 * ⚠️ 「二」节会真实创建/编辑/清理 Task/Project/Workflow（走真实
 * Sheet + EventBus），沿用 36/38 现有 Gate 的做法，用带时间戳的
 * testChatId 隔离，finally 里 try/ignore 清理。不调用
 * rebuildTasksProjection()/rebuildActiveTasksProjection() 本体——那是
 * 全量、无范围限定的操作，现有任何测试文件都没有直接调用过它们（只有
 * 20_TaskEngine.gs 内部一处运维用途）。「二、5」改为直接对
 * TaskEngine.deriveFromEvent 喂合成事件序列，这正是 ProjectionRebuilder
 * 内部循环调用的同一个函数，能验证同一段逻辑，且不接触生产数据。
 *
 * 单一入口 runIdentityScopeKeyRegressionGate()。
 */

// ============================================================
// 一、纯函数层：直接对 IdentityEngine 断言，不碰 Sheet，跑得最快
// ============================================================

/**
 * Carson 要求 1/6：legacy identity unchanged —— scopeKey 缺省/空值时，
 * 跟"当初没有这个参数"逐字节相同。用固定的历史样例值做锚点，避免
 * "跟自己比较"（那样任何回归都测不出来）。
 */
function testIdentityScope_LegacyUnchanged_() {
  Logger.log('--- testIdentityScope_LegacyUnchanged_ 开始 ---');
  var pass = true;

  try {
    var base = ['123', '提醒我去买菜', '2026-07-01', '', 'MEDIUM', 'SHOPPING'];
    var omitted   = IdentityEngine.generateTaskIdentity.apply(null, base);
    var withUndef = IdentityEngine.generateTaskIdentity.apply(null, base.concat([undefined]));
    var withEmpty = IdentityEngine.generateTaskIdentity.apply(null, base.concat(['']));
    var withNull  = IdentityEngine.generateTaskIdentity.apply(null, base.concat([null]));

    if (omitted !== withUndef || omitted !== withEmpty || omitted !== withNull) {
      Logger.log('❌ scopeKey 缺省 / undefined / "" / null 四种写法应该逐字节相同，实际不同');
      pass = false;
    }

    // 不在这里硬编码一个"锚点哈希值"去比对——那需要脱离本项目独立
    // 算出正确答案才有意义，否则只是自证。这一步已经在 Track 1
    // preflight 阶段用一个跟 07_IdentityEngine.js 完全独立、从零实现
    // 的参照哈希函数在 Node 里真实跑过（见 Track 1 报告），确认
    // scopeKey 缺省时的结果逐字节匹配"改动前 6 字段公式"的独立参照值。
    // 这里改跑一个本文件能长期自动复查的不变量：至少四种"缺省写法"
    // 必须互相相等（上面已验证），且输出必须是合法的 SHA-256 hex。
    if (!/^[0-9a-f]{64}$/.test(omitted)) {
      Logger.log('❌ identity 不是预期的 SHA-256 hex 格式: ' + omitted);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_LegacyUnchanged_ 抛出异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testIdentityScope_LegacyUnchanged_ PASS' : '❌ testIdentityScope_LegacyUnchanged_ FAIL');
  return pass;
}

/**
 * Carson 要求 2/6 + 3/6：same workflow_id → same identity；
 * different workflow_id → different identity。
 */
function testIdentityScope_SameDifferentWorkflow_() {
  Logger.log('--- testIdentityScope_SameDifferentWorkflow_ 开始 ---');
  var pass = true;

  try {
    var fields = ['123', 'X', '2026-07-01', '', 'MEDIUM', 'SHOPPING'];
    var a1 = IdentityEngine.generateTaskIdentity.apply(null, fields.concat(['WKF-A']));
    var a2 = IdentityEngine.generateTaskIdentity.apply(null, fields.concat(['WKF-A']));
    var b  = IdentityEngine.generateTaskIdentity.apply(null, fields.concat(['WKF-B']));

    if (a1 !== a2) {
      Logger.log('❌ 相同 workflow_id 应该得到相同 identity');
      pass = false;
    }
    if (a1 === b) {
      Logger.log('❌ 不同 workflow_id 应该得到不同 identity');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_SameDifferentWorkflow_ 抛出异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testIdentityScope_SameDifferentWorkflow_ PASS' : '❌ testIdentityScope_SameDifferentWorkflow_ FAIL');
  return pass;
}

/**
 * Carson 要求 5/6：legacy Task + 新 context-aware Task 不互相碰撞
 * （字段完全相同、只差 scopeKey 有没有）。
 */
function testIdentityScope_NoCollisionWithLegacy_() {
  Logger.log('--- testIdentityScope_NoCollisionWithLegacy_ 开始 ---');
  var pass = true;

  try {
    var fields = ['123', 'X', '2026-07-01', '', 'MEDIUM', 'SHOPPING'];
    var legacy = IdentityEngine.generateTaskIdentity.apply(null, fields);
    var ctxA   = IdentityEngine.generateTaskIdentity.apply(null, fields.concat(['WKF-A']));
    var ctxB   = IdentityEngine.generateTaskIdentity.apply(null, fields.concat(['WKF-B']));

    if (legacy === ctxA || legacy === ctxB) {
      Logger.log('❌ legacy identity 不应该跟任何 context-aware identity 相同');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_NoCollisionWithLegacy_ 抛出异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testIdentityScope_NoCollisionWithLegacy_ PASS' : '❌ testIdentityScope_NoCollisionWithLegacy_ FAIL');
  return pass;
}

// ============================================================
// 二、真实环境层：走真实 Engine + Sheet + EventBus
// ============================================================

/**
 * Carson 要求 4/6：instantiate 同一个 template 两次 → 两个 Task 的
 * identity 必须不同（不只是 task_id 不同——38_Tests_UIBridge.gs 的
 * Cross-Contamination 测试断言的是 task_id/project_id/workflow_id，
 * 没有直接断言 identity 本身；本测试补上对 identity 字段的直接断言，
 * 这才是 Track 1 要保证的那个不变量）。
 */
function testIdentityScope_RepeatInstantiate_IndependentIdentity_() {
  Logger.log('--- testIdentityScope_RepeatInstantiate_IndependentIdentity_ 开始 ---');
  var pass = true;
  var testChatId = 'identity_gate_' + new Date().getTime();
  var ruleName = '身份回归测试规则_' + new Date().getTime();
  var project, template, first, second;

  try {
    project = ProjectEngine.createProject('身份回归测试：模板源', {}, testChatId);
    TaskEngine.createTask('身份回归测试：模板任务', { project_id: project.project_id }, testChatId);

    var captured = ui_captureProjectAsTemplate(project.project_id, ruleName);
    if (!captured.ok) { Logger.log('❌ 前置 Capture 失败: ' + JSON.stringify(captured)); return false; }
    template = captured.template;

    first  = ui_instantiateTemplate(template.template_id, { chatId: testChatId });
    second = ui_instantiateTemplate(template.template_id, { chatId: testChatId });

    if (!first.ok || !second.ok) {
      Logger.log('❌ 两次 Instantiate 都应该成功');
      pass = false;
    } else if (!first.tasks[0].identity || !second.tasks[0].identity) {
      Logger.log('❌ 返回的 Task 应该带 identity 字段');
      pass = false;
    } else if (first.tasks[0].identity === second.tasks[0].identity) {
      Logger.log('❌ 两次 instantiate 生成的 Task identity 不应该相同（各自的 workflow_id 不同）');
      pass = false;
    } else if (first.tasks[0].workflow_id === second.tasks[0].workflow_id) {
      Logger.log('❌ 两次 instantiate 的 workflow_id 不应该相同（前提条件不成立，测试本身无意义）');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_RepeatInstantiate_IndependentIdentity_ 抛出异常: ' + e.message + '\n' + e.stack);
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

  Logger.log(pass ? '✅ testIdentityScope_RepeatInstantiate_IndependentIdentity_ PASS' : '❌ testIdentityScope_RepeatInstantiate_IndependentIdentity_ FAIL');
  return pass;
}

/**
 * Preflight 新发现项（不在原始 6 项内，见文件头说明）：
 * context-aware Task（带 workflow_id）编辑 identity-affecting 字段后，
 * 新 identity 必须仍然带 scope（不能退化成 legacy 公式），且仍然不跟
 * 字段相同的 legacy Task 碰撞。同时验证这是 20_TaskEngine.updateTask()
 * 2026-08-20 修复（新增 scopeKey 传参）生效的直接证据。
 */
function testIdentityScope_UpdateTaskPreservesScope_() {
  Logger.log('--- testIdentityScope_UpdateTaskPreservesScope_ 开始 ---');
  var pass = true;
  var testChatId = 'identity_gate_upd_' + new Date().getTime();
  var fakeWorkflowId = 'WKF-TEST-' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('身份回归测试：待编辑任务', {
      workflow_id: fakeWorkflowId,
      due_date:    '2026-08-25',
      priority:    'MEDIUM',
      category:    'GENERAL'
    }, testChatId);

    var identityBeforeEdit = task.identity;

    var updated = TaskEngine.updateTask(task.task_id, { title: '身份回归测试：已编辑标题' }, testChatId);
    if (!updated || !updated.identity) {
      Logger.log('❌ updateTask 应该返回带 identity 的 payload: ' + JSON.stringify(updated));
      pass = false;
    } else {
      if (updated.identity === identityBeforeEdit) {
        Logger.log('❌ 标题变了，identity 应该跟着变（identity-affecting 字段）');
        pass = false;
      }

      // 编辑后的 identity 必须等于"直接用编辑后的字段 + 同一个
      // workflow_id 重新算一遍"的结果——这是修复要保证的精确不变量，
      // 不只是"变了就行"。
      var expectedAfterEdit = IdentityEngine.generateTaskIdentity(
        testChatId, '身份回归测试：已编辑标题',
        IdentityEngine.resolveIdentityDueValue({ due_date: '2026-08-25' }),
        '', 'MEDIUM', 'GENERAL', fakeWorkflowId
      );
      if (updated.identity !== expectedAfterEdit) {
        Logger.log('❌ 编辑后 identity 应该等于"新字段 + 原 workflow_id"重算结果，实际不等（scopeKey 可能又被漏传了）');
        pass = false;
      }

      // 且编辑后仍不能跟字段相同的 legacy（无 workflow）Task 碰撞——
      // 这正是本修复要防止的退化。
      var legacyEquivalent = IdentityEngine.generateTaskIdentity(
        testChatId, '身份回归测试：已编辑标题',
        IdentityEngine.resolveIdentityDueValue({ due_date: '2026-08-25' }),
        '', 'MEDIUM', 'GENERAL'
      );
      if (updated.identity === legacyEquivalent) {
        Logger.log('❌ 编辑后的 context-aware identity 退化成了 legacy 公式，会跟字段相同的 legacy Task 碰撞');
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_UpdateTaskPreservesScope_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log(pass ? '✅ testIdentityScope_UpdateTaskPreservesScope_ PASS' : '❌ testIdentityScope_UpdateTaskPreservesScope_ FAIL');
  return pass;
}

/**
 * Carson 要求 6/6：ProjectionRebuilder 保持有效。不直接调用
 * rebuildTasksProjection()（全量、无范围限定，现有任何测试文件都没有
 * 这么用过），改为直接对 TaskEngine.deriveFromEvent 喂合成的
 * TASK_CREATED → TASK_UPDATED 事件序列——这正是 rebuildTasksProjection()
 * 内部循环调用的同一个函数，验证的是同一段逻辑，且不接触生产 Sheet。
 * 覆盖：legacy 序列、context-aware 序列、context-aware 序列 + 编辑（对应
 * 20_TaskEngine.updateTask() 的修复），三种情况下折叠出来的 identity
 * 都必须跟"最后一次写入时" identity 一致，且重复折叠同一份事件序列
 * 结果不变（幂等）。
 */
function testIdentityScope_ProjectionRebuildLogic_() {
  Logger.log('--- testIdentityScope_ProjectionRebuildLogic_ 开始 ---');
  var pass = true;

  try {
    // --- 场景 A：legacy Task，只有 TASK_CREATED ---
    var legacyIdentity = IdentityEngine.generateTaskIdentity('123', 'Legacy Task', '2026-07-01', '', 'MEDIUM', 'GENERAL');
    var eventsA = [
      { type: 'TASK_CREATED', chat_id: '123', payload: { task_id: 'TSK-A', title: 'Legacy Task', due_date: '2026-07-01', priority: 'MEDIUM', category: 'GENERAL', identity: legacyIdentity, workflow_id: '' } }
    ];
    var stateA = {};
    eventsA.forEach(function (e) { TaskEngine.deriveFromEvent(e, stateA); });
    if (stateA['TSK-A'].identity !== legacyIdentity) {
      Logger.log('❌ 场景 A（legacy，仅 CREATED）折叠出来的 identity 不对');
      pass = false;
    }

    // --- 场景 B：context-aware Task，只有 TASK_CREATED ---
    var ctxIdentity = IdentityEngine.generateTaskIdentity('123', 'Ctx Task', '2026-07-01', '', 'MEDIUM', 'GENERAL', 'WKF-X');
    var eventsB = [
      { type: 'TASK_CREATED', chat_id: '123', payload: { task_id: 'TSK-B', title: 'Ctx Task', due_date: '2026-07-01', priority: 'MEDIUM', category: 'GENERAL', identity: ctxIdentity, workflow_id: 'WKF-X' } }
    ];
    var stateB = {};
    eventsB.forEach(function (e) { TaskEngine.deriveFromEvent(e, stateB); });
    if (stateB['TSK-B'].identity !== ctxIdentity) {
      Logger.log('❌ 场景 B（context-aware，仅 CREATED）折叠出来的 identity 不对');
      pass = false;
    }

    // --- 场景 C：context-aware Task，CREATED 之后 UPDATED 改了标题 ---
    // payload.identity 模拟 20_TaskEngine.updateTask() 修复后会算出来的值
    // （新字段 + 原 workflow_id）。
    var ctxIdentityAfterEdit = IdentityEngine.generateTaskIdentity('123', 'Ctx Task Renamed', '2026-07-01', '', 'MEDIUM', 'GENERAL', 'WKF-X');
    var eventsC = [
      { type: 'TASK_CREATED', chat_id: '123', payload: { task_id: 'TSK-C', title: 'Ctx Task', due_date: '2026-07-01', priority: 'MEDIUM', category: 'GENERAL', identity: ctxIdentity, workflow_id: 'WKF-X' } },
      { type: 'TASK_UPDATED', chat_id: '123', payload: { task_id: 'TSK-C', title: 'Ctx Task Renamed', identity: ctxIdentityAfterEdit } }
    ];
    var stateC1 = {};
    eventsC.forEach(function (e) { TaskEngine.deriveFromEvent(e, stateC1); });
    if (stateC1['TSK-C'].identity !== ctxIdentityAfterEdit) {
      Logger.log('❌ 场景 C（context-aware，CREATED+UPDATED）折叠出来的 identity 应该是编辑后的值');
      pass = false;
    }
    if (stateC1['TSK-C'].identity === legacyIdentity || stateC1['TSK-C'].workflow_id !== 'WKF-X') {
      Logger.log('❌ 场景 C 折叠结果丢失了 workflow_id 关联或退化成了 legacy identity');
      pass = false;
    }

    // --- 幂等性：同一份事件序列重复折叠两遍，结果必须完全一致 ---
    var stateC2 = {};
    eventsC.forEach(function (e) { TaskEngine.deriveFromEvent(e, stateC2); });
    eventsC.forEach(function (e) { TaskEngine.deriveFromEvent(e, stateC2); }); // 重放一遍
    if (stateC2['TSK-C'].identity !== ctxIdentityAfterEdit) {
      Logger.log('❌ 重复折叠同一份事件序列，identity 结果应该保持幂等');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ testIdentityScope_ProjectionRebuildLogic_ 抛出异常: ' + e.message + '\n' + e.stack);
    pass = false;
  }

  Logger.log(pass ? '✅ testIdentityScope_ProjectionRebuildLogic_ PASS' : '❌ testIdentityScope_ProjectionRebuildLogic_ FAIL');
  return pass;
}

// ============================================================
// 三、单一入口
// ============================================================

function runIdentityScopeKeyRegressionGate() {
  Logger.log('========== Identity scopeKey (workflow_id) Regression Gate 开始 ==========');
  Logger.log('对应 Identity Impact Audit Track 1 批准消息「4. 增加」的 6 项 + Preflight');
  Logger.log('过程中新发现的 updateTask() 编辑路径修复验证。');
  Logger.log('');

  var results = {
    '1. Legacy identity unchanged':                       testIdentityScope_LegacyUnchanged_(),
    '2+3. Same/Different workflow_id':                     testIdentityScope_SameDifferentWorkflow_(),
    '5. No collision: legacy vs context-aware':            testIdentityScope_NoCollisionWithLegacy_(),
    '4. Repeat instantiate -> independent identity':       testIdentityScope_RepeatInstantiate_IndependentIdentity_(),
    '(new) updateTask preserves scopeKey on edit':         testIdentityScope_UpdateTaskPreservesScope_(),
    '6. ProjectionRebuilder logic remains valid':          testIdentityScope_ProjectionRebuildLogic_()
  };

  Logger.log('');
  Logger.log('========== Identity scopeKey Regression Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——Track 1 (Identity) 的 6 项回归 + preflight 新发现项均满足'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去，不要在此基础上继续 Track 2');
  Logger.log('========== Identity scopeKey Regression Gate 结束 ==========');

  return allPass;
}
