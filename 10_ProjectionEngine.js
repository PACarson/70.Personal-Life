/**
 * 10_ProjectionEngine.gs
 * Personal Life OS v5.2 — Projection Engine（Events → Read Model）
 *
 * 【Sprint 3 新增】dispatch() 新增 case：TASK_CONVERTED_TO_PROJECT/
 * PROJECT_CONVERTED_TO_TASK（双向转换，两者都只更新"源"侧，"目标"侧
 * 已经在各自正常的 CREATED 事件里创建过）、NOTE_CREATED/ARCHIVED/
 * CONVERTED、REVIEW_GENERATED、BUSINESS_RULE_CREATED、
 * WORKFLOW_TEMPLATE_CAPTURED/FROZEN/DEPRECATED、
 * WORKFLOW_INSTANCE_CREATED（只更新模板 usage_count，不重复创建
 * 实体）。
 *
 * 【Sprint 1 新增，其余全部既有逻辑原样保留、逐行核对未改动】
 *  - dispatch() 的 switch 新增 case：PROJECT_CREATED/UPDATED/COMPLETED/
 *    CANCELLED/ARCHIVED、WORKFLOW_STARTED/UPDATED/FINISHED/CANCELLED、
 *    TASK_NOT_SELECTED，各自委托给对应新 projector 函数
 *  - dispatch() 末尾新增无条件的 Timeline 追加（见设计包
 *    00_ADR.gs ADR-2026-07-24-004：Timeline 是 Projection，不是
 *    第二个 Write Model）——处理完任何一个属于本项目、且在
 *    TIMELINE_ENTITY_MAP 里注册过的事件后，都会追加一行 Timeline
 *    记录。放在 switch 外层、trycatch 内层，任何一个 case 处理完（或
 *    default 情况被跳过）都会走到这一步。
 *
 * 既有 Task/Reminder 投影逻辑、TaskStatistics/TaskFilters 维护说明、
 * _getRowByKey_ 等全部原样保留，不做任何改动。
 *
 * 架构铁律（不变）：
 *  - 唯一允许写 Tasks/ActiveTasks/TaskFilters/Projects/
 *    Workflows/Timeline 等 Read Model 表的模块（Operations
 *    层的 rebuildAllProjections 除外——那是同一份逻辑的批量重放，不是
 *    另一个写入方）
 *  - dispatch() 必须是幂等消费——同一个 event_id 重复处理不能产生
 *    副作用叠加（upsertRowByKey_ 天然幂等：写同一个 key 是覆盖，不是
 *    追加）
 */

/**
 * ── Engine Contract ──────────────────────────────────────────────────
 *   Responsibilities      : 把 Events 表的每一条事件"投影"成对应的
 *                           Read Model 表变化
 *   Owns                  : event.type → 具体投影函数的路由表；
 *                           Timeline 无条件追加这条规则本身
 *   Reads                 : none（只接收 EventBus.publish 传入的
 *                           event 对象，不自己读 Events 表）
 *   Writes                : Tasks, ActiveTasks, TaskFilters,
 *                           Projects, Workflows, Timeline
 *   Public API            : dispatch
 *   Dependencies           : 05_SheetUtils.gs
 *   Forbidden Dependencies  : 02_EventBus.gs 之外的任何"发起写请求"的
 *                           模块不得反过来调用本模块之外的方式写
 *                           Read Model 表
 *   Pure Function            : NO
 *   Thread Safety             : dispatch() 由 EventBus.publish 同步
 *                           调用，运行在发布方已经持有的 Soft Lock
 *                           范围内
 *   Side Effects              : YES（Sheet 写入是本模块存在的意义）
 *   Notes                      : dispatch() 内部的每个 project*_ 函数
 *                           失败时只记录日志、不抛错（外层 try/catch
 *                           兜底，02_EventBus.gs 自己也包了一层
 *                           try/catch 并据此设置 event.projection_ok），
 *                           保证一个 Projection 步骤失败不会波及 Event
 *                           已经成功写入这个事实。
 */

var ProjectionEngine = (function () {

  var TASKS_SHEET        = 'Tasks';
  var ACTIVE_TASKS_SHEET = 'ActiveTasks';
  // TASK_STATS_SHEET 常量已移除（V4.6）——本文件不再直接写 TaskStatistics，
  // 见下方"TaskStatistics 维护"小节的说明，该表现在由
  // 11_ProjectionRebuilder.recomputeStatisticsFromTasks_() 每日批量维护。
  var TASK_FILTERS_SHEET = 'TaskFilters';

  // 【Sprint 1 新增】
  var PROJECTS_SHEET  = 'Projects';
  var WORKFLOWS_SHEET = 'Workflows';
  var TIMELINE_SHEET  = 'Timeline';
  // 【Sprint 3 新增】
  var NOTES_SHEET             = 'Notes';
  var REVIEWS_SHEET           = 'Reviews';
  var BUSINESS_RULES_SHEET    = 'BusinessRules';
  var WORKFLOW_TEMPLATES_SHEET = 'WorkflowTemplates';

  // 【Sprint 1 新增】event.type → { entityType, idField }，供 dispatch()
  // 末尾统一生成 Timeline 记录，避免在每个 case 分支里各自重复写一遍
  // 映射关系（见 ADR-2026-07-24-004 Consequences 段落的建议）。
  var TIMELINE_ENTITY_MAP = {
    'TASK_CREATED':       { entityType: 'TASK',     idField: 'task_id' },
    'TASK_UPDATED':       { entityType: 'TASK',     idField: 'task_id' },
    'TASK_COMPLETED':     { entityType: 'TASK',     idField: 'task_id' },
    'TASK_CANCELLED':     { entityType: 'TASK',     idField: 'task_id' },
    'TASK_NOT_SELECTED':  { entityType: 'TASK',     idField: 'task_id' },
    'PROJECT_CREATED':    { entityType: 'PROJECT',  idField: 'project_id' },
    'PROJECT_UPDATED':    { entityType: 'PROJECT',  idField: 'project_id' },
    'PROJECT_COMPLETED':  { entityType: 'PROJECT',  idField: 'project_id' },
    'PROJECT_CANCELLED':  { entityType: 'PROJECT',  idField: 'project_id' },
    'PROJECT_ARCHIVED':   { entityType: 'PROJECT',  idField: 'project_id' },
    'WORKFLOW_STARTED':   { entityType: 'WORKFLOW', idField: 'workflow_id' },
    'WORKFLOW_UPDATED':   { entityType: 'WORKFLOW', idField: 'workflow_id' },
    'WORKFLOW_FINISHED':  { entityType: 'WORKFLOW', idField: 'workflow_id' },
    'WORKFLOW_CANCELLED': { entityType: 'WORKFLOW', idField: 'workflow_id' },

    // 【Sprint 3 新增】
    'TASK_CONVERTED_TO_PROJECT':    { entityType: 'TASK',             idField: 'task_id' },
    'PROJECT_CONVERTED_TO_TASK':    { entityType: 'PROJECT',          idField: 'project_id' },
    'NOTE_CREATED':                 { entityType: 'NOTE',             idField: 'note_id' },
    'NOTE_ARCHIVED':                { entityType: 'NOTE',             idField: 'note_id' },
    'NOTE_CONVERTED':               { entityType: 'NOTE',             idField: 'note_id' },
    'REVIEW_GENERATED':             { entityType: 'REVIEW',           idField: 'review_id' },
    'BUSINESS_RULE_CREATED':        { entityType: 'BUSINESS_RULE',    idField: 'rule_id' },
    'WORKFLOW_TEMPLATE_CAPTURED':   { entityType: 'WORKFLOW_TEMPLATE', idField: 'template_id' },
    'WORKFLOW_TEMPLATE_FROZEN':     { entityType: 'WORKFLOW_TEMPLATE', idField: 'template_id' },
    'WORKFLOW_TEMPLATE_DEPRECATED': { entityType: 'WORKFLOW_TEMPLATE', idField: 'template_id' },
    'WORKFLOW_INSTANCE_CREATED':    { entityType: 'WORKFLOW_TEMPLATE', idField: 'template_id' }
  };

  // ============ 入口 ============

  function dispatch(event) {
    try {
      var type = event.type;
      switch (type) {
        case 'TASK_CREATED':   projectTaskCreated_(event);   break;
        case 'TASK_UPDATED':   projectTaskUpdated_(event);   break;
        case 'TASK_COMPLETED': projectTaskCompleted_(event); break;
        case 'TASK_CANCELLED': projectTaskCancelled_(event); break;
        case 'REMINDER_SENT':  projectReminderSent_(event);  break;

        // 【Sprint 1 新增】
        case 'TASK_NOT_SELECTED':  projectTaskNotSelected_(event);  break;
        case 'PROJECT_CREATED':    projectProjectCreated_(event);   break;
        case 'PROJECT_UPDATED':    projectProjectUpdated_(event);   break;
        case 'PROJECT_COMPLETED':  projectProjectCompleted_(event); break;
        case 'PROJECT_CANCELLED':  projectProjectCancelled_(event); break;
        case 'PROJECT_ARCHIVED':   projectProjectArchived_(event);  break;
        case 'WORKFLOW_STARTED':   projectWorkflowStarted_(event);  break;
        case 'WORKFLOW_UPDATED':   projectWorkflowUpdated_(event);  break;
        case 'WORKFLOW_FINISHED':  projectWorkflowFinished_(event); break;
        case 'WORKFLOW_CANCELLED': projectWorkflowCancelled_(event); break;

        // 【Sprint 3 新增】
        case 'TASK_CONVERTED_TO_PROJECT':    projectTaskConvertedToProject_(event);    break;
        case 'PROJECT_CONVERTED_TO_TASK':    projectProjectConvertedToTask_(event);    break;
        case 'NOTE_CREATED':                 projectNoteCreated_(event);               break;
        case 'NOTE_ARCHIVED':                projectNoteArchived_(event);              break;
        case 'NOTE_CONVERTED':               projectNoteConverted_(event);             break;
        case 'REVIEW_GENERATED':             projectReviewGenerated_(event);           break;
        case 'BUSINESS_RULE_CREATED':        projectBusinessRuleCreated_(event);       break;
        case 'WORKFLOW_TEMPLATE_CAPTURED':   projectWorkflowTemplateCaptured_(event);  break;
        case 'WORKFLOW_TEMPLATE_FROZEN':     projectWorkflowTemplateFrozen_(event);    break;
        case 'WORKFLOW_TEMPLATE_DEPRECATED': projectWorkflowTemplateDeprecated_(event); break;
        case 'WORKFLOW_INSTANCE_CREATED':    projectWorkflowInstanceCreated_(event);   break;

        default:
          break;
      }

      // 【Sprint 1 新增】不论上面走的是哪个 case，只要这个事件类型出现在
      // TIMELINE_ENTITY_MAP 里，就无条件追加一行 Timeline，放在
      // switch 之后、外层 catch 之前——任何一个 case 抛出的异常都会跳过
      // 这一步（被下面的 catch 统一捕获记录），保证"主 Read Model 没写
      // 成功却仍然记了一条 Timeline"这种不一致不会发生。
      _appendTimelineEntry_(event);

    } catch (e) {
      Logger.log('[ProjectionEngine] ERROR dispatching ' + (event && event.type) + ': ' + e.message);
    }
  }

  // ============ Task Projectors（既有，不变） ============

  function projectTaskCreated_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, p);

    try {
      upsertRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id, p);
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks upsert 失败（Sheet 可能尚未建立）: ' + e.message);
    }

    _upsertTaskFilters_(p.task_id, p);
    // 【V4.6 移除 TaskStatistics 同步维护】见文件头 V4.6 修复说明和
    // 00_ADR.gs ADR-2026-07-06-005。
  }

  /** V4 新增 */
  function projectTaskUpdated_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    var fields = shallowCopy_(p);
    delete fields.task_id;
    if (Object.keys(fields).length === 0) return;

    // 【V4.2 修复 HIGH RISK 3 之一】之前这里对同一个 task_id 读了两次
    // Tasks 行（一次判断 ActiveTasks 该不该同步、一次为了拼 TaskFilters 的
    // searchable_text）。改成只读一次，'before' 在下面被 ActiveTasks 同步、
    // TaskFilters 刷新、TaskStatistics 漂移修正三处共用。
    var before = _getRowByKey_(TASKS_SHEET, 'task_id', p.task_id);

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, fields);

    // 只有当任务当前还是非终态才需要同步 ActiveTasks（终态任务本来就不在
    // ActiveTasks 里，upsert 一个不存在的 key 会误新增一行——upsertRowByKey_
    // 找不到就 append，所以这里用 before 的状态判断，避免把已完成/取消的
    // 任务意外重新塞回工作台）。【Sprint 1 说明】28_WorkflowEngine 的
    // Branch WAITING 分支会经这条路径把 status 改成 WAITING（非终态），
    // before.status 此时是原状态（通常 PENDING），判断结果为"需要同步"，
    // 行为正确，不需要为此新增任何特殊分支。
    try {
      var status = before ? String(before.status || '').toUpperCase() : '';
      if (status !== 'DONE' && status !== 'CANCELLED') {
        upsertRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id, fields);
      }
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks update 同步失败: ' + e.message);
    }

    if (before) {
      // 重新拼 searchable_text 需要完整字段（title/description/tags/category
      // 都可能没在这次 update 的 payload 里），用 before + 本次改动合并即可，
      // 不需要再查一次 Sheet。
      var merged = shallowCopy_(before);
      for (var k in fields) merged[k] = fields[k];
      _upsertTaskFilters_(p.task_id, merged);
      // 【V4.6 移除 TaskStatistics 同步维护】原来这里会调
      // _adjustStatisticsForUpdate_ 修正 recurring/chat_id 变更导致的统计
      // 漂移（V4.2 MEDIUM RISK 2 的修复）。现在 TaskStatistics 整体改为
      // 每日批量重算（见文件头 V4.6 说明），这个问题连带一起解决了——
      // 批量重算每次都是从 Tasks 表现状重新聚合，不存在"漂移"这个概念
      // （每天都是全新算一遍，不是在旧值上累加），原来专门为这类边界
      // 情况写的调整逻辑不再需要，已删除。
    }
  }

  /**
   * 【V4.5 修复历史记录，HIGH RISK 1：并发状态下的统计数据漂移】曾经在这里
   * 用"事件发生前是否已处于同一终态"来判断要不要跳过 TaskStatistics 的
   * 增量扣减。V4.6 起 TaskStatistics 改为每日批量重算（见文件头 V4.6
   * 说明），不再有任何同步增量写入，这个判断本身也就不需要了——但
   * wasAlreadyDone 这个"事件是不是重复的"信号本身仍然有意义（哪怕现在
   * 只用来打日志），保留判断、去掉它原本保护的那次 _bumpStatistics_ 调用。
   */
  function projectTaskCompleted_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    var completedAt = event.timestamp || new Date().toISOString();
    var current = _getRowByKey_(TASKS_SHEET, 'task_id', p.task_id);
    var wasAlreadyDone = !!(current && String(current.status || '').toUpperCase() === 'DONE');

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {
      status:       'DONE',
      completed_at: completedAt
    });

    try {
      deleteRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id);
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks 删除失败（Sheet 可能尚未建立）: ' + e.message);
    }

    if (wasAlreadyDone) {
      Logger.log('[ProjectionEngine] task_id=' + p.task_id + ' 在这次 TASK_COMPLETED 之前就已经是 DONE' +
        '（重复事件，很可能是并发竞态产生的）——Tasks/ActiveTasks 的覆写本身是幂等操作，无需特殊处理');
    }
  }

  function projectTaskCancelled_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    var current = _getRowByKey_(TASKS_SHEET, 'task_id', p.task_id);
    var wasAlreadyCancelled = !!(current && String(current.status || '').toUpperCase() === 'CANCELLED');

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {
      status: 'CANCELLED'
    });

    try {
      deleteRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id);
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks 删除失败（Sheet 可能尚未建立）: ' + e.message);
    }

    if (wasAlreadyCancelled) {
      Logger.log('[ProjectionEngine] task_id=' + p.task_id + ' 在这次 TASK_CANCELLED 之前就已经是 CANCELLED' +
        '（重复事件，很可能是并发竞态产生的）——Tasks/ActiveTasks 的覆写本身是幂等操作，无需特殊处理');
    }
  }

  /**
   * 【Sprint 1 新增】跟 projectTaskCancelled_ 几乎同构——NOT_SELECTED 也是
   * 终态，同样要从 ActiveTasks 移除。不合并成一个函数，是因为两者的
   * "重复事件"日志文案不同，未来各自可能需要独立演化（比如 NOT_SELECTED
   * 未来可能需要额外记录是哪个 branch_group/哪次 Complete 触发的）。
   */
  function projectTaskNotSelected_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    var current = _getRowByKey_(TASKS_SHEET, 'task_id', p.task_id);
    var wasAlreadyNotSelected = !!(current && String(current.status || '').toUpperCase() === 'NOT_SELECTED');

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {
      status: 'NOT_SELECTED'
    });

    try {
      deleteRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id);
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks 删除失败（Sheet 可能尚未建立）: ' + e.message);
    }

    if (wasAlreadyNotSelected) {
      Logger.log('[ProjectionEngine] task_id=' + p.task_id + ' 在这次 TASK_NOT_SELECTED 之前就已经是 NOT_SELECTED（重复事件）——覆写本身是幂等操作，无需特殊处理');
    }
  }

  function projectReminderSent_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;

    var current = _getRowByKey_(TASKS_SHEET, 'task_id', p.task_id);
    if (!current) return;

    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {
      reminder_count: (Number(current.reminder_count) || 0) + 1
    });
    // ActiveTasks 不需要 reminder_count（工作台不展示这列），跳过
  }

  // ============ TaskStatistics 维护（既有，不变） ============
  //
  // 【V4.6 移除】这里原来有一个 _bumpStatistics_(chatId, deltas) 函数，
  // 被 projectTaskCreated_/projectTaskUpdated_（经 _adjustStatisticsForUpdate_）/
  // projectTaskCompleted_/projectTaskCancelled_/projectReminderSent_ 五个
  // 地方同步调用，对 TaskStatistics 做"读一行、内存里加减、写回"的增量更新。
  //
  // 第五轮外部审计同时指出两个问题：
  //   HIGH RISK 1：这个"读-改-写"本身不是原子操作，同一 chatId 的两个并发
  //   请求（不同任务，比如同一用户几乎同时完成两个不同的任务）会同时读到
  //   同一份旧值，其中一个的更新会被覆盖丢失（lost update）。
  //   HIGH RISK 4：12_TaskQueryEngine.getStatistics() 早就完全不读
  //   TaskStatistics 这张表了（直接用 AnalyticsEngine.computeStatistics
  //   扫描 Tasks 现算，见该函数注释）——也就是说，本 OS 每一次创建/更新/
  //   完成/取消/提醒事件，都在为一张"没有任何查询路径依赖"的表支付一次
  //   额外的 Sheet 读写成本。
  //
  // 这两个问题指向同一个结论：与其给一个已经被证实没人读的同步写入路径
  // 加锁（修好 HIGH1 但让 HIGH4 更严重——加锁只会让这条本来就该被质疑的
  // 写入路径更慢），不如直接停止同步维护，改成低频、异步的每日批量重算
  // （HIGH RISK 4 审计原文自己给出的建议）。批量重算天然没有"读-改-写"
  // 竞争问题（每次都是从 Tasks 现状完整重新聚合一遍，不是在旧值上累加），
  // 一并解决了 HIGH RISK 1。
  //
  // 新的维护方式：15_Setup.gs 的每日触发器新增
  // triggerDailyStatisticsRecompute()，调用
  // 11_ProjectionRebuilder.recomputeStatisticsFromTasks_()，从 Tasks 表
  // （不是 Events——Tasks 本身已经是可信的 Read Model，不需要每天重放
  // 全部历史 Events 才能算出当前状态，见该函数文件头对比说明）按 chat_id
  // 分组重新聚合，整体覆写 TaskStatistics。
  //
  // 完整架构论证见 00_ADR.gs ADR-2026-07-06-005。TaskStatistics 表本身
  // 和它的 Schema 都没有删除——只是从"事件驱动的实时投影"降级为"每日
  // 批量重算的缓存"，如果未来真的有查询路径需要用到它，性质变了这一点
  // 需要留意（缓存现在最多有 24 小时延迟，不再是实时的）。

  // ============ TaskFilters 维护（既有，不变） ============

  /**
   * 拼好 searchable_text（title+description+notes+tags+category 小写拼接），
   * upsert 到 TaskFilters。见文件头注释——当前 23_SearchEngine 暂未依赖这张表
   * （直接在 Tasks 行上过滤已经够快），这里先维护起来，面向未来更大数据量。
   */
  function _upsertTaskFilters_(taskId, task) {
    try {
      var searchableText = [task.title, task.description, task.notes, task.tags, task.category]
        .filter(function (v) { return !!v; })
        .join(' ')
        .toLowerCase();

      upsertRowByKey_(TASK_FILTERS_SHEET, 'task_id', taskId, {
        task_id:         taskId,
        chat_id:         task.chat_id || '',
        searchable_text: searchableText,
        tags_csv:        task.tags || ''
      });
    } catch (e) {
      Logger.log('[ProjectionEngine] TaskFilters upsert 失败（Sheet 可能尚未建立）: ' + e.message);
    }
  }

  // ============ Project Projectors（Sprint 1 新增） ============

  function projectProjectCreated_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, p);
  }

  function projectProjectUpdated_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    var fields = shallowCopy_(p);
    delete fields.project_id;
    if (Object.keys(fields).length === 0) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, fields);
  }

  function projectProjectCompleted_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, { status: 'COMPLETED' });
  }

  function projectProjectCancelled_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, { status: 'CANCELLED' });
  }

  function projectProjectArchived_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, {
      status: 'ARCHIVED',
      archived_at: event.timestamp || new Date().toISOString()
    });
  }

  // ============ Workflow Projectors（Sprint 1 新增） ============

  function projectWorkflowStarted_(event) {
    var p = event.payload || {};
    if (!p.workflow_id) return;
    upsertRowByKey_(WORKFLOWS_SHEET, 'workflow_id', p.workflow_id, p);
  }

  function projectWorkflowUpdated_(event) {
    var p = event.payload || {};
    if (!p.workflow_id) return;
    var fields = shallowCopy_(p);
    delete fields.workflow_id;
    if (Object.keys(fields).length === 0) return;
    upsertRowByKey_(WORKFLOWS_SHEET, 'workflow_id', p.workflow_id, fields);
  }

  function projectWorkflowFinished_(event) {
    var p = event.payload || {};
    if (!p.workflow_id) return;
    upsertRowByKey_(WORKFLOWS_SHEET, 'workflow_id', p.workflow_id, { status: 'COMPLETED' });
  }

  function projectWorkflowCancelled_(event) {
    var p = event.payload || {};
    if (!p.workflow_id) return;
    upsertRowByKey_(WORKFLOWS_SHEET, 'workflow_id', p.workflow_id, { status: 'CANCELLED' });
  }

  // ============ Conversion Projectors（Sprint 3 新增） ============
  //
  // 两个转换事件都只更新"源"侧一张表——"目标"侧（新 Project/新 Task）
  // 已经在各自的 PROJECT_CREATED / TASK_CREATED 事件里正常创建过了
  // （42_ConversionEngine.gs 是先调用正常的 createProject/
  // createTaskFromConversion_，再发布这个转换事件收尾），这里不需要
  // 重复插入目标行。

  function projectTaskConvertedToProject_(event) {
    var p = event.payload || {};
    if (!p.task_id) return;
    upsertRowByKey_(TASKS_SHEET, 'task_id', p.task_id, {
      status: 'CONVERTED',
      converted_to_project_id: p.converted_to_project_id
    });
    try {
      deleteRowByKey_(ACTIVE_TASKS_SHEET, 'task_id', p.task_id);
    } catch (e) {
      Logger.log('[ProjectionEngine] ActiveTasks 删除失败: ' + e.message);
    }
  }

  function projectProjectConvertedToTask_(event) {
    var p = event.payload || {};
    if (!p.project_id) return;
    upsertRowByKey_(PROJECTS_SHEET, 'project_id', p.project_id, {
      status: 'CONVERTED_TO_TASK',
      converted_to_task_id: p.converted_to_task_id
    });
  }

  // ============ Note Projectors（Sprint 3 新增） ============

  function projectNoteCreated_(event) {
    var p = event.payload || {};
    if (!p.note_id) return;
    upsertRowByKey_(NOTES_SHEET, 'note_id', p.note_id, p);
  }

  function projectNoteArchived_(event) {
    var p = event.payload || {};
    if (!p.note_id) return;
    upsertRowByKey_(NOTES_SHEET, 'note_id', p.note_id, { status: 'ARCHIVED' });
  }

  function projectNoteConverted_(event) {
    var p = event.payload || {};
    if (!p.note_id) return;
    upsertRowByKey_(NOTES_SHEET, 'note_id', p.note_id, {
      status: 'CONVERTED',
      converted_to_type: p.target_type,
      converted_to_id: p.target_id
    });
  }

  // ============ Review Projector（Sprint 3 新增） ============

  function projectReviewGenerated_(event) {
    var p = event.payload || {};
    if (!p.review_id) return;
    upsertRowByKey_(REVIEWS_SHEET, 'review_id', p.review_id, p);
  }

  // ============ BusinessRule / WorkflowTemplate Projectors（Sprint 3 新增）===

  function projectBusinessRuleCreated_(event) {
    var p = event.payload || {};
    if (!p.rule_id) return;
    upsertRowByKey_(BUSINESS_RULES_SHEET, 'rule_id', p.rule_id, p);
  }

  function projectWorkflowTemplateCaptured_(event) {
    var p = event.payload || {};
    if (!p.template_id) return;
    upsertRowByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', p.template_id, p);
  }

  function projectWorkflowTemplateFrozen_(event) {
    var p = event.payload || {};
    if (!p.template_id) return;
    upsertRowByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', p.template_id, { status: 'FROZEN' });
  }

  function projectWorkflowTemplateDeprecated_(event) {
    var p = event.payload || {};
    if (!p.template_id) return;
    upsertRowByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', p.template_id, { status: 'DEPRECATED' });
  }

  /**
   * 只更新 WorkflowTemplates 的 usage_count/last_used_at——新
   * Workflow/新 Project 已经在各自的 WORKFLOW_STARTED/PROJECT_CREATED
   * 事件里正常创建过了（41_BusinessRuleEngine.instantiateFromTemplate
   * 复用既有 WorkflowEngine/ProjectEngine/TaskEngine 创建路径，不重新
   * 实现一遍实体创建逻辑）。
   */
  function projectWorkflowInstanceCreated_(event) {
    var p = event.payload || {};
    if (!p.template_id) return;

    var current = _getRowByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', p.template_id);
    var newUsageCount = (current ? (Number(current.usage_count) || 0) : 0) + 1;

    upsertRowByKey_(WORKFLOW_TEMPLATES_SHEET, 'template_id', p.template_id, {
      usage_count: newUsageCount,
      last_used_at: event.timestamp
    });
  }

  // ============ Timeline 投影（Sprint 1 新增，见 ADR-2026-07-24-004） ====

  function _appendTimelineEntry_(event) {
    var mapping = TIMELINE_ENTITY_MAP[event.type];
    if (!mapping) return; // 这个事件类型不对应任何需要留痕的实体，跳过

    var entityId = (event.payload || {})[mapping.idField];
    if (!entityId) return;

    try {
      var sheet = getSheet_(TIMELINE_SHEET);
      var actor = (event.payload && event.payload.creator) ? event.payload.creator
        : (event.source === 'WorkflowEngine' ? 'System' : 'User');

      sheet.appendRow([
        _generateTimelineId_(),
        mapping.entityType,
        entityId,
        event.type,
        event.timestamp,
        actor,
        '', // detail：Sprint 1 不填充，预留给未来需要快照上下文的场景
        event.event_id || ''
      ]);
    } catch (e) {
      Logger.log('[ProjectionEngine] Timeline 追加失败（不影响主 Read Model 已经写入成功的事实）: ' + e.message);
    }
  }

  function _generateTimelineId_() {
    var tz = Session.getScriptTimeZone();
    var today = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
    var uniqueSuffix = Utilities.getUuid().split('-')[0].toUpperCase();
    return 'TML-' + today + '-' + uniqueSuffix;
  }

  // ============ 内部工具（既有，不变） ============

  function _getRowByKey_(sheetName, keyHeader, keyValue) {
    try {
      var sheet = getSheet_(sheetName);
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      var headerMap = getHeaderMap_(sheet);
      if (!(keyHeader in headerMap)) return null;

      var keyCol = headerMap[keyHeader] + 1;
      var ids = sheet.getRange(2, keyCol, lastRow - 1, 1).getValues();

      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(keyValue)) {
          var numCols = sheet.getLastColumn();
          var row = sheet.getRange(i + 2, 1, 1, numCols).getValues()[0];
          var obj = {};
          for (var h in headerMap) obj[h] = row[headerMap[h]];
          return obj;
        }
      }
    } catch (e) {
      Logger.log('[ProjectionEngine] _getRowByKey_ error (' + sheetName + ', ' + keyValue + '): ' + e.message);
    }
    return null;
  }

  return {
    dispatch:     dispatch,
    _getRowByKey: _getRowByKey_
  };
})();
