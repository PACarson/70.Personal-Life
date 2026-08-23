/**
 * 00_Drag_Ordering_ADR.gs
 * Personal Life OS — UI-I6 Drag Ordering: Architecture Decision Record
 *
 * 状态：本文件是 ADR 草案本身，尚未被 Carson 批准。UI-I6 的实施状态
 * 保持 BLOCKED_PENDING_ARCHITECTURE_DECISION——这份 ADR 提出推荐方案，
 * 不等于批准；Track 2 的 UI-I1~I5 不依赖、也不会因为这份 ADR 是否
 * 批准而被阻塞。
 */

// ============================================================
// A. 问题陈述 + 既有 precedent
// ============================================================

/**
 * 问题：用户想在 UI 里拖拽调整 Task 的显示顺序（"手动排序"），需要
 * 一个地方存"用户手动排好的这个顺序"。
 *
 * 已有的、容易被误认成"现成答案"、但其实是另一回事的字段：
 * sequence_index（20_TaskEngine.js:168, 219；41_BusinessRuleEngine.js:147）
 * ——这是 Business Rule/Workflow Template 里"步骤本来的编排顺序"
 * （比如"检查外墙"=1、"检查水电"=2，41_BusinessRuleEngine.js:76-77
 * 测试数据），在 instantiateFromTemplate 时按这个值排序生成 Task
 * （41_BusinessRuleEngine.js:147:
 * tasks.sort(function(a,b){ return sequence_index 差值 })）。
 * 这是"模板作者定的步骤顺序"，不是"某个用户在 UI 里拖出来的顺序"——
 * 如果 UI-I6 直接复用这个字段，会跟 Workflow 自己的编排语义冲突：
 * 用户在 Tasks 面板拖一下，就可能悄悄改写了这个 Task 所属 Workflow
 * 的步骤顺序，这是两件完全不同的事被同一个字段意外绑在一起。这正是
 * 「三」12 条里"不能不经批准就引入 Task.manual_order 等字段"这条
 * 安全阀存在的理由之一——同样的风险（"看起来现成、其实语义不对"）
 * 同样适用于任何顺手复用既有字段的冲动。
 *
 * Dashboard Ownership Precedent（ADR-2026-07-24-007，
 * 00_Domain_Boundary.gs「四」）：判断标准是"Ownership 由数据决定，
 * 不由名称决定"——具体到 Dashboard，是"这份数据只需要读本 Domain
 * 自己的表就够，还是需要跨 Domain 读"。把同一个判断标准套到 Task
 * Ordering 上：这份"顺序"数据，本质上是"某个用户在某个具体查看
 * 场景下排出来的顺序"，会不会随场景变化而需要不同的值？如果同一个
 * Task 可能同时出现在"全部 Tasks"视图和"某个 Project 下的 Tasks"
 * 视图里（下面「E」会论证这不是假设），这份顺序数据的自然归属就
 * 不是"Task 自己"（一个标量字段answer不了"在场景 A 排第几、在场景 B
 * 排第几"这种双重问题），而是"场景本身"——跟 Dashboard Ownership
 * 的推理结构是同一种：不能因为"这是 Task 的顺序"就想当然把字段焊
 * 在 Task 上，要看这份数据实际依赖什么、随什么变化。
 */

// ============================================================
// B. 候选模型 1 —— Task-owned scalar field
// ============================================================

/**
 * 做法：Task 新增一个字段（比如 manual_order，数字或浮点），跟
 * sequence_index 分开、互不干扰，drag 时只改这一个新字段。
 *
 * 优点：
 *   - 实现最简单，改动面最小——UPDATABLE_FIELDS 加一项，UIBridge
 *     加一个 ui_reorderTask() 之类的函数，前端拖拽结束时调一次
 *     ui_updateTask(taskId, {manual_order: N})，复用 Track 2 已经有的
 *     Edit 写路径，几乎不需要新概念。
 *   - 跟既有"字段直接挂在实体上"的模式（priority/category 都是这样）
 *     视觉上最一致，未来维护者最容易看懂。
 *
 * 缺点：
 *   - Multi-context 完全撑不住（见「E」）——一个标量存不下"这个 Task
 *     在场景 A 该排第几、在场景 B 又该排第几"这两份不同的信息，用户
 *     在"全部 Tasks"视图拖一下，会让"某个 Project 下的 Tasks"视图
 *     的顺序也跟着变，即使用户当时压根不是在那个视图里操作。
 *   - 容易在视觉/命名上跟既有 sequence_index 混淆（见「A」），需要
 *     格外清楚的文档和字段命名来避免以后被误用/合并。
 *   - 如果之后真的需要多场景各自独立排序，这个字段本身没法优雅升级，
 *     大概率要整个推倒重来（不是加字段就能扩展，是数据模型选错了）。
 */

// ============================================================
// C. 候选模型 2 —— Project-owned ordering array
// ============================================================

/**
 * 做法：Project 新增一个字段（比如 task_order，存这个 Project 下
 * Task id 的有序数组/JSON 字符串），代表"这个 Project 视角下 Task
 * 该按什么顺序显示"。
 *
 * 优点：
 *   - 对"在某个 Project 详情页里拖拽排序它下面的 Task"这一个具体
 *     场景，是精确匹配的解——顺序信息天然属于"这个 Project 怎么看待
 *     它自己的 Task"，不需要碰 Task 本身的 schema。
 *   - 完全不改 Task 的既有字段/UPDATABLE_FIELDS，风险最集中、最容易
 *     审查（只碰 27_ProjectEngine.gs 一个文件）。
 *
 * 缺点：
 *   - 只覆盖"某个 Project 内部"这一种场景——如果用户还想要"我全部
 *     open Tasks，不分 Project，按我自己的心意排"，这个模型完全没有
 *     地方存这份信息，需要另外发明一套（等于是模型 2 + 模型 3 拼在
 *     一起，复杂度没有真的省下来，只是把"全局顺序"这部分推迟了）。
 *   - 一个 Task 被移出/移入 Project（Track 2 目前没有这个操作，但
 *     架构上 project_id 是 UPDATABLE_FIELDS 的一部分，理论上未来可能
 *     有）时，谁负责保持 task_order 数组不引用一个已经不在这个
 *     Project 下的 task_id？这是一个需要额外维护的一致性责任，模型 1
 *     和模型 3 都不需要操心这个（各自的顺序信息天然跟着 Task 或者
 *     跟着场景走，不需要一个"数组里的 id 是否还有效"的额外校验）。
 */

// ============================================================
// D. 候选模型 3 —— Context-scoped ordering entity（独立实体）
// ============================================================

/**
 * 做法：新增一个轻量、通用的排序记录（不叫 Task 也不叫 Project 的
 * 表，比如 TaskViewOrder：{context_key, task_id, order_index}}）——
 * context_key 可以是 "ALL_OPEN_TASKS" 这种全局场景，也可以是
 * "PROJECT:<project_id>" 这种按 Project 区分的场景，每一行代表"在
 * 这个具体场景下，这个 Task 排第几"。Task/Project 的既有 schema
 * 完全不动。
 *
 * 优点：
 *   - Multi-context 天然支持——同一个 task_id 可以同时在
 *     "ALL_OPEN_TASKS"场景下是第 3 位、在"PROJECT:xyz"场景下是
 *     第 1 位，两份记录互不干扰，因为它们是两行独立的数据，不是同一个
 *     字段被迫承担两种含义。
 *   - 纯增量，Task/Project/既有 UPDATABLE_FIELDS 一个字段都不用碰，
 *     不存在"跟 sequence_index 混淆"或者"未来要不要迁移既有字段"
 *     这类风险——这是这三个模型里对既有实体侵入性最小的一个。
 *   - 这是一个通用的"某个场景下，一组 id 该排什么顺序"的模式，不
 *     依赖任何 Task/Project 特有的语义——如果以后 Property OS 想给
 *     它自己的维修任务做类似的手动排序，可以照抄同一套结构（
 *     {context_key, item_id, order_index}），不需要每个 Domain OS
 *     各自发明一套；这跟"Execution 永远不拥有 Business Data"这条
 *     边界（00_Domain_Boundary.gs「一」）不冲突——这份排序数据完全
 *     待在本 Domain 自己的表里，不需要跨 Domain 读写，只是"这个模式
 *     本身可以被其它 Domain 复制"，不是"这份数据被其它 Domain 共享"。
 *
 * 缺点：
 *   - 实现成本最高——需要一个新的轻量 Query/Command（读某个
 *     context_key 下的排序、写一次拖拽后的新排序），不能像模型 1 那样
 *     直接复用 Track 2 已有的 ui_updateTask 写路径，是三个模型里
 *     新增代码量最大的一个。
 *   - 多一张表、多一层间接——对只有"一个 Project 内部拖拽"这一种
 *     真实需求的场景，这个模型是"为了以后可能用不上的灵活性，现在
 *     多付一次实现成本"，如果多场景排序需求最终被证明不存在，这份
 *     投入是过度设计。
 */

// ============================================================
// E. 跨模型的共性维度（Multi-context / Cross-OS / Storage / Migration）
// ============================================================

/**
 * Multi-context behavior：
 *   现有 12_TaskQueryEngine.getTasksByProject(projectId)（
 *   12_TaskQueryEngine.js:235）已经是一个真实存在、Sprint 1 就有的
 *   查询能力——"按某个 Project 查看它下面的 Task"不是假设出来的
 *   未来场景，是架构里已经支持、只是 Track 2 的 UI 还没有专门做一个
 *   面板去渲染它。一旦这样的 Project 详情视图上线，"全部 Tasks"面板
 *   （已有，Track 2 交付）和"某 Project 下的 Tasks"视图会同时存在，
 *   同一个 Task 会同时出现在两个地方——这就是模型 1 撑不住的具体
 *   场景，不是纸上谈兵。
 *
 * Cross-OS boundary：
 *   三个模型都是纯 Domain 内部数据，不需要跨 Domain 读写，都不违反
 *   "Execution 永远不拥有 Business Data"（00_Domain_Boundary.gs
 *   「一」）——这条边界不构成三选一的筛选条件。真正有区分度的是
 *   "模式本身能不能被未来的 Property OS/Investment OS 直接复用"：
 *   模型 1/2 的字段名字和挂载位置是 Task/Project 特有的，每个未来
 *   Domain OS 要照抄的话，需要自己决定"排序字段该叫什么、挂在哪个
 *   实体上"；模型 3 的 {context_key, item_id, order_index} 结构本身
 *   不含任何 Task/Project 特有语义，是三者里最适合直接被"未来所有
 *   Domain OS 的参考实现"（Carson 原话，00_Domain_Boundary.gs 文件头）
 *   这个定位复用的一个。
 *
 * Storage：
 *   模型 1：Tasks/ActiveTasks/ArchiveTasks 三张表各加一列（沿用
 *   _addColumnsIfMissing_ + _setPlainTextFormatForNewColumns_ 的既有
 *   模式，Track 1B 才刚验证过这个模式好用）。
 *   模型 2：Projects 表加一列（存 JSON 数组字符串）。
 *   模型 3：新增一张表，结构最简单（三列），但是全新的表，需要
 *   15_Setup.js 里注册。
 *
 * Migration cost：
 *   模型 1/2 都需要给已经存在的 Task/Project 回填一个初始顺序
 *   （否则既有数据在新字段上全是空值，排序退化成"看起来随机"）——
 *   这跟 Track 1B 刚做完的"存量数据回填"是同一类工作，有直接可以
 *   照搬的 Inventory→Dry-run→Write→Verify 流程可以复用
 *   （11_ProjectionRebuilder__DUE_DATE_VALUE_MIGRATION.gs 的结构）。
 *   模型 3 不需要动 Task/Project 的存量数据一个字节——新表从空开始，
 *   没有旧数据需要回填，migration cost 在这三个里最低。
 */

// ============================================================
// F. Recommendation
// ============================================================

/**
 * 推荐：模型 3（Context-scoped ordering entity）。
 *
 * 理由（引用「B」~「E」的具体发现，不是泛泛而谈）：
 *   1. 「E」已经确认 Multi-context 不是假设——getTasksByProject 早就
 *      存在，"全部 Tasks"+"某 Project 下的 Tasks"两种场景迟早会同时
 *      出现，模型 1 在这个具体、已经证实存在的场景下会直接坏掉
 *      （「B」缺点第一条）。
 *   2. 「A」已经指出 sequence_index 的既有语义冲突——模型 1 需要
 *      额外承担"如何让未来维护者不会把 manual_order 和
 *      sequence_index 搞混"这个持续的沟通成本，模型 3 完全不涉及
 *      Task 自己的字段，天然规避这个风险。
 *   3. 「E」的 Cross-OS boundary 分析指出模型 3 是三者里最适合被
 *      "未来所有 Domain OS 的参考实现"这个项目定位复用的一个——这
 *      不是锦上添花，是 Carson 自己对这个项目的定位（
 *      00_Domain_Boundary.gs 文件头引用的原话）。
 *   4. 「E」的 Migration cost 分析：模型 3 不需要碰 Task/Project 的
 *      任何存量数据，是三者里风险最低、最容易独立验证的一个——跟
 *      Track 1B 因为要碰存量数据而需要一整套 Backup/Dry-run/
 *      Verify 流程比，模型 3 从这类风险里完全脱身。
 *
 * Explicit trade-off（不回避）：模型 3 的实现成本确实是三者里最高的
 * ——需要一张新表、一套新的 Query/Command，不能像模型 1 那样几乎
 * 零成本复用 Track 2 已有的 ui_updateTask。如果 Carson 判断"多场景
 * 排序"这个需求短期内根本不会发生（比如已经决定 Project 详情视图
 * 半年内都不会做），模型 2 会是一个明显更便宜、且不构成技术负债的
 * 选择——这是一个关于产品优先级的判断，不是纯技术判断，本 ADR 只
 * 负责把技术层面的取舍讲清楚，最终选择需要 Carson 确认。
 *
 * Falsifiability / Reopening conditions：
 *   如果未来证实以下任何一条为真，本推荐应该被重新评估，不是靠
 *   继续论证撑下去：
 *     - Project 详情视图（getTasksByProject 对应的 UI）被证实
 *       长期不会做，"全部 Tasks 该怎么排"是唯一真实存在的排序需求
 *       ——此时模型 2（甚至模型 1，如果连"按 Project 排序"这个场景
 *       都不存在）会比模型 3 更合适，本 ADR 的推荐应该改。
 *     - 模型 3 实际实现后，Query/Command 的复杂度远超本 ADR 的估计
 *       （比如需要频繁的 context_key 失效清理逻辑，维护成本比预想
 *       的高很多）——此时需要重新比较模型 2 是不是够用。
 *     - sequence_index 这条既有语义冲突，被证实其实从未在真实生产
 *       数据里发生过混淆（比如 UI 从来不会让用户同时看到两种顺序
 *       语义），"A"里那条风险被证明是过度担心——这会削弱推荐模型 3
 *       而非模型 1 的理由之一，但不会单独推翻整个推荐（「E」的
 *       Multi-context/Cross-OS 论证依然独立成立）。
 *
 * Written-model vs shipped-code integrity：
 *   本 ADR 只是设计推荐，UI-I6 在这份 ADR 被 Carson 正式批准之前，
 *   状态保持 BLOCKED_PENDING_ARCHITECTURE_DECISION，不会有任何代码
 *   实现——本轮交付的是分析文档本身，不包含 TaskViewOrder（或任何
 *   其它模型对应）的 Schema/Engine/UIBridge 代码。
 *
 * 明确确认（Carson 要求的第 12 条安全阀）：在这份 ADR 被 Carson
 * 正式批准、并且批准结果明确选择"Task 拥有排序"这个方向之前，不会
 * 引入 Task.manual_order / Task.display_order 或任何同类字段——
 * 即使模型 3 最终被否决、退回模型 1，也需要 Carson 明确批准这个
 * 具体方向之后才会写代码，不会因为这份 ADR 存在推荐意见就视为
 * 已经批准。
 */

// ============================================================
// G. UI-I6 状态
// ============================================================

/**
 * UI-I6 = BLOCKED_PENDING_ARCHITECTURE_DECISION（不变）。
 * 本 ADR 的推荐意见本身不构成批准——按 Carson 原话："不要把 ADR
 * 推荐当成批准"。UI-I1~I5、Track 1A、Track 1B 均不因本 ADR 的状态
 * 而受影响，四条线继续独立，见 00_Project_State.gs「十六」。
 */
