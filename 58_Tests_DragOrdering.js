/**
 * 58_Tests_DragOrdering.gs
 * Personal Life OS — UI-I6 Drag Ordering（ADR-2026-08-26-026）验收测试
 *
 * 【2026-09-11】覆盖 Decision Gate 批准后新增的：
 *   - 12_TaskQueryEngine.getTaskViewOrder（读）
 *   - 20_TaskEngine.updateTaskOrder（写命令 + 独立读回校验）
 *   - 10_ProjectionEngine 的 VIEW_ORDER_UPDATED case / projectViewOrderUpdated_
 *     / _replaceTaskViewOrderRows_（整体覆盖式重写）
 *   - 50_UIBridge 的 ui_updateTaskOrder、ui_getConvertibleTasks 新增的
 *     view_order_index 联查
 *
 * 全链路核对（Carson 的 Verification Discipline，见对话记录）：
 *   Schema Definition   → 15_Setup.gs setupSheets() 新增 TaskViewOrder
 *   Setup/Migration     → migrateSchemaPersonalLifeOS() 末尾已有的
 *                         setupSheets() 调用会自动带上（全新表，同 Sprint 1
 *                         七张新表的先例，不需要新的迁移步骤——见
 *                         00_Drag_Ordering_ADR.gs「J」的核实说明）
 *   Create/Update       → TaskEngine.updateTaskOrder（本文件 Case 1-5）
 *   Read                → TaskQueryEngine.getTaskViewOrder（本文件 Case 1-5，
 *                         间接覆盖）
 *   Projection          → ProjectionEngine.dispatch 的 VIEW_ORDER_UPDATED
 *                         case（本文件全部 Case 都要经过这条路径才能验证
 *                         persisted 数据，间接覆盖；dispatch() 本身不能独立
 *                         调用，见下方"未覆盖"说明）
 *   Replay              → rebuildTaskViewOrderProjection()（见
 *                         11_ProjectionRebuilder__UI_I6_ADDITIONS.gs），
 *                         本文件 Case 6 覆盖
 *   Identity impact      → Case 3 直接证明 Task 自己的字段不受影响
 *   Tests                → 本文件
 *
 * 【如实记录，本文件明确没有覆盖、也没办法在 GAS 测试里覆盖的部分】
 *   (a) 真实拖拽交互（pointerdown/pointermove/pointerup、handle 的
 *       disabled 视觉状态、Filter 激活时 handle 是否真的不可操作）—— 这些
 *       全部是浏览器端 JS（ui_index.html），跟 UI-I1 Sort 当年的既有边界
 *       完全一样（见 00_Known_Limitations.gs「五」），GAS 测试函数看不到
 *       浏览器 DOM/事件，需要 Carson 在浏览器里手动跑一遍。
 *   (b) "独立读回校验真的能抓住一次持久化失败"这个失败路径本身——
 *       正常调用下 projectViewOrderUpdated_ 会成功，无法在不改动
 *       02_EventBus.gs/10_ProjectionEngine.gs（本次 Known Limitation 9
 *       frozen，不修改）的前提下，从测试代码里干净地模拟"projector 内部
 *       真的抛异常"这个场景来验证校验分支本身会被触发——这条校验的存在
 *       理由（为什么不能信任 event.projection_ok）已经是
 *       00_Known_Limitations.gs「九」的既有、独立证实的代码事实，本文件
 *       只能证明"正常路径下读回结果跟提交内容一致"（Case 1/2/5），不能
 *       证明"真出问题时一定会被抓住"这个反向场景。这是诚实的覆盖边界，
 *       不是遗漏。
 *
 * 单一入口：runDragOrderingGate()
 */

function testUpdateTaskOrder_PersistsAndReadsBack_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  try {
    var t1 = TaskEngine.createTask('验收测试-拖拽-A', {}, testChatId);
    var t2 = TaskEngine.createTask('验收测试-拖拽-B', {}, testChatId);
    var t3 = TaskEngine.createTask('验收测试-拖拽-C', {}, testChatId);

    var order = [t3.task_id, t1.task_id, t2.task_id];
    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', order, testChatId);

    var persisted = TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS');
    for (var i = 0; i < order.length; i++) {
      if (persisted[order[i]] !== i) {
        Logger.log('❌ task_id=' + order[i] + ' 期望 order_index=' + i + '，实际=' + persisted[order[i]]);
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUpdateTaskOrder_PersistsAndReadsBack_ PASS' : '❌ testUpdateTaskOrder_PersistsAndReadsBack_ FAIL');
  return pass;
}

function testUpdateTaskOrder_OverwriteNotAccumulate_NoOrphanRows_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  try {
    var t1 = TaskEngine.createTask('验收测试-覆盖-A', {}, testChatId);
    var t2 = TaskEngine.createTask('验收测试-覆盖-B', {}, testChatId);
    var t3 = TaskEngine.createTask('验收测试-覆盖-C', {}, testChatId);

    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [t1.task_id, t2.task_id, t3.task_id], testChatId);
    var firstCount = Object.keys(TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS')).length;
    if (firstCount !== 3) {
      Logger.log('❌ 第一次写入后应该恰好 3 行，实际 ' + firstCount);
      pass = false;
    }

    // 第二次只提交 2 个（模拟其中一个 task 被 filter/完成移出视图后的
    // 重新排序）——整体覆盖式重写，不是增量 patch，见「H.3」。
    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [t3.task_id, t1.task_id], testChatId);
    var secondMap = TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS');
    var secondCount = Object.keys(secondMap).length;
    if (secondCount !== 2) {
      Logger.log('❌ 第二次写入后应该恰好 2 行（不是 3 或 5），实际 ' + secondCount + '——说明清空旧行这一步有问题（幽灵行）');
      pass = false;
    }
    if (secondMap[t3.task_id] !== 0 || secondMap[t1.task_id] !== 1) {
      Logger.log('❌ 第二次写入的 order_index 不对: ' + JSON.stringify(secondMap));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUpdateTaskOrder_OverwriteNotAccumulate_NoOrphanRows_ PASS' : '❌ testUpdateTaskOrder_OverwriteNotAccumulate_NoOrphanRows_ FAIL');
  return pass;
}

function testUpdateTaskOrder_DoesNotTouchTaskOwnFields_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  try {
    var task = TaskEngine.createTask('验收测试-字段不受影响', { category: 'GENERAL', priority: 'HIGH' }, testChatId);
    var before = TaskQueryEngine.getTask(task.task_id, testChatId);

    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [task.task_id], testChatId);

    var after = TaskQueryEngine.getTask(task.task_id, testChatId);
    // 逐个已知字段核对，而不是只看"没抛异常"——直接证明 Carson 要求的
    // "不修改 Tasks/不修改 Task Identity"这条架构边界，不是假设它成立。
    ['title', 'status', 'category', 'priority', 'identity', 'created_time', 'updated_time'].forEach(function (f) {
      if (String(before[f]) !== String(after[f])) {
        Logger.log('❌ 字段 ' + f + ' 被意外改动: ' + before[f] + ' → ' + after[f]);
        pass = false;
      }
    });
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUpdateTaskOrder_DoesNotTouchTaskOwnFields_ PASS' : '❌ testUpdateTaskOrder_DoesNotTouchTaskOwnFields_ FAIL');
  return pass;
}

function testUpdateTaskOrder_RejectsInvalidInput_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  function expectThrow(fn, label) {
    try {
      fn();
      Logger.log('❌ ' + label + ' 应该抛异常但没有');
      pass = false;
    } catch (e) {
      // 期望的路径
    }
  }

  expectThrow(function () { TaskEngine.updateTaskOrder('', ['x'], testChatId); }, '空 contextKey');
  expectThrow(function () { TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [], testChatId); }, '空数组');
  expectThrow(function () { TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', null, testChatId); }, 'null 数组');
  expectThrow(function () { TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', ['x'], ''); }, '空 chatId');

  Logger.log(pass ? '✅ testUpdateTaskOrder_RejectsInvalidInput_ PASS' : '❌ testUpdateTaskOrder_RejectsInvalidInput_ FAIL');
  return pass;
}

function testUpdateTaskOrder_ContextsAreIndependent_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  try {
    var t1 = TaskEngine.createTask('验收测试-独立A', {}, testChatId);
    var t2 = TaskEngine.createTask('验收测试-独立B', {}, testChatId);

    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [t1.task_id, t2.task_id], testChatId);
    // 复合键 (chat_id, context_key, task_id)——同一个 chat 下另一个
    // context_key 不应该看到，也不应该互相覆盖。Phase 2 实际只用
    // 'ALL_OPEN_TASKS'，这里用一个假想 context_key 只是为了验证
    // 复合键过滤逻辑本身（_replaceTaskViewOrderRows_ 的 compound filter）。
    TaskEngine.updateTaskOrder('SOME_OTHER_CONTEXT', [t2.task_id, t1.task_id], testChatId);

    var mapAllOpen = TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS');
    var mapOther   = TaskQueryEngine.getTaskViewOrder(testChatId, 'SOME_OTHER_CONTEXT');

    if (mapAllOpen[t1.task_id] !== 0 || mapAllOpen[t2.task_id] !== 1) {
      Logger.log('❌ ALL_OPEN_TASKS 的顺序被另一个 context 的写入影响了: ' + JSON.stringify(mapAllOpen));
      pass = false;
    }
    if (mapOther[t2.task_id] !== 0 || mapOther[t1.task_id] !== 1) {
      Logger.log('❌ SOME_OTHER_CONTEXT 顺序不对: ' + JSON.stringify(mapOther));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUpdateTaskOrder_ContextsAreIndependent_ PASS' : '❌ testUpdateTaskOrder_ContextsAreIndependent_ FAIL');
  return pass;
}

function testUiUpdateTaskOrder_And_GetConvertibleTasks_JoinRoundTrip_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;
  var overrides = { chatId: testChatId };

  try {
    var t1 = TaskEngine.createTask('验收测试-UIBridge-A', {}, testChatId);
    var t2 = TaskEngine.createTask('验收测试-UIBridge-B', {}, testChatId);
    var t3 = TaskEngine.createTask('验收测试-UIBridge-C（不参与本次排序）', {}, testChatId);

    var badResult = ui_updateTaskOrder([], overrides);
    if (badResult.ok !== false || badResult.code !== 'MISSING_ORDERED_TASK_IDS') {
      Logger.log('❌ 空数组应该被 ui_updateTaskOrder 拒绝: ' + JSON.stringify(badResult));
      pass = false;
    }

    var okResult = ui_updateTaskOrder([t2.task_id, t1.task_id], overrides);
    if (!okResult.ok) {
      Logger.log('❌ ui_updateTaskOrder 应该成功: ' + JSON.stringify(okResult));
      pass = false;
    }

    var listResult = ui_getConvertibleTasks({}, overrides);
    if (!listResult.ok) {
      Logger.log('❌ ui_getConvertibleTasks 应该成功: ' + JSON.stringify(listResult));
      pass = false;
    } else {
      var byId = {};
      listResult.tasks.forEach(function (t) { byId[t.task_id] = t; });
      if (byId[t2.task_id].view_order_index !== 0 || byId[t1.task_id].view_order_index !== 1) {
        Logger.log('❌ view_order_index 联查结果不对: t1=' + byId[t1.task_id].view_order_index + ' t2=' + byId[t2.task_id].view_order_index);
        pass = false;
      }
      if (byId[t3.task_id].view_order_index !== null) {
        Logger.log('❌ 没被排序过的 task 应该是 null，实际: ' + byId[t3.task_id].view_order_index);
        pass = false;
      }
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testUiUpdateTaskOrder_And_GetConvertibleTasks_JoinRoundTrip_ PASS' : '❌ testUiUpdateTaskOrder_And_GetConvertibleTasks_JoinRoundTrip_ FAIL');
  return pass;
}

function testRebuildTaskViewOrderProjection_MatchesLiveState_() {
  var testChatId = 'accept_test_drag_' + new Date().getTime();
  var pass = true;

  try {
    var t1 = TaskEngine.createTask('验收测试-Replay-A', {}, testChatId);
    var t2 = TaskEngine.createTask('验收测试-Replay-B', {}, testChatId);
    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [t1.task_id, t2.task_id], testChatId);
    TaskEngine.updateTaskOrder('ALL_OPEN_TASKS', [t2.task_id, t1.task_id], testChatId); // 制造历史：两次事件，只有最后一次该生效

    var beforeRebuild = TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS');

    rebuildTaskViewOrderProjection(); // 11_ProjectionRebuilder__UI_I6_ADDITIONS.gs，全量重放

    var afterRebuild = TaskQueryEngine.getTaskViewOrder(testChatId, 'ALL_OPEN_TASKS');

    if (afterRebuild[t2.task_id] !== 0 || afterRebuild[t1.task_id] !== 1) {
      Logger.log('❌ Replay 后顺序应该是最后一次事件的结果 [t2,t1]，实际: ' + JSON.stringify(afterRebuild));
      pass = false;
    }
    if (JSON.stringify(beforeRebuild) !== JSON.stringify(afterRebuild)) {
      Logger.log('❌ Replay 前后应该一致（Everything Rebuildable），实际不同: ' +
        JSON.stringify(beforeRebuild) + ' vs ' + JSON.stringify(afterRebuild));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testRebuildTaskViewOrderProjection_MatchesLiveState_ PASS' : '❌ testRebuildTaskViewOrderProjection_MatchesLiveState_ FAIL');
  return pass;
}

function runDragOrderingGate() {
  Logger.log('========== UI-I6 Drag Ordering（ADR-026）Gate 开始 ==========');
  Logger.log('范围：TaskQueryEngine.getTaskViewOrder、TaskEngine.updateTaskOrder、');
  Logger.log('ProjectionEngine 的 VIEW_ORDER_UPDATED、ui_updateTaskOrder、');
  Logger.log('ui_getConvertibleTasks 的 view_order_index 联查、rebuildTaskViewOrderProjection。');
  Logger.log('不覆盖：真实浏览器拖拽交互（见文件头说明，需要 Carson 手动 LIVE 验证）。');
  Logger.log('');

  var results = {
    'Persist + Read Back':                          testUpdateTaskOrder_PersistsAndReadsBack_(),
    'Overwrite Semantics, No Orphan Rows':           testUpdateTaskOrder_OverwriteNotAccumulate_NoOrphanRows_(),
    'Task Own Fields / Identity Untouched':          testUpdateTaskOrder_DoesNotTouchTaskOwnFields_(),
    'Rejects Invalid Input':                          testUpdateTaskOrder_RejectsInvalidInput_(),
    'Contexts Are Independent (Compound Key)':        testUpdateTaskOrder_ContextsAreIndependent_(),
    'UIBridge Round Trip (order + join)':             testUiUpdateTaskOrder_And_GetConvertibleTasks_JoinRoundTrip_(),
    'Replay Matches Live State':                      testRebuildTaskViewOrderProjection_MatchesLiveState_()
  };

  Logger.log('');
  Logger.log('========== UI-I6 Drag Ordering Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过（STATIC/AUTOMATED）——下一步是 Carson 的 LIVE Gate：真实浏览器里验证拖拽本身（见 F. Next Step）'
    : '❌❌❌ 存在失败项，见上面详情，先不要进行浏览器 LIVE 验证');
  Logger.log('========== UI-I6 Drag Ordering Gate 结束 ==========');
  return allPass;
}
