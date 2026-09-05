/**
 * 42_ConversionEngine.gs
 * Personal Life OS v5.2 — Conversion Engine（Sprint 3，双向）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「七」、
 * 00_Business_Rules.gs「一」、00_ADR.gs ADR-2026-07-24-015（双向）、
 * Architecture Principle 11（Conversion Preserves Lineage）。
 *
 * 职责：全部"实体转换"操作的唯一编排入口——Task↔Project（双向）、
 * Note→Task、Note→Project、Note→Goal Candidate（发布给 Execution，
 * 不在本项目内创建 Goal）。不允许 TaskEngine/NoteEngine/ProjectEngine
 * 各自实现一遍转换逻辑。
 *
 * 本 Engine 自己不摸任何 Sheet——全部通过调用对应 Engine 的
 * markXxxConverted_/createXxxFromConversion_ 完成。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 见文件头
 *   Owns                  : 转换前置校验规则（幂等/终态检查委托给各
 *                           Engine 自己的 markXxxConverted_，Project→
 *                           Task 的"够不够格"校验委托给
 *                           ProjectEngine.checkEligibleForTaskDemotion_）
 *   Reads                 : 源实体的完整快照（通过对应 QueryEngine）
 *   Writes                : Events（通过各 Engine 内部调用，本 Engine
 *                           不直接调 EventBus）
 *   Public API            : convertTaskToProject, convertProjectToTask,
 *                           convertNoteToTask, convertNoteToProject,
 *                           convertNoteToGoalCandidate
 *   Dependencies           : 20_TaskEngine.gs、27_ProjectEngine.gs、
 *                           29_NoteEngine.gs、12_TaskQueryEngine.gs、
 *                           14_ProjectQueryEngine.gs、
 *                           17_NoteQueryEngine.gs
 *   Forbidden Dependencies  : Sheet 直接读写
 *   Pure Function            : NO
 *   Side Effects              : YES
 */

var ConversionEngine = (function () {

  // ============ Task → Project ============

  /**
   * @param {string} taskId
   * @param {object} projectMeta  { description, parent_project_id,
   *                                execution_mode }
   * @param {string} chatId
   * @returns {{project:object, already_converted?:boolean}|{not_found:true}|
   *           {blocked:true, reason:string}}
   *   【2026-09-04 更正】此前这里写的是 {invalid_state:true,...}——查了一遍
   *   代码，这个函数从来没有返回过 invalid_state，是文档跟代码从一开始
   *   就没对上，不是这次改动引入的偏差。新增的 blocked 是这次 Slice 4
   *   Part A 真实加入的分支（ADR-2026-09-02-028）。
   */
  function convertTaskToProject(taskId, projectMeta, chatId) {
    var sourceTask = TaskQueryEngine.getTask(taskId, chatId);
    if (!sourceTask) return { not_found: true };

    // 幂等：已经转换过，直接返回既有目标（不重复创建）
    if (String(sourceTask.status || '').toUpperCase() === 'CONVERTED' && sourceTask.converted_to_project_id) {
      var existingProject = ProjectQueryEngine.getProject(sourceTask.converted_to_project_id);
      return { project: existingProject, already_converted: true };
    }

    // 【Slice 4 Part A, 2026-09-04，ADR-2026-09-02-028 + Business_Rules
    // 「十一」No-Silent-Loss Principle】源 Task 带日期时，Project 现在
    // 没有 schema 能存放，必须结构化 BLOCKED，不能静默丢弃。跟
    // convertProjectToTask 的 checkEligibleForTaskDemotion_ 同一个
    // "先校验、不满足直接 return {blocked:true, reason}" 风格。放在
    // 幂等分支之后：已经转换过的 Task 不应该因为带日期而在重复调用时
    // 突然变成 BLOCKED——幂等优先于这条新校验。Project Deadline
    // Contract 一旦批准，这条检查本身要重新评估（见 ADR-028 Related
    // ADR 一栏），不是这次顺手解决。
    if (sourceTask.due_date || sourceTask.due_time || sourceTask.due_datetime) {
      return {
        blocked: true,
        reason: 'Project 尚不支持 deadline（due_date/due_time），暂时无法转换。' +
                '等 Project Deadline Contract 批准后可以重新尝试。'
      };
    }

    projectMeta = projectMeta || {};

    // 【失败恢复策略，见 00_Business_Rules.gs「一」】先创建不可逆的
    // 目标 Project，再标记源 Task 为 CONVERTED——如果第二步失败，
    // 源 Task 仍然完好，不会出现"源丢了目标也没建成"的情况；下次
    // 幂等检查会发现 Project 已存在（走上面的分支），只需要补一次
    // markTaskConverted_ 即可收敛。
    var project = ProjectEngine.createProject(sourceTask.title, {
      description:       projectMeta.description || sourceTask.notes || '',
      parent_project_id: projectMeta.parent_project_id || '',
      execution_mode:    projectMeta.execution_mode || '',
      source_task_id:    taskId,
      creator:           'User',
      source_module:     'ConversionEngine.convertTaskToProject',
      decision_owner:    projectMeta.decision_owner // 2026-08-16 同一处修复
                                                       // （见 convertNoteToTask 上面
                                                       // 的说明）：此前没有转发，
                                                       // Slice 2 开发时顺手修，不等
                                                       // 它再被测试发现一次。不传
                                                       // || '' 兜底，未传时行为
                                                       // 不变（createProject 内部
                                                       // 自己会 fallback 成 chatId）。
    }, chatId || sourceTask.chat_id);

    TaskEngine.markTaskConverted_(taskId, project.project_id, chatId || sourceTask.chat_id);

    return { project: project };
  }

  // ============ Project → Task（v5.1/5.2 新增反方向） ============

  /**
   * 前置条件（见 checkEligibleForTaskDemotion_）：Project 必须没有
   * Sub-Project、没有非终态子 Task，即"确实只是空的/只是一件小事"
   * 才允许降级。
   *
   * @param {string} projectId
   * @param {object} [taskMeta]  预留，本版本字段映射固定（见
   *                             TaskEngine.createTaskFromConversion_），
   *                             不接受调用方覆盖映射规则
   * @param {string} chatId
   * @returns {{task:object}|{not_found:true}|{blocked:true,reason:string}}
   */
  function convertProjectToTask(projectId, taskMeta, chatId) {
    var sourceProject = ProjectQueryEngine.getProject(projectId, chatId);
    if (!sourceProject) return { not_found: true };

    if (String(sourceProject.status || '').toUpperCase() === 'CONVERTED_TO_TASK' && sourceProject.converted_to_task_id) {
      var existingTask = TaskQueryEngine.getTask(sourceProject.converted_to_task_id);
      return { task: existingTask, already_converted: true };
    }

    var eligibility = ProjectEngine.checkEligibleForTaskDemotion_(projectId);
    if (!eligibility.eligible) {
      return { blocked: true, reason: eligibility.reason };
    }

    // 同一套"先创建不可逆产物、再收尾"策略
    var task = TaskEngine.createTaskFromConversion_(sourceProject, chatId || sourceProject.chat_id);

    ProjectEngine.markProjectConvertedToTask_(projectId, task.task_id, chatId || sourceProject.chat_id);

    return { task: task };
  }

  // ============ Task → Note（Slice 4 Part B, 2026-09-04,
  //              ADR-2026-09-02-030） ============

  /**
   * ADR-030 C7：校验必须先于创建——跟 `convertTaskToProject` 现在
   * "先建目标、再查源状态"的顺序刻意不同。全部 BLOCKED 判断（B2 的
   * `FORBIDDEN_FIELDS` 四兄弟 + D1 的 recurring）、以及非终态前置
   * 检查，都在真正调用 `NoteEngine.createNote` 之前完成——一旦开始
   * 创建，后面只有"标记源"这一步可能失败，不会再有"创建了目标才
   * 发现不该创建"的情况。
   *
   * content 拼接严格按 ADR-030 B1/B3/B5/D2/D3/D4：主体叙述（title +
   * context + notes + description）+ 一段"转换来源"注解（非默认/非空
   * 的 category/priority/budget/tags/结构性字段/source_project_id，
   * 有几个写几个，一个都没有就不加这段，不制造空壳注解）。
   *
   * 失败窗口（如实记录，不假装有 transaction，完整分析见
   * 00_Project_State.gs 本次交付章节）：本函数内 Note 创建成功、但
   * 下面 `markTaskConvertedToNote_` 失败时，源 Task 会停留在原状态，
   * Note 已经独立存在——重试时因为 content 是从源 Task 字段确定性
   * 拼出来的，`NoteEngine.createNote`→`IdempotencyManager.
   * createNoteIfNotExists`会按 identity 命中同一条 Note、不会产生
   * 第二条重复 Note，但源 Task 在重试成功之前仍会显示为"未转换"。
   *
   * @param {string} taskId
   * @param {object} [noteMeta]  { decision_owner }——跟其它既有转换
   *                             函数一致，调用方只转发 decision_owner，
   *                             其余字段全部从源 Task 派生，不接受
   *                             调用方覆盖，ADR-030 没有开放这个口子。
   * @param {string} chatId
   * @returns {{note:object, already_converted?:boolean}|{not_found:true}|
   *           {blocked:true, reason:string}|
   *           {invalid_state:true, current_status:string, reason:string}}
   */
  function convertTaskToNote(taskId, noteMeta, chatId) {
    var sourceTask = TaskQueryEngine.getTask(taskId, chatId);
    if (!sourceTask) return { not_found: true };

    var currentStatus = String(sourceTask.status || '').toUpperCase();

    // 幂等 / 已被另一种转换消费掉：提前查是为了在真正创建 Note 之前
    // 就能短路，不是"创建了才发现已经转换过"。
    if (currentStatus === 'CONVERTED') {
      if (sourceTask.converted_to_note_id) {
        return { note: NoteQueryEngine.getNote(sourceTask.converted_to_note_id), already_converted: true };
      }
      return { invalid_state: true, current_status: currentStatus,
        reason: 'Task 已经转换过（转去了 Project），不能再转换成 Note' };
    }

    // ADR-030 C7 + Business_Rules「一」既有的"只有非终态 Task 才能
    // 转换"前置条件——跟 `markTaskConvertedToNote_`内部的同一条检查
    // 重复，是有意的：这里提前查是为了在创建 Note 之前就挡住，不是
    // 信任那边的重复检查就够、这边可以省略。
    var terminalStatuses = ['DONE', 'CANCELLED', 'NOT_SELECTED'];
    if (terminalStatuses.indexOf(currentStatus) !== -1) {
      return { invalid_state: true, current_status: currentStatus,
        reason: '只有非终态的 Task 才能转换为 Note' };
    }

    // ADR-030 B2：跟 Note 自己的 FORBIDDEN_FIELDS 同一份清单，不重新
    // 发明一份新的；D1：recurring 单独判断，证据等级跟前四个不同
    // （不在 FORBIDDEN_FIELDS 里，是这次单独拍板的行为语义损失），
    // 但处理档位（BLOCKED）相同，合并成一次检查、一次报错。
    var blockedFields = LifeNoteConfig.FORBIDDEN_FIELDS.filter(function (f) {
      return !!sourceTask[f];
    });
    if (sourceTask.recurring) blockedFields.push('recurring');
    if (blockedFields.length > 0) {
      return {
        blocked: true,
        reason: 'Note 不支持这个 Task 携带的字段（' + blockedFields.join('、') + '），暂时无法转换。' +
                '这类信息一旦转成 Note 会被静默丢失，按规则必须挡下来，不能悄悄丢掉。'
      };
    }

    noteMeta = noteMeta || {};

    // ── B1：主体叙述 —— title 独占一行，context/notes/description
    //    依次另起一段，中间空行分隔（配合 Slice 3 的
    //    white-space:pre-wrap，换行会被正常保留显示）───────────────
    var bodyParts = [sourceTask.title || ''];
    if (sourceTask.context)     bodyParts.push(sourceTask.context);
    if (sourceTask.notes)       bodyParts.push(sourceTask.notes);
    if (sourceTask.description) bodyParts.push(sourceTask.description);

    // ── B3/B5/D2/D3/D4：转换来源注解 —— 只有非默认/非空的才写，一条
    //    都没有就完全不加这一段（不制造空壳注解）。MEDIUM 是 priority
    //    的 schema 默认值本身，不算"用户特意设置"，不触发这一行
    //    （D2 原文口径）。sequence_index 用 0 是合法值，不能用真值
    //    判断，要单独判 null/undefined/空字符串。─────────────────────
    var annotations = [];
    if (sourceTask.category)                                     annotations.push('category: ' + sourceTask.category);
    if (sourceTask.priority && sourceTask.priority !== 'MEDIUM')  annotations.push('priority: ' + sourceTask.priority);
    if (sourceTask.budget)                                       annotations.push('budget: ' + sourceTask.budget);
    if (sourceTask.tags)                                         annotations.push('tags: ' + sourceTask.tags);
    if (sourceTask.project_id)                                   annotations.push('project_id: ' + sourceTask.project_id);
    if (sourceTask.workflow_id)                                  annotations.push('workflow_id: ' + sourceTask.workflow_id);
    if (sourceTask.parent_task_id)                                annotations.push('parent_task_id: ' + sourceTask.parent_task_id);
    if (sourceTask.depends_on_task_ids)                           annotations.push('depends_on_task_ids: ' + sourceTask.depends_on_task_ids);
    if (sourceTask.sequence_index !== '' && sourceTask.sequence_index !== undefined && sourceTask.sequence_index !== null)
                                                                   annotations.push('sequence_index: ' + sourceTask.sequence_index);
    if (sourceTask.branch_group)                                  annotations.push('branch_group: ' + sourceTask.branch_group);
    if (sourceTask.branch_resolution_policy)                       annotations.push('branch_resolution_policy: ' + sourceTask.branch_resolution_policy);
    if (sourceTask.source_project_id)                             annotations.push('source_project_id（更早一层血缘）: ' + sourceTask.source_project_id);
    // priority_ai_recommended：现状全项目没有任何 Producer 写值（见
    // ADR-030 B5），如实反映"当前没有值"，不虚构——这一行目前永远
    // 不会触发，字段一旦开始被写入会自动纳入，不需要再改这段代码。
    if (sourceTask.priority_ai_recommended)                       annotations.push('priority_ai_recommended: ' + sourceTask.priority_ai_recommended);

    if (annotations.length > 0) {
      bodyParts.push('[Converted from Task ' + taskId + ' \u00b7 ' + annotations.join(' \u00b7 ') + ']');
    }

    var content = bodyParts.join('\n\n');

    // ── C1/B3：category 不做枚举映射，新 Note 落 createNote 自己的
    //    默认值（不在这里传 category），原 Task 的 category 已经在
    //    上面的注解里保留为文本 ──────────────────────────────────────
    var note = NoteEngine.createNote(content, {
      creator:        'User',
      suggested_by:   sourceTask.suggested_by || '',
      source_domain:  sourceTask.source_domain || '',
      source_module:  'ConversionEngine.convertTaskToNote',
      source_task_id: taskId, // B4：这次转换的 lineage，不是 Task 自己更早的 source_task_id
      created_method: 'Converted',
      decision_owner: noteMeta.decision_owner // 不加 || '' 兜底，
                                               // 保持跟 convertNoteToTask
                                               // 2026-08-16 修复同一个
                                               // 理由：让 createNote
                                               // 内部自己的 fallback
                                               // 逻辑在没传时正常生效
    }, chatId || sourceTask.chat_id);

    // ── C3：标记源 Task —— 校验已经在上面全部做完，这一步失败时源
    //    Task 会停留在原状态、Note 已经独立存在，见函数顶部"失败窗口"
    //    说明，不在这里用假的 rollback 掩盖 ──────────────────────────
    TaskEngine.markTaskConvertedToNote_(taskId, note.note_id, chatId || sourceTask.chat_id);

    return { note: note };
  }

  // ============ Note → Task / Project / Goal Candidate ============

  function convertNoteToTask(noteId, taskMeta, chatId) {
    var sourceNote = NoteQueryEngine.getNote(noteId, chatId);
    if (!sourceNote) return { not_found: true };

    if (String(sourceNote.status || '').toUpperCase() === 'CONVERTED' && sourceNote.converted_to_type === 'TASK') {
      return { task: TaskQueryEngine.getTask(sourceNote.converted_to_id), already_converted: true };
    }

    taskMeta = taskMeta || {};
    var task = TaskEngine.createTask(taskMeta.title || sourceNote.content, {
      notes:           taskMeta.notes || sourceNote.content,
      category:        taskMeta.category || '',
      due_date:        taskMeta.due_date || '',
      creator:         'User',
      source_module:   'ConversionEngine.convertNoteToTask',
      source_task_id:  '', // Note 不是 Task，没有 source_task_id 可填；血缘走 NOTE_CONVERTED 事件本身
      created_method:  'Converted',
      decision_owner:  taskMeta.decision_owner // 2026-08-16 修复：此前没有转发这个字段，
                                                 // 转换出来的 Task 会静默丢失调用方传入的
                                                 // decision_owner，回退成 chat_id（Bug 由
                                                 // UI Slice 1 测试发现）。不传 || '' 兜底——
                                                 // 保持 taskMeta.decision_owner 为 undefined
                                                 // 时，原有 fallback（createTask 内部
                                                 // meta.decision_owner || String(chatId)）
                                                 // 行为不变，向后兼容。
    }, chatId || sourceNote.chat_id);

    NoteEngine.markNoteConverted_(noteId, 'TASK', task.task_id, chatId || sourceNote.chat_id);

    return { task: task };
  }

  function convertNoteToProject(noteId, projectMeta, chatId) {
    var sourceNote = NoteQueryEngine.getNote(noteId, chatId);
    if (!sourceNote) return { not_found: true };

    if (String(sourceNote.status || '').toUpperCase() === 'CONVERTED' && sourceNote.converted_to_type === 'PROJECT') {
      return { project: ProjectQueryEngine.getProject(sourceNote.converted_to_id), already_converted: true };
    }

    projectMeta = projectMeta || {};
    var project = ProjectEngine.createProject(projectMeta.title || sourceNote.content, {
      description:       projectMeta.description || sourceNote.content,
      parent_project_id: projectMeta.parent_project_id || '',
      creator:           'User',
      source_module:     'ConversionEngine.convertNoteToProject',
      created_method:    'Converted'
    }, chatId || sourceNote.chat_id);

    NoteEngine.markNoteConverted_(noteId, 'PROJECT', project.project_id, chatId || sourceNote.chat_id);

    return { project: project };
  }

  /**
   * 只发布信号，不在本项目内创建任何 Goal——Goal 完全是 Life
   * Execution OS 的职责（见 00_Domain_Boundary.gs「一」），本项目
   * 不能、也不会替它写入任何 Goal 相关的表。
   */
  function convertNoteToGoalCandidate(noteId, chatId) {
    var sourceNote = NoteQueryEngine.getNote(noteId, chatId);
    if (!sourceNote) return { not_found: true };

    if (String(sourceNote.status || '').toUpperCase() === 'CONVERTED' && sourceNote.converted_to_type === 'GOAL_CANDIDATE') {
      return { already_converted: true };
    }

    NoteEngine.markNoteConverted_(noteId, 'GOAL_CANDIDATE', '', chatId || sourceNote.chat_id);

    return {};
  }

  return {
    convertTaskToProject:      convertTaskToProject,
    convertProjectToTask:      convertProjectToTask,
    convertTaskToNote:         convertTaskToNote,
    convertNoteToTask:         convertNoteToTask,
    convertNoteToProject:      convertNoteToProject,
    convertNoteToGoalCandidate: convertNoteToGoalCandidate
  };
})();
