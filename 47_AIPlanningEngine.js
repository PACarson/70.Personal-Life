/**
 * 47_AIPlanningEngine.gs
 * Personal Life OS v5.2 — AI Planning Engine（Sprint 4）
 *
 * 覆盖 Sprint 4 里"AI Project Suggestion"和"AI Workflow Generation"
 * 两项。"AI Goal Planning"不在本文件、也不在本项目范围——Goal 是
 * Life Execution OS 的对象（见 00_Domain_Boundary.gs「一」），"Goal
 * 自动拆解"属于 Execution 的职责，本项目不能、也不会实现它。
 *
 * 两个函数都只产出建议，不自动创建任何 Project/Workflow/Task——沿用
 * Architecture Principle 9（AI Suggests, Human Confirms）。建议被
 * 人确认之后，走已有的 27_ProjectEngine.createProject /
 * 28_WorkflowEngine.startWorkflow / 20_TaskEngine.createTask 正常
 * 创建，本文件不重新实现一遍创建逻辑。
 *
 * generateWorkflowSuggestion_ 返回的结构刻意跟
 * 41_BusinessRuleEngine.captureAsWorkflowTemplate 产出的
 * workflow_shape 格式一致（tasks 数组 + title_template/
 * relative_offset_days/local_id 等字段）——这样如果用户确认了 AI
 * 生成的这个结构、且真的照着做了一次，未来可以直接把这次的 Project
 * 拿去 captureAsWorkflowTemplate，两条路径共用同一份数据形状，不用
 * 转换。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : AI Project Suggestion（给一批 Note/上下文，
 *                           建议要不要开一个新 Project）、AI Workflow
 *                           Generation（给一段自然语言描述，生成一份
 *                           建议的 Task 结构）
 *   Owns                  : 两个 Prompt 的设计、AI 回复的校验/解析
 *   Reads                 : NoteQueryEngine（Project Suggestion 参考
 *                           开放中的 Note）
 *   Writes                : none——只返回建议，不创建任何实体、不发布
 *                           任何 Event
 *   Public API            : suggestNewProject_,
 *                           generateWorkflowSuggestion_
 *   Dependencies           : 46_AIConnector.gs、17_NoteQueryEngine.gs
 *   Forbidden Dependencies  : 自动创建 Project/Workflow/Task（必须由
 *                           调用方在人类确认后，另外调用
 *                           27_ProjectEngine/28_WorkflowEngine/
 *                           20_TaskEngine 完成）
 *   Pure Function            : NO（发起真实 AI 调用）
 *   Side Effects              : YES（网络请求，但不涉及本项目任何
 *                           数据的读写）
 */

var AIPlanningEngine = (function () {

  /**
   * 【AI Project Suggestion】看一批开放中的 Note（还没转化的原始记录），
   * 建议是否有值得开一个新 Project 的模式——比如好几条 Note 都在说
   * "以后要整理XX"，可能已经够格开一个 Project 而不是继续散在 Note 里。
   *
   * @param {string} chatId
   * @returns {{has_suggestion: boolean, title: (string|undefined),
   *            reasoning: (string|undefined),
   *            related_note_ids: (string[]|undefined)}}
   *   has_suggestion=false 时代表 AI 认为现在没有值得建议的模式，其余
   *   字段不存在——这是正常结果，不是错误。
   */
  function suggestNewProject_(chatId) {
    var openNotes = NoteQueryEngine.getOpenNotes(chatId);

    if (openNotes.length === 0) {
      return { has_suggestion: false };
    }

    var notesForPrompt = openNotes.slice(0, 30); // 避免 Prompt 过长，只取最近 30 条

    var prompt =
      '以下是用户还没有整理的一批零散记录（Note）。只回复 JSON，不要任何其它文字，格式：\n' +
      '{"has_suggestion": true|false, "title": "建议的项目名称", ' +
      '"reasoning": "一句话理由（中文，30字以内）", "related_note_ids": ["note_id1", "note_id2"]}\n' +
      '如果这些记录里没有任何值得整理成一个正式 Project 的模式，has_suggestion 填 false，' +
      '其余字段可以省略。\n\n' +
      notesForPrompt.map(function (n) { return '[' + n.note_id + '] ' + n.content; }).join('\n');

    var result = AIConnector.callAIForJSON_(prompt);

    if (!result.has_suggestion) {
      return { has_suggestion: false };
    }

    return {
      has_suggestion:    true,
      title:             result.title || '',
      reasoning:         result.reasoning || '',
      related_note_ids:  Array.isArray(result.related_note_ids) ? result.related_note_ids : []
    };
  }

  /**
   * 【AI Workflow Generation】给一段自然语言描述，生成一份建议的
   * Task 结构——格式故意跟 BusinessRuleEngine 的 workflow_shape 一致
   * （见文件头）。
   *
   * @param {string} description  例如"帮我规划一次简单的搬家"
   * @returns {{workflow_type: string, tasks: object[]}}  tasks 数组
   *   每项含 local_id/title_template/relative_offset_days/
   *   sequence_index/parent_local_id/branch_group_label/
   *   branch_resolution_policy，含义跟
   *   00_Business_Rules.gs「三」workflow_shape 定义完全一致
   */
  function generateWorkflowSuggestion_(description) {
    var prompt =
      '帮用户把下面这件事拆解成具体的任务步骤。只回复 JSON，不要任何其它文字，格式：\n' +
      '{"workflow_type": "SEQUENTIAL"|"PARALLEL", "tasks": [' +
      '{"local_id": 1, "title_template": "任务标题", "relative_offset_days": 0, ' +
      '"sequence_index": 1, "parent_local_id": null}]}\n' +
      'relative_offset_days 表示"相对今天的第几天该做这件事"（0=今天），' +
      'sequence_index 表示顺序（并行的步骤可以给同一个 sequence_index）。' +
      '步骤数量控制在 3-8 个之间，不要太琐碎也不要太笼统。\n\n' +
      '要拆解的事情：' + description;

    var result = AIConnector.callAIForJSON_(prompt);

    if (!result.tasks || !Array.isArray(result.tasks) || result.tasks.length === 0) {
      throw new Error('AI_RESPONSE_INVALID: AI 没有返回有效的 tasks 数组，原始回复: ' + JSON.stringify(result));
    }

    // 补全 workflow_shape 需要、但 AI 可能没主动给的字段，保持跟
    // BusinessRuleEngine 产出的形状完全一致（多余字段留空，不是缺失）
    var normalizedTasks = result.tasks.map(function (t) {
      return {
        local_id:              t.local_id,
        title_template:        t.title_template,
        relative_offset_days:  (t.relative_offset_days != null) ? t.relative_offset_days : 0,
        sequence_index:        (t.sequence_index != null) ? t.sequence_index : '',
        parent_local_id:       t.parent_local_id || null,
        branch_group_label:    t.branch_group_label || null,
        branch_resolution_policy: t.branch_resolution_policy || ''
      };
    });

    return {
      workflow_type: (result.workflow_type === 'PARALLEL') ? 'PARALLEL' : 'SEQUENTIAL',
      tasks: normalizedTasks
    };
  }

  return {
    suggestNewProject_:          suggestNewProject_,
    generateWorkflowSuggestion_: generateWorkflowSuggestion_
  };
})();