/**
 * 00_Architecture_Review_ProjectWorkflow_Reminder_Integration.js
 * Personal Life OS × Reminder OS
 * "Project / Workflow → Reminder OS" 集成缺口 — 正式架构评审
 *
 * STATUS: Review（架构评审，不是 ADR——第九节给出正式 ADR 的建议编号与落点，
 *         在 Carson 明确批准前，本文档不构成任何架构决策，不得被引用为
 *         "已批准"）
 * DATE  : 2026-08-27
 * SCOPE : 只评审"Personal Life OS 的 Project/Workflow 实体如何被
 *         Reminder OS 消费提醒请求"这一件具体的集成缺口。不重启
 *         Reminder OS ADR-003 的七引擎 V2 构想（该构想继续 Proposed
 *         搁置，本文档不改变它的状态）。
 * 本次未修改任何生产代码——本文档是本次会话唯一新增的文件。
 *
 * 证据来源：直接读取 Carson 提供的两份源码压缩包
 *   - Personal-Life-main（70_Personal-Life-main.zip）
 *   - Reminder-main      （19_Reminder-main.zip）
 * 全文标注 file:line 的结论均为直接读取/grep 核实；少数只能追溯到
 * "被另一份文件引用"而未能独立打开原件的地方，逐一标注为"未独立核实"，
 * 不冒充一手证据。
 */

// ============================================================================
// 零、先澄清一个会影响全篇分析的命名误导
// ============================================================================

/**
 * "Project/Workflow → Reminder OS" 这个题目名字本身有一处需要先澄清，
 * 否则后面第三、四节的模型评估会被误导：
 *
 * 43_ReminderConnector.js 对外只有两个函数：requestProjectReminder
 * 和 requestWorkflowStepReminder。但 requestWorkflowStepReminder 的
 * 参数是 taskId，发布的 payload 是 entity_type: 'TASK'——函数自己的
 * 文档注释写得很直接（43_ReminderConnector.js:52-56）：
 *
 *   "Workflow 里某一步（Task）的 id——命名为"WorkflowStep"是概念上的
 *    说法，实际实体仍然是 Task（见设计包 00_Entity_Relationship.gs：
 *    Workflow 没有独立的 Step 实体，步骤就是 Task 本身）"
 *
 * 也就是说，目前代码里真正会被发布的 entity_type 只有两种：
 *   'PROJECT'（全新，Reminder OS 从未处理过）
 *   'TASK'   （Reminder OS 已经有完整基础设施处理这个实体类型）
 *
 * Workflow 实体本身（LIFE_WORKFLOWS 表那一行，workflow_id 本身）没有
 * 任何函数为它发布提醒请求——现有的两个函数只覆盖"Project"和"属于
 * Workflow 的某个 Task"，不覆盖"整个 Workflow 实例作为一个整体"这个
 * case。这不是本文档的推测，是 43_ReminderConnector.js 的 Public API
 * 就只有这两个函数这一事实决定的。
 *
 * 这条澄清直接决定了下面第三、四节不能把"Project/Workflow 集成"当成
 * 一个同质问题处理——TASK 那一半和 PROJECT 那一半的可行性差距很大，
 * 见第一节 G 和第六节的分别处理。
 */

// ============================================================================
// 一、事实基线（Establish the current factual baseline）
// ============================================================================

// ---- A. Project/Workflow 目前如何发布 REMINDER_REQUESTED ----

/**
 * 43_ReminderConnector.js（Personal-Life-main，全文 73 行，已完整读取）：
 *
 *   function requestProjectReminder(projectId, reminderPolicy, chatId) {
 *     var payload = {
 *       entity_type:      'PROJECT',
 *       entity_id:        projectId,
 *       reminder_policy:  reminderPolicy || {}
 *     };
 *     EventBus.publish('REMINDER_REQUESTED', payload, chatId, 'ReminderConnector');
 *   }                                                    （line 42-49）
 *
 *   function requestWorkflowStepReminder(taskId, reminderPolicy, chatId) {
 *     var payload = {
 *       entity_type:      'TASK',
 *       entity_id:        taskId,
 *       reminder_policy:  reminderPolicy || {}
 *     };
 *     EventBus.publish('REMINDER_REQUESTED', payload, chatId, 'ReminderConnector');
 *   }                                                    （line 60-67）
 *
 * Engine Contract（line 16-30）自陈：Reads: none；Writes: Events
 * （REMINDER_REQUESTED）；Forbidden Dependencies: Sheet 读写、直接调用
 * Reminder OS 的任何函数。纯格式转换，不做任何业务判断。
 *
 * 文件头（line 11-12）："本 Connector 跟 Reminder OS 之间只通过 Events
 * 表耦合，不直接调用 Reminder OS 的任何函数（见 00_Domain_Boundary.gs
 * 「六」）。"
 *
 * 关键发现——生产环境里目前没有任何真实调用方：
 *   grep -rn "requestProjectReminder\|requestWorkflowStepReminder" 覆盖
 *   Personal-Life-main 全部 .js 文件，唯一命中的调用点是：
 *
 *     36_Tests_Sprint3Acceptance.js:271
 *       ReminderConnector.requestProjectReminder(project.project_id,
 *         { offset_minutes: 1440 }, testChatId);
 *
 *   27_ProjectEngine.js、28_WorkflowEngine.js、50_UIBridge.js、
 *   ui_index.html 全部 grep "reminder"/"Reminder" 零命中。Add Project
 *   表单（ui_index.html）字段只有 title/description/
 *   parent_project_id/execution_mode，没有任何提醒相关输入。
 *
 *   也就是说：这两个函数目前只被 Sprint 3 Acceptance Gate 测试调用过
 *   （而且该 Gate 曾在真实生产环境跑过，见 productivity-os 记录
 *   "2026-08-16 Sprint 3: 4/4"——意味着每次真实跑这个 Gate，Events 表
 *   里都会多一行真实的 REMINDER_REQUESTED 事件，这行事件目前没有任何
 *   代码会去读它）。没有任何用户可触达的路径（Project/Task 的创建、
 *   编辑、UI）会真正调用这两个函数。
 */

// ---- B. 事件封装（envelope）的确切字段 ----

/**
 * 02_EventBus.js（Personal-Life-main，全文已读）：
 *
 *   COLS = ['event_id', 'timestamp', 'type', 'chat_id', 'payload', 'source']
 *                                                              （line 69）
 *   function publish(type, payload, chatId, source, identity)   （line 155）
 *   event = {
 *     event_id: 'EVT-' + Date.now() + '-' + random(0-999),
 *     timestamp: new Date().toISOString(),
 *     type, chat_id: chatId||'', payload: payload||{}, source: source||''
 *   }                                                     （line 165-172）
 *
 * REMINDER_REQUESTED 的 payload 因此确定为三个字段：
 *   entity_type ('PROJECT'|'TASK')、entity_id、reminder_policy（object）
 *
 * 幂等性相关的关键事实：publish() 的第五个可选参数 identity 用于
 * "本次执行内 identity 缓存"去重（line 46-50 文件头 + line 155-163），
 * 但 43_ReminderConnector.js 两处调用 EventBus.publish 都只传了 4 个
 * 参数（entity_type/entity_id/reminder_policy + chatId + source），
 * 完全没有传 identity。也就是说：如果 requestProjectReminder 被同一个
 * project_id 调用两次（哪怕在同一次脚本执行内），会不多不少产生两条
 * 完全独立、event_id 不同的 REMINDER_REQUESTED 事件，现有代码没有
 * 任何一层去重保护。
 *
 * Events 表所在的 Spreadsheet：02_EventBus.js:90-101 的
 * _spreadsheet_() 用 SecureConfig.getKey('SPREADSHEET_ID') +
 * SpreadsheetApp.openById——文件头明确写"跟 Core 用同一个共享
 * Spreadsheet"（line 16-21）。05_SheetUtils.js（Personal-Life-main，
 * line 97-106）用的是同一个 SPREADSHEET_ID key。也就是说 Events、
 * Tasks、Projects、Workflows 这些表全部是同一张物理 Spreadsheet 里的
 * 不同 tab，不是分散在多个 Spreadsheet 里——这条对第一节 H 和第三节的
 * 模型评估很关键。
 */

// ---- C. Task 级提醒目前如何工作（既有 precedent） ----

/**
 * Task 级提醒完全不经过 43_ReminderConnector / REMINDER_REQUESTED
 * 事件——20_ReminderEngine.js 文件头（line 40-51）明确记录这是独立机制
 * （ADR-2026-07-17-006，Personal-Life-main 侧对应 ADR-2026-07-17-009）：
 *
 *   - Task 创建时可在 task.reminder_policy 字段直接写入
 *     { offsets: [{value, unit}, ...] }（或留空/null）
 *   - 20_ReminderEngine.js 的 _ensureRulesFromPolicy_（line 287-352）
 *     读 task.reminder_policy（_parseJsonSafe_，line 298），按
 *     taskIdsWithRules[task.task_id] 是否已存在决定"这个 task 是否已经
 *     生成过规则"——只在【第一次】看到这个 task_id 时生成规则
 *   - 明确设计决定（line 318-319 注释）："reminder_policy 不可变
 *     （决定 #2）"——不支持创建后修改
 *
 * 数据来源：22_QueryEngine.getPendingTasks()（line 1-70 文件头 +
 * 实现）不是直接扫 Tasks 全表，而是两步：① 读 Personal Life OS 自己
 * 维护的 ActiveTasks 投影表（体量只随"当前未完成任务数"增长，不随
 * 历史任务数增长）拿候选任务；② 只对这批候选任务的 task_id，用
 * SheetUtils.batchReadFieldsByKey_ 定点读 Tasks 表的
 * reminder_count/last_reminder_at 两个字段（这两个字段的权威数据只在
 * Tasks，ActiveTasks 不维护）。这是 2026-07-11 一次外部审计 HIGH RISK 2
 * 修复的结果（22_QueryEngine.js 文件头完整记录了权衡过程）。
 *
 * 唯一的写回例外：20_ReminderEngine.js:60-62 明确写"从不写回
 * Productivity OS 的表——唯一例外是 reminder_count/last_reminder_at
 * 这两个字段，V1 时代就已经是 Reminder OS 有限写权限的一部分（见 P3）"。
 *
 * 这条 precedent 对本次评审极其重要——见第五节。
 */

// ---- D. Reminder OS 的到期时间解析顺序 ----

/**
 * 20_ReminderEngine.js:189-204：
 *
 *   function _resolveEffectiveDueDatetime_(task) {
 *     if (task.due_datetime) { ... return dt1; }              // 优先级1
 *     if (task.due_date && task.due_time) { ... return dt2; } // 优先级2
 *     if (task.due_date) { ... return dt3; }                  // 优先级3（午夜兜底）
 *     return null;
 *   }
 *
 * 50_ReminderEngine_Tests.js:67-76 三个场景分别断言这三级优先顺序
 * （67-68 due_datetime；71-72 due_date+due_time；75 纯 due_date）。
 *
 * 这条直接回答了 Session Handoff 里"未解决的开放问题"（该问题误写文件名
 * 为 26_ReminderOffsetEngine.gs——实际不存在这个文件，对应逻辑就在
 * 20_ReminderEngine.js）：Reminder OS 的引擎确实是 datetime-aware 的，
 * 不是只到天。但这条解析逻辑目前【只接受 task 形状的对象】
 * （task.due_datetime/task.due_date/task.due_time）——Project/Workflow
 * 目前没有任何同名字段可供这个函数解析（见下方 G）。
 */

// ---- E. 既有身份/幂等机制 ----

/**
 * 20_ReminderEngine.js 三张自有表（line 116-118）：
 *   RULES_SHEET = 'ReminderRules'
 *   OCCURRENCES_SHEET = 'ReminderOccurrences'
 *   HISTORY_SHEET = 'ReminderHistory'
 *
 * 幂等 key（line 216-218）：
 *   _computeIdempotencyKey_(ruleId, channel, fireAt) =
 *     ruleId + ':' + channel + ':' + Math.floor(fireAt.getTime()/60000)
 *
 * ReminderRules 目前的 schema（line 328-339 生成处）：rule_id（主键，
 * 'RULE-'+timestamp+random）、task_id（写死这个字段名，不是
 * entity_id/entity_type）、chat_id、offset_minutes、offset_label、
 * channels（JSON）、rule_status、source（auto_default|user_override）、
 * resolved_fire_ats（JSON）、created_at。
 *
 * 关键限制：规则表目前【硬编码按 task_id 建索引】——taskIdsWithRules
 * 这个去重 map、newRules.push 时的字段名都写死是 task_id。要让同一套
 * 表也承载 Project 的规则，要么改 schema（task_id → entity_id +
 * entity_type，属于列改名/迁移级别的改动），要么另开一张结构类似但
 * 独立的表（不改动这张已经有真实生产数据、被 Task 路径依赖的表）。
 * 这条直接影响第四节 H（migration cost）。
 *
 * 文件头（line 72-108）额外记录了两处"设计阶段没预见、写代码时才发现"
 * 的细化，都跟"resolved_fire_ats 存什么语义"有关，直接对应下面 F。
 */

// ---- F. 既有取消/完成/重新排期处理 ----

/**
 * checkOffsetReminders() 主循环（20_ReminderEngine.js:701-985）：
 *
 * 取消检测（line 812-829）——不是读某个 status 字段，而是"这个
 * rule.task_id 是否还在本轮 pendingTaskById 里"：
 *
 *   var task = pendingTaskById[rule.task_id];
 *   if (!task) {
 *     // design doc §5 step 4：task 不在这一轮的 pending 集合里 → 取消
 *     for (occ in occurrenceByKey 属于这条 rule 且状态是
 *          pending/failed/snoozed 的) {
 *       历史记录 'cancelled' / 'task_no_longer_pending'
 *       发布 REMINDER_CANCELLED 事件
 *     }
 *     ruleDeletes.push(rule.rule_id);
 *   }
 *
 * 这个设计的优点：不管 task 是"完成"还是"取消"还是"被归档"，只要它
 * 离开了 getPendingTasks() 的结果集，统一走同一条取消路径，不需要
 * Reminder OS 自己认识 Personal Life OS 的完整状态机。
 *
 * 重新排期（line 834-860）——2026-07-15 外部审计 HIGH RISK 1 修复过
 * 一次：resolved_fire_ats 原本存"上次解决掉的 fire_at"，隐含"到期时间
 * 只会不变或后移"的假设；一旦到期时间被改早，新算出的更小 fireAt 会
 * 被误判成"已处理过"而漏发。修复后存"上次解决这个 channel 时的
 * effectiveDue 本身"，到期时间只要变了（不管早晚）就重新评估——
 * 50_ReminderEngine_Tests.js 场景 F（dueRescheduledF，line 246）专门
 * 覆盖这个回归。
 *
 * 这两条机制（离开 pending 集合即取消；effectiveDue 变化即重新评估）
 * 是第六节推荐方案里，Project/Task 两种 entity_type 都应该直接复用的
 * 现成能力，不需要重新发明。
 */

// ---- G. Project/Workflow 目前是否已有提醒相关字段 ----

/**
 * 这是本次评审里最重要的一条事实发现，直接决定第三、六、七节的范围。
 *
 * 00_Sheets_Structure.js（Personal-Life-main）「三、LIFE_PROJECTS」
 * （line 76-119）完整列清单：project_id / identity / title /
 * description / execution_mode / parent_project_id /
 * depends_on_project_ids / source_task_id / archived_at / chat_id /
 * status / converted_to_task_id / instantiated_from_template_id /
 * decision_owner / approval_status。
 *
 * 「四、LIFE_WORKFLOWS」（line 120-165）完整列清单：workflow_id /
 * identity / project_id / title / loop_max_iterations / chat_id /
 * recurrence_rule / workflow_type / status /
 * instantiated_from_template_id / template_version_at_instantiation /
 * decision_owner / approval_status。
 *
 * 两张表【都没有】due_date / due_datetime / due_time / reminder_policy
 * / priority 中的任何一个字段。额外用词根 "date|deadline|target_|
 * end_|due" 搜过整个文件，命中的只有 Metadata 的 updated_time（审计
 * 时间戳，不是业务到期时间）。
 *
 * 后果：requestProjectReminder 的 reminderPolicy 参数【纯粹是函数调用
 * 时的临时参数】，从来没有被持久化在 Project 行上——唯一真实调用
 * （36_Tests_Sprint3Acceptance.js:271）传的是 { offset_minutes: 1440 }，
 * 只有一个偏移量，没有任何到期时间锚点。就算 Reminder OS 今天就建好
 * 一个完美的消费者，"读取 Project 的权威到期数据"这一步在当前 schema
 * 下无字可读。
 *
 * 这不是 Reminder OS 这一侧的缺口，也不是"消费者没写好"——是 Personal
 * Life OS 的 Project/Workflow 实体本身还没有到期时间概念。这是一个
 * 独立于本次评审题目的、更前置的 schema 问题，见第六、七节的处理。
 */

// ---- H. Reminder OS 是否已有读取其它 Domain OS 的机制 ----

/**
 * 已确认（21_SheetUtils.js:120-128，Reminder-main）：
 *
 *   var id = SecureConfig.getKey('SPREADSHEET_ID');
 *   ...
 *   var sheet = SpreadsheetApp.openById(id).getSheetByName(sheetName);
 *
 * 这跟 Personal-Life-main 自己的 05_SheetUtils.js:97-106 用的是同一个
 * 单一 key（"要设成跟 Core 一样的值"）。也就是说 Reminder OS、
 * Personal AI Core、Personal Life OS 三个独立 GAS 项目今天打开的是
 * 【同一张物理 Spreadsheet】，不是三张各自独立、需要额外授权互通的表。
 *
 * 01_SecureConfig.js:9 出现过 SecureConfig.setKey('RIDER_OS_
 * SPREADSHEET_ID', ...) 这样的示例——这是 SecureConfig 这个 API
 * 本身用法的说明性示例（给未来"Rider OS 有自己独立 Spreadsheet"这类
 * 场景准备的通用能力），不是当前已经在用的实际 key；实际驱动
 * getPendingTasks() 的就是上面那个单一 SPREADSHEET_ID。这里做一次
 * 精确澄清，避免把示例代码误当成已实现机制。
 *
 * 结论：Reminder OS 读 Personal Life OS 的 Projects/Workflows 表，
 * 不需要任何新的跨项目授权配置——跟它今天读 Tasks 表是同一个
 * openById 调用，只是换一个 getSheetByName 参数。
 *
 * 但有一层现成的性能考量需要保留：22_QueryEngine.js 文件头
 * （line 9-50）记录过 2026-07-11 的一次审计教训——Reminder OS 更愿意
 * 读 Personal Life OS 自己维护的"只含当前活跃条目"的投影表
 * （ActiveTasks），而不是直接扫会无限增长的原始表（Tasks）。
 * Personal Life OS 侧目前【没有】等价的 ActiveProjects/
 * ActiveWorkflows 独立投影表——14_ProjectQueryEngine.js:124 的
 * getActiveProjects() 是这个项目自己进程内对 Projects 全表的实时过滤
 * 函数，不是一张单独维护、体量有界的表；而且 Reminder OS 目前跟
 * Personal Life OS 之间从未出现过"调用对方一个 QueryEngine 函数"这种
 * 跨项目函数调用关系（两边全部的既有集成手段都是"共享 Spreadsheet
 * 直接读表"，jarvis.md 记录的"Apps Script Library integration"是
 * 平台层面的泛化描述，Reminder OS↔Personal Life OS 这一对关系目前
 * 具体的实现不是 Library 调用）。以 Carson 个人使用规模判断，Project/
 * Workflow 数量大概率远小于 Task 数量，这层优化目前不构成阻塞项，
 * 但值得在第七节明确记成"未来如果需要，走 ActiveTasks 同款模式"，
 * 不是这次顺手做。
 */

// ---- I. 治理相关的既有 ADR ----

/**
 * 直接核实过的（已打开原文件）：
 *
 *   Reminder-main ADR-003（00_ADR_003_Reminder_OS_V2_Vision_Evaluation.js，
 *   line 1-90，STATUS: Proposed）——评估一个 7 引擎/10 schema 概念/8
 *   Domain OS 集成/11 事件类型的宏大 V2 构想，结论明确是"不要现在为
 *   还不存在的需求预先建"，只建议先做 Temporal Engine（已完成）。这条
 *   直接支持本文档"不重启 V2、只补一个具体缺口"的范围界定。
 *
 *   Personal-Life-main ADR-2026-07-24-012（00_ADR.js:337-390，
 *   STATUS: Accepted，2026-07-24，"Domain is Producer, Execution is
 *   Consumer"）——原则："Domain 永远是 Producer……不主动推送、不关心
 *   消费方怎么用；消费方永远是 Consumer……不拥有任何 Business State，
 *   也不修改 Domain State"，消费方只允许保存 Reference，不允许复制
 *   Domain Entity 完整内容。这条虽然是为 Life Execution OS 写的，但
 *   原则本身跟"Reminder OS 该怎么消费 Personal Life OS 的数据"是
 *   同一个形状的问题，可以直接借用（见第五节）。
 *
 *   00_Domain_Boundary.js「六」（line 208-215，Personal-Life-main）——
 *   现有的 Reminder OS 边界文本，原样引用见第一节 A。「Schema
 *   Authority」矩阵里有一行"Reminder Rule | Domain（本项目）"
 *   （line 88）——这条对第四节 A（Ownership）的判断很关键：Personal
 *   Life OS 自己的治理文档已经把"Reminder Rule"判给 Domain 侧所有，
 *   这里的"Reminder Rule"应理解为"要不要提醒、按什么策略"这个业务
 *   决定本身，不是 Reminder OS 内部的调度/执行状态（ReminderRules/
 *   Occurrences/History 三张表）——第四节 B 会把这两者明确分开。
 *
 *   20_ReminderEngine.js 文件头引用、但本次未独立打开原文件核实的：
 *   ADR-004（Temporal Engine 设计，被引用为"提前N天/N小时提醒"逻辑
 *   明确排除在 Temporal Engine 范围外，属于 ReminderEngine 自己）、
 *   ADR-006（Reminder Policy Override，line 40-51 引用其决定"只在
 *   首次物化生效、不引入持续 Rebuild"，正是第三节 F 提到的
 *   "immutable" 决定 #2 的出处）、ADR-007（Unified Reminder Engine，
 *   line 1-38 引用，V1/V2 合并的完整决策）、ADR-002（Audit Fixes，
 *   line 704-726 引用，"跨项目并发无法用 LockService 解决"这条平台级
 *   限制的既有结论，评估过两个修复方向都因为需要跨三个项目协调而
 *   放弃，记录进"已知问题"而不是假装修好——这条处理方式本身是第七、
 *   九节要沿用的先例）。这几条都是"被引用"而非本次独立打开原件核实，
 *   如实标注，不冒充一手证据。
 *
 *   Personal-Life-main ADR-2026-07-17-009（Reminder Policy 透传模式）
 *   被 00_Domain_Boundary.js「六」引用，但当前上传的 00_ADR.js 全文
 *   grep 不到这个编号——可能是更早期"Productivity OS"阶段的 ADR 没有
 *   被带进当前这份 00_ADR.js。本次未能独立核实其内容，如实记录，不
 *   代表这条决策不存在，只代表本次评审拿不到它的原文。
 */

// ============================================================================
// 二、问题的精确定义（Define the exact problem）
// ============================================================================

/**
 * 现在能工作的：
 *   Task 级提醒——从 Task 创建、到 reminder_policy 解析、到期时间解析、
 *   规则生成、幂等发送、取消、重新排期——完整闭环，两侧代码、既有测试
 *   （50_ReminderEngine_Tests.js）都能对上。
 *
 *   REMINDER_REQUESTED 事件本身的"发布"半边——ReminderConnector 两个
 *   函数按契约正确构造 payload、正确调用 EventBus.publish，Sprint 3
 *   Acceptance Gate 能验证这半边行为正确。
 *
 * 目前缺失的（需要拆成两条，因为严重程度完全不同，见第零节的澄清）：
 *
 *   (1) entity_type: 'TASK' 路径（即"WorkflowStepReminder"）——
 *       Reminder OS 没有任何代码读 REMINDER_REQUESTED 事件（全仓库
 *       grep "REMINDER_REQUESTED"/"entity_type"/"EventType" 排除测试
 *       文件后零命中）。但 Reminder OS 已经有完整的 Task 处理能力，
 *       缺的只是"从事件触发注册"这一层，不缺任何底层能力。
 *
 *   (2) entity_type: 'PROJECT' 路径——Reminder OS 同样没有消费者；
 *       而且即使有，Project 实体本身也没有可供解析的到期时间字段
 *       （第一节 G），这是比"没有消费者"更前置的缺口。
 *
 *   此外，两条路径目前都【没有任何生产环境调用方】——不是"请求发出去
 *   没人接"，而是"请求这件事本身在真实使用路径里还没被触发过"，唯一
 *   触发过它的是 Sprint 3 Gate 测试。
 *
 * 可观察到的后果：
 *   今天，不管从哪个方向看，用户都感知不到任何 Project/Workflow 级
 *   提醒——因为(a)没有 UI/业务逻辑真正调用 request*Reminder，(b)就算
 *   调用了，Reminder OS 也不会处理。唯一的实际痕迹是 Sprint 3 Gate
 *   每次跑在真实环境时，会往共享 Events 表多写一行没人会再读的
 *   REMINDER_REQUESTED 记录（数据层面的轻量"垃圾"，不影响任何正确性，
 *   但值得知道）。
 *
 * 没有坏的：
 *   Task 级提醒的全部现有行为——本次评审的任何建议都不应该触碰这条
 *   已经工作、已经被测试覆盖的路径。ReminderConnector 已交付的格式
 *   转换逻辑本身没有 bug，问题不在"发布方做错了什么"，而在"消费方
 *   和更前置的 schema 都还没跟上"。不应该把这个问题描述成"Personal
 *   Life OS 违反了自己的契约"——它完全按契约做的（只发布，不关心
 *   后续），这本来就是既定设计。
 */

// ============================================================================
// 三、候选架构评估（Evaluate candidate architectures）
// ============================================================================

/**
 * ---- Model A：事件作为"登记信号"（Registration Signal）----
 *
 * Reminder OS 收到 REMINDER_REQUESTED 后，不把事件payload当权威数据，
 * 而是拿 entity_id（+ entity_type）去共享 Spreadsheet 里读该实体的
 * 权威行（Projects/Workflows 或 Tasks），登记/更新一条内部
 * ReminderRule，之后的到期时间判断、发送、取消、重排期全部复用
 * checkOffsetReminders 现有主循环。
 *
 * 这跟 Task 级 precedent（第一节 C）在"到期时间必须临时读、不能存
 * 快照"这一点上完全一致——唯一的区别是"登记"这个动作从"每轮 poll
 * 时自动从 task.reminder_policy 发现"变成"由一次显式事件触发"。
 *
 * ---- Model B：事件携带完整快照（含 due_datetime/policy/title）----
 *
 * REMINDER_REQUESTED 的 payload 直接扩充到期时间等全部信息，
 * Reminder OS 消费事件后不再回读 Domain 实体。
 *
 * ---- Model C：Reminder OS 直接轮询/扫描 Projects 和 Workflows ----
 *
 * 不需要任何事件驱动的注册——Reminder OS 每轮直接读 Projects/
 * Workflows 全表，跟今天读 Tasks 表一样。
 *
 * ---- Model D：专用 Reminder Connector / API 契约 ----
 *
 * Reminder OS 暴露一个显式的注册/同步接口，Personal Life OS 通过某种
 * 跨项目调用机制（Library 依赖或类似）主动调用它，而不是通过共享
 * Events 表被动等待。
 *
 * 四个模型的逐项分析见下一节；本节不单独展开，避免和第四节重复。
 */

// ============================================================================
// 四、逐模型的九维分析（A-I）
// ============================================================================

/**
 * ---- A. Ownership（谁拥有 Project/Workflow/due_datetime/
 *         reminder_policy/reminder schedule/reminder execution state）----
 *
 * 不论选哪个模型，以下几条由第一节的证据直接决定，不因模型而变：
 *   - Project、Workflow 本身（标题、状态、层级关系等）：Personal Life
 *     OS 所有，Domain（本项目）——00_Domain_Boundary.js 的 Schema
 *     Authority 矩阵明文。
 *   - "是否要提醒、用什么策略"这个业务决定（reminder_policy 的值）：
 *     矩阵里"Reminder Rule | Domain（本项目）"这一行——所有权在
 *     Personal Life OS，不在 Reminder OS。
 *   - reminder schedule / reminder execution state（哪个 fire_at 已经
 *     处理过、有没有在 retry、发送历史）：这些是 ReminderRules/
 *     Occurrences/History 三张表，物理上就建在 Reminder OS 自己的
 *     Spreadsheet 读写范围内（虽然是同一张共享 Spreadsheet，但这三张
 *     表只有 Reminder OS 写），事实上的所有权在 Reminder OS。
 *   - due_datetime 本身（Task 已有该字段；Project/Workflow 目前没有）：
 *     一旦 Project/Workflow 获得该字段，所有权同样在 Personal Life
 *     OS——这是 Domain 业务数据，不因为 Reminder OS 要读它就转移所有权。
 *
 * Model A/C 都不改变这个所有权划分——只是"谁在什么时机去读"的区别。
 * Model B 会在事实上制造第二个 due_datetime 副本（存在事件 payload
 * 里，脱离 Personal Life OS 表的实时状态），事实所有权变得含糊——
 * 见 B 项。Model D 不改变逻辑所有权，但会让 Reminder OS 拥有一个
 * Personal Life OS 从未主动调用过的"合约提供者"身份，责任边界比现在
 * 更重。
 *
 * ---- B. Source of Truth（Domain 业务数据 vs Reminder 调度状态）----
 *
 * Model A：干净地维持两者分离——due_datetime/policy 永远从 Personal
 * Life OS 的表里现读现算；fire_at/occurrence/history 永远只在
 * Reminder OS 自己的三张表。这跟 Task 级 precedent（第一节 C、D）
 * 逐字一致。
 *
 * Model B：due_datetime 一旦被写进事件 payload，就产生了一份脱离
 * Personal Life OS 表的副本——Personal Life OS 那边到期时间变了，
 * 除非再发一次新事件，Reminder OS 手里那份不会跟着变。这正是 Track 1B
 * （Due-Date Canonicalization）和 2026-07-15 那次 resolved_fire_ats
 * 修复两次分别解决过的同一类问题（"缓存的到期时间不可信，必须现读"）
 * ——Model B 会把已经修过两次的问题重新引入一次。
 *
 * Model C：跟 Model A 相同（现读现算），只是触发方式不同。
 *
 * Model D：取决于 API 契约怎么设计——如果 Reminder OS 的注册接口只
 * 接受 entity_id 再自己回读，等价于 Model A 的语义；如果接口直接接受
 * 完整 due_datetime，等价于 Model B 的语义连同它的问题。
 *
 * ---- C. Event 语义（REMINDER_REQUESTED 到底是 command / event /
 *         registration signal / synchronization signal）----
 *
 * 如实描述现状（不重新定义）：今天这个事件的语义是"未定义生效"——它被
 * 发布（一次性、无重试、无消费确认），但没有任何一方读它，所以它既不
 * 是正在生效的 command，也不是正在生效的 registration signal，只是一条
 * 写进共享 Events 表、格式正确但无人处理的记录。
 *
 * 本文档第六节推荐把它明确定义为 registration signal（Model A 的
 * 定义）——"请把这个 entity_id 纳入你的提醒登记表，用这个 policy"，
 * 不是 command（不要求立即执行动作），也不是携带完整数据的
 * synchronization snapshot（Model B 那种语义）。
 *
 * ---- D. Idempotency（同一事件收到两次会怎样）----
 *
 * 现状（第一节 B）：EventBus.publish 完全没有用 identity 参数去重，
 * ReminderConnector 调用时也没传。如果 Reminder OS 的消费者单纯"看到
 * 一条 REMINDER_REQUESTED 就 push 一条新 ReminderRule"，同一个
 * entity_id 被请求两次会产生两条重复规则、重复提醒。
 *
 * Model A/C 下推荐的解决方式：不依赖事件本身的幂等性，而是在
 * "登记"这一步按 entity_id（Task 路径可以复用现成的
 * task_id 去重逻辑；Project 路径需要新增等价的 project_id 去重逻辑）
 * 做 upsert，不是每次都 push 新行——这跟 taskIdsWithRules 现有的处理
 * 方式（同一个 task_id 在一轮内只生成一次）是同一个模式，是本文档
 * 推荐复用而不是新发明的部分。
 *
 * ---- E. Updates（due date 变化 / priority 变化 / reminder_policy
 *         变化 / Project 完成或取消 / Workflow 完成或取消）----
 *
 * 完成/取消：Task precedent 的"离开 pending 集合即视为取消"（第一节
 * F）可以直接套用到 Project/Workflow——只要 Reminder OS 判断
 * "这个 entity_id 现在还查得到、且状态仍然是活跃状态吗"，不需要认识
 * Personal Life OS 完整的 Canonical Entity Lifecycle 状态机（DRAFT/
 * READY/IN_PROGRESS/.../CANCELLED 等）——只需要一个"activity 判定"。
 *
 * due date 变化：一旦 Project/Workflow 有了 due_datetime 字段，
 * resolved_fire_ats/effectiveDue 比较机制（第一节 F）可以原样复用。
 *
 * reminder_policy 变化：这里 Model A 会有一个需要 Carson 明确确认的
 * 后果——Task 级现有决定 #2 是"reminder_policy 创建后不可变"（第一节
 * C）。如果 requestWorkflowStepReminder 这条事件路径生效，等于给了
 * 一条"创建后修改 Task 提醒策略"的新通道，事实上部分推翻/扩展了决定
 * #2。这不是本文档偷偷决定的，是采用 Model A 后必然产生的后果，第六
 * 节会明确点出、交给 Carson 确认是否接受。
 *
 * ---- F. Failure recovery（event 发出但消费者不可用 / 消费者收到但
 *         Domain 读取失败 / 实体已不存在 / 提醒已存在 / 提醒已过期）----
 *
 * event 发出但消费者不可用：Events 表本身是持久化的（append-only），
 * Reminder OS 下次轮询时仍然能读到——只要消费逻辑设计成"扫描未处理过
 * 的事件"而不是"实时订阅"，这类失败天然可恢复，不需要额外设计。
 *
 * 消费者收到但 Domain 读取失败（entity_id 查无此行）：应该沿用
 * Reminder OS 现有的"缺失即视为不再活跃"处理惯例（第一节 F 的
 * !task 分支）——不生成规则，不报错阻塞整轮处理，只在 log 里留痕。
 *
 * 提醒已存在（重复登记）：见上面 D 的幂等设计。
 *
 * 跨项目并发（多个项目同时写共享表）：20_ReminderEngine.js:704-726
 * 已经明确记录这是平台级限制（GAS LockService 不跨 standalone 项目
 * 生效），评估过两个修复方向后都因为需要三个项目协同才放弃，记录进
 * 「已知问题」而不是假装修好。Project/Workflow 路径继承同一个既有
 * 结论，不需要在本文档重新解决一遍。
 *
 * ---- G. Cross-OS boundary（确认 Reminder OS 不会变成 Personal Life
 *         OS 业务状态的所有者）----
 *
 * Model A/C 都不会——Reminder OS 只读 Project/Workflow 的权威行，
 * 从不写。现有的唯一写回例外（reminder_count/last_reminder_at 两个
 * 字段，第一节 C）目前只对 Tasks 生效；本文档不建议不假思索地把同一
 * 例外扩展到 Projects/Workflows——如果需要类似的"提醒次数"统计，应该
 * 作为一条独立的、需要 Carson 明确批准的决定，不是这次顺带做。
 *
 * Model D 如果设计成"Reminder OS 自己维护一份 Project 的注册状态并
 * 反过来通知 Personal Life OS"，边界会比 A/C 更模糊，需要格外小心。
 *
 * ---- H. Migration / implementation cost ----
 *
 * TASK 路径（Model A）：新增一个 Events 表消费者（需要 Reminder OS
 * 自己维护一个"读到哪儿了"的游标/水位，因为 Events 是跨项目共享、
 * 只追加的表，不能重复处理，也不能干扰 Personal Life OS 自己对同一张
 * 表的读取节奏）；ReminderRules 表不需要改 schema（task_id 字段直接
 * 复用，因为这条路径的 entity_type 就是 TASK）；新增一层
 * entity_id 幂等 upsert；新增回归测试。成本：中等偏小，且完全落在
 * Reminder OS 一个项目内，不需要 Personal Life OS side 任何改动。
 *
 * PROJECT 路径（Model A）：除了上面这些，还需要（a）Personal Life OS
 * 先给 Project（以及如果要支持"整个 Workflow 实例"，Workflow）加一个
 * due_datetime 类字段——这是一个独立于本次评审、需要 Carson 单独拍板
 * 的 schema 决定；（b）ReminderRules 需要能表达 entity_type + entity_id
 * 而不是写死 task_id——这是需要新增列或新建一张结构相似的表的选择，
 * 本文档倾向于"新建一张 ReminderRules 结构一致但独立的表处理非-Task
 * entity"而不是改动已经有真实生产数据、被 Task 路径依赖的现有表，
 * 具体见第七节。成本：明显更高，且卡在一个本文档职责外的前置决定上。
 *
 * Model B 除了上面的成本外，还需要 Personal Life OS 在 Project/
 * Workflow 的 due_datetime（未来）每次变化时都重新发布事件——现有
 * ProjectEngine.js/WorkflowEngine.js 完全没有这类"变更即发布"的钩子，
 * 需要额外新增，成本比 A 更高，且会长期背负"事件和数据不同步"的
 * 维护负担。
 *
 * Model C 需要 Carson 重新批准修改 00_Domain_Boundary.js「六」的
 * 既有文本，且会让已交付、已测试的 ReminderConnector/Sprint 3 Gate
 * 变成没有实际作用的代码——需要额外决定"是否连带废弃它们"。
 *
 * Model D 成本最高——需要新建一种目前两个项目之间完全不存在的跨项目
 * 调用机制（Library 依赖或类似），且需要重新评审现有
 * "只发布不调用"边界决定本身。
 *
 * ---- I. Future extensibility（Property/Procurement/Inventory/
 *         Investment/Compliance OS）----
 *
 * Model A 的可扩展性最好——"发布 REMINDER_REQUESTED（entity_type +
 * entity_id + policy）→ Reminder OS 回读对应 Domain OS 的权威数据"
 * 这个形状不要求 Reminder OS 认识任何 Domain OS 的内部实现，只要求
 * 未来每个新 Domain OS 都：①共用同一张 Spreadsheet（或按
 * SecureConfig 现成的多 Spreadsheet key 模式注册自己的 ID）、②有一个
 * 可解析的到期时间字段。这跟 Personal Life OS 被定位为"未来 Domain OS
 * 家族的 Canonical Reference Implementation"这件事完全对齐。
 *
 * Model B 的可扩展性差——每个新 Domain OS 都需要各自实现"字段变化即
 * 重新发布完整快照"的逻辑，且都会各自继承同一类"快照过期"风险。
 *
 * Model C 的可扩展性中等——要求 Reminder OS 逐个认识每个新 Domain OS
 * 的表结构去直接扫描，不经过任何统一的登记步骤，长期会让 Reminder OS
 * 内部的"Domain 专属读表逻辑"越堆越多。
 *
 * Model D 的可扩展性取决于 API 设计质量，但会给每个新 Domain OS 都
 * 增加"必须实现调用 Reminder OS API"这一新增依赖，比"发一个到共享
 * Events 表的事件"耦合更紧。
 */

// ============================================================================
// 五、既有先例的适用（Apply existing precedent）
// ============================================================================

/**
 * 1. Task 级 Reminder OS 集成（第一节 C/D/E/F）——Model A 本质上就是
 *    "把这套已经工作、已经测试过的机制，从"每轮 poll 时自动发现
 *    reminder_policy"扩展成"也可以由一次显式事件触发注册"，复用同一套
 *    到期时间解析、幂等、取消、重排期逻辑。
 *
 * 2. Domain Producer / Execution Consumer 边界（ADR-2026-07-24-012，
 *    第一节 I）——原则"Producer 不主动推送、不关心消费方怎么用；
 *    Consumer 不拥有 Business State、不修改 Domain State、只允许保存
 *    自己的 Reference/调度状态"跟本文档推荐的 Model A 逐条对应：
 *    Personal Life OS 发布事件后不关心 Reminder OS 怎么处理（现状
 *    已经是这样）；Reminder OS 只维护自己的 ReminderRules/
 *    Occurrences/History，不复制 Project/Workflow 的完整内容，不
 *    反向修改 Personal Life OS 的表（唯一既有例外目前不建议扩展，
 *    见第四节 G）。这不是本文档发明的新模式，是把平台已经批准过一次
 *    的原则套用到第二个类似场景。
 *
 * 3. Dashboard ownership 判断原则（"归属看数据本身，不看哪个界面
 *    展示它"）——同一逻辑适用在这里："Reminder Rule"这个业务概念归
 *    Domain 所有，不因为 Reminder OS 是"负责真正发提醒的那个模块"就
 *    转移所有权，这条已经在 Schema Authority 矩阵里明文（第一节 I）。
 *
 * 4. 既有 Reminder OS ADR（004/006/007，第一节 I）——都支持"到期时间
 *    解析、policy 覆盖、Pre-Due/Overdue 两阶段"这套现有机制原样复用，
 *    不需要重新设计。
 *
 * 5. EventBus / 跨 OS 集成模式——现状已经是"共享 Spreadsheet 多项目
 *    直接读表"（不是 Library 调用），Model A 延续这个已经在用、已经
 *    验证过的具体机制，不引入新的集成方式。
 *
 * 结论：不需要为这个问题发明新模式——Model A 是"已批准的 Producer/
 * Consumer 原则"+"已验证的 Task 级具体机制"两者的直接组合，不是
 * 全新设计。
 */

// ============================================================================
// 六、推荐（Recommendation）
// ============================================================================

/**
 * 推荐 Model A（事件作为登记信号），对 entity_type: 'TASK' 和
 * entity_type: 'PROJECT' 两条路径给出同一个模型形状，但明确标注差异化
 * 的可实现程度（见下方 Selected model 的两个子条目）。
 *
 * 1. Selected model：Model A——REMINDER_REQUESTED 只作为登记信号，
 *    Reminder OS 收到后回读 entity_id 对应的权威行，never 把 payload
 *    里的 policy 之外的字段当作事实来源。
 *
 * 2. 直接证据支持：
 *    - Task 级 precedent（第一节 C/D/F）证明这套"现读现算 + 幂等
 *      + 离开 pending 集合即取消 + effectiveDue 变化即重排期"机制
 *      已经在生产环境跑通、已经通过两轮外部审计。
 *    - Reminder OS/Personal Life OS 已经共享同一张 Spreadsheet
 *      （第一节 H），Model A 不需要任何新的跨项目授权。
 *    - ADR-2026-07-24-012（第一节 I）已经批准了同一形状的
 *      Producer/Consumer 原则。
 *
 * 3. 第四节 A-I 里驱动这个决定的具体发现：
 *    - B/D 两项：Model B 会重新引入 Track 1B + 2026-07-15 两次修过的
 *      "到期时间缓存过期"问题类别，Model A 不会。
 *    - H 项：Model C 需要重新批准并修改已有的
 *      00_Domain_Boundary.js「六」文本，且会让已交付的
 *      ReminderConnector 变成无用代码；Model D 需要新建目前完全不
 *      存在的跨项目函数调用机制，且需要重新评审"不直接调用 Reminder
 *      OS 任何函数"这条既有边界决定本身，两者都比 A 的改动面大得多。
 *    - I 项：Model A 对"未来还有 Property/Procurement/... OS"这件事
 *      的扩展性最好，跟 Personal Life OS 的 Canonical Reference
 *      Implementation 定位对齐。
 *
 * 4. 明确放弃的东西（trade away）：
 *    - 不追求"事件本身自带完整数据、消费端零回读"的实现简便性（Model
 *      B 的卖点）——用一次额外的 Spreadsheet 读换取到期时间永远新鲜、
 *      不会跟 Track 1B 那类 bug 再撞一次。
 *    - 不追求"Reminder OS 单一轮询模型、不需要处理事件"的概念统一性
 *      （Model C 的卖点）——用"需要维护一个事件游标"的额外复杂度，
 *      换取不用重新开一次"要不要允许 Reminder OS 无差别扫描 Personal
 *      Life OS 的表"这个更大的架构讨论。
 *
 * 5. 被拒绝方案为什么更差（已在第四节逐项展开，此处只总结）：
 *    Model B——制造第二个到期时间副本，重新引入已修过的 bug 类别。
 *    Model C——需要推翻既有边界文本，废弃已交付代码，且并没有真的
 *    绕开"Project 需要 due_datetime 字段"这个前置缺口。
 *    Model D——改动面最大，需要新建跨项目调用机制，且没有证据表明
 *    现有的"只发布事件"边界已经不够用（没有找到任何 disconfirming
 *    evidence 支持推翻它）。
 *
 * 6. Falsifiability / reopening 条件：
 *    如果未来出现以下任一情况，本条建议应该被重新评审，而不是本文档
 *    自己预留一个"以后再说"的模糊出口：
 *      - Project/Workflow 数量增长到 Reminder OS 单纯"回读 Domain
 *        权威行"这一步本身成为可观测的性能瓶颈（对照第一节 H 提到的
 *        ActiveTasks 优化教训，那时候应该走同一模式，不是重新设计）；
 *      - 出现真实需求要求"提醒请求发出的瞬间就要有同步确认/报错反馈"
 *        （比如"这个 Project 还没有到期时间，请求被拒绝"需要立刻让
 *        用户看到）——这种同步语义是 Model A 目前不提供的，届时才是
 *        重新评估 Model D 的合理时机；
 *      - 未来某个新 Domain OS 不与 Reminder OS 共享同一张 Spreadsheet
 *        （第一节 H 的前提被打破），需要重新评估读取机制本身。
 *
 * 7. 确认：本建议不会把 Project/Workflow 的业务数据所有权转移给
 *    Reminder OS——Reminder OS 只新增读权限（跟读 Tasks 表同一性质），
 *    不新增任何写权限；Project/Workflow 本身、以及"要不要提醒"这个
 *    业务决定，所有权始终在 Personal Life OS（对应 Schema Authority
 *    矩阵"Reminder Rule | Domain（本项目）"这一行，第一节 I）。
 */

// ============================================================================
// 七、实现边界（Implementation boundary）
// ============================================================================

/**
 * ---- Required now（如果 Carson 批准 Model A，这一批可以现在做）----
 *
 * 范围仅限 entity_type: 'TASK' 路径（即 requestWorkflowStepReminder
 * 这条线，第零节澄清过它实际操作的是 Task 实体）：
 *
 *   (a) Reminder OS 新增一个 REMINDER_REQUESTED 消费者——需要自己
 *       维护"处理到哪一行 Events"的水位（不能重复处理，也不能因为
 *       Events 表是共享的就干扰 Personal Life OS 自己对它的读取）。
 *   (b) 按 entity_id（此路径即 task_id）做幂等 upsert，不是每次都
 *       push 新规则行——复用 taskIdsWithRules 现有的"同一个 key 只
 *       处理一次"模式。
 *   (c) 明确记录并让 Carson 确认一条后果：这条路径事实上允许"创建后
 *       修改 Task 的提醒策略"，是对既有决定 #2（reminder_policy
 *       不可变）的一次有意识的扩展，不是意外——需要 Carson 明确点头，
 *       不能默认通过。
 *   (d) 新增回归测试，覆盖：事件触发的注册、重复事件的幂等、Task
 *       完成/取消后的取消级联（复用离开 pending 集合即取消的现有
 *       逻辑）、到期时间变化后的重新排期。
 *   (e) 确认现有 50_ReminderEngine_Tests.js 和 Sprint 3 Acceptance
 *       Gate 保持全绿，不因这次改动回归。
 *
 * ---- Explicitly deferred（明确不在这次做）----
 *
 *   - entity_type: 'PROJECT' 路径的实现——卡在一个更前置、独立的
 *     决定上：Personal Life OS 是否要给 Project（以及如果需要，
 *     Workflow 整体）新增 due_datetime 类字段，字段名/语义是什么。
 *     这条应该作为一个独立的 Personal Life OS 侧 schema 决定单独
 *     提给 Carson，本文档不代为决定，也不假设它一定要加。
 *   - ReminderRules 是否需要从"写死 task_id"改成"entity_type +
 *     entity_id"通用 schema，还是为非-Task entity 新开一张结构相似
 *     的独立表——这个选择本身建议等 Project 的 schema 决定有了结果
 *     之后再定，现在决定为时过早（第四节 H 已展开两种选择各自的
 *     成本，此处不重复）。
 *   - ActiveProjects/ActiveWorkflows 投影表——第一节 H 提到的性能
 *     优化模式，目前规模下不构成阻塞，留到真的需要时再照 ActiveTasks
 *     的路子做。
 *   - Quiet Hours、多 channel、Overdue 阶段的任何调整——不在本次范围。
 *   - ADR-003 的七引擎 V2 构想——继续 Proposed 搁置，本文档不重启。
 *   - 00_Domain_Boundary.js「六」的文字——Model A 不需要修改它（该
 *     文本约束的是"Personal Life OS 是否直接调用 Reminder OS 函数"
 *     这个方向，跟"Reminder OS 读共享表"是不同方向，见第一节 I 的
 *     精确澄清），不建议现在动它。
 */

// ============================================================================
// 八、验收标准（Acceptance Gate，建议）
// ============================================================================

/**
 * 如果 Carson 批准 Model A 并进入"Required now"范围的实现，建议的
 * 验收 Gate 覆盖（沿用这个项目一贯的"单一入口函数跑全部断言"惯例）：
 *
 *   □ 架构契约：消费者只读 entity_id 对应的权威行，不把事件 payload
 *     里除 policy 外的字段当到期时间来源（静态代码检查 + 单测双重
 *     确认）。
 *   □ Ownership：Reminder OS 对 Tasks 表的写权限仍然只限于
 *     reminder_count/last_reminder_at 两个既有字段，本次改动不新增
 *     任何写路径。
 *   □ Event 语义：同一个 entity_id 被请求两次不产生两条独立规则
 *     （幂等 upsert 验证）。
 *   □ Idempotency：同一条 Events 行被消费者重复读到（比如水位机制
 *     出错重跑）不产生重复副作用。
 *   □ Update 处理：due date 变化触发重新排期、Task 完成/取消触发
 *     取消级联，两条各自独立测试用例覆盖（可直接仿照现有场景 F/
 *     task_no_longer_pending 分支的测试写法）。
 *   □ 完成/取消处理：验证"离开 pending 集合"这条既有判定逻辑对这条
 *     新路径同样生效，不需要重新认识 Personal Life OS 的完整状态机。
 *   □ 失败恢复：entity_id 查无此行时不报错阻塞整轮处理，只留痕。
 *   □ 回归安全：50_ReminderEngine_Tests.js 与 Sprint 3 Acceptance
 *     Gate 全部保持通过，不因本次改动出现新的失败。
 *   □ 跨 OS 边界：确认 Reminder OS 没有获得任何指向 Projects/
 *     Workflows 表的写权限（本批范围内这两张表根本不涉及，此项此刻
 *     应为"不适用"，留作 Project 路径未来实现时的检查项）。
 *   □ 决定 #2 的扩展：Carson 已明确确认接受"Task 提醒策略可通过事件
 *     渠道创建后修改"这条后果（第七节 c 项），作为本 Gate 的前置
 *     确认项，不是技术测试项。
 */

// ============================================================================
// 九、治理（Governance）
// ============================================================================

/**
 * 本文档目前的状态：Review。在此之前的九节全部是评审内容，不构成
 * 任何已批准的架构决定。
 *
 * 如果 Carson 批准第六节的 Model A 推荐，建议：
 *
 *   1. 在 Reminder OS 自己的 00_ADR_00X 序列里新增一条 ADR（Reminder
 *      OS 现有 ADR 到 008 为止，建议编号 ADR-009，标题类似"Project/
 *      Task-typed REMINDER_REQUESTED 消费——Registration Signal 模型"，
 *      初始 STATUS 为 Proposed，Carson 明确批准后才改 Accepted——不
 *      在 Carson 批准前就写成 Accepted，沿用这个项目一贯"不假装已批准"
 *      的纪律（对照 ADR-2026-08-26-026 的先例：Proposed 就是
 *      Proposed，不提前包装成 Accepted）。
 *   2. 在 00_Domain_Boundary.js「六」追加一条【指向性】备注（不改写
 *      现有文字本身），说明"事件发布后由 Reminder OS 侧的 ADR-009
 *      定义消费方式"，让这份文档在"发布之后发生了什么"这一点上不再
 *      是历史上准确、但现在读起来不完整的状态。这条追加本身也需要
 *      Carson 批准后才执行，本文档不代为修改。
 *   3. entity_type: 'PROJECT' 路径的前置缺口（Project 需不需要
 *      due_datetime 字段）建议作为 Personal Life OS 侧【独立的一条】
 *      ADR 提出，不合并进 ADR-009——这是两个不同项目、不同 Schema
 *      Authority 范围内的决定，混在一起会让"谁批准了什么"变得不清楚。
 *   4. 本文档本身不修改任何既有 ADR，不冒充 Stable——第六、七节的
 *      建议在 Carson 明确批准、且 Required now 范围的实现经过第八节
 *      验收 Gate 验证之前，都停留在"Proposed"这一层。
 */

// ============================================================================
// 最终报告（按 Carson 要求的 9 点结构汇总，全部指向上方对应章节）
// ============================================================================

/**
 * 1. Current factual baseline        — 第一节 A-I
 * 2. Architecture gap                — 第二节（分两条：TASK 路径缺
 *                                       消费者；PROJECT 路径缺消费者
 *                                       且缺前置 schema）
 * 3. Candidate models                — 第三节 A/B/C/D
 * 4. Recommendation                  — 第六节：Model A
 * 5. Trade-offs                      — 第六节第 4 条 + 第四节逐项
 * 6. Reopening condition             — 第六节第 6 条
 * 7. Minimum implementation scope    — 第七节（Required now 仅
 *                                       entity_type: TASK 路径；
 *                                       PROJECT 路径 explicitly
 *                                       deferred，卡在 schema 前置
 *                                       决定上）
 * 8. Required ADR                    — 第九节：Reminder OS ADR-009
 *                                       （Proposed），Personal Life OS
 *                                       侧另开一条独立 ADR 处理 Project
 *                                       due_datetime schema 决定
 * 9. Acceptance Gate                 — 第八节
 *
 * 本文档到此结束。未对任何生产代码做出修改。等待 Carson 对第六节
 * 推荐、第七节范围划分、以及第七节 (c) 项（决定 #2 扩展的后果）的
 * 明确批准或修改意见后，再进入实现阶段。
 */
