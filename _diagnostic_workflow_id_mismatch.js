/**
 * _diagnostic_workflow_id_mismatch.gs
 *
 * 临时诊断用，不是正式回归测试的一部分，不需要注册进 00_File_Map.gs——
 * 前两次假设（表头缺列、due_date 被 Sheets 转成 Date）都被 Carson 提供
 * 的直接证据推翻了，与其继续猜第三个，不如把两边真正喂进
 * generateTaskIdentity 的每一个参数原样打印出来，直接比对，用真实证据
 * 而不是推理找到分歧点。跑完、看完 Log 之后可以直接删掉这个文件。
 *
 * 用法：在 Apps Script 编辑器里跑 diagnoseWorkflowIdMismatch()，把完整
 * Logger 输出发回来。
 */
function diagnoseWorkflowIdMismatch() {
  Logger.log('========== diagnoseWorkflowIdMismatch 开始 ==========');
  var testChatId = 'diag_' + new Date().getTime();
  var fakeWorkflowId = 'WKF-DIAG-' + new Date().getTime();
  var task;

  try {
    task = TaskEngine.createTask('诊断：待编辑任务', {
      workflow_id: fakeWorkflowId,
      due_date:    '2026-08-25',
      priority:    'MEDIUM',
      category:    'GENERAL'
    }, testChatId);

    Logger.log('--- 创建后，内存里 task 对象的关键字段 ---');
    ['chat_id', 'title', 'due_date', 'due_time', 'due_datetime', 'recurring', 'priority', 'category', 'workflow_id', 'identity'].forEach(function (f) {
      Logger.log(f + ' = ' + JSON.stringify(task[f]) + '   (typeof ' + typeof task[f] + ')');
    });

    var existing = TaskQueryEngine.getTask(task.task_id, testChatId);
    Logger.log('--- 从 Sheet 里用 getTask() 读回来的 existing 对象关键字段 ---');
    ['chat_id', 'title', 'due_date', 'due_time', 'due_datetime', 'recurring', 'priority', 'category', 'workflow_id', 'identity'].forEach(function (f) {
      Logger.log(f + ' = ' + JSON.stringify(existing[f]) + '   (typeof ' + typeof existing[f] + ')');
    });

    // ---- 完全照抄 20_TaskEngine.updateTask() 的合并逻辑，自己在这里重放一遍 ----
    var changes = { title: '诊断：已编辑标题' };
    var payload = { task_id: task.task_id };
    payload.title = changes.title;
    var merged = shallowCopy_(existing);
    for (var k in payload) merged[k] = payload[k];

    Logger.log('--- 按 updateTask() 同样逻辑构造出的 merged 对象关键字段 ---');
    ['chat_id', 'title', 'due_date', 'due_time', 'due_datetime', 'recurring', 'priority', 'category', 'workflow_id'].forEach(function (f) {
      Logger.log(f + ' = ' + JSON.stringify(merged[f]) + '   (typeof ' + typeof merged[f] + ')');
    });

    var prodDueValue = IdentityEngine.resolveIdentityDueValue(merged);
    var testDueValue = IdentityEngine.resolveIdentityDueValue({ due_date: '2026-08-25' });
    Logger.log('resolveIdentityDueValue(merged)                     = ' + JSON.stringify(prodDueValue) + '   (typeof ' + typeof prodDueValue + ')');
    Logger.log('resolveIdentityDueValue({due_date:"2026-08-25"})    = ' + JSON.stringify(testDueValue) + '   (typeof ' + typeof testDueValue + ')');

    // ---- 两边分别喂进 generateTaskIdentity 用到的 7 个参数，逐个打印比对 ----
    var prodParams = [
      merged.chat_id || testChatId || existing.chat_id,
      merged.title,
      prodDueValue,
      merged.recurring || '',
      merged.priority  || 'MEDIUM',
      merged.category  || 'GENERAL',
      merged.workflow_id || ''
    ];
    var testParams = [
      testChatId,
      '诊断：已编辑标题',
      testDueValue,
      '',
      'MEDIUM',
      'GENERAL',
      fakeWorkflowId
    ];
    var labels = ['chatId/scope', 'title', 'dueValue', 'recurring', 'priority', 'category', 'scopeKey(workflow_id)'];

    Logger.log('--- 逐参数比对（production 实际计算 vs 测试期望的手工计算）---');
    var anyDiff = false;
    for (var i = 0; i < labels.length; i++) {
      var same = String(prodParams[i]) === String(testParams[i]);
      if (!same) anyDiff = true;
      Logger.log((same ? '✅ 一致' : '❌ 不一致') + '  [' + labels[i] + ']  production=' + JSON.stringify(prodParams[i]) + '  test=' + JSON.stringify(testParams[i]));
    }

    var prodIdentity = IdentityEngine.generateTaskIdentity.apply(null, prodParams);
    var testIdentity = IdentityEngine.generateTaskIdentity.apply(null, testParams);
    Logger.log('production 用上面 7 个参数重算出的 identity = ' + prodIdentity);
    Logger.log('测试期望的 identity                         = ' + testIdentity);
    Logger.log('两者是否相等: ' + (prodIdentity === testIdentity));

    var actualUpdateResult = TaskEngine.updateTask(task.task_id, changes, testChatId);
    Logger.log('TaskEngine.updateTask() 真实返回的 identity  = ' + (actualUpdateResult ? actualUpdateResult.identity : '(null)'));

    Logger.log(anyDiff
      ? '❌ 上面标了"不一致"的参数就是根因，不需要再猜。'
      : '🤔 7 个参数逐个比对完全一致，但如果最终 identity 还是不等，说明' +
        'generateTaskIdentity 内部（比如 normalizeTitle_ 或 sha256_）本身' +
        '有状态或非确定性行为，需要再往里查一层。');

  } catch (e) {
    Logger.log('❌ 诊断过程抛出异常: ' + e.message + '\n' + e.stack);
  } finally {
    try { if (task) TaskEngine.cancelTask(task.task_id, testChatId); } catch (ignore) {}
  }

  Logger.log('========== diagnoseWorkflowIdMismatch 结束 ==========');
}
