/**
 * 27_ProjectEngine.gs
 * Personal Life OS v5.2 — Project Engine（create / update / complete /
 * cancel / archive）
 *
 * 完整设计见设计包 00_Module_Responsibility.gs「二」、00_Business_Rules.gs、
 * 00_ADR.gs（ADR-2026-07-24-017 Canonical Lifecycle 等）。
 *
 * 架构铁律（跟 20_TaskEngine.gs 同构）：
 *  - 真相来源是 EVENTS 表
 *  - Projects Sheet 是 Read Model（由 10_ProjectionEngine 维护）
 *  - 只有 EventBus.publish 能写 Events
 *  - createProjectDirect_ 只允许 09_IdempotencyManager 调用，外部代码
 *    一律走 createProject()（内部会经过幂等+锁）
 *
 * status 原生采用 Canonical Entity Lifecycle（v5.2 起，见 00_ADR.gs
 * ADR-2026-07-24-017）：DRAFT/READY/IN_PROGRESS/WAITING/BLOCKED/
 * COMPLETED/ARCHIVED/CANCELLED + Project 专属的 CONVERTED_TO_TASK。
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : Project 业务对象的核心生命周期操作
 *   Owns                  : Project 字段校验规则（status/execution_mode
 *                           白名单）
 *   Reads                 : 单个 project（通过 ProjectQueryEngine.getProject）
 *   Writes                : Events（通过 EventBus.publish）
 *   Public API            : createProject, createProjectDirect_,
 *                           updateProject, completeProject, cancelProject,
 *                           archiveProject
 *   Dependencies           : 09_IdempotencyManager.gs、
 *                           14_ProjectQueryEngine.gs、02_EventBus.gs、
 *                           05_SheetUtils.gs、07_IdentityEngine.gs
 *   Forbidden Dependencies  : Sheet 直接读写以外的方式、Telegram/Output、
 *                           跨 Domain 调用
 *   Pure Function            : NO
 *   Side Effects              : YES
 */

var LifeProjectConfig = Object.freeze({
  PROJECTS_SHEET_NAME: 'Projects',
  // Canonical Entity Lifecycle（v5.2，见 ADR-2026-07-24-017）+ Project 专属
  // 的 CONVERTED_TO_TASK（见 ADR-2026-07-24-015）。
  PROJECT_STATUSES: [
    'DRAFT', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED',
    'COMPLETED', 'ARCHIVED', 'CANCELLED', 'CONVERTED_TO_TASK'
  ],
  EXECUTION_MODES: ['', 'SEQUENTIAL', 'PARALLEL', 'BRANCH'],
  CREATED_METHODS:  ['Manual', 'AI Suggestion', 'Rule Generated', 'Imported', 'Converted'],
  APPROVAL_STATUSES: ['APPROVED', 'PENDING', 'REJECTED'],
  // title/parent_project_id 变化会让 identity 不同（见
  // 07_IdentityEngine.generateProjectIdentity）；depends_on_project_ids/
  // execution_mode/description 等不影响 identity——描述"这个 Project
  // 跟谁关联/怎么组织"，不描述"这个 Project 本身是什么"。
  IDENTITY_AFFECTING_FIELDS: ['title', 'parent_project_id']
});

var ProjectEngine = (function () {

  var CFG = LifeProjectConfig;

  function _resolveMetadata_(meta, chatId) {
    var creator = meta.creator === 'AI' ? 'AI' : 'User';
    var isAiCreated = (creator === 'AI');

    return {
      creator:          creator,
      suggested_by:     meta.suggested_by || (isAiCreated ? '' : 'User'),
      source_domain:    OS_REGISTRY.indexOf(meta.source_domain) !== -1 ? meta.source_domain : OS_REGISTRY[0],
      source_module:    meta.source_module || '',
      source_event_id:  meta.source_event_id || '',
      created_method:   CFG.CREATED_METHODS.indexOf(meta.created_method) !== -1 ? meta.created_method : 'Manual',
      decision_owner:   meta.decision_owner || String(chatId || ''),
      approval_status:  isAiCreated ? 'PENDING' : 'APPROVED'
    };
  }

  // ============ Create ============

  function createProject(title, meta, chatId) {
    var result = IdempotencyManager.createProjectIfNotExists(title, meta || {}, chatId);
    return result.project;
  }

  /**
   * 实际创建函数 —— 只由 09_IdempotencyManager.createProjectIfNotExists()
   * 调用（已在锁内）。外部代码一律调 createProject()。
   *
   * meta.source_task_id 有值时，代表这是 Task→Project 转换的产物——
   * Sprint 1 只是让 ProjectEngine 有能力接受这个字段（Schema Authority
   * 一致性），实际触发这条路径的 42_ConversionEngine.gs 在 Sprint 3
   * 才会存在，Sprint 1 没有任何调用方会真的传入这个字段。
   */
  function createProjectDirect_(title, meta, chatId, identity) {
    meta = meta || {};

    var executionMode = CFG.EXECUTION_MODES.indexOf(meta.execution_mode) !== -1 ? meta.execution_mode : '';
    var metadata = _resolveMetadata_(meta, chatId);
    var nowIso = new Date().toISOString();
    var isConverted = !!meta.source_task_id;

    var project = {
      project_id:      generateProjectId_(),
      identity:        identity || '',
      title:           title,
      description:     meta.description || '',
      status:          'DRAFT',
      execution_mode:  executionMode,
      parent_project_id:     meta.parent_project_id || '',
      depends_on_project_ids:  meta.depends_on_project_ids || '',
      source_task_id:            meta.source_task_id || '',
      converted_to_task_id:        '', // Sprint 3：Project→Task 反方向用
      instantiated_from_template_id:  meta.instantiated_from_template_id || '', // Sprint 3
      archived_at:                       '',
      chat_id:                              chatId || '',

      creator:          isConverted ? metadata.creator : metadata.creator,
      suggested_by:     metadata.suggested_by,
      source_domain:    metadata.source_domain,
      source_module:    metadata.source_module,
      source_event_id:  metadata.source_event_id,
      created_method:   isConverted ? 'Converted' : metadata.created_method,
      created_time:     nowIso,
      updated_time:     nowIso,
      decision_owner:   metadata.decision_owner,
      approval_status:  metadata.approval_status
    };

    EventBus.publish('PROJECT_CREATED', project, chatId, 'ProjectEngine', identity);

    return project;
  }

  /**
   * 【Sprint 3 预留】仅供 42_ConversionEngine.gs 调用——Task→Project
   * 转换时创建目标 Project。Sprint 1 不实现调用方，这里先不落地这个
   * 函数本体（YAGNI，见设计包 00_Architecture.gs「六」UEF Self-Check
   * B1/D2 的判断标准），等 Sprint 3 ConversionEngine 落地时一并补上。
   */

  // ============ Update ============

  var UPDATABLE_FIELDS = [
    'title', 'description', 'depends_on_project_ids', 'execution_mode',
    // 【Slice 1 新增,2026-09-01】Project 原本就有 source_domain（跟
    // Task/Workflow/Note 共用同一份 Metadata Standard 字段，见
    // 00_Data_Ownership.gs「三」），只是之前没有开放编辑——这次复用既有
    // 字段，不新增第二个 OS/Domain 字段。枚举见 20_TaskEngine.gs 顶层的
    // OS_REGISTRY（跨 Task/Project 共用同一份，不在这里另抄一份）。
    'source_domain'
  ];

  /**
   * 更新 Project 的可编辑字段。status 不在这里——非终态之间的切换
   * （比如 READY→IN_PROGRESS、IN_PROGRESS→BLOCKED）走 transitionProjectStatus，
   * 终态切换走 completeProject/cancelProject/archiveProject，理由同
   * 20_TaskEngine.updateTask 不接受直接覆写 status。
   */
  function updateProject(projectId, changes, chatId) {
    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) {
      Logger.log('[ProjectEngine] updateProject: 找不到项目 ' + projectId);
      return null;
    }

    changes = changes || {};
    var payload = { project_id: projectId };
    UPDATABLE_FIELDS.forEach(function (f) {
      if (changes.hasOwnProperty(f)) {
        var v = changes[f];
        if (f === 'execution_mode' && CFG.EXECUTION_MODES.indexOf(v) === -1) return;
        if (f === 'source_domain' && OS_REGISTRY.indexOf(v) === -1) return;
        payload[f] = v;
      }
    });

    if (Object.keys(payload).length === 1) return null;

    var merged = shallowCopy_(existing);
    for (var k in payload) merged[k] = payload[k];

    var identityFieldChanged = CFG.IDENTITY_AFFECTING_FIELDS.some(function (f) {
      return payload.hasOwnProperty(f);
    });
    if (identityFieldChanged) {
      var newIdentity = IdentityEngine.generateProjectIdentity(
        merged.chat_id || chatId || existing.chat_id,
        merged.title,
        merged.parent_project_id || ''
      );
      payload.identity = newIdentity;
      merged.identity   = newIdentity;
    }

    payload.updated_time = new Date().toISOString();

    var event = EventBus.publish('PROJECT_UPDATED', payload, chatId || existing.chat_id, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, merged);
    }

    return payload;
  }

  /**
   * 非终态之间的状态切换（DRAFT/READY/IN_PROGRESS/WAITING/BLOCKED
   * 互相切换），单独一个函数而不是塞进 updateProject 的原因：这些切换
   * 之间没有"哪个字段变了才需要重算 identity"这类顾虑，但需要校验
   * "目标状态必须是非终态"，逻辑上更接近 completeProject/cancelProject
   * 这类专门状态转换函数，不是普通字段编辑。
   */
  function transitionProjectStatus(projectId, newStatus, chatId) {
    var nonTerminal = ['DRAFT', 'READY', 'IN_PROGRESS', 'WAITING', 'BLOCKED'];
    if (nonTerminal.indexOf(newStatus) === -1) {
      Logger.log('[ProjectEngine] transitionProjectStatus: ' + newStatus + ' 不是合法的非终态目标');
      return null;
    }

    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) {
      Logger.log('[ProjectEngine] transitionProjectStatus: 找不到项目 ' + projectId);
      return null;
    }

    var currentStatus = String(existing.status || '').toUpperCase();
    if (nonTerminal.indexOf(currentStatus) === -1) {
      Logger.log('[ProjectEngine] transitionProjectStatus: 项目 ' + projectId + ' 已经是终态 ' + currentStatus + '，拒绝切换');
      return null;
    }

    var payload = { project_id: projectId, status: newStatus, updated_time: new Date().toISOString() };
    var event = EventBus.publish('PROJECT_UPDATED', payload, chatId || existing.chat_id, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, payload);
    }

    return payload;
  }

  // ============ Complete / Cancel / Archive ============

  var TERMINAL_STATUSES = ['COMPLETED', 'ARCHIVED', 'CANCELLED', 'CONVERTED_TO_TASK'];

  function completeProject(projectId, chatId) {
    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'COMPLETED') return { already_completed: true };
    if (TERMINAL_STATUSES.indexOf(currentStatus) !== -1) {
      return { invalid_state: true, current_status: currentStatus };
    }

    var event = EventBus.publish('PROJECT_COMPLETED', { project_id: projectId }, chatId, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, { status: 'COMPLETED' });
    }

    return {};
  }

  function cancelProject(projectId, chatId) {
    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CANCELLED') return { already_cancelled: true };
    if (TERMINAL_STATUSES.indexOf(currentStatus) !== -1) {
      return { invalid_state: true, current_status: currentStatus };
    }

    var event = EventBus.publish('PROJECT_CANCELLED', { project_id: projectId }, chatId, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, { status: 'CANCELLED' });
    }

    return {};
  }

  /**
   * 归档一个已经是终态（COMPLETED/CANCELLED）的 Project。
   *
   * 前置条件（见 00_Module_Responsibility.gs「二」）：拒绝归档如果——
   *   (a) 还有其它 Project 的 parent_project_id 指向本 Project 且未终态
   *   (b) 本 Project 名下还有非终态 Task
   * 拒绝时返回明确原因，不是笼统失败。
   */
  function archiveProject(projectId, chatId) {
    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'ARCHIVED') return { already_archived: true };
    if (currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED') {
      return { invalid_state: true, current_status: currentStatus,
        reason: 'Project 必须先 Complete 或 Cancel 才能 Archive' };
    }

    var openSubProjects = ProjectQueryEngine.getProjectsByParent(projectId).filter(function (p) {
      return TERMINAL_STATUSES.indexOf(String(p.status || '').toUpperCase()) === -1;
    });
    if (openSubProjects.length > 0) {
      return { blocked: true, reason: '还有 ' + openSubProjects.length + ' 个未处理完的 Sub-Project' };
    }

    var openTasks = (typeof TaskQueryEngine !== 'undefined')
      ? TaskQueryEngine.getTasksByProject(projectId).filter(function (t) {
          var s = String(t.status || '').toUpperCase();
          return ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'].indexOf(s) === -1;
        })
      : [];
    if (openTasks.length > 0) {
      return { blocked: true, reason: '还有 ' + openTasks.length + ' 个未完成的 Task' };
    }

    var archivedAt = new Date().toISOString();
    var event = EventBus.publish('PROJECT_ARCHIVED', { project_id: projectId }, chatId, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, { status: 'ARCHIVED', archived_at: archivedAt });
    }

    return {};
  }

  // ============ Conversion（Sprint 3，仅供 42_ConversionEngine.gs 调用）====

  /**
   * 【Sprint 3 落地，Sprint 1 时已预留】纯查询：判断某个 Project 是否
   * 够格被降级转换为 Task。两个条件必须同时满足（见
   * 00_Business_Rules.gs「一」）：
   *   (a) 没有其它 Project 的 parent_project_id 指向本 Project
   *   (b) 本 Project 名下的 Task 全部已是终态，或者压根没有任何 Task
   * 不满足时返回明确原因，不是笼统拒绝。
   *
   * @param {string} projectId
   * @returns {{eligible: boolean, reason: (string|undefined)}}
   */
  function checkEligibleForTaskDemotion_(projectId) {
    var subProjects = ProjectQueryEngine.getProjectsByParent(projectId).filter(function (p) {
      return TERMINAL_STATUSES.indexOf(String(p.status || '').toUpperCase()) === -1;
    });
    if (subProjects.length > 0) {
      return { eligible: false, reason: '还有 ' + subProjects.length + ' 个 Sub-Project 未处理' };
    }

    var tasks = (typeof TaskQueryEngine !== 'undefined') ? TaskQueryEngine.getTasksByProject(projectId) : [];
    var openTasks = tasks.filter(function (t) {
      var s = String(t.status || '').toUpperCase();
      return ['DONE', 'CANCELLED', 'CONVERTED', 'NOT_SELECTED'].indexOf(s) === -1;
    });
    if (openTasks.length > 0) {
      return { eligible: false, reason: '还有 ' + openTasks.length + ' 个未完成的 Task' };
    }

    return { eligible: true };
  }

  /**
   * 【Sprint 3 落地】把一个 Project 标记为 CONVERTED_TO_TASK（终态）——
   * Project→Task 转换的源侧收尾。仅供 42_ConversionEngine.gs 调用，
   * 调用前必须已经过 checkEligibleForTaskDemotion_ 校验。幂等：已经
   * 转换到*同一个*目标 Task，返回既有结果而不是报错。
   *
   * @param {string} projectId
   * @param {string} newTaskId
   * @param {string} chatId
   */
  function markProjectConvertedToTask_(projectId, newTaskId, chatId) {
    var existing = ProjectQueryEngine.getProject(projectId, chatId);
    if (!existing) return { not_found: true };

    var currentStatus = String(existing.status || '').toUpperCase();
    if (currentStatus === 'CONVERTED_TO_TASK') {
      if (existing.converted_to_task_id === newTaskId) {
        return { already_converted: true, project: existing }; // 幂等
      }
      return { invalid_state: true, current_status: currentStatus,
        reason: 'Project 已经转换到另一个 Task（' + existing.converted_to_task_id + '），不能再转换一次' };
    }
    if (TERMINAL_STATUSES.indexOf(currentStatus) !== -1) {
      return { invalid_state: true, current_status: currentStatus,
        reason: '只有非终态的 Project 才能转换为 Task' };
    }

    var payload = { project_id: projectId, status: 'CONVERTED_TO_TASK', converted_to_task_id: newTaskId,
      updated_time: new Date().toISOString() };
    var event = EventBus.publish('PROJECT_CONVERTED_TO_TASK', payload, chatId || existing.chat_id, 'ProjectEngine');

    if (event && event.projection_ok === false) {
      materializeProjectRow_(projectId, { status: 'CONVERTED_TO_TASK', converted_to_task_id: newTaskId });
    }

    return {};
  }

  // ============ 派生引擎（保留供 11_ProjectionRebuilder 使用） ============


  function deriveFromEvent(event, stateMap) {
    stateMap = stateMap || {};
    var p = event.payload || {};

    switch (event.type) {
      case 'PROJECT_CREATED':
        stateMap[p.project_id] = shallowCopy_(p);
        break;
      case 'PROJECT_UPDATED':
        if (stateMap[p.project_id]) {
          for (var k in p) if (k !== 'project_id') stateMap[p.project_id][k] = p[k];
        }
        break;
      case 'PROJECT_COMPLETED':
        if (stateMap[p.project_id]) stateMap[p.project_id].status = 'COMPLETED';
        break;
      case 'PROJECT_CANCELLED':
        if (stateMap[p.project_id]) stateMap[p.project_id].status = 'CANCELLED';
        break;
      case 'PROJECT_ARCHIVED':
        if (stateMap[p.project_id]) {
          stateMap[p.project_id].status = 'ARCHIVED';
          stateMap[p.project_id].archived_at = event.timestamp;
        }
        break;
      case 'PROJECT_CONVERTED_TO_TASK':
        if (stateMap[p.project_id]) {
          stateMap[p.project_id].status = 'CONVERTED_TO_TASK';
          stateMap[p.project_id].converted_to_task_id = p.converted_to_task_id;
        }
        break;
    }
    return stateMap;
  }

  function materializeProjectRow_(projectId, knownProject) {
    var project = knownProject;
    if (!project) return;
    upsertRowByKey_(CFG.PROJECTS_SHEET_NAME, 'project_id', projectId, project);
  }

  // ============ 内部工具 ============

  function generateProjectId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'PRJ-' + today + '-' + uniqueSuffix;
  }

  return {
    createProject:             createProject,
    createProjectDirect_:      createProjectDirect_,
    updateProject:             updateProject,
    transitionProjectStatus:   transitionProjectStatus,
    completeProject:           completeProject,
    cancelProject:             cancelProject,
    archiveProject:            archiveProject,
    checkEligibleForTaskDemotion_: checkEligibleForTaskDemotion_,
    markProjectConvertedToTask_:   markProjectConvertedToTask_,
    deriveFromEvent:           deriveFromEvent,
    materializeProjectRow_:    materializeProjectRow_
  };
})();
