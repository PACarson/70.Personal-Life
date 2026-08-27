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
 *   EventBus.getEventsByType()（02_EventBus.js:122）——技术上"存在
 *   现成的按类型读事件"函数，但见第四节，这次不采用它，原因是它的
 *   实现（getAllEvents(), 02_EventBus.js:92-120）是对共享 Events 表
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
 * ---- 4.4 登记规则——沿用 batchUpsertRowsByKey_，但明确是 upsert
 *          不是 append ----
 *
 * 对每个"entity_id 能在当前 ActiveTasks 里查到"的事件：
 *
 *   构造一条（或按 offsets 数组构造多条，与 _ensureRulesFromPolicy_
 *   同样的"一个 offset 一行"模式）ReminderRules 行，task_id =
 *   entity_id，source = 'event_registered'（新增的 source 取值，
 *   跟现有 'auto_default'/'user_override' 区分开，方便未来在
 *   ReminderHistory 里追溯"这条规则是怎么来的"——这是 ReminderHistory
 *   现有 policy_source 字段的自然扩展，不是新开一个字段）。
 *
 *   用 SheetUtils.batchUpsertRowsByKey_(RULES_SHEET, 'rule_id', ...)
 *   —— 但这里有个关键设计问题：ReminderRules 现有的 rule_id 是每次
 *   生成一个新的随机 ID（_generateRuleId_()），upsert by rule_id
 *   对"替换同一个 task_id 的旧规则"没有帮助，因为新旧 rule_id 本来
 *   就不一样，upsert 只会是"插入一条新行"，不会覆盖旧行。
 *
 *   所以真正的"upsert 语义"要在应用层做：先查这个 task_id 名下
 *   source = 'event_registered' 的既有规则行（可以在同一次
 *   ActiveRules 读取里过滤，不需要额外查表），如果存在，先加入
 *   ruleDeletes（沿用 checkOffsetReminders 现有的批量删除机制）删掉
 *   旧规则，再插入新规则——这样对外表现为"替换"，而不是"堆积"。
 *
 *   这个"先删旧、再插新"的具体触发时机，取决于第七节那个需要 Carson
 *   确认的开放问题（是否允许同一个 task_id 被多次登记时更新 policy）
 *   ——本节描述的是【如果】允许更新时的机制，不是不由分说就这么做。
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
 * 两层幂等，对应两种不同的"重复"：
 *
 *   同一条 Events 行被重复处理（比如触发器重叠、水位更新失败但
 *   处理逻辑已经跑过）——由 4.2 的"先处理、后推进水位"顺序 +
 *   LockService 独占锁共同保证：只有水位成功推进之后，这一行才算
 *   "处理过"；如果处理成功但推进水位失败（比如中途报错），下一轮
 *   会重新处理这一行——这时候 4.4 的"先删旧规则再插新规则"设计本身
 *   是幂等的（重复执行"删掉 source=event_registered 的旧规则、插入
 *   新规则"这个操作，结果不会因为多跑一次而不同），所以重复处理同一
 *   条事件是安全的，不会造成规则重复堆积。
 *
 *   同一个 task_id 被两个不同事件（不同 event_id）先后请求——见
 *   4.4 的"先删旧、再插新"设计，效果是后一次登记替换前一次，不是
 *   累加。这条具体要不要生效，见第七节的开放问题。
 */

// ============================================================================
// 七、Duplicate event behavior —— 含一个需要 Carson 明确确认的开放问题
// ============================================================================

/**
 * 上面两层幂等设计里，第二层（同一个 task_id 被多次登记，是否允许
 * 后一次替换前一次的 policy）实际上是在动 Task 现有的"决定 #2"
 * （reminder_policy 创建后不可变，20_ReminderEngine.js:318-319）——
 * 这正是架构评审第七节 (c) 项要求"必须 Carson 明确点头，不能默认
 * 通过"的那个点。Carson 这次的批准意见没有单独回答这一条，本计划
 * 不能替 Carson 做这个决定，也不能假装它已经被批准。
 *
 * 两个选项，各自的后果：
 *
 *   选项 1（replace）：同一个 task_id 被再次登记时，用新 policy
 *   替换旧规则。好处：requestWorkflowStepReminder 真正具备"创建后
 *   修改提醒策略"的能力，这也更符合这个函数名字暗示的用途（Workflow
 *   步骤的提醒需求可能在 Workflow 实例真正推进到那一步时才确定，
 *   不一定跟 Task 创建同时发生）。代价：事实上扩展了决定 #2，需要
 *   在 ADR-009 里明确写清楚这条扩展，且需要一条新的回归测试确保
 *   "只通过事件渠道改、Task 自己的 reminder_policy 字段仍然不可变"
 *   这条边界不会被混淆。
 *
 *   选项 2（ignore-if-exists）：同一个 task_id 已经有
 *   source=event_registered 的规则时，后续事件直接跳过、不生效，
 *   决定 #2 完全不动。好处：改动面更小、更保守。代价：
 *   requestWorkflowStepReminder 事实上只能"设置一次"，如果这不符合
 *   它的实际使用场景，这个函数的价值会打折扣——而且鉴于它目前连
 *   生产调用方都没有（第一节），"它实际会被怎么用"目前完全没有真实
 *   证据，选哪个都带有一定的猜测成分。
 *
 * 本计划默认按选项 1（replace）写第四节的设计，因为这更符合
 * "WorkflowStepReminder"这个名字暗示的语义，但明确把这个默认标注为
 * 待确认，不是已经拍板——第八节的测试要求也会按"两个选项都各自需要
 * 什么测试"分别列出，Carson 确认后我只需要保留对应那一侧，不需要
 * 重新规划。
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
 * 新建 60_ReminderRequestConsumer_Tests.js（沿用 50 系列测试文件
 * 命名，但既然是新组件，用下一个可用的前缀区间——如果 Carson 的
 * 习惯是所有测试都统一用 50_ 前缀，这个数字可以改，不影响下面的
 * 用例设计），至少覆盖：
 *
 *   □ 水位机制：首次运行（无既有水位）、增量运行（只处理新增行）、
 *     无新事件时的空跑（不产生任何副作用）。
 *   □ 事件过滤：entity_type='PROJECT' 的事件被正确跳过、不处理、
 *     水位仍然正确推进过它。
 *   □ 正常登记：entity_id 能在 ActiveTasks 查到时，生成正确的
 *     ReminderRules 行（task_id/chat_id/offset/source 全部正确）。
 *   □ 幂等重放：人为重复处理同一批已处理过的事件（模拟水位推进
 *     失败后的重跑），确认不产生重复/错误的规则行。
 *   □ 重复登记（同一 task_id 两次，policy 不同）：按第七节 Carson
 *     确认的选项（1 或 2）分别断言"替换"或"忽略"的正确行为——两个
 *     选项的测试用例都先写出来，Carson 选定后只保留对应那一组，
 *     删掉另一组，不是两组都要长期维护。
 *   □ Stale Task：entity_id 查无此 Task，且事件时间戳在阈值内 →
 *     不推进水位、不生成规则；超过阈值 → 推进水位、记日志、不生成
 *     规则。
 *   □ 端到端回归：登记后跑一次 checkOffsetReminders，确认新规则
 *     被正确纳入正常的到期时间判断、发送、取消、重排期流程——这条
 *     直接验证"第八节"里"完成之后全部交给现有引擎"这个设计假设
 *     真的成立，不是纸面推论。
 *
 * 同时要求（沿用这个项目"改一个文件、独立验证一次"的纪律）：
 *   □ 50_ReminderEngine_Tests.js 全部保持通过（确认新组件没有对
 *     ReminderRules 表产生任何非预期的旁路影响）。
 *   □ Sprint 3 Acceptance Gate（Personal-Life-main 侧）保持通过——
 *     本计划不改动 Personal-Life-main 任何文件，这一项预期是
 *     "自动保持通过"，但仍然建议 Carson 实现后重新跑一次确认，不
 *     假设"没改代码=一定还是绿的"。
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
// 十三、实现前需要 Carson 明确回答的唯一问题
// ============================================================================

/**
 * 第七节展开过，这里单独摘出，避免被埋没：
 *
 *   同一个 task_id 被 requestWorkflowStepReminder 多次登记、且
 *   reminder_policy 不同时，后一次应该【替换】前一次（选项 1，本
 *   计划的默认设计），还是【忽略】、维持 Task 第一次登记时的策略
 *   不变（选项 2，完全不动决定 #2）？
 *
 * 这是本计划里唯一一处在等 Carson 的回答，而不是在等"批准整个计划"
 * ——其余部分（第二到六、八到十二节）不依赖这个答案，可以先定下来；
 * 只有第四节 4.4 的具体触发条件、第七节的最终行为、第十一节测试用例
 * 里"重复登记"那一组，需要这个答案才能定稿到可以真正开始写代码的
 * 程度。
 */

// ============================================================================
// 十四、治理状态
// ============================================================================

/**
 * 本文档状态：Plan — Pending Review。不是 ADR，不是 Stable，不代表
 * 任何已经发生的代码改动。
 *
 * 待 Carson：
 *   (a) 回答第十三节的开放问题；
 *   (b) 确认或调整第二节的文件/编号选择、第四节的触发器调度细节、
 *       第九节的 stale 阈值等实现细节；
 * 之后本计划才转入实现阶段，实现完成后按第十一节验收，验收通过后
 * 才在 ADR-009 里把 STATUS 从 Proposed 改成 Accepted——不在代码写完
 * 之前、也不在自动化测试和 Carson 的生产环境验证完成之前，标注
 * 任何东西为 Stable。
 */
