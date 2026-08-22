/**
 * 00_Due_Date_Canonicalization_Audit.gs
 * Personal Life OS — Track 1B Audit: Due-Date Canonicalization / Identity Stability
 *
 * 状态：AUDIT_PENDING_IMPLEMENTATION
 * 本轮性质：Audit + Recommendation。未修改任何生产代码（
 * 07_IdentityEngine.js / 09_IdempotencyManager.js / TaskEngine /
 * ProjectionRebuilder / schema / Sheet formatting / migration 均未触碰）。
 * 唯一新增的文件是这份审计本身，以及此前（在本审计正式立项之前）为了
 * 定位 Track 1A 测试失败原因而写的 _diagnostic_workflow_id_mismatch.js
 * （纯诊断，不是生产代码）。
 *
 * 与 Track 1A（workflow_id scope key）明确拆开：Track 1A 已完成并在真实
 * 环境确认（见「七」），本文件只处理 Track 1B。
 */

// ============================================================
// 一、问题一句话总结
// ============================================================

/**
 * "due_date" 创建时是 canonical string（如 "2026-08-25"），但从 Google
 * Sheet 读回来时，在 Carson 的真实环境里被观测到变成了 JavaScript
 * "Date" object。任何"读回已存在 Task → 重新喂进
 * generateTaskIdentity()"的路径，如果不做归一化，重算出来的 identity
 * 会跟创建时不一致——这不是 workflow_id 那条线的问题，是一个独立、
 * 范围更广的 Identity Stability 问题。
 */

// ============================================================
// 二、A. Creation Path（证据：file:line）
// ============================================================

/**
 * due_date 从哪里进入：
 * - 06_TaskIntentParser.js:179 IdempotencyManager.createTaskIfNotExists(
 *   parsed.title, meta, chatId) —— meta.due_date 来自
 *   09_TemporalParser.extractDateTime() 的输出，格式固定是
 *   'yyyy-MM-dd' 或 'yyyy-MM-ddTHH:mm:ss' 两种 canonical string 之一
 *   （09_TemporalParser.js:536-541 注释明确写了这个契约）。
 * - 21_RecurringEngine.js:226-227（spawnNextIfNeeded）：meta.due_date
 *   来自 nextDueDate，由 09_TemporalParser.computeNextDueDateFromLabel()
 *   通过 Utilities.formatDate(nextDate, tz, 'yyyy-MM-dd') 产出
 *   （09_TemporalParser.js:558-559）——同样是 canonical string。
 *
 * 进入 IdentityEngine 前是什么类型：
 * - 两条路径喂给 IdempotencyManager.createTaskIfNotExists 的 meta 对象，
 *   在到达 09_IdempotencyManager.js:90-96 之前完全是内存里的、刚构造
 *   出来的 JS 对象，从未被写进/读出过任何 Sheet —— due_date 在这一步
 *   100% 是 string。这一点也用真实环境跑出的诊断数据直接验证过（见
 *   附录 diagnoseWorkflowIdMismatch() 的 Logger 输出：创建后内存里
 *   due_date = "2026-08-25" (typeof string)）。
 *
 * resolveIdentityDueValue() 实际返回什么（07_IdentityEngine.js:127-129）：
 *   function resolveIdentityDueValue(task) {
 *     return ((task && task.due_datetime) || (task && task.due_date) || '');
 *   }
 *   创建时 meta.due_datetime 通常不存在（undefined，falsy），所以返回
 *   meta.due_date 本身——这一步没有做任何类型检查或归一化，原样透传。
 *
 * generateTaskIdentity() 实际收到什么（09_IdempotencyManager.js:90-96）：
 *   var identity = IdentityEngine.generateTaskIdentity(
 *     chatId, title,
 *     IdentityEngine.resolveIdentityDueValue(meta),
 *     meta.recurring || '', meta.priority || 'MEDIUM',
 *     meta.category || 'GENERAL', meta.workflow_id || ''
 *   );
 *   收到的就是上面那个 canonical string，原样进 07_IdentityEngine.js:106
 *   的 generateTaskIdentity(chatId, title, dueDate, ...) 里做
 *   String(dueDate || '') 之后参与拼接哈希。
 *
 * 结论：创建时最终 identity input 是纯 string，格式跟
 * 09_TemporalParser 的输出契约完全一致。这条路径本身没有问题——问题
 * 在读回之后的重算路径（见「三」）。
 */

// ============================================================
// 三、B. Read / Update Path（证据：file:line + 真实环境诊断输出）
// ============================================================

/**
 * getTask() → Sheet read → due_date 类型：
 * 12_TaskQueryEngine.js:175-214 的 getTask(taskId, chatId)，核心是
 *   for (var h in headerMap) task[h] = rowValues[headerMap[h]];
 * 直接把 Range.getValues() 的原始返回值逐列赋给返回对象，没有任何
 * 类型转换或归一化。
 *
 * 真实环境诊断结果（Carson 跑的 diagnoseWorkflowIdMismatch()，完整
 * Logger 输出）：
 *   创建后内存对象：due_date = "2026-08-25" (typeof string)
 *   getTask() 读回：due_date = "2026-08-24T16:00:00.000Z" (typeof object)
 * 这是直接的真实环境证据，不是推测——getTask() 读回的 due_date 确认是
 * 一个 JS Date 实例。
 *
 * getTask() → updateTask() → identity recomputation，每一步实际类型：
 * 20_TaskEngine.js:224-296 updateTask(taskId, changes, chatId)：
 *   var existing = TaskQueryEngine.getTask(taskId, chatId);        // Date object（见上）
 *   var merged = shallowCopy_(existing);                            // merged.due_date 仍是同一个 Date object（浅拷贝不转类型）
 *   for (var k in payload) merged[k] = payload[k];                  // 这次编辑只改 title，不碰 due_date，merged.due_date 保持 Date object
 *   ...
 *   var newIdentity = IdentityEngine.generateTaskIdentity(
 *     ...,
 *     IdentityEngine.resolveIdentityDueValue(merged),               // 传入 Date object，原样返回（07_IdentityEngine.js:127-129 没有类型检查）
 *     ...
 *   );
 * generateTaskIdentity() 内部对这个参数做 String(dueDate || '')——
 * String(DateObject) 调用的是 Date.prototype.toString()（不是
 * toISOString()），产出类似
 * "Mon Aug 25 2026 00:00:00 GMT+0800 (China Standard Time)" 这样的
 * 本地时区默认格式字符串，跟创建时的 "2026-08-25" 完全不是同一个
 * 字符串——这就是两次 identity 不一致的直接原因。
 *
 * 真实环境诊断的最终验证（7 个参数逐一比对）：
 *   ✅ chatId/scope、title、recurring、priority、category、
 *      scopeKey(workflow_id) —— 全部一致
 *   ❌ dueValue —— production="2026-08-24T16:00:00.000Z"（Date 对象的
 *      JSON 序列化形式）vs test="2026-08-25"（string）——唯一分歧点，
 *      精确坐实这是 due_date 类型问题，不是 workflow_id 逻辑问题。
 */

// ============================================================
// 四、C. 其他 Identity Callers（全仓库搜索结果 + 逐一风险判定）
// ============================================================

/**
 * 全仓库搜索 generateTaskIdentity( / resolveIdentityDueValue( /
 * createTaskIfNotExists( 的所有非测试调用点：
 *
 * 1. 09_IdempotencyManager.js:90（createTaskIfNotExists，创建路径）
 *    due_date 来源：调用方传入的 meta（见「二」），永远是刚构造的
 *    内存对象，从未读过 Sheet。
 *    类型：恒为 string。
 *    是否受影响：否。生产数据风险：无。
 *
 * 2. 11_ProjectionRebuilder.js:215、269（rebuildTasksProjection 里
 *    "if (!task.identity) 才重算"的兜底分支）
 *    due_date 来源：deriveFromEvent() 从 Event_Log 的 payload 折叠出来
 *    的 task 对象——02_EventBus.js:184 确认 Event_Log 的 payload 列是
 *    JSON.stringify(event.payload) 整体存成一个 JSON 字符串。一个
 *    "{...}"开头的 JSON 字符串不会被 Sheets 误判成日期类型（跟裸日期
 *    字符串完全不是一回事），所以从 Event_Log 折叠出来的 due_date
 *    在类型上不会受这个问题影响。
 *    类型：string（继承自事件发布时的原始值，创建时恒为 string）。
 *    是否受影响：否（这条兜底分支本身只在"payload 里完全没有
 *    identity 字段"——即 identity 追踪机制引入之前的古老事件——才会
 *    触发，触发面本来就很窄）。生产数据风险：无（有独立证据支持，
 *    不是仅凭代码结构推测）。
 *
 * 3. 20_TaskEngine.js:279（updateTask，编辑路径）
 *    due_date 来源：TaskQueryEngine.getTask() 的真实 Sheet 读取。
 *    类型：真实环境确认为 Date object（见「三」）。
 *    是否受影响：是——这是本次 Track 1A 回归测试
 *    （testIdentityScope_UpdateTaskPreservesScope_）实际失败并已经
 *    实锤的路径。
 *    生产数据风险：updateTask() 目前没有任何真实调用方（
 *    00_Known_Limitations.gs「二」明确记录"现在不用 Telegram 指令，
 *    无人调用"）——Track 2 的 UI-I2（Edit Task）是这个函数第一个真实
 *    调用方。也就是说：这个 bug 目前还没有机会写坏任何一条真实生产
 *    identity，但 Track 2 一旦真的被使用，就会开始产生。
 *
 * 4. 21_RecurringEngine.js:209（spawnNextIfNeeded，recurring 任务
 *    completeTask 后自动续期）—— 这是本次审计过程中新发现、原始
 *    Track 1A 审计没有覆盖到的调用点。
 *    due_date 来源：函数签名明确写"TaskQueryEngine.getTask 的返回值"
 *    （21_RecurringEngine.js:186）——真实 Sheet 读取，类型可能是
 *    Date object。
 *    这条路径不是"重算 identity 后丢弃"，而是把
 *    resolveIdentityDueValue(task) 的结果继续传给
 *    computeNextDueDate() → 09_TemporalParser.
 *    computeNextDueDateFromLabel()，用来算"下一次到期日"，这个结果
 *    还会被当成下一个 Task 实例的 meta.due_date 传回
 *    createTaskIfNotExists() ——如果这里被 Date object 污染，理论上
 *    不只是 identity 不稳定，连"下一次到期日算对不对"这个用户能直接
 *    看到的功能都可能受影响，风险级别比 updateTask() 那条更高。
 *
 *    追查结果（09_TemporalParser.js:543-560 computeNextDueDateFromLabel）：
 *      var prevDate = parseDueDate_(String(prevDueDateStr).trim());
 *    这里有一个显式的 String(...) 强制转换。05_SheetUtils.js:345-351
 *    的 parseDueDate_ 对一个不匹配 'yyyy-MM-dd' 正则的字符串会落到
 *    "return new Date(raw)"分支。
 *
 *    已经用 Node 直接验证过（不是纯推理）：String(DateObject) 产出的
 *    是 Date.prototype.toString() 格式（带明确时区信息），
 *    new Date(那个字符串) 能正确还原回同一个时间点
 *    （reparsed.getTime() === original.getTime()，验证为 true），
 *    后续 Utilities.formatDate(nextDate, tz, ...) 用脚本真实时区格式化，
 *    能正确拿回原本的日历日期。
 *
 *    结论：这条路径目前【没有】在产生错误的到期日——但这是因为
 *    String(Date)→new Date(string) 这个 JS 隐式转换链条"恰好"是
 *    往返安全的，是一种脆弱的、无人设计过的巧合保护，不是有意为之的
 *    契约。任何一个环节（比如以后有人把这里的 String(...) 强制转换
 *    去掉，或者 parseDueDate_ 的正则不小心匹配到了 toString() 输出的
 *    某个子串）都可能让这层意外保护失效。不应该依赖这种巧合。
 *
 * 5. 08_DeduplicationEngine.js（findExistingTask 等）
 *    完全不接触 due_date——它的输入是调用方已经算好的 identity 字符串，
 *    只做"Sheet 里有没有一行 identity 列匹配"的扫描
 *    （08_DeduplicationEngine.js:104-113）。
 *    是否受影响：否。
 *
 * 6. Retry 路径：21_RecurringEngine.js:240-257 的
 *    MAX_SPAWN_RETRIES 重试循环，重试的是已经算好的同一个 meta 对象
 *    （clean string，来自 Utilities.formatDate 的输出），不会重新
 *    触碰 due_date 类型问题——风险已经完全包含在上面第 4 条里，
 *    不是独立风险点。
 */

// ============================================================
// 五、3. 现有生产数据 Impact Audit
// ============================================================

/**
 * 3.1 现有 due_date column 的实际格式是什么？
 *
 * 代码层面的"设计意图"证据：15_Setup.js:165 和 15_Setup.js:313 都对
 * 整个数据区（含 due_date 列，headers 数组里明确列了
 * 'due_date'——15_Setup.js:65-66/72-73/79-80/195-196/201-202/
 * 207-208）调用了
 *   sheet.getRange(2, 1, ..., headers.length).setNumberFormat('@')
 * '@' 是 Plain Text 格式代码——如果 Carson 的 Tasks 表是完全经由这条
 * 代码路径建出来的，due_date 列理论上不应该被 Sheets 误判成日期。
 *
 * 但真实环境诊断（见「三」）确认 due_date 读回来确实是 Date object——
 * 跟代码的设计意图直接矛盾。
 *
 * 无法仅凭代码库确认这个矛盾具体怎么发生的——可能的原因（无法排序
 * 优先级，因为这需要 Carson 那份 Sheet 自己的历史）：
 *   (a) 这张 Tasks 表本身建于 15_Setup.js 这个函数存在/被调用之前
 *       （比如手工建表，或更早版本的 setup 逻辑）；
 *   (b) setNumberFormat('@') 当时确实生效过，但后续被别的操作重置
 *       （比如在 Sheets UI 里手工调整过格式、导入/粘贴数据时
 *       Sheets 自己的智能格式识别覆盖了列格式）；
 *   (c) setNumberFormat 调用用的是 sheet.getMaxRows() - 1 决定格式化
 *       到第几行——如果表格后续增长超过了当时格式化覆盖的行数范围，
 *       超出范围新增的行可能不会继承 Plain Text 格式。
 * 不确定是哪一种，也可能是这三种以外的原因——这是 Carson 环境的实际
 * 历史，不是代码库能回答的问题。
 *
 * 3.2 现有生产 Tasks 是否可能同时存在 String due_date 和 Date due_date？
 *
 * 无法从当前代码库证明生产数据实际分布。可以确认的是：every Task
 * 在刚创建、写进 Sheet 之前那一刻，due_date 在内存里 100% 是 string
 * （见「二」）；它会不会在写入/读出 Sheet 之后变成 Date，完全取决于
 * 3.1 里那个未解开的格式矛盾在 Carson 的表格里具体是什么状态、什么
 * 时候发生的——如果这个格式问题是从某个时间点才开始出现的（比如
 * 3.1(b)/(c) 里描述的某次操作之后），那么在那个时间点之前创建、
 * 之后从未被重新写入过 due_date 列的 Task，读回来仍然可能是 string；
 * 反之则是 Date。这两种可能都无法排除，需要 Carson 直接抽查真实表格
 * 才能确认，不应该在没有证据的情况下假设"全部"或"没有"受影响。
 *
 * 3.3 如果现在开始 canonicalize，identity 是否会发生变化？
 *
 * 需要检查的依赖方逐一确认：
 *   - IdempotencyManager：创建路径的 meta 恒为 string（见「二」），
 *     canonicalize 对它是 no-op，不受影响。
 *   - Event_Log：只存已经发生过的事件 payload（JSON 字符串），
 *     canonicalize 不会（也不应该）回头改写历史事件——不受影响。
 *   - Projection / ProjectionRebuilder：见「四」第 2 条，
 *     due_date 来自 Event_Log，本来就是 string，不受影响。
 *   - Retry：见「四」第 6 条，重试的是已经算好的 meta，不涉及
 *     从 Sheet 重新读 due_date，不受影响。
 *   - existing Task update（20_TaskEngine.updateTask）：这正是
 *     canonicalize 要修的那条路径——canonicalize 之后，
 *     resolveIdentityDueValue() 对"读回来是 Date object"的情况会
 *     正确转换回创建时那种 canonical string，让重算结果重新匹配
 *     创建时的 identity；对"读回来仍然是 string"的情况（如果本来就
 *     没被污染），canonicalize 只要设计成"已经是 canonical string
 *     就原样返回"，就是纯粹的 no-op。
 *   - duplicate detection（DeduplicationEngine）：不接触 due_date
 *     （见「四」第 5 条），不受影响。
 *
 * 结论：canonicalize 本身不会主动改写任何已经存在的 identity 存量
 * 值——它只改变"未来调用 resolveIdentityDueValue() 时，遇到 Date
 * object 该怎么处理"这一条逻辑。已经写进 Sheet 的 identity 列的值，
 * 不会被这个改动本身回头重写。真正会写入新 identity 值的，只有
 * "之后有人再编辑这个 Task"（20_TaskEngine.updateTask）或
 * "之后触发 ProjectionRebuilder 重算"这两个事件本身，而不是
 * canonicalize 这个改动上线的那一刻。
 */

// ============================================================
// 六、4. Timezone 分析
// ============================================================

/**
 * 为什么 "2026-08-25" 读取后变成 "2026-08-24T16:00:00.000Z"：
 *
 * 2026-08-25 00:00:00 GMT+8 换算成 UTC，正是 2026-08-24 16:00:00 UTC
 * （GMT+8 比 UTC 快 8 小时，所以同一时刻的 UTC 表示要往前减 8 小时，
 * 也就是显示成"前一天 16:00"）——两个数字对得上，误差为 0。
 *
 * 这确认了：这只是同一个时间点的 UTC 表示法，不是业务日期真的被
 * 悄悄改成了 8 月 24 日。Google Sheets 把 "2026-08-25" 这个字符串
 * 自动解析成了"表格所在时区的 8 月 25 日 00:00:00"这个时间点，
 * Apps Script 读回来的 Date object 忠实反映的是同一个时间点，只是
 * JSON 序列化（以及诊断脚本里用 JSON.stringify 打印）用的是 UTC
 * 记法，看起来像是变成了 24 号——本质上是显示/序列化格式的问题，
 * 不是这个时间点本身错了。
 *
 * canonical Task due_date 应该代表什么：
 *
 * 应该是 Business Date（YYYY-MM-DD，需要具体时间时是
 * YYYY-MM-DDTHH:mm:ss），不是 UTC timestamp——这不是本次审计新定的
 * 语义，是现有代码库已经在到处依赖、并且已经为此专门修过一次 bug 的
 * 既有设计意图：
 *   - 05_SheetUtils.js:337-343 的 parseDueDate_ 文件头注释，专门记录
 *     了一次真实 bugfix："纯日期字符串用 new Date() 解析时 JS 会按
 *     UTC 处理，不是本地时区"，当时就是为了让"到期"判断落在正确的
 *     本地日历日，特意手工按本地时区午夜处理。
 *   - 09_TemporalParser.computeNextDueDateFromLabel() 全程用
 *     Utilities.formatDate(nextDate, tz, ...)（tz =
 *     Session.getScriptTimeZone()）来产出结果，而不是
 *     nextDate.toISOString()。
 * 这次的 due_date canonicalization 应该延续、而不是重新发明这个已经
 * 存在的语义——canonical 化的目标是"确认它是本地日历日的字符串"，
 * 不是引入 UTC timestamp 这个新概念。
 */

// ============================================================
// 七、5. 修复方案比较
// ============================================================

/**
 * Option A —— Storage-level fix
 * 做法：把 due_date（以及 due_time/due_datetime）列显式设为 Plain
 * Text，并对已经被误判成 Date 的既有单元格做一次"读出→按脚本时区
 * 格式化回 YYYY-MM-DD→写回"的数据重写。
 *
 * 优点：
 *   - 从根上堵住问题，对所有读 due_date 的地方都有好处，不只是
 *     identity 计算——包括未来任何新写的功能。
 *   - 跟 15_Setup.js 本来的设计意图一致，不是新发明一条规则。
 *
 * 缺点：
 *   - 仅仅改"格式"（setNumberFormat）不会让已经被转换成 Date 的
 *     既有单元格自动变回字符串——那只影响之后的新写入。要修好
 *     已经存在的数据，必须额外做一次"读出、按正确时区转回
 *     YYYY-MM-DD、再写回"的重写步骤，这本身是一次需要谨慎验证的
 *     data migration，而不是一次纯格式操作。
 *   - 不能防住"以后又有新代码路径直接构造/传入一个 Date object"
 *     这类问题——它是数据层的防护，不是计算层的防护。
 *   - 需要 Carson 在真实 Spreadsheet 上执行，这次沙盒环境没有
 *     真实表格，没法代跑或代验证。
 *
 * 对现有数据影响：如上，格式改动本身不改变已经错误存储的值，需要
 * 配一次显式重写。
 * migration requirement：是，且是"数据值"迁移（重写 due_date
 * 存量值），不是 identity 迁移。
 * 对 UI / Query / Reminder / Scheduler 的影响：这些路径本来就已经
 * 靠 parseDueDate_ / new Date(...) 重新解析 due_date（能同时正确
 * 处理 string 和 Date 输入——new Date(existingDateObject) 在 JS 里
 * 本来就是合法且正确的克隆），所以让 due_date 稳定变回纯字符串，
 * 对它们只有更一致、没有负面影响。
 * 单独是否足够：不足够——见上面两条缺点（存量数据不会自动修好；
 * 不防未来新代码路径）。
 *
 * ---
 *
 * Option B —— Identity defensive normalization
 * 做法：在 resolveIdentityDueValue()（或它的调用点）里加一层归一化：
 * 如果传入的是字符串（且已经是 canonical 格式），原样返回；如果
 * 传入的是 Date 对象，用 Utilities.formatDate(value, 脚本真实时区,
 * 'yyyy-MM-dd' 或 'yyyy-MM-ddTHH:mm:ss') 转回 canonical string 再返回。
 *
 * 优点：
 *   - 不依赖 Sheet 里实际存的是什么类型，identity 计算这一层自己
 *     兜底，是纵深防御。
 *   - 不需要碰 Carson 的真实 Spreadsheet 数据，纯代码改动，风险和
 *     范围都更可控。
 *   - 只要设计成"已经是 canonical string 就原样返回"，对创建时
 *     100% 走 string 输入的既有路径是纯 no-op——不改变任何既有
 *     identity（详见「六」）。
 *   - 同时也能顺手把「四」第 4 条 RecurringEngine 那条"目前靠巧合
 *     没出事"的路径，从"侥幸正确"变成"设计上就正确"。
 *
 * 缺点：
 *   - 不解决 due_date 存储本身的类型不一致问题——除 identity 计算
 *     之外的其他消费方（比如未来某个新报表、新功能直接读
 *     due_date）依然可能拿到 Date 而不是 string，需要自己处理
 *     （虽然目前看到的消费方基本都已经在用 new Date(...) 重新
 *     解析，能兼容）。
 *   - 归一化逻辑本身需要用脚本的真实时区（Session.
 *     getScriptTimeZone()）格式化，如果时区参数传错，会引入新的
 *     "看起来对但其实差一天"的 bug——这正是「六」分析过的那类
 *     问题，需要非常小心地验证，不能想当然。
 * 对旧 identity 的影响：无（见「六」，创建路径恒为 string 输入，
 * 归一化对它是 no-op）。
 * 是否会改变既有 hash：不会。
 * 对 ProjectionRebuilder 的影响：无额外影响（它的 due_date 来源
 * 本来就是 string，见「四」第 2 条）；顺带在它的两处调用点也加上
 * 同样的归一化是安全的加固，不是必须。
 * 对 retry / idempotency 的影响：让「四」第 4 条 RecurringEngine
 * 那条路径不再依赖侥幸的类型转换链条。
 *
 * ---
 *
 * Option C —— Both
 * 推荐两层同时存在，而且明确它们解决的是两个不同问题，不是重复
 * 设计：
 *   - Storage-level（Option A）解决的是"due_date 这个字段本身，
 *     对所有消费方而言，应该始终是稳定的字符串"这个更广泛的数据
 *     质量问题。
 *   - Identity-level（Option B）解决的是"不管存储层现在是什么状态
 *     （包括迁移不完整、未来又引入新的类型不一致），identity 计算
 *     这一个特定的、对幂等性/去重至关重要的路径，必须始终稳定"这个
 *     更窄、但风险等级更高的问题。
 * 两者不冲突、不重叠——Storage-level 修完之后，Identity-level 的
 * 归一化在正常情况下大部分时间只是走"已经是 string，原样返回"这个
 * no-op 分支，但仍然值得保留作为兜底，因为 identity 稳定性的代价
 * （错误的重复检测/幂等判断）比其他消费方拿到 Date 对象的代价要
 * 高得多。
 */

// ============================================================
// 八、6. Legacy Identity Compatibility（硬性要求）
// ============================================================

/**
 * 对一个已经存在的 Task，如果没有 workflow_id，新逻辑是否仍然产生
 * 完全相同的 identity？
 *
 * 这个问题属于 Track 1A，已经在真实环境确认：
 * runIdentityScopeKeyRegressionGate() 里的
 * testIdentityScope_LegacyUnchanged_ 真实环境 PASS——scopeKey 缺省时
 * 哈希逐字节不变，已经不是待验证事项。
 *
 * 对一个已经存在的 Task，如果 due_date 从 Sheet Date object
 * normalize 成 "YYYY-MM-DD"，是否会改变旧 identity？
 *
 * 不会改变任何"旧"identity 的存量值——原因见「五」3.3 的完整推导：
 * canonicalize 这个改动本身不会主动重写 Sheet 里已经存在的 identity
 * 列的值；它只改变"以后调用 resolveIdentityDueValue() 时该怎么处理
 * Date 输入"这一条逻辑。已经存在的 identity 值是安全的。
 *
 * 会发生变化的是：以后第一次对某个 Task 触发
 * updateTask()/ProjectionRebuilder 重算时，重算出来的 identity 会
 * 从"错误地跟创建时不一致"变成"正确地跟创建时一致"——这是修复
 * bug，不是破坏兼容性；唯一的前提条件是 00_Known_Limitations.gs 里
 * 记录的"updateTask() 目前无人调用"这个事实为真（见下面的诚实
 * 保留）。
 *
 * 是否需要 migration / 禁止直接修改 / legacy compatibility mode /
 * versioned identity / 只对新 context-aware path 使用新规则：
 *
 * 都不需要。归一化函数只要满足"输入已经是 canonical string 时
 * 原样返回"这一个设计约束，就是对 100% 既有 identity 计算路径的
 * no-op——不需要额外的兼容层、版本标记或分路径规则，这跟 Track 1A
 * workflow_id 那条修复用的是同一套"可选、向后兼容、无需 migration"
 * 的设计原则，不需要为 Track 1B 另外发明一套。
 *
 * 诚实的保留：上面"不会改变任何旧 identity"的结论，前提是
 * 00_Known_Limitations.gs 记录的"updateTask() 至今没有真实调用方"
 * 这一条属实。这是本仓库自己的文档声明，不是我能独立核实
 * Carson 真实 Event_Log 历史的证据——如果实际上曾经有某个我不知道的
 * 外部脚本/人工操作调用过 updateTask() 并触发过带 due_date 的
 * identity 重算，那一小部分 identity 有可能已经受这个 bug 影响。
 * 这一点无法从代码库本身证明或排除。
 */

// ============================================================
// 九、7. Track 1A / Track 1B 分离状态
// ============================================================

/**
 * Track 1A —— Workflow-scoped Task Identity
 * 状态：已完成，真实环境已确认。
 * - workflow_id 作为 scope key，legacy 行为不变，无需 migration。
 * - runIdentityScopeKeyRegressionGate() 真实环境 5/6 通过；唯一失败
 *   （testIdentityScope_UpdateTaskPreservesScope_）已定位为 Track 1B
 *   这个独立问题，不是 Track 1A 本身的缺陷——见本文件全篇。
 *
 * Track 1B —— Due-Date Canonicalization / Identity Stability
 * 状态：AUDIT_PENDING_IMPLEMENTATION（本文件）。
 *
 * 两者代码改动不会混在一起：Track 1A 已经落地的改动
 * （07_IdentityEngine.js 的 scopeKey 参数、09_IdempotencyManager.js/
 * 20_TaskEngine.js 的调用点、39_Tests_IdentityScopeKey.js）都不涉及
 * due_date 归一化；Track 1B 一旦获批实施，改动范围会是
 * resolveIdentityDueValue()（及可能的 Sheet 格式/数据迁移），不会
 * 反过来改动 scopeKey 相关逻辑。
 */

// ============================================================
// 十、9. Recommendation（可审计）
// ============================================================

/**
 * 1. 是否需要修复？
 *    Yes。
 *
 * 2. 如果需要，推荐：
 *    Both（Option C：Storage-level fix + Identity-level defensive
 *    normalization）。
 *
 * 3. 为什么（引用前面的实际 findings）：
 *    - 「三」「四」第 3 条：20_TaskEngine.updateTask() 的 identity
 *      重算已经在真实环境实测失败，这是确定发生、不是假设的问题；
 *      Track 2 的 UI-I2（Edit Task）是这个函数第一个真实调用方，
 *      不修的话，这个 bug 会随 Track 2 的实际使用开始产生错误的
 *      生产 identity。
 *    - 「四」第 4 条：21_RecurringEngine.spawnNextIfNeeded（
 *      completeTask 后自动续期 recurring 任务，属于已经在用的核心
 *      功能）目前没有出错，但已经证实是靠一条没人设计过的 JS 隐式
 *      类型转换链条侥幸撑住的，不应该长期依赖这种巧合。
 *    - 「五」3.1：15_Setup.js 明确表达了"due_date 应该是 Plain
 *      Text"的设计意图，但真实环境证明这个意图目前没有兑现——这个
 *      矛盾本身不只影响 identity，值得在数据层面一并解决，否则
 *      未来任何新功能读 due_date 都可能踩到同一个坑。
 *    - Option A 和 Option B 解决的是两个不同层面的问题（见
 *      「七」Option C 的说明），单独任何一个都不完整。
 *
 * 4. 是否需要 migration？
 *    Data-only migration——针对 due_date 这一列已经存在的、被
 *    误判成 Date 的单元格值，需要一次"读出→按脚本真实时区格式化回
 *    YYYY-MM-DD→写回"的数据重写（配合 Option A 的存储层格式修复）。
 *    不需要 identity migration——见「八」的完整推导，canonicalize
 *    这个改动本身不会主动重写任何已存在的 identity 存量值。
 *
 * 5. 是否应该与 Track 1A 一起实施？
 *    不应该。Track 1A 已经完成并且是独立可用的——它的正确性不依赖
 *    Track 1B 是否修复（scopeKey 逻辑本身没有问题，唯一暴露出来的
 *    失败原因是 due_date，不是 workflow_id）。没有发现任何强技术
 *    依赖要求这两者必须同时改动或同时上线，符合 Carson 默认的
 *    "除非证明存在强技术依赖，否则保持两个 change set 独立"这条
 *    要求。建议 Track 1B 作为独立的下一个 Track（可以叫 Track 1B
 *    或者单独编号），走它自己完整的 preflight → 实施 → 真实环境
 *    验证流程。
 */

// ============================================================
// 十一、10. Required Regression Test Proposal（仅提议，不实现代码）
// ============================================================

/**
 * 实施后必须新增的测试（建议命名空间：Tests_DueDateCanonicalization）：
 *
 * 【归一化函数本身的单元测试，纯函数，不需要真实 Sheet】
 * 1. Canonical string 输入原样返回：'2026-08-25' → '2026-08-25'
 *    （逐字节相等，验证 no-op 性质）。
 * 2. 带时间的 canonical string 原样返回：
 *    '2026-08-25T09:00:00' → '2026-08-25T09:00:00'。
 * 3. Date 对象正确归一化：一个代表"脚本时区 2026-08-25 00:00:00"的
 *    Date 对象 → 'yyyy-MM-dd' 分支，'2026-08-25'（不是 '2026-08-24'，
 *    这是本次 bug 的核心回归点，必须显式覆盖时区换算方向）。
 * 4. 空值/undefined/null 输入：仍然返回 ''（不改变既有行为）。
 * 5. due_datetime 优先于 due_date 的既有规则，在归一化前后保持不变
 *    （防止归一化逻辑不小心破坏这条已有优先级）。
 *
 * 【回归 Track 1A 的既有 6 项，确认两个修复不互相干扰】
 * 6. 重跑 39_Tests_IdentityScopeKey.js 全部既有用例，确认归一化
 *    上线后 legacy-unchanged / same-different-workflow /
 *    no-collision / repeat-instantiate 四项依然全部通过。
 *
 * 【真实 Sheet 集成测试】
 * 7. testIdentityScope_UpdateTaskPreservesScope_（已存在于
 *    39_Tests_IdentityScopeKey.js，目前失败）：归一化上线后应该转为
 *    PASS，不需要改测试本身的期望值——这条测试从一开始的设计就是
 *    对的，错的是被测代码缺一层归一化。
 * 8. 新增：create（due_date 只给日期）→ 真实 Sheet 读回（预期
 *    Date 对象）→ updateTask 编辑非 due_date 字段 → 重算 identity
 *    应该等于"用同样字段、创建时那种 canonical string 手工重算"的
 *    结果——跟第 7 条本质相同，但显式针对"只给日期没给时间"这个
 *    最常见的场景单独留一条，避免以后重构时被无意合并/删掉。
 * 9. RecurringEngine.spawnNextIfNeeded：构造一个 due_date 是真实
 *    Date 对象（不是 string）的 task 快照喂进去，确认算出来的
 *    "下一次到期日"仍然是正确的日历日期——把「四」第 4 条那条目前
 *    "侥幸正确"的路径，转成一条有真实断言、不再依赖巧合的测试。
 *
 * 【如果同时实施 Option A（Storage-level）】
 * 10. 数据迁移脚本本身的验证：迁移前后，同一个 Task 行读回的
 *     due_date 语义上代表同一个日历日期（不是同一个 Date 对象/同一个
 *     时间戳，是同一个业务日期字符串），且迁移过程不触发任何
 *     identity 重算或改写。
 */
