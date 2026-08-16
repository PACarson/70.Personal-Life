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
   * @returns {{project:object}|{not_found:true}|{invalid_state:true,...}}
   */
  function convertTaskToProject(taskId, projectMeta, chatId) {
    var sourceTask = TaskQueryEngine.getTask(taskId, chatId);
    if (!sourceTask) return { not_found: true };

    // 幂等：已经转换过，直接返回既有目标（不重复创建）
    if (String(sourceTask.status || '').toUpperCase() === 'CONVERTED' && sourceTask.converted_to_project_id) {
      var existingProject = ProjectQueryEngine.getProject(sourceTask.converted_to_project_id);
      return { project: existingProject, already_converted: true };
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
      source_module:     'ConversionEngine.convertTaskToProject'
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
    convertNoteToTask:         convertNoteToTask,
    convertNoteToProject:      convertNoteToProject,
    convertNoteToGoalCandidate: convertNoteToGoalCandidate
  };
})();
