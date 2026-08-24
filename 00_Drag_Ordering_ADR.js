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
// G. Ownership of the Context-Scoped Ordering Entity（2026-08-24 新增，
//    Carson 明确要求：在他做最终决定之前，先把这一节写清楚——"叫它
//    ordering entity"本身不能让它变成 ownership-neutral，必须对
//    Inbox/Today/Weekly/Project/Workflow/Goal/Review/Timeline 逐一
//    明确回答"这份数据到底是谁的"）
// ============================================================

/**
 * H.1 判断方法——复用既有测试，不新发明一套
 *
 * 「E」已经确认：三个候选模型本身都不违反"Execution 永远不拥有
 * Business Data"，因为三者都是纯 Domain 内部数据。但那个结论只回答了
 * "模型 3 这个模式本身合法"，没有回答"每一个具体 context 的那一份
 * 排序数据，实际归谁"——这正是 Carson 要求补的这一节。
 *
 * 判断标准照抄 Dashboard Ownership Precedent
 * （00_Domain_Boundary.gs「四」，ADR-2026-07-24-007）和 Review
 * Ownership Test（00_Domain_Boundary.gs「五」）已经确立的同一套逻辑，
 * 不重新发明：
 *
 *   对每个 context，问一个问题——"这个 context 下被排序的那些条目，
 *   是不是只来自本 Domain（Personal Life OS）自己的表？"
 *     → 只需要本 Domain 自己的数据就能回答 → Personal Life OS Domain
 *       state。
 *     → 需要跨至少一个其它 Domain/OS 的数据才能回答（条目本身来自
 *       多个 Domain 的聚合）→ Life Execution OS state。
 *
 * "Ownership 由数据决定，不由名称决定"（Carson 原话）在这里的具体
 * 含义：两个完全不同的东西可能共享同一个名字——00_Domain_Boundary.gs
 * 「二」的 Ownership Matrix 里已经有先例："Dashboard"和"Review"都是
 * 一个名字对应两种不同 ownership 的数据（Domain 版 vs Execution 版，
 * 用同一个测试区分）。下面会看到"Today"/"Weekly"正是同一个陷阱的
 * 第三个例子——必须先拆成"哪一个 Today"才能回答 ownership，不能看到
 * 名字就下结论。
 *
 * H.2 逐 context 结论
 *
 * **Inbox** → Personal Life OS Domain state。
 *   这是"本 Domain 自己尚未归类/全部 Tasks"的视图，条目 100% 来自
 *   Personal Life OS 自己的 Tasks 表。context_key 例如 'INBOX' 或
 *   'ALL_OPEN_TASKS'（沿用「D」已经举过的例子）。
 *
 * **Project** → Personal Life OS Domain state。
 *   Project 本身和它下面的 Task 都是本 Domain 拥有的 Business Data
 *   （00_Domain_Boundary.gs「二」矩阵）。context_key 例如
 *   'PROJECT:<project_id>'（「D」原有例子）。
 *
 * **Workflow** → Personal Life OS Domain state，但带一条必须守住的
 *   边界，不是"跟 Project 一样直接照抄"：
 *   Workflow 已经有一个"步骤顺序"的既有权威字段——sequence_index
 *   （「A」已经详细论证过它是 Workflow Template 的编排语义，不是
 *   用户手动排序）。如果 Workflow context 下的拖拽排序，被误用成
 *   "改这个 Task 在 Workflow 执行序列里的位置"，就是「A」已经警告过的
 *   同一个冲突重新发生一次，只是这次是在"给排序找 ownership"这一步
 *   而不是"复用哪个字段"这一步犯错。必须明确写下来：Workflow
 *   context 的 context-scoped ordering entity 只表达"用户在这个
 *   Workflow 视图里想怎么看"，永远不覆写、不参与 sequence_index
 *   的任何计算——两者即使将来共享同一张 TaskViewOrder 表的存储机制，
 *   语义上也是完全不相交的两件事。如果 Carson 未来真的想要"拖拽改变
 *   Workflow 执行顺序"这个功能，那是一个需要单独提出、单独批准的
 *   不同能力，不是 UI-I6 顺带覆盖的范围。
 *
 * **Review** → Personal Life OS Domain state——但这里指的是本项目
 *   自己的 Review Engine（40_ReviewEngine.gs，Required Modules 之一），
 *   不是 Domain Boundary 矩阵里"Execution Review"那一行。跟
 *   Dashboard/Review 已经确立的判断标准完全一致：本项目的 Review
 *   只读本 Domain 自己的 Task/Project/Workflow 数据就能生成
 *   （00_Domain_Boundary.gs「五」），所以它内部"先看哪几项"的排序
 *   需求，同样是 Domain state。如果 Carson 说的"Review"其实指的是
 *   跨 Domain 的 Execution Review 界面，结论要翻转成 Life Execution
 *   OS state——这正是本节要强调的"先分清哪一个，再判断 ownership"。
 *
 * **Timeline** → 不建议引入 context-scoped ordering entity，即使
 *   技术上"能做"。00_Domain_Boundary.gs「二」矩阵已经把 Timeline
 *   定义为"本项目的完整历史流水账"——它的自然顺序是时间戳先后，
 *   一份历史记录被用户手动拖拽重排，等于允许用户改写历史发生的
 *   顺序，这跟 Timeline 存在的目的（如实记录发生过什么）直接矛盾。
 *   如果未来确实需要"Timeline 里我想把某几条置顶看"这种纯浏览偏好，
 *   那是 View-local state（见 H.2 末尾对这一类的定义），不应该
 *   通过给 Timeline 条目分配 order_index 的方式实现，避免跟"Timeline
 *   = 真实历史顺序"这个语义混在一起。
 *
 * **Today / Weekly** → 视具体所指分裂成两个不同答案，这是本节最容易
 *   被简化掉、但 Carson 明确要求讲清楚的一点：
 *
 *   (a) 本项目 24_ViewEngine.gs 已有的 today()/thisWeek()——
 *       实测确认（24_ViewEngine.js 文件头 ADR-2026-07-06 注释 +
 *       函数体本身）这两个函数是纯函数，对一个已经在内存里的 Task
 *       数组按 due_date 做筛选，不读取任何持久化的顺序，本项目 UI
 *       目前也还没有一个专门渲染它们的面板（nav 里只有
 *       Notes/Tasks/Projects 三项，见 ui_index.html）。如果未来
 *       给这个 Domain-local 的筛选视图加手动排序，条目 100% 来自
 *       本 Domain 自己的 Tasks 表，跟"Inbox"是同一种情况——
 *       ordering entity 归 Personal Life OS Domain state，
 *       context_key 例如 'TODAY'/'THIS_WEEK'，不违反任何边界。
 *
 *   (b) 00_Domain_Boundary.gs「二」矩阵里的"Today View"/"Weekly
 *       View"——明确标注为 Life Execution 拥有，是跨 Domain 聚合
 *       视图（未来会同时拉 Personal Life OS + Property OS +
 *       Investment OS 等多个 Domain 的条目）。这个视图如果要支持
 *       手动排序，ordering entity 必须是 Life Execution OS state，
 *       不能是本项目的表——原因不只是"Execution 不该拥有 Business
 *       Data"，反过来同样成立："本 Domain 也不该拥有一份需要引用
 *       其它 Domain 条目的排序数据"，因为那份排序数据的条目集合本身
 *       就已经超出了本 Domain 的可见范围，只有 Execution 才有完整的
 *       跨 Domain 视野去维护它。
 *
 *   跟 Reference Integrity（00_Domain_Boundary.gs「七」）的衔接：
 *   Execution 侧如果要实现 (b) 的排序，做法是在 Execution 自己的
 *   存储里放一张结构相同的 {context_key, item_ref, order_index} 表，
 *   item_ref 用 Execution 已经在用的 Reference 信封（ReferenceID/
 *   SourceOS/EntityType/EntityID/Snapshot/LastSyncTime）而不是直接
 *   引用本 Domain 的 task_id——这样排序数据本身也遵守"Execution 只
 *   持有 Reference，不持有 Domain 实体"的既有契约，本 Domain 完全
 *   不需要知道这张表存在，也不需要为它开放任何写权限。这不是本项目
 *   需要实现的部分（超出 Personal Life OS 的 Schema Authority），
 *   本节只负责说清楚"如果做，应该做在哪、用什么形状"，呼应「E」已经
 *   指出的"模式可以被复用，数据不可以被共享"这条原则——这里是把
 *   同一条原则，从"未来 Domain OS"，扩展到"Life Execution OS 自己"
 *   这一个方向。
 *
 * **Goal** → Life Execution OS state，理由跟 Today/Weekly 的 (b)
 *   完全一致——00_Domain_Boundary.gs「二」矩阵已经把 Goal 标注为
 *   Life Execution 拥有。Goal 下面引用的 Project/Task 可能横跨多个
 *   未来 Domain OS，排序如果需要，同样通过 Execution 自己的
 *   {context_key, item_ref, order_index} 表 + Reference 信封实现，
 *   不进入本项目的 Schema Authority。
 *
 * "Shared infrastructure state"这个选项在以上 8 个 context 里没有
 * 一个成立——这里明确排除，不是漏看：让 Personal Life OS 和 Life
 * Execution OS 共同写同一张排序表，等于同时违反两边的 Schema
 * Authority（00_Data_Ownership.gs「一」，"每一张表只有一个模块可以
 * 写"这条铁律不因为存的是排序数据、不是 Business Data 本身而放松）。
 * 会被复用的是模式（{context_key, item_id/item_ref, order_index}
 * 这个形状），不是任何一张具体的表。
 *
 * H.3 提议实体的完整规格（限本项目 Schema Authority 内：Inbox/
 *     Project/Workflow/Review 四个 context；Today(b)/Weekly(b)/Goal
 *     的 Execution 侧实体形状已在 H.2 描述，具体规格属于 Life
 *     Execution OS 自己的 ADR，不在本文件的权限范围内）
 *
 *   **Identity**：复合键 (context_key, task_id)，不需要单独的
 *   identity/hash——这是纯位置元数据，不是需要去重的 Business
 *   实体，天然键就是这个二元组本身，跟 Task/Project 的
 *   Canonical Identity 系统（07_IdentityEngine.gs）是两回事，不共用
 *   也不需要共用。
 *
 *   **Owner（写权限）**：新表的唯一写入模块沿用既有 Schema Authority
 *   模式（00_Data_Ownership.gs「一」）——比照 Sprint 1 新表的既有
 *   先例（并入 10_ProjectionEngine.gs 的既有写权限，而不是开一个新
 *   模块），不给 50_UIBridge.gs 任何直接写权限（呼应「六」"UIBridge
 *   不新增任何一张表的写入权"这条已经确立的规则）。
 *
 *   **Storage**：新表 TaskViewOrder（chat_id, context_key, task_id,
 *   order_index, updated_time）。吸取 Track 1B 的教训（due_date 的
 *   存量数据被 Sheets 静默转换成 Date 对象），15_Setup.js 注册这张表
 *   时对 context_key/task_id 两列显式做 Plain-Text 格式化
 *   （沿用 _setPlainTextFormatForNewColumns_ 既有工具函数），不留
 *   同样的隐患。
 *
 *   **Lifecycle**：没有 DRAFT/READY 等生命周期状态——纯位置数据，
 *   写入即生效，用 upsert 语义（同一个 (context_key, task_id) 的
 *   新 order_index 直接覆盖旧值），不是追加式的版本历史。
 *
 *   **Event semantics**：一次拖拽操作产生一个 VIEW_ORDER_UPDATED
 *   事件，payload 是 {context_key, ordered_task_ids: [...], chat_id}
 *   ——整份新顺序一次性提交，不是每挪动一个 Task 就发一个事件（避免
 *   一次拖拽拆成 N 个事件）。事件本身依然写入 Events 表，遵守
 *   "真相来源是 EVENTS 表"这条全项目铁律（00_Data_Ownership.gs），
 *   跟其它任何 Business Event 一样是追加式、永久保留。
 *
 *   **Projection behavior**：收到 VIEW_ORDER_UPDATED 后，对该
 *   context_key 做整体覆盖式重写（清除该 context_key 的旧行，按
 *   ordered_task_ids 的顺序重新写入 order_index），不是增量 patch——
 *   这是 Read Model 层面的"当前状态"覆盖，跟 Tasks 表本身也是
 *   Projection 出来的当前状态（完整历史仍在 Events 表）是同一套
 *   已有模式，不是例外。
 *
 *   **Cross-device behavior**：因为存储在 Sheet（服务端），不是
 *   浏览器 localStorage 或任何客户端专属存储，同一个 chat_id 在
 *   不同设备/不同浏览器会话打开同一个 context，看到的是同一份
 *   最后保存的顺序——这是选择 Model 3（服务端持久化）而不是纯前端
 *   方案的直接好处之一，不需要额外设计就自然成立。
 *
 *   **Deletion behavior**：本项目里没有硬删除——Task/Project 的
 *   "结束"永远是状态字段（COMPLETED/CANCELLED/ARCHIVED），不是
 *   物理删除行（00_Data_Ownership.gs「五」，"只增不删,用状态字段
 *   表达'结束'"）。所以 TaskViewOrder 也不需要一套主动的级联删除
 *   机制去响应"Task 被删除"这种事件——这种事件本来就不存在。唯一
 *   需要考虑的删除场景是 context 本身的整体废弃（例如一个 Project
 *   被 ARCHIVED），此时对应 context_key 的 TaskViewOrder 行不需要
 *   立刻清理，见下一条 Orphan behavior。
 *
 *   **Orphan behavior**：跟「B」已经指出的模型 2（数组）的核心风险
 *   不同——模型 2 的风险是"数组里引用一个已经不在这个 Project 下的
 *   task_id"需要主动维护一致性；模型 3 每一行独立存在，一个 task_id
 *   不再出现在某个 context 的当前结果集里（比如任务已完成、被移到
 *   别的 Project），对应的 TaskViewOrder 行只是变得"不会再被读到"，
 *   不会破坏任何渲染逻辑，也不产生"数组里有一个无效引用"这类需要
 *   显式校验的错误状态——这一点「D」「E」已有的论证在这里同样成立，
 *   本节只是把它显式列进 Carson 要求的这份清单。这类"不会再被读到"
 *   的行属于被动废弃，不需要实时清理；如果未来 Sheet 行数变成实际
 *   问题，可以照抄 11_ProjectionRebuilder 的既有模式做一次性清扫，
 *   这是运维层面的房务工作，不是本 ADR 需要现在解决的正确性问题。
 *
 * 本节到此为止仍然只是分析——不改变 UI-I6 的状态，也不引入
 * TaskViewOrder 或任何对应代码，见「H」。
 */

// ============================================================
// H. UI-I6 状态
// ============================================================

/**
 * UI-I6 = BLOCKED_PENDING_ARCHITECTURE_DECISION（不变）。
 * 本 ADR 的推荐意见本身不构成批准——按 Carson 原话："不要把 ADR
 * 推荐当成批准"。UI-I1~I5、Track 1A、Track 1B 均不因本 ADR 的状态
 * 而受影响，四条线继续独立，见 00_Project_State.gs「十六」。
 */
