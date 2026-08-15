/**
 * 37_Tests_AIEngines.gs
 * Personal Life OS — Sprint 4 AI Engine Contract Tests
 *
 * 背景：见 00_ADR.gs ADR-2026-07-24-021。这不是完整的 Sprint 4
 * Acceptance Gate（那需要等 Telegram 指令层落地、Integration Tests /
 * Failure Tests / Regression Tests 跑完才有意义，见 Recovery Audit 报告
 * 「Sprint 3 Recovery & Integration Gate」顺序）。本文件只覆盖三个救回
 * 文件（46_AIConnector.gs / 22_PriorityEngine.gs 的 AI 增量 /
 * 47_AIPlanningEngine.gs）自身的契约正确性——尤其是 AI 输出异常时的
 * 处理是否符合预期，这是 AI Execution Safety 的第一层。
 *
 * 测试方法说明（本项目此前的测试都是对真实 Sheet 写入的集成测试，没有
 * mock 先例——这里是第一次引入）：AIConnector.callAIForJSON_ 会发起
 * 真实网络请求，不适合每次跑测试都真的调用付费 AI API，也没办法用真实
 * 调用可靠地制造"AI 返回 malformed JSON"这类确定性场景。因为
 * AIConnector 是普通对象（不是 Object.freeze 过的），本文件用最小侵入
 * 的方式临时替换 AIConnector.callAIForJSON_（或 UrlFetchApp.fetch，
 * 「四」两个测试专门测 AIConnector 自己），每个测试都在 try/finally 里
 * 恢复原函数，不会影响其它测试或真实调用。这不是引入一个通用 mock
 * 框架，只是针对"外部网络依赖"这一类无法确定性测试的调用点的最小处理。
 *
 * 单一入口 runAIEngineContractTests()。
 */

// ============================================================
// 一、22_PriorityEngine.suggestPriorityWithAI_
// ============================================================

function testPriorityAI_ValidResponse_() {
  Logger.log('--- testPriorityAI_ValidResponse_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  try {
    AIConnector.callAIForJSON_ = function () {
      return { priority: 'HIGH', reasoning: '截止日期很近' };
    };

    var task = { title: '验收测试任务', due_date: '2026-08-15', priority: 'MEDIUM' };
    var result = PriorityEngine.suggestPriorityWithAI_(task);

    if (result.priority !== 'HIGH' || result.reasoning !== '截止日期很近') {
      Logger.log('❌ 合法响应下返回值不对: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 合法响应下不应该抛异常，但抛了: ' + e.message);
    pass = false;
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testPriorityAI_ValidResponse_ PASS' : '❌ testPriorityAI_ValidResponse_ FAIL');
  return pass;
}

function testPriorityAI_InvalidPriorityField_() {
  Logger.log('--- testPriorityAI_InvalidPriorityField_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  try {
    // AI 回了合法 JSON，但 priority 字段不是 HIGH/MEDIUM/LOW（含缺字段的情况）
    AIConnector.callAIForJSON_ = function () { return { reasoning: '没给 priority' }; };

    var threw = false;
    try {
      PriorityEngine.suggestPriorityWithAI_({ title: '测试' });
    } catch (e) {
      threw = (e.message.indexOf('AI_RESPONSE_INVALID') === 0);
      if (!threw) Logger.log('❌ 抛的异常前缀不对: ' + e.message);
    }
    if (!threw) {
      Logger.log('❌ priority 缺失/不合法时应该抛 AI_RESPONSE_INVALID，但没有');
      pass = false;
    }
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testPriorityAI_InvalidPriorityField_ PASS' : '❌ testPriorityAI_InvalidPriorityField_ FAIL');
  return pass;
}

function testPriorityAI_MissingReasoningTolerated_() {
  Logger.log('--- testPriorityAI_MissingReasoningTolerated_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  try {
    AIConnector.callAIForJSON_ = function () { return { priority: 'LOW' }; }; // 没给 reasoning

    var result = PriorityEngine.suggestPriorityWithAI_({ title: '测试' });
    if (result.priority !== 'LOW' || result.reasoning !== '') {
      Logger.log('❌ reasoning 缺失时应该容错为空字符串，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ reasoning 缺失不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testPriorityAI_MissingReasoningTolerated_ PASS' : '❌ testPriorityAI_MissingReasoningTolerated_ FAIL');
  return pass;
}

function testPriorityAI_ConnectorErrorsPropagate_() {
  Logger.log('--- testPriorityAI_ConnectorErrorsPropagate_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  var scenarios = [
    'AI_RESPONSE_NOT_JSON: AI 没有按要求回复合法 JSON，原始回复: 不是JSON的文字',
    'AI_API_ERROR(Anthropic, HTTP 429): rate limited',
    'AI_NOT_CONFIGURED: 请先设置 SecureConfig.setKey("AI_API_KEY", ...)'
  ];

  try {
    for (var i = 0; i < scenarios.length; i++) {
      var msg = scenarios[i];
      AIConnector.callAIForJSON_ = (function (m) {
        return function () { throw new Error(m); };
      })(msg);

      var threw = false;
      try {
        PriorityEngine.suggestPriorityWithAI_({ title: '测试' });
      } catch (e) {
        threw = (e.message === msg); // 原样传播，不包装、不吞掉
      }
      if (!threw) {
        Logger.log('❌ AIConnector 抛出 "' + msg + '" 时，suggestPriorityWithAI_ 没有原样传播');
        pass = false;
      }
    }
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testPriorityAI_ConnectorErrorsPropagate_ PASS' : '❌ testPriorityAI_ConnectorErrorsPropagate_ FAIL');
  return pass;
}

// ============================================================
// 二、47_AIPlanningEngine.suggestNewProject_
// ============================================================

function testSuggestProject_NoOpenNotesShortCircuits_() {
  Logger.log('--- testSuggestProject_NoOpenNotesShortCircuits_ 开始 ---');
  var pass = true;
  var originalGetOpenNotes = NoteQueryEngine.getOpenNotes;
  var originalCallAI = AIConnector.callAIForJSON_;
  var aiWasCalled = false;

  try {
    NoteQueryEngine.getOpenNotes = function () { return []; };
    AIConnector.callAIForJSON_ = function () { aiWasCalled = true; return { has_suggestion: true }; };

    var result = AIPlanningEngine.suggestNewProject_('test_chat');
    if (result.has_suggestion !== false) {
      Logger.log('❌ 没有 open Note 时应该返回 has_suggestion:false，实际: ' + JSON.stringify(result));
      pass = false;
    }
    if (aiWasCalled) {
      Logger.log('❌ 没有 open Note 时不应该发起 AI 调用（浪费一次真实请求），但调用了');
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    NoteQueryEngine.getOpenNotes = originalGetOpenNotes;
    AIConnector.callAIForJSON_ = originalCallAI;
  }

  Logger.log(pass ? '✅ testSuggestProject_NoOpenNotesShortCircuits_ PASS' : '❌ testSuggestProject_NoOpenNotesShortCircuits_ FAIL');
  return pass;
}

function testSuggestProject_ValidSuggestion_() {
  Logger.log('--- testSuggestProject_ValidSuggestion_ 开始 ---');
  var pass = true;
  var originalGetOpenNotes = NoteQueryEngine.getOpenNotes;
  var originalCallAI = AIConnector.callAIForJSON_;

  try {
    NoteQueryEngine.getOpenNotes = function () {
      return [{ note_id: 'NOTE-1', content: '以后要整理车库' }, { note_id: 'NOTE-2', content: '车库的工具该分类了' }];
    };
    AIConnector.callAIForJSON_ = function () {
      return { has_suggestion: true, title: '整理车库', reasoning: '两条 Note 都在说同一件事', related_note_ids: ['NOTE-1', 'NOTE-2'] };
    };

    var result = AIPlanningEngine.suggestNewProject_('test_chat');
    if (!result.has_suggestion || result.title !== '整理车库' || result.related_note_ids.length !== 2) {
      Logger.log('❌ 合法建议响应处理不对: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    NoteQueryEngine.getOpenNotes = originalGetOpenNotes;
    AIConnector.callAIForJSON_ = originalCallAI;
  }

  Logger.log(pass ? '✅ testSuggestProject_ValidSuggestion_ PASS' : '❌ testSuggestProject_ValidSuggestion_ FAIL');
  return pass;
}

function testSuggestProject_MissingOptionalFieldsDefault_() {
  Logger.log('--- testSuggestProject_MissingOptionalFieldsDefault_ 开始 ---');
  var pass = true;
  var originalGetOpenNotes = NoteQueryEngine.getOpenNotes;
  var originalCallAI = AIConnector.callAIForJSON_;

  try {
    NoteQueryEngine.getOpenNotes = function () { return [{ note_id: 'NOTE-1', content: '随便一条' }]; };
    // 只给 has_suggestion，不给 title/reasoning/related_note_ids
    AIConnector.callAIForJSON_ = function () { return { has_suggestion: true }; };

    var result = AIPlanningEngine.suggestNewProject_('test_chat');
    if (result.title !== '' || result.reasoning !== '' || !Array.isArray(result.related_note_ids) || result.related_note_ids.length !== 0) {
      Logger.log('❌ 缺失字段应该容错为默认值，实际: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 次要字段缺失不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    NoteQueryEngine.getOpenNotes = originalGetOpenNotes;
    AIConnector.callAIForJSON_ = originalCallAI;
  }

  Logger.log(pass ? '✅ testSuggestProject_MissingOptionalFieldsDefault_ PASS' : '❌ testSuggestProject_MissingOptionalFieldsDefault_ FAIL');
  return pass;
}

// ============================================================
// 三、47_AIPlanningEngine.generateWorkflowSuggestion_
// ============================================================

function testWorkflowSuggestion_ShapeMatchesBusinessRuleEngine_() {
  Logger.log('--- testWorkflowSuggestion_ShapeMatchesBusinessRuleEngine_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  try {
    AIConnector.callAIForJSON_ = function () {
      return {
        workflow_type: 'SEQUENTIAL',
        tasks: [
          { local_id: 1, title_template: '联系搬家公司', relative_offset_days: 0, sequence_index: 1, parent_local_id: null },
          { local_id: 2, title_template: '打包物品', relative_offset_days: 2, sequence_index: 2, parent_local_id: null }
        ]
      };
    };

    var result = AIPlanningEngine.generateWorkflowSuggestion_('帮我规划一次简单的搬家');

    // 逐字段核对跟 41_BusinessRuleEngine.captureAsWorkflowTemplate 产出的
    // workflow_shape 完全一致的字段名（不是原始 Task 的 parent_task_id/
    // branch_group）——这是 Recovery Audit 里核实过的契约，这里回归测试它。
    var requiredFields = ['local_id', 'title_template', 'relative_offset_days', 'sequence_index',
      'parent_local_id', 'branch_group_label', 'branch_resolution_policy'];
    result.tasks.forEach(function (t) {
      requiredFields.forEach(function (f) {
        if (!(f in t)) {
          Logger.log('❌ 输出的 task 缺少 workflow_shape 字段: ' + f);
          pass = false;
        }
      });
    });
    if (result.workflow_type !== 'SEQUENTIAL' || result.tasks.length !== 2) {
      Logger.log('❌ 顶层结构不对: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testWorkflowSuggestion_ShapeMatchesBusinessRuleEngine_ PASS' : '❌ testWorkflowSuggestion_ShapeMatchesBusinessRuleEngine_ FAIL');
  return pass;
}

function testWorkflowSuggestion_MissingTasksArrayThrows_() {
  Logger.log('--- testWorkflowSuggestion_MissingTasksArrayThrows_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  var badResponses = [
    { workflow_type: 'SEQUENTIAL' },          // 没给 tasks
    { workflow_type: 'SEQUENTIAL', tasks: [] }, // 空数组
    { workflow_type: 'SEQUENTIAL', tasks: 'not an array' }
  ];

  try {
    for (var i = 0; i < badResponses.length; i++) {
      AIConnector.callAIForJSON_ = (function (resp) { return function () { return resp; }; })(badResponses[i]);

      var threw = false;
      try {
        AIPlanningEngine.generateWorkflowSuggestion_('随便描述一件事');
      } catch (e) {
        threw = (e.message.indexOf('AI_RESPONSE_INVALID') === 0);
      }
      if (!threw) {
        Logger.log('❌ tasks 缺失/空/类型不对时应该抛 AI_RESPONSE_INVALID，场景 ' + i + ' 没有');
        pass = false;
      }
    }
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testWorkflowSuggestion_MissingTasksArrayThrows_ PASS' : '❌ testWorkflowSuggestion_MissingTasksArrayThrows_ FAIL');
  return pass;
}

function testWorkflowSuggestion_SubFieldDefaultsApplied_() {
  Logger.log('--- testWorkflowSuggestion_SubFieldDefaultsApplied_ 开始 ---');
  var pass = true;
  var original = AIConnector.callAIForJSON_;

  try {
    // AI 只给了 local_id/title_template，其余 workflow_shape 字段都没给
    AIConnector.callAIForJSON_ = function () {
      return { workflow_type: 'WEIRD_VALUE', tasks: [{ local_id: 1, title_template: '唯一步骤' }] };
    };

    var result = AIPlanningEngine.generateWorkflowSuggestion_('一件只有一步的事');
    var t = result.tasks[0];
    if (t.relative_offset_days !== 0 || t.parent_local_id !== null || t.branch_group_label !== null || t.branch_resolution_policy !== '') {
      Logger.log('❌ 缺失的 workflow_shape 字段应该有合理默认值，实际: ' + JSON.stringify(t));
      pass = false;
    }
    if (result.workflow_type !== 'SEQUENTIAL') {
      Logger.log('❌ workflow_type 不是 PARALLEL 时应该兜底成 SEQUENTIAL，实际: ' + result.workflow_type);
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    AIConnector.callAIForJSON_ = original;
  }

  Logger.log(pass ? '✅ testWorkflowSuggestion_SubFieldDefaultsApplied_ PASS' : '❌ testWorkflowSuggestion_SubFieldDefaultsApplied_ FAIL');
  return pass;
}

// ============================================================
// 四、46_AIConnector 自身（stub UrlFetchApp.fetch，不是
//    AIConnector.callAIForJSON_——这两个测试验证的是 AIConnector
//    自己对原始 HTTP 响应的翻译逻辑，是比「一二三」更底层的一层）
// ============================================================

function testAIConnector_NonOkHttpBecomesCleanError_() {
  Logger.log('--- testAIConnector_NonOkHttpBecomesCleanError_ 开始 ---');
  var pass = true;
  var originalFetch = UrlFetchApp.fetch;
  var originalGetKey = SecureConfig.getKey;

  try {
    SecureConfig.getKey = function (key) {
      if (key === 'AI_API_KEY') return 'fake-key-for-test';
      if (key === 'AI_PROVIDER') return 'ANTHROPIC';
      return originalGetKey(key);
    };
    UrlFetchApp.fetch = function () {
      return {
        getContentText: function () { return JSON.stringify({ error: { message: 'rate limited' } }); },
        getResponseCode: function () { return 429; }
      };
    };

    var threw = false;
    try {
      AIConnector.callAI_('随便一个 prompt');
    } catch (e) {
      threw = (e.message.indexOf('AI_API_ERROR(Anthropic, HTTP 429)') === 0 && e.message.indexOf('rate limited') !== -1);
      if (!threw) Logger.log('❌ 错误信息格式不对: ' + e.message);
    }
    if (!threw) {
      Logger.log('❌ 非 200 响应应该抛 AI_API_ERROR，但没有正确抛出');
      pass = false;
    }
  } finally {
    UrlFetchApp.fetch = originalFetch;
    SecureConfig.getKey = originalGetKey;
  }

  Logger.log(pass ? '✅ testAIConnector_NonOkHttpBecomesCleanError_ PASS' : '❌ testAIConnector_NonOkHttpBecomesCleanError_ FAIL');
  return pass;
}

function testAIConnector_StripsJsonCodeFence_() {
  Logger.log('--- testAIConnector_StripsJsonCodeFence_ 开始 ---');
  var pass = true;
  var originalFetch = UrlFetchApp.fetch;
  var originalGetKey = SecureConfig.getKey;

  try {
    SecureConfig.getKey = function (key) {
      if (key === 'AI_API_KEY') return 'fake-key-for-test';
      if (key === 'AI_PROVIDER') return 'ANTHROPIC';
      return originalGetKey(key);
    };
    // 模拟 AI 把 JSON 包在 ```json 代码块里回复（常见行为，即使 prompt 里要求不要）
    UrlFetchApp.fetch = function () {
      var wrapped = '```json\n' + JSON.stringify({ priority: 'HIGH' }) + '\n```';
      return {
        getContentText: function () { return JSON.stringify({ content: [{ type: 'text', text: wrapped }] }); },
        getResponseCode: function () { return 200; }
      };
    };

    var result = AIConnector.callAIForJSON_('随便一个 prompt');
    if (result.priority !== 'HIGH') {
      Logger.log('❌ 代码块清洗后解析结果不对: ' + JSON.stringify(result));
      pass = false;
    }
  } catch (e) {
    Logger.log('❌ 不应该抛异常: ' + e.message);
    pass = false;
  } finally {
    UrlFetchApp.fetch = originalFetch;
    SecureConfig.getKey = originalGetKey;
  }

  Logger.log(pass ? '✅ testAIConnector_StripsJsonCodeFence_ PASS' : '❌ testAIConnector_StripsJsonCodeFence_ FAIL');
  return pass;
}

// ============================================================
// 五、单一入口
// ============================================================

function runAIEngineContractTests() {
  Logger.log('========== Sprint 4 AI Engine Contract Tests 开始 ==========');
  Logger.log('范围：46/22-AI增量/47 三个文件自身的契约正确性。不覆盖');
  Logger.log('Telegram 集成、真实 AI 调用、Project/Workflow/Task 创建链路');
  Logger.log('（那部分还没有编排代码，见 00_Known_Limitations.gs「四」）。');
  Logger.log('');

  var results = {
    'PriorityAI: Valid Response':              testPriorityAI_ValidResponse_(),
    'PriorityAI: Invalid Priority Field':       testPriorityAI_InvalidPriorityField_(),
    'PriorityAI: Missing Reasoning Tolerated':  testPriorityAI_MissingReasoningTolerated_(),
    'PriorityAI: Connector Errors Propagate':   testPriorityAI_ConnectorErrorsPropagate_(),
    'SuggestProject: No Notes Short-Circuits':  testSuggestProject_NoOpenNotesShortCircuits_(),
    'SuggestProject: Valid Suggestion':         testSuggestProject_ValidSuggestion_(),
    'SuggestProject: Missing Fields Default':   testSuggestProject_MissingOptionalFieldsDefault_(),
    'WorkflowSuggestion: Shape Matches BRE':    testWorkflowSuggestion_ShapeMatchesBusinessRuleEngine_(),
    'WorkflowSuggestion: Missing Tasks Throws': testWorkflowSuggestion_MissingTasksArrayThrows_(),
    'WorkflowSuggestion: Sub-Field Defaults':   testWorkflowSuggestion_SubFieldDefaultsApplied_(),
    'AIConnector: Non-OK HTTP → Clean Error':   testAIConnector_NonOkHttpBecomesCleanError_(),
    'AIConnector: Strips JSON Code Fence':      testAIConnector_StripsJsonCodeFence_()
  };

  Logger.log('');
  Logger.log('========== Sprint 4 AI Engine Contract Tests 结果汇总 ==========');
  var allPass = true;
  for (var name in results) {
    Logger.log((results[name] ? '✅ ' : '❌ ') + name);
    if (!results[name]) allPass = false;
  }
  Logger.log('');
  Logger.log(allPass
    ? '✅✅✅ 全部通过——三个文件自身契约正确。这不等于 Sprint 4 可以验收，' +
      '还需要 Integration Tests / Failure Tests / Regression Tests（见 Recovery Audit 报告）'
    : '❌ 有测试未通过——请把上面完整 Logger 输出发回去');
  Logger.log('========== Sprint 4 AI Engine Contract Tests 结束 ==========');

  return allPass;
}
