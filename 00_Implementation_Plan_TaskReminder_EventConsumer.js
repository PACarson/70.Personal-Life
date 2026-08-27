/**
 * 00_Implementation_Plan_TaskReminder_EventConsumer.js
 * Reminder OS — REMINDER_REQUESTED（entity_type: TASK）事件消费层
 * 实现计划（Implementation Plan，非代码，供 Carson 批准后再动工）
 *
 * STATUS: Plan — Pending Review（本文档本身不是代码，也不是 ADR；是
 *         00_Architecture_Review_ProjectWorkflow_Reminder_Integration.js
 *         第六节 Model A 被批准后的下一步产物。未经 Carson 对本计划、
 *         尤其是第十三节那个开放决定的明确答复，不动一行生产代码。）
 * DATE  : 2026-08-27
 * SCOPE : 只覆盖 entity_type: 'TASK' 路径（即 requestWorkflowStepReminder
 *         这条线）。PROJECT 路径继续 explicitly deferred，本计划完全
 *         不涉及。
 */

// ============================================================================
// 零、范围确认（对照 Carson 批准意见逐条核对）
// ============================================================================

/**
 * 逐条确认本计划遵守的边界：
 *   ✅ 只做 TASK 路径的缺失消费层，不碰 PROJECT 路径。
 *   ✅ 不重新设计 Reminder Engine——checkOffsetReminders 主循环、
 *      _resolveEffectiveDueDatetime_、_computeIdempotencyKey_、
 *      resolved_fire_ats 重排期机制、离开 pending 集合即取消，全部
 *      原样复用，零改动。
 *   ✅ 不创建第二套 Task 提醒机制——新组件只负责"确保 ReminderRules
 *      表里有正确的行"，真正的调度/发送/取消/重试仍然是
 *      checkOffsetReminders 这一套，不新建平行的调度器。
 *   ✅ 不把 Task 业务数据复制进 Reminder OS 长期持有——新组件读到的
 *      Task 字段只用于当次登记判断，不额外新建"Reminder OS 自己的
 *      Task 副本"表。
 *   ✅ 不改动 Task identity 契约（Carson 2026-08-27 批准意见明确要求）
 *      ——本次实现从未涉及 Personal Life OS 的
 *      generateTaskIdentity()/scopeKey，task_id 只被当作普通查找 key
 *      使用，不重新推导、不重新定义任何身份语义。
 *   ✅ 不重启 V2/七引擎/全局 Reminder Rule 存储重设计/Task 提醒重设计/
 *      Project deadline schema/其它 Domain OS 集成——本计划的改动面
 *      严格限定在第二节列出的文件范围内。
 *   ✅ 不新增任何生产调用方（不在 Personal-Life-main 的 TaskEngine/UI
 *      里新增调用 requestWorkflowStepReminder 的地方）——这条第五节会
 *      展开说明为什么，也会明确指出这意味着什么。
 */

// ============================================================================
// 一、现状准确记录（对应 Carson 批准意见第 5 点）
// ============================================================================

/**
 * 不把这次集成描述成"已经部分上线"。准确的现状是：
 *
 *   Producer（43_ReminderConnector.js 的 requestWorkflowStepReminder）
 *   ：存在，格式正确，Sprint 3 Acceptance Gate 验证过它能正确发布
 *   entity_type: 'TASK' 的 REMINDER_REQUESTED 事件。
 *
 *   生产调用方：不存在。全仓库 grep 确认，唯一调用点是
 *   36_Tests_Sprint3Acceptance.js:271。Personal Life OS 目前没有任何
 *   TaskEngine/UI 代码路径会在真实用户操作下触发这个函数。
 *
 *   Consumer（Reminder OS 侧）：不存在。全仓库 grep "REMINDER_REQUESTED"
 *   排除测试文件后零命中。
 *
 * 也就是说，本计划完成后，技术上"消费层"会补齐，但只要生产调用方
 * 这一环不存在，entity_type: 'TASK' 的 REMINDER_REQUESTED 事件在真实
 * 使用中仍然【不会被产生】——新消费层建好后能且只能通过类似 Sprint 3
 * Gate 那种直接调用 ReminderConnector 的测试验证其正确性，不会在真实
 * 用户操作下被触发。这不是本计划的缺陷，是范围内、范围外两件事：
 * "建消费层"和"给它接一个真实触发点"是两个独立决定，后者本计划不做，
 * 也没有被 Carson 的批准意见要求做——如果之后需要做，应该是 Personal
 * Life OS 侧一个独立的、需要单独批准的决定（比如"Edit Task 加一个
 * 修改提醒策略的入口"），不在本计划范围内顺带加上。
 */

// ============================================================================
// 二、涉及文件（Files to change / New files）
// ============================================================================

/**
 * 新增文件（1个，Reminder-main）：
 *
 *   23_ReminderRequestConsumer.js
 *   （编号建议——沿用 ADR-001 的 Domain OS Blueprint 分层，这是
 *    2.Runtime 层，紧接在 22_QueryEngine.js 之后、50 系列测试文件
 *    之前；如果 Carson 有不同的编号习惯，这个数字本身可以改，不影响
 *    下面的设计）
 *
 * 修改文件：
 *
 *   11_Setup.js —— 只新增一行触发器注册（下面第四节说明为什么建议
 *   独立触发器而不是塞进 checkOffsetReminders 现有触发器），不改动
 *   这个文件里任何既有函数的内部逻辑。
 *
 * 明确不改动的文件（避免任何误解）：
 *
 *   20_ReminderEngine.js —— 零改动。
 *   21_SheetUtils.js —— 零改动。
 *   02_EventBus.js —— 零改动（详见第四节，为什么不直接复用
 *   getEventsByType，以及为什么不需要改这个文件）。
 *   Personal-Life-main 任何文件 —— 零改动。
 */

// ============================================================================
// 三、复用的既有函数（Existing functions to reuse）
// ============================================================================

/**
 * 直接复用、不做任何修改：
 *
 *   SecureConfig.getKey('SPREADSHEET_ID')          （01_SecureConfig.js）
 *   SheetUtils.getSheet_ / getHeaderMap_             （21_SheetUtils.js）
 *   SheetUtils.batchUpsertRowsByKey_                 （21_SheetUtils.js:325）
 *   QueryEngine.getPendingTasks()                    （22_QueryEngine.js）
 *   ReminderEngine._resolveEffectiveDueDatetime_ 及其后续整条
 *     checkOffsetReminders 主循环 —— 新组件不直接调用这个私有函数
 *     （它在 IIFE 内部，本来就不对外暴露），而是通过"确保
 *     ReminderRules 表里有正确的行"这一层间接生效——下一次
 *     checkOffsetReminders 跑的时候，会像对待任何其它规则一样处理
 *     这条新规则，不需要新组件自己重新实现到期时间解析。
 *
 * 需要小心处理、不能直接复用的：
 *
 *   EventBus.getEventsByType()（20_EventBus.js:252-256——真正在生产环境
 *   生效的文件；02_EventBus.js 是 2026-07-06 按 Domain OS Blueprint
 *   改名迁移后遗留在仓库里、事实上已经不再生效的旧文件，20_ReminderEngine.js
 *   调用的 EventBus.publishBatch 只存在于 20_EventBus.js，这是在最终
 *   实现前逐字核对源码时才发现、并更正的一处引用——之前的评审草稿一度
 *   写成 02_EventBus.js，这里如实记录更正，不掩盖）——技术上"存在
 *   现成的按类型读事件"函数，但见第四节，这次不采用它，原因是它的
 *   实现（getAllEvents(), 20_EventBus.js:222-250）是对共享 Events 表
 *   【从第 2 行到 lastRow 整表读取】，且这张表是跨 Personal AI Core/
 *   Personal Life OS/Reminder OS 三个项目共同追加、只增不删的表
 *   （00_Project_Constitution.js:102 明确"没有任何 update/delete
 *   Event 的 API"）。如果直接复用它，等于把这一次会全表扫描的调用，
 *   第一次接进一个每 5 分钟跑一次的常驻触发器——这正是这个代码库已经
 *   修过两次的同一类问题（ReminderHistory 曾经的风险、
 *   getPendingTasks 2026-07-11 那次 HIGH RISK 2 修复），不应该在
 *   明知道这个教训的情况下又引入一次。
 *
 *   QueryEngine.getTaskById()（22_QueryEngine.js:192）——同样存在，但
 *   它自己的文档注释写明"本项目目前没有任何调用方，继续读全量 Tasks"
 *   ——也就是说它对未被裁剪优化的原始 Tasks 表（不是 ActiveTasks）
 *   做整表扫描。本计划的新组件会成为它的第一个真实调用方，如果直接
 *   用它，等于重新引入同一类问题。第四节说明改用什么替代方式。
 */

// ============================================================================
// 四、新组件设计（23_ReminderRequestConsumer.js）
// ============================================================================

/**
 * ---- 4.1 触发方式 ----
 *
 * 建议独立的时间触发器，同样 5 分钟一次（跟 checkOffsetReminders 同
 * 频率，但独立触发、独立函数、独立 LockService 锁），而不是塞进
 * checkOffsetReminders 内部：
 *
 *   理由：checkOffsetReminders 已经有自己的
 *   EXECUTION_TIME_BUDGET_MS 预算和"时间预算耗尽就把剩下的规则留给
 *   下次触发器"的设计（20_ReminderEngine.js:806-808）。把一个新职责
 *   塞进同一次执行，会挤占这个已经调校过的预算，且让"这次执行慢是
 *   因为规则多、还是因为事件消费慢"变得难以从日志区分。独立触发器、
 *   独立锁，出问题时职责边界清楚，且完全符合"只加缺失的消费层，不
 *   改动 Reminder Engine 内部"的边界。
 *
 *   顺序关系：这个新触发器建议安排在 checkOffsetReminders 触发器
 *   之前几分钟跑（比如错开 2-3 分钟），保证"这一轮登记的新规则"能
 *   赶上"下一次"checkOffsetReminders 的评估，而不是恰好卡在两次
 *   checkOffsetReminders 之间、多等快 5 分钟——这只是调度时间上的
 *   优化，不影响正确性（即使不这样错开，最坏情况也只是多等一个
 *   周期，不会丢事件）。
 *
 * ---- 4.2 发现"未处理"事件——水位机制，不用 getEventsByType ----
 *
 * 用 PropertiesService 存一个水位（跟 RETRY_FLAG_KEY 那套已有模式
 * 同源，20_ReminderEngine.js:177-178）：
 *
 *   REMINDER_REQUEST_CONSUMER_LAST_ROW_KEY —— 存"上次处理到 Events
 *   表第几行"（整数，不是 event_id 或 timestamp）。
 *
 * 每次运行：
 *   1. 读 PropertiesService 里的 lastRow（不存在则视为 1，即表头行，
 *      从第 2 行开始处理）。
 *   2. 读当前 Events 表的 sheet.getLastRow()。
 *   3. 如果 currentLastRow <= lastRow，本轮无新事件，直接返回。
 *   4. 否则只对 (lastRow+1) 到 currentLastRow 这个区间做
 *      getRange(...).getValues()【只读这个增量区间，不读历史】，
 *      在内存里过滤 type === 'REMINDER_REQUESTED' 且
 *      payload.entity_type === 'TASK' 的行。
 *   5. 处理完（见 4.3-4.6）后，把水位更新为 currentLastRow。
 *
 * 这跟 getEventsByType 的区别：读取量正比于"这一轮新增的 Events 行数"
 * （通常很小，多数轮次可能是 0-1 行），不正比于 Events 表的历史总量
 * ——这是本计划里性能相关的核心设计决定，直接对应第三节点出的、
 * 不能直接复用 getEventsByType 的理由。
 *
 * 风险说明（如实记录，不回避）：这个设计假设 Events 表只追加、不
 * 删除、不重排——00_Project_Constitution.js:102 的"没有任何
 * update/delete API"这条已核实的事实支持这个假设；如果未来这个假设
 * 被打破（比如某天真的加了归档/清理 Events 的功能），这个水位机制
 * 需要跟着重新设计，届时应该在那次改动里一并考虑，不是本计划现在
 * 能预判的。
 *
 * ---- 4.3 Task 查找——用 ActiveTasks，不用 getTaskById ----
 *
 * 对每个待处理事件的 entity_id（= task_id），不调用
 * QueryEngine.getTaskById()（会整表扫描原始 Tasks 表），而是复用
 * QueryEngine.getPendingTasks() 已经在读的 ActiveTasks（有界表，
 * 体量只随"当前活跃任务数"增长）：本组件自己也调用一次
 * QueryEngine.getPendingTasks()（跟 checkOffsetReminders 各自独立
 * 调用，两边不共享同一次内存对象，但两边都是读同一张有界表，成本
 * 可控），在返回结果里按 task_id 查找。
 *
 * 如果需要 chat_id 之外的更多字段确认，遵循 getPendingTasks() 本身
 * 已经建立的"ActiveTasks 拿候选、Tasks 定点查 1-2 个字段"模式，不
 * 额外发明新查法。
 *
 * ---- 4.4 登记规则——【终定，Carson 2026-08-27 批准 Option 1】比较后
 *          再替换，不是无条件替换 ----
 *
 * 对每个"entity_id 能在当前 ActiveTasks 里查到、且 policy 有效"的事件：
 *
 *   先查这个 task_id 名下 source = 'event_registered' 的既有规则行
 *   （在同一次 ReminderRules 读取里过滤，不需要额外查表），把它们的
 *   offset_minutes 集合跟这次事件解析出的 offset_minutes 集合做比较：
 *
 *     完全相同 —— 不删不插，既有规则原样保留（rule_id、
 *     resolved_fire_ats、发送历史全部不动）。这一条是 Carson 批准意见
 *     明确要求的幂等语义的核心："receiving the same request/policy
 *     repeatedly must not create duplicate reminders"——如果不做这层
 *     比较、每次都无条件删旧插新，即使 policy 真的没变，rule_id 也会
 *     每次换新、resolved_fire_ats 每次归零，一旦这发生在某个 offset
 *     已经真正发送过提醒之后，会让那条 offset 被误判成"从未处理过"而
 *     重新发送——这才是真正的幂等违反，不能只满足于"最终状态不重复"
 *     这个弱化版本。
 *
 *     不同（包括这个 task_id 第一次通过这条事件路径出现）—— 执行
 *     替换：先把旧规则的 rule_id 加入 ruleDeletes（用
 *     SheetUtils.batchDeleteRowsByKey_ 删除），再构造新的 ReminderRules
 *     行（一个 offset 一行，跟 _ensureRulesFromPolicy_ 同样的模式，
 *     task_id = entity_id，chat_id 从 Task 权威行读——不用事件 payload
 *     里的快照，source = 'event_registered'，resolved_fire_ats 从空
 *     对象重新开始——这是"policy 真的变了"时的正确行为，新 policy 需要
 *     自己全新的调度状态），用 SheetUtils.batchUpsertRowsByKey_(
 *     RULES_SHEET, 'rule_id', ...) 落盘（这里的 rule_id 都是新生成的，
 *     所以这一步实际效果是插入，"upsert"只是复用现成函数，不依赖它的
 *     覆盖语义）。
 *
 *   source 沿用现有 'auto_default'/'user_override' 之外新增
 *   'event_registered' 取值——这是 ReminderHistory 现有 policy_source
 *   字段的自然扩展，不是新开字段。
 *
 * ---- 4.5 加锁 ----
 *
 * 用独立的 LockService.getScriptLock() 调用（不是共享
 * checkOffsetReminders 那把锁——两个独立触发器不应该抢同一把锁，
 * 否则任何一边执行慢都会拖慢另一边），沿用现有的
 * lock.waitLock(LOCK_WAIT_MS) + 失败则跳过本轮的既有模式
 * （20_ReminderEngine.js:727-734 的写法）。
 */

// ============================================================================
// 五、Event fields consumed
// ============================================================================

/**
 * 只信任并使用：
 *   event.type              （筛选 'REMINDER_REQUESTED'）
 *   event.payload.entity_type（筛选 'TASK'——本计划范围内，'PROJECT'
 *                             的事件会被读到但明确跳过、不处理、
 *                             正常推进水位，不阻塞，也不报错）
 *   event.payload.entity_id  （= task_id）
 *   event.payload.reminder_policy（登记用的策略来源）
 *
 * 明确不信任、不使用的：
 *   event.timestamp —— 只用于日志/调试参考，不作为到期时间来源、
 *   也不作为水位机制本身（水位用行号，见 4.2，不用 timestamp，
 *   避免依赖"事件按时间顺序追加"这个虽然目前成立、但没有必要额外
 *   依赖的假设）。
 *   event.chat_id / event.source —— 不参与登记逻辑判断，只在生成的
 *   ReminderRules 行里透传 chat_id（复用现有规则行本来就需要这个
 *   字段发送通知）。
 */

// ============================================================================
// 六、Idempotency behavior
// ============================================================================

/**
 * 两层幂等，对应两种不同的"重复"，两层都已经在 23_ReminderRequestConsumer.js
 * 里实现并跑 Node 沙盒测试逐条验证过（见第十一节）：
 *
 *   同一条 Events 行被重复处理（比如触发器重叠、水位更新失败但
 *   处理逻辑已经跑过）——由 4.2 的"先处理、后推进水位"顺序 +
 *   LockService 独占锁共同保证：只有水位成功推进之后，这一行才算
 *   "处理过"；如果处理成功但推进水位失败（比如中途报错），下一轮
 *   会重新处理这一行。
 *
 *   同一个 task_id 被两个不同事件（不同 event_id）先后请求、且
 *   policy 相同——【这是 Carson 批准意见里"receiving the same
 *   request/policy repeatedly must not create duplicate reminders"
 *   逐字对应的场景】。4.4 最终实现的做法：先比较这个 task_id 现有
 *   登记的 offset 集合跟这次事件的 offset 集合，完全相同就直接跳过，
 *   不删不插，既有规则的 rule_id、resolved_fire_ats（已发送历史）
 *   原样保留。如果不做这层比较、无条件"先删旧插新"，即使 policy
 *   没变也会让 rule_id 每次换新、resolved_fire_ats 每次归零——一旦
 *   这发生在某个 offset 已经真正发送过提醒之后，会让那条 offset 被
 *   误判成"从未处理过"而重新发送，这才是真正的幂等违反。测试套件
 *   场景 D 专门覆盖了这个时序（先手工把 resolved_fire_ats 标记成
 *   "已发送"，再重复同一个 policy，断言 rule_id 和 resolved_fire_ats
 *   都没有被扰动）。
 *
 *   同一个 task_id 被两个不同事件、且 policy 确实不同——见 4.4，
 *   后一次替换前一次（Carson 2026-08-27 批准 Option 1），旧规则的
 *   resolved_fire_ats 不延续，这是"policy 真的变了"时的正确行为，
 *   不是幂等违反。
 */

// ============================================================================
// 七、Duplicate event behavior —— 【已由 Carson 2026-08-27 批准 Option 1，定案】
// ============================================================================

/**
 * 这一节原本记录的是一个待 Carson 回答的开放问题（同一个 task_id 被
 * 多次登记、policy 不同时，是替换还是忽略——这实际上是在动 Task 现有的
 * "决定 #2"：reminder_policy 创建后不可变，20_ReminderEngine.js:318-319，
 * 正是架构评审第七节 (c) 项要求"必须 Carson 明确点头，不能默认通过"
 * 的那个点）。Carson 已于 2026-08-27 明确批准 Option 1（replace），
 * 并逐字给出了以下约束，全部已经体现在第四、六节的最终设计和
 * 23_ReminderRequestConsumer.js 的实现里：
 *
 *   "the latest valid policy becomes authoritative" —— 第四节 4.4，
 *   policy 确实不同时替换生效。
 *
 *   "The previous registration/policy must no longer remain
 *   effective" —— 替换执行的是真删除（batchDeleteRowsByKey_），不是
 *   留着旧规则不管，旧规则从 ReminderRules 里彻底移除。
 *
 *   "This must be idempotent: receiving the same request/policy
 *   repeatedly must not create duplicate reminders" —— 第六节的
 *   "先比较、相同则跳过"机制专门为这条服务，测试场景 D 直接验证了
 *   这条要求最容易被忽略的那个反例（已发送过的 offset 不会被
 *   误重置）。
 *
 *   "The Domain Task remains the source of truth; Reminder OS only
 *   maintains the scheduling state derived from it" —— chat_id 从
 *   Task 权威行读，不用事件 payload 快照；ReminderRules/
 *   Occurrences/History 三张表继续是 Reminder OS 自己的调度状态，
 *   不复制 Task 的业务字段。
 *
 *   "Do not modify the Task identity contract for this decision" ——
 *   本文件、本次实现从未涉及 Personal Life OS 的
 *   generateTaskIdentity()/scopeKey，task_id 只被当成普通查找 key
 *   使用，见第零节的范围确认。
 *
 * 历史记录（不删除，留痕）：曾经考虑过的选项 2（ignore-if-exists，
 * 完全不动决定 #2，后续事件直接忽略）没有被采纳——本节保留这条记录，
 * 供以后如果要重新评估这个决定时，知道当初还比较过什么、为什么没选。
 *
 * 决定 #2 的扩展范围：只有"通过 REMINDER_REQUESTED 事件渠道"这条新路径
 * 能够变更已登记的 policy；task.reminder_policy 字段本身在 Task
 * 创建之后依然不可变，_ensureRulesFromPolicy_ 的既有"只在首次生成"
 * 逻辑完全不动——两条路径分别用 source 字段区分
 * （'auto_default'/'user_override' vs 'event_registered'），不会
 * 互相覆盖或混淆。
 */

// ============================================================================
// 八、Task update / completion / cancellation / rescheduling behavior
// ============================================================================

/**
 * 这四项都不需要新逻辑——这是本计划里"确认现有机制足够、不用发明
 * 新东西"的部分，逐条对应架构评审第一节 F 已经核实过的既有机制：
 *
 *   Task 到期时间变化（reschedule）：一旦规则登记进 ReminderRules，
 *   checkOffsetReminders 每轮都会用 _resolveEffectiveDueDatetime_
 *   现读 Task 当前的 due_datetime/due_date/due_time，resolved_fire_ats
 *   的 effectiveDue 比较机制（20_ReminderEngine.js:834-860）已经能
 *   正确处理"改早"和"改晚"两种情况，新组件不需要对此做任何事。
 *
 *   Task 完成（completed）：完成后的 Task 会从 ActiveTasks/
 *   getPendingTasks() 的结果集里消失，checkOffsetReminders 现有的
 *   "task 不在 pendingTaskById 里 → 取消"逻辑（line 812-829）会
 *   自动处理，发布 REMINDER_CANCELLED，删除规则——新组件不需要监听
 *   Task 的完成事件，也不需要自己发起取消。
 *
 *   Task 取消（cancelled）：同上，效果一样——不区分"完成"还是
 *   "取消"，两者都表现为"离开 pending 集合"，现有逻辑统一处理。
 *
 *   Task 重新排期（reschedule）：同"到期时间变化"，无需额外处理。
 *
 * 换句话说，新组件的职责严格止于"登记"这一步，完成之后的全部生命
 * 周期都交给已经验证过的 checkOffsetReminders，这正是"只补消费层、
 * 不碰 Reminder Engine"这条边界在实际设计里的体现。
 */

// ============================================================================
// 九、Stale / missing Task behavior
// ============================================================================

/**
 * 事件引用的 entity_id 在当前 ActiveTasks（即 getPendingTasks() 结果）
 * 里找不到——可能因为 Task 在事件发出后、消费者处理前就已完成/取消，
 * 也可能因为发布方和这次轮询之间存在极短的时序差（Task 刚创建、
 * ActiveTasks 投影还没来得及同步）。
 *
 * 处理方式：不立即放弃，也不无限期等待——比照
 * MAX_RETRY_ATTEMPTS/RETRY_DELAY_MINUTES 这类既有的"有限重试"模式
 * （20_ReminderEngine.js:173-174），设一个有限的等待窗口：
 *
 *   如果 event.timestamp 距今不超过一个阈值（建议 2 小时，一个明显
 *   大于任何合理的"投影同步延迟"、又不至于让一个真正失效的事件挂
 *   太久的数值——具体数字可以由 Carson 调整，不是需要精确论证的
 *   科学常数），先不推进水位越过这一行，等下一轮重新检查。
 *
 *   超过阈值仍然找不到——视为 stale，记一条 Logger 日志（注明
 *   entity_id、原始 event_id、判定为 stale 的原因），推进水位越过
 *   这一行，不再重试，也不生成任何规则。
 *
 * 这条设计避免了"水位卡死在一个永远解决不了的坏事件上、连累后面
 * 合法事件也进不来"的问题（对照第四节 4.2 提到的"单一水位不容易
 * 表达'跳过一个、继续处理后面'"这个限制）——用"超时后放弃并前进"这个
 * 简单规则解决，不引入更复杂的按事件独立追踪状态的机制，符合
 * "最小实现"的要求。
 */

// ============================================================================
// 十、Failure / retry behavior
// ============================================================================

/**
 * 消费者本身执行失败（比如中途抛异常）：
 *   水位只在成功处理完这一批事件后才推进（4.2 步骤 5）——如果中途
 *   失败，水位保持在上一次成功的位置，下一轮触发器会重新读同一批
 *   （包括已经部分处理过的）事件。这依赖 4.4 的"先删旧、再插新"
 *   规则登记操作本身是幂等的（重复执行结果一致）——已经在第六节
 *   确认过这一点，所以"重新处理同一批事件"是安全的，不会因为部分
 *   重复执行而产生错误状态。
 *
 * 加锁失败（上一轮还没跑完）：
 *   沿用 checkOffsetReminders 现有的处理方式——拿不到锁就跳过本轮、
 *   记日志，不排队等待、不报错阻塞（20_ReminderEngine.js:730-734
 *   同款模式）。
 *
 * 单个事件解析失败（payload JSON 损坏、entity_id 缺失等格式异常）：
 *   记日志，跳过这一条，不影响同一批里其它事件的处理，水位
 *   仍然正常推进（一条格式错误的历史事件不应该永久卡住整条流水线，
 *   这条原则跟第九节"超时放弃"背后的考虑是一致的）。
 */

// ============================================================================
// 十一、需要的测试（Tests required）
// ============================================================================

/**
 * 60_ReminderRequestConsumer_Tests.js 已交付，跟 50_ReminderEngine_Tests.js
 * 同款风格（手工 Logger.log PASS/FAIL，同一套 mocks.js），覆盖场景
 * A-I，共 28 条断言：
 *
 *   A 首次运行 + 单 offset 正常登记（含 chat_id 确认来自 Task 权威行，
 *     不是事件 payload）
 *   B 多 offset——一个 offset 一行，offset 换算正确
 *   C entity_type=PROJECT 被跳过、不生成规则、水位仍正确推进
 *   D 【幂等核心】同一 task_id + 相同 policy 重复登记：不删不插，
 *     rule_id 和已经手工标记过的 resolved_fire_ats（模拟"已发送过"）
 *     都原样保留
 *   E 同一 task_id + 不同 policy：真替换（rule_id 变化，offset 更新，
 *     行数不堆积）
 *   F Stale：entity_id 查无 Task 且事件已超过 2 小时阈值——判定 stale，
 *     推进水位，不生成规则
 *   G entity_id 暂时查无 Task 但仍在阈值内——本轮不推进水位，下一轮
 *     Task 出现后正常登记
 *   H 空 offsets——判定无效，跳过，不生成规则
 *   I 增量水位——无新事件时不重新扫描已处理过的行
 *
 * 【已在本地 Node 沙盒实际运行，不是只写了断言】用 mocks.js 提供的
 * 内存版 GAS shim + vm.runInThisContext（原样加载 21_SheetUtils.js 的
 * 真实源码，不是重新手写一份简化版逻辑）——运行结果：28 passed, 0
 * failed。这是 Node 沙盒里的验证，不是 Carson 真实 GAS/Sheets 环境里
 * 的验证，下面仍然需要 Carson 在真实环境里跑一遍确认。
 *
 * 【顺带发现，不在本次修复范围】run_reminder_tests.js（这个仓库既有的
 * 本地测试 runner）引用的 21_SheetUtils.txt/40_Output.txt/
 * 20_ReminderEngine.txt 在这次上传的 zip 里都不存在，且如果直接用
 * require() 加载这些原样 GAS 风格代码（顶层 var X = (function(){...})()，
 * 没有显式挂 global），也不会正确生效——需要 vm.runInThisContext 才行
 * （这一点是写本文件的 runner 时亲自踩过、修正过的）。这两点都不影响
 * 本次交付的正确性（本次的 runner 是单独写的，只依赖 mocks.js +
 * 21_SheetUtils.js 的 .js 原文件本身），如实记录，供 Carson 之后自己
 * 要跑既有的 50_ReminderEngine_Tests.js 时避免走同样的弯路。
 *
 * 仍然需要 Carson 做的（沿用这个项目"改一个文件、独立验证一次"的
 * 纪律，Node 沙盒不能替代）：
 *   □ 在真实 GAS 项目里跑一次 50_ReminderEngine_Tests.js（如果要跑，
 *     先解决上一条提到的 runner 本身的问题），确认新文件没有对
 *     ReminderRules 表产生任何非预期的旁路影响。
 *   □ Sprint 3 Acceptance Gate（Personal-Life-main 侧）——本次没有
 *     改动 Personal-Life-main 任何文件，预期"自动保持通过"，仍建议
 *     重新跑一次确认，不假设"没改代码=一定还是绿的"。
 *   □ 真实环境端到端验证：运行 createTriggers() 挂好新触发器，用
 *     Sprint-3-Gate 同款方式（直接调用
 *     ReminderConnector.requestWorkflowStepReminder）手动触发一次
 *     真实事件，确认 consumeReminderRequests 和 checkOffsetReminders
 *     在真实 Sheets 环境下也能正确衔接——这是 Node mock 不能完全
 *     替代的部分。
 */

// ============================================================================
// 十二、明确的非目标（对照 Carson 批准意见第 6 点）
// ============================================================================

/**
 * 本计划不做、也不应该被误读为顺带做了：
 *   ✗ Reminder OS V2 / 七引擎重设计
 *   ✗ 全局 Reminder Rule 存储重设计（ReminderRules 表结构不变，只是
 *     多了一种 source 取值）
 *   ✗ Task 提醒重设计（现有 reminder_policy 字段路径、决定 #2 对
 *     "字段本身"的约束，都不变——第七节的开放问题只影响"通过事件
 *     渠道"这条新路径，不影响 task.reminder_policy 字段本身的既有
 *     语义）
 *   ✗ Project deadline schema——不涉及
 *   ✗ 其它 Domain OS 集成——不涉及
 *   ✗ 在 Personal Life OS 侧新增任何生产调用方——见第一节，这是一个
 *     独立于本计划的、未来可能需要单独提出的决定
 */

// ============================================================================
// 十三、【已解决】实现前需要 Carson 明确回答的唯一问题
// ============================================================================

/**
 * 原问题：同一个 task_id 被 requestWorkflowStepReminder 多次登记、且
 * reminder_policy 不同时，后一次应该【替换】前一次，还是【忽略】、
 * 维持 Task 第一次登记时的策略不变？
 *
 * Carson 2026-08-27 批准：Option 1（replace），并附加了幂等、Domain
 * Task 权威性、不改动 Task identity 契约三条明确约束——完整决定和
 * 约束记录见第七节，已经体现在第四、六节的最终设计和
 * 23_ReminderRequestConsumer.js 的实现、60_ReminderRequestConsumer_Tests.js
 * 的测试场景 D/E 里。本计划自此不再有任何待 Carson 回答的开放问题。
 */

// ============================================================================
// 十四、治理状态
// ============================================================================

/**
 * 本文档状态更新（2026-08-27）：Plan — Implemented, Pending Carson's
 * Production Verification。第十三节的开放问题已解决，代码已经写出来
 * 并交付：
 *
 *   新增 23_ReminderRequestConsumer.js（Reminder-main）
 *   新增 60_ReminderRequestConsumer_Tests.js（Reminder-main）
 *   修改 11_Setup.js（Reminder-main）——createTriggers() 新增
 *   consumeReminderRequests 触发器的清理与创建，其余内容不变
 *
 * 验证现状：Node 沙盒里 28/28 断言通过（第十一节），这证明了逻辑
 * 正确性，但不等于生产验证——第十一节末尾列出的三项仍然需要 Carson
 * 在真实 GAS/Sheets 环境里做。
 *
 * ADR-009 的状态：仍然是 Proposed，不因为 Node 沙盒测试通过就自动
 * 升级成 Accepted——按这个项目一贯的纪律，Stable/Accepted 需要
 * Carson 在真实环境里验证过之后才标注，不能只凭 Node mock 的结果
 * 提前定案。等 Carson 完成第十一节末尾那三项真实环境验证、明确确认
 * 之后，再把 ADR-009 从 Proposed 改成 Accepted。
 */
