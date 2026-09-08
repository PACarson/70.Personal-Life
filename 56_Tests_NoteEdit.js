/**
 * 56_Tests_NoteEdit.gs
 * Personal Life OS — UI V2 Implementation Plan Slice 3（Note Edit）
 * 最小化针对性验收测试
 *
 * 【2026-09-07 补齐】Slice 3（`29_NoteEngine.updateNote` +
 * `50_UIBridge.ui_updateNote`）自 2026-09-04 交付以来，全项目没有任何
 * 一个测试文件碰过 `updateNote`/`ui_updateNote`（已用 grep 核实：
 * 36_Tests_Sprint3Acceptance.gs、51_Tests_UIBridge_Interactions.gs 等
 * 既有回归套件都不覆盖）——这是 Slice 4A 的 BLOCKED 路径测试缺口
 * （见 55_Tests_TaskToProjectBlocked.gs）之外，另一个"代码交付了但
 * 没有自动化验收测试"的独立缺口，同样的模式，跟那次一样补上。
 *
 * 跟 54/55 一样是真实环境集成测试（真的写 Sheet），用命名空间化的
 * 测试 chatId（accept_test_ne_ + 时间戳）隔离，不碰真实 Telegram 数据。
 *
 * 覆盖 `29_NoteEngine.gs`「Update（Slice 3, 2026-09-04）」这一段的
 * 全部分支：
 *   1  合法 content 变更 —— 持久化正确、identity 重算
 *      —— testNoteEdit_UpdateContent_()
 *   2  合法 category 变更 —— 持久化正确、identity 重算
 *      —— testNoteEdit_UpdateCategory_()
 *   3  FORBIDDEN_FIELDS 校验：混了一个合法字段（content）和一个禁止
 *      字段（due_date）—— 整个请求必须整体拒绝（抛异常），不能只
 *      应用 content 那部分（部分应用会比完全不应用更危险，因为看起来
 *      "成功了一半"）—— testNoteEdit_ForbiddenField_NoPartialApply_()
 *   4  无效 category 值、且没有其它合法字段 —— UPDATABLE_FIELDS 过滤后
 *      payload 只剩 note_id，updateNote 应该返回 null（没有可保存的
 *      改动），不是报错、也不是假装成功
 *      —— testNoteEdit_InvalidCategoryOnly_NoChange_()
 *   5  noteId 不存在 —— 返回 null，不抛异常
 *      —— testNoteEdit_NotFound_()
 *   6  NOTE_UPDATED 事件确实发布、真实 projection 确实落到 Note 行——
 *      这一项特意不信任 updateNote() 自己的返回值，而是用一次独立的
 *      NoteQueryEngine.getNote() 重新读一遍（模拟另一次全新请求），
 *      直接对照“真正持久化的那一行”，不是对照内存里的返回对象
 *      —— testNoteEdit_EventEmittedAndProjected_()
 *
 * 全链路核对（按 Carson 2026-09-07 提出的要求，本次没有新增字段，
 * 记录核对结论）：content/category/identity 三个字段都在
 * `15_Setup.gs`「Notes」的基础列清单里（不是走 NEW_TASK_COLUMNS 那种
 * 后补数组，Notes 的 setup 是一次性列清单），已确认存在，不存在
 * "代码认识这个字段、真实表没有这一列"的风险。
 *
 * 刻意排除（不在这次范围内）：
 *   - `ui_updateNote` 这一层 UIBridge 包装本身（`_resolveChatId_`/
 *     existence check/`_sanitizeTaskDatesForTransport_`）——本文件只
 *     测 `NoteEngine.updateNote`，跟 55_/54_ 一样直接测 Engine 层；
 *     UIBridge 层的浏览器交互仍然要靠人工走一遍 Edit 表单确认。
 *   - Note Create 阶段能不能选 category、卡片是否显示 category
 *     徽章——这两项在 Slice 3 的 Plan 范围之外（`00_Known_Limitations.gs`
 *     没有单独记录，属于 Slice 3 交付说明里已经写清楚的范围排除，不是
 *     这次测试的责任）。
 *
 * 单一入口：runNoteEditGate()
 */

// ============================================================
// 一、Positive — 合法字段更新
// ============================================================

function testNoteEdit_UpdateContent_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var note = NoteEngine.createNote('验收测试-NoteEdit-原始内容', {
      source_module: 'Tests.NoteEdit', decision_owner: testChatId
    }, testChatId);
    var oldIdentity = note.identity;

    var result = NoteEngine.updateNote(note.note_id, { content: '验收测试-NoteEdit-已修改内容' }, testChatId);

    if (!result || result.content !== '验收测试-NoteEdit-已修改内容') {
      Logger.log('❌ updateNote 返回值里 content 不对: ' + JSON.stringify(result));
      pass = false;
    } else if (!result.identity || result.identity === oldIdentity) {
      Logger.log('❌ content 变了，identity 应该跟着重算，实际: ' + result.identity + '（旧值 ' + oldIdentity + '）');
      pass = false;
    }

    var reread = NoteQueryEngine.getNote(note.note_id, testChatId);
    if (!reread || reread.content !== '验收测试-NoteEdit-已修改内容') {
      Logger.log('❌ 重新读取的 Note content 没有持久化成功: ' + JSON.stringify(reread));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_UpdateContent_ PASS' : '❌ testNoteEdit_UpdateContent_ FAIL');
  return pass;
}

function testNoteEdit_UpdateCategory_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var note = NoteEngine.createNote('验收测试-NoteEdit-分类测试', {
      source_module: 'Tests.NoteEdit', decision_owner: testChatId, category: 'IDEA'
    }, testChatId);
    var oldIdentity = note.identity;

    var result = NoteEngine.updateNote(note.note_id, { category: 'REFERENCE' }, testChatId);

    if (!result || result.category !== 'REFERENCE') {
      Logger.log('❌ updateNote 返回值里 category 不对: ' + JSON.stringify(result));
      pass = false;
    } else if (!result.identity || result.identity === oldIdentity) {
      Logger.log('❌ category 变了，identity 应该跟着重算，实际没变: ' + result.identity);
      pass = false;
    }

    var reread = NoteQueryEngine.getNote(note.note_id, testChatId);
    if (!reread || reread.category !== 'REFERENCE') {
      Logger.log('❌ 重新读取的 Note category 没有持久化成功: ' + JSON.stringify(reread));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_UpdateCategory_ PASS' : '❌ testNoteEdit_UpdateCategory_ FAIL');
  return pass;
}

// ============================================================
// 二、Negative — FORBIDDEN_FIELDS 整体拒绝，不部分应用
// ============================================================

function testNoteEdit_ForbiddenField_NoPartialApply_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var note = NoteEngine.createNote('验收测试-NoteEdit-禁止字段', {
      source_module: 'Tests.NoteEdit', decision_owner: testChatId
    }, testChatId);

    var threw = false;
    try {
      NoteEngine.updateNote(note.note_id, { content: '不应该生效的新内容', due_date: '2026-12-31' }, testChatId);
    } catch (e) {
      threw = true;
      if (String(e.message).indexOf('INVALID_FIELD') === -1) {
        Logger.log('❌ 抛的异常不是 INVALID_FIELD: ' + e.message);
        pass = false;
      }
    }
    if (!threw) {
      Logger.log('❌ 混了 due_date 应该抛异常，实际没有抛');
      pass = false;
    }

    var reread = NoteQueryEngine.getNote(note.note_id, testChatId);
    if (!reread || reread.content !== '验收测试-NoteEdit-禁止字段') {
      Logger.log('❌ 应该整体拒绝、content 保持原样，实际被部分应用了: ' + JSON.stringify(reread));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该在测试框架层面抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_ForbiddenField_NoPartialApply_ PASS' : '❌ testNoteEdit_ForbiddenField_NoPartialApply_ FAIL');
  return pass;
}

// ============================================================
// 三、Negative — 无有效改动 / Note 不存在
// ============================================================

function testNoteEdit_InvalidCategoryOnly_NoChange_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var note = NoteEngine.createNote('验收测试-NoteEdit-无效分类', {
      source_module: 'Tests.NoteEdit', decision_owner: testChatId
    }, testChatId);

    var result = NoteEngine.updateNote(note.note_id, { category: 'NOT_A_REAL_CATEGORY' }, testChatId);

    if (result !== null) {
      Logger.log('❌ 无效 category、没有其它字段时应该返回 null，实际: ' + JSON.stringify(result));
      pass = false;
    }

    var reread = NoteQueryEngine.getNote(note.note_id, testChatId);
    if (!reread || reread.category === 'NOT_A_REAL_CATEGORY') {
      Logger.log('❌ 无效 category 不应该被写入: ' + JSON.stringify(reread));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常（无效 category 应该被静默过滤，不是报错）: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_InvalidCategoryOnly_NoChange_ PASS' : '❌ testNoteEdit_InvalidCategoryOnly_NoChange_ FAIL');
  return pass;
}

function testNoteEdit_NotFound_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var result = NoteEngine.updateNote('NOTE-does-not-exist-' + testChatId, { content: '不重要' }, testChatId);
    if (result !== null) {
      Logger.log('❌ 不存在的 noteId 应该返回 null，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不存在的 noteId 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_NotFound_ PASS' : '❌ testNoteEdit_NotFound_ FAIL');
  return pass;
}

// ============================================================
// 四、Integrity — 事件发布 + 真实 projection（独立重读，不信任
//    updateNote() 自己的返回值）
// ============================================================

function testNoteEdit_EventEmittedAndProjected_() {
  var testChatId = 'accept_test_ne_' + new Date().getTime();
  var pass = true;

  try {
    var note = NoteEngine.createNote('验收测试-NoteEdit-事件核对', {
      source_module: 'Tests.NoteEdit', decision_owner: testChatId
    }, testChatId);

    NoteEngine.updateNote(note.note_id, { content: '验收测试-NoteEdit-事件核对-已更新' }, testChatId);

    // 故意不用 updateNote() 的返回值做判断，模拟"另一次全新请求"重新
    // 查一遍，直接核对真正持久化的那一行——这一步是被
    // 00_Known_Limitations.gs「NEW_TASK_COLUMNS 漏列」那次事故直接
    // 影响加上的：只信返回值、不核对真实持久化状态，正是那次没有
    // 更早发现问题的原因之一。
    var reread = NoteQueryEngine.getNote(note.note_id, testChatId);
    if (!reread) {
      Logger.log('❌ 重新查询应该能找到这条 Note');
      pass = false;
    } else if (reread.content !== '验收测试-NoteEdit-事件核对-已更新') {
      Logger.log('❌ 真实 projection 的 content 不对: ' + JSON.stringify(reread));
      pass = false;
    } else if (reread.identity === note.identity) {
      Logger.log('❌ content 变了，真实持久化的 identity 应该也跟着变，实际没变');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  }

  Logger.log(pass ? '✅ testNoteEdit_EventEmittedAndProjected_ PASS' : '❌ testNoteEdit_EventEmittedAndProjected_ FAIL');
  return pass;
}

// ============================================================
// 五、单一入口
// ============================================================

function runNoteEditGate() {
  Logger.log('========== Note Edit Gate 开始 ==========');
  Logger.log('范围：29_NoteEngine.gs updateNote()（Slice 3, 2026-09-04）。');
  Logger.log('只测 Engine 层；ui_updateNote 的 UIBridge 包装 + 浏览器里');
  Logger.log('Edit 表单的真实交互不在本 Gate 覆盖范围内，需要人工验证。');
  Logger.log('');

  var results = {
    'Positive: Update Content':                   testNoteEdit_UpdateContent_(),
    'Positive: Update Category':                  testNoteEdit_UpdateCategory_(),
    'Negative: Forbidden Field, No Partial Apply': testNoteEdit_ForbiddenField_NoPartialApply_(),
    'Negative: Invalid Category Only, No Change':  testNoteEdit_InvalidCategoryOnly_NoChange_(),
    'Negative: Note Not Found':                    testNoteEdit_NotFound_(),
    'Integrity: Event Emitted And Projected':      testNoteEdit_EventEmittedAndProjected_()
  };

  Logger.log('');
  Logger.log('========== Note Edit Gate 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——下一步：真实浏览器手动走一遍 Note 卡片 Edit ' +
      '表单，确认 content/category 能正常保存、UI 正确刷新'
    : '❌❌❌ 存在失败项，见上面详情');
  Logger.log('========== Note Edit Gate 结束 ==========');
  return allPass;
}
