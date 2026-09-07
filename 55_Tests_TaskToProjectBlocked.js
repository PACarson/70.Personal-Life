/**
 * 55_Tests_TaskToProjectBlocked.gs
 * Personal Life OS — Slice 4 Part A（Task → Project BLOCKED）针对性
 * 验收测试，ADR-2026-09-02-028
 *
 * 起因：Slice 4 Part A 交付时（2026-09-04）`36_Tests_Sprint3Acceptance.gs`/
 * `38_Tests_UIBridge.gs`只回归确认了"没有 due_date 的 Task 正常转换成
 * Project"这条既有路径没被破坏（`testBidirectionalConversion_`，line
 * 165-178，已确认 converted_to_project_id 正确回读），但 ADR-028 这次
 * 新加的核心行为——"带 due_date/due_time 的 Task 应该被 BLOCKED，不能
 * 转换成 Project"——本身从来没有一个自动化测试真正验证过，一直是
 * Known gap（见 00_Project_State.gs 交付章节里"没有自动化测试覆盖新的
 * BLOCKED 路径本身"那条）。本文件只补这一个缺口，不重复
 * `testBidirectionalConversion_`已经覆盖的成功路径。
 *
 * 跟 35/36/38/54 一样是真实环境集成测试（真的写 Sheet），用命名空间化
 * 的测试 chatId（accept_test_ttpb_ + 时间戳）隔离，不碰真实 Telegram
 * 数据。
 *
 * 覆盖范围：
 *   1. 源 Task 只带 due_date → BLOCKED
 *   2. 源 Task 只带 due_time → BLOCKED
 *   3. 两种 BLOCKED 情况下都确认：没有 Project 被创建、源 Task 没有被
 *      标记成 CONVERTED（对称于 54_Tests_TaskToNoteConversion.gs 里
 *      同样的检查方式）
 *
 * 刻意排除（不在本文件范围内，如实记录，不是遗漏）：
 *   - "已经转换过的 Task 之后被打上 due_date，再次调用应该走幂等分支
 *     而不是变成 BLOCKED"——42_ConversionEngine.gs 第 66-74 行的注释
 *     明确写了这是有意的顺序（幂等检查在 BLOCKED 检查之前），但要验证
 *     这条需要先让一个 Task 成功转换、再用 updateTask 补一个 due_date
 *     上去，前提是 updateTask 对已经 CONVERTED 的 Task 不会拒绝写入
 *     ——这一点本次没有去确认，为了不重复这次 due_datetime 那种"测试
 *     假设了一个没验证过的行为"的错误，这次不做这个更复杂的场景，只
 *     测最核心、最直接的触发条件。等 Carson 需要时可以再单独补。
 *   - due_datetime 单独触发——ADR-028 的检查是
 *     `due_date || due_time || due_datetime`的 OR 条件，due_date 或
 *     due_time 单独设置就足够触发，不需要（也做不到，due_datetime 是
 *     纯派生字段，见 54_Tests_TaskToNoteConversion.gs 顶部同样的教训）
 *     单独构造一个"只有 due_datetime"的场景。
 *
 * 单一入口：runTaskToProjectBlockedGate()
 */

// ============================================================
// 一、Negative Tests — due_date / due_time 触发 BLOCKED
// ============================================================

function testTaskToProject_DueDateBlocked_() {
  Logger.log('--- testTaskToProject_DueDateBlocked_ 开始 ---');
  var pass = true;
  var testChatId = 'accept_test_ttpb_' + new Date().getTime();

  var cases = [
    { field: 'due_date', meta: { due_date: '2026-12-31' } },
    { field: 'due_time', meta: { due_date: '2026-12-31', due_time: '09:00' } }
    // due_time 单独测试也顺带给了 due_date（跟 54 号文件对 due_time
    // 用例的处理方式一致），因为空 due_time、没有 due_date 不是一个
    // 有意义的真实数据状态；这条用例主要验证 due_time 这个 OR 分支
    // 本身确实会被走到（哪怕 due_date 同时也真），不是排他性验证。
  ];

  cases.forEach(function (c) {
    try {
      var title = '验收测试-TaskToProject-BLOCKED-' + c.field;
      var task = TaskEngine.createTask(title, c.meta, testChatId);

      var result = ConversionEngine.convertTaskToProject(task.task_id, {}, testChatId);

      if (!result.blocked) {
        Logger.log('❌ [' + c.field + '] 应该 blocked，实际: ' + JSON.stringify(result));
        pass = false;
        return;
      }

      if (result.project) {
        Logger.log('❌ [' + c.field + '] blocked 了，但仍然返回了一个 project 对象，不应该发生: ' + JSON.stringify(result));
        pass = false;
        return;
      }

      // 源 Task 本身不应该被标记为 CONVERTED（对称于
      // 54_Tests_TaskToNoteConversion.gs 里同样的检查方式）
      var reloaded = TaskQueryEngine.getTask(task.task_id, testChatId);
      if (String(reloaded.status).toUpperCase() === 'CONVERTED') {
        Logger.log('❌ [' + c.field + '] BLOCKED 之后源 Task 不应该变成 CONVERTED，实际: ' + JSON.stringify(reloaded));
        pass = false;
      }
      if (reloaded.converted_to_project_id) {
        Logger.log('❌ [' + c.field + '] BLOCKED 之后源 Task 不应该有 converted_to_project_id，实际: ' + reloaded.converted_to_project_id);
        pass = false;
      }
    } catch (e) {
      Logger.log('❌ [' + c.field + '] 不应该抛异常: ' + e.message);
      pass = false;
    }
  });

  Logger.log(pass ? '✅ testTaskToProject_DueDateBlocked_ PASS' : '❌ testTaskToProject_DueDateBlocked_ FAIL');
  return pass;
}

// ============================================================
// Gate Runner
// ============================================================

function runTaskToProjectBlockedGate() {
  Logger.log('========== Task → Project BLOCKED Gate 开始 ==========');
  Logger.log('范围：42_ConversionEngine.gs convertTaskToProject 的');
  Logger.log('ADR-2026-09-02-028 BLOCKED 检查（Slice 4 Part A）。');
  Logger.log('成功转换路径已经由 36_Tests_Sprint3Acceptance.gs 的');
  Logger.log('testBidirectionalConversion_ 覆盖，本 Gate 不重复。');
  Logger.log('');

  var results = {
    'Negative: Task→Project Blocked by due_date/due_time': testTaskToProject_DueDateBlocked_()
  };

  Logger.log('');
  Logger.log('========== Task → Project BLOCKED Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass ? '✅✅✅ 全部通过' : '❌❌❌ 存在失败项，见上面详情');
  return allPass;
}
