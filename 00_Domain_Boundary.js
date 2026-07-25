/**
 * 00_Domain_Boundary.gs
 * Personal Life OS v5.1（Design Phase）— Domain Boundary
 *
 * Changelog: v5.0 → v5.1——「四」Dashboard 冲突由 Proposed 正式 Accepted
 * 为"Ownership 由数据决定，不由名称决定"；新增「七」Reference Integrity
 * 契约（Execution 只能持有 Reference，不能复制 Entity）。见
 * 00_ADR.gs ADR-2026-07-24-007 / ADR-2026-07-24-012。
 *
 * 本文件对应需求「2. Boundary」。这是本设计包里安全等级最高的一份文件——
 * Carson 原话："这个 OS 很可能会成为未来所有 Domain OS 的参考实现"，
 * 也意味着这里画错一条线，以后 Property OS/Rider OS 等全部会照抄错误的
 * 边界。跟 00_Architecture.gs 的分工：Architecture 回答"这个 Domain
 * 长什么样"，本文件回答"这个 Domain 的边界在哪里、越界会怎样"。
 */

// ============================================================
// 一、Domain vs Execution（最高优先级的一条边界）
// ============================================================

/**
 * 铁律（Carson 在设计会话最开始就冻结，本文件正式收录，完整 ADR 见
 * 00_ADR.gs ADR-2026-07-24-002）：
 *
 *   Execution 永远不拥有 Business Data。
 *
 * Personal Life OS（本项目）拥有：
 *
 *   Business Project     — 项目本身（搬家/家庭整理/喂流浪猫计划/...）
 *   Business Task         — 任务（洗衣/晾衣/收衣/...）
 *   Workflow              — 任务编排（Sequential/Parallel/Branch/Loop/
 *                           Recurring）
 *   Timeline               — 完整历史流水账
 *   Business Event          — 本项目负责发布的 Events 表条目
 *   Recurring Task           — Task 级日历续期
 *   Routine                  →（本版本不做，见下方「三」的范围说明）
 *   Reminder Connector        — 只发布 ReminderRequested，不负责提醒
 *   Review                    — Daily/Weekly/Monthly 回顾
 *   Note Engine                — 暂存与转化
 *
 * Personal Life OS 绝对不能拥有（属于 Life Execution OS）：
 *
 *   Goal                      — 目标（一年/六个月级别的意图）
 *   Vision                    — 十年级别的愿景
 *   Execution Project          — "开发 Property OS" 这类 Execution 自己
 *                              的项目，不是 Business Project
 *   Today View                 — 跨 Domain 聚合的"今天"
 *   Weekly View                 — 跨 Domain 聚合的"本周"
 *   Dashboard（跨 Domain 版本）   — 见下方「四、一处需要确认的冲突」，
 *                              本项目的 Domain-local Dashboard 不算
 *                              违反本条，两者范围不同
 *
 * 为什么这条线画在"Business Data 有没有跨 Domain 聚合需求"上，而不是
 * 画在"看起来像不像管理类工作"上：Vision/Goal/Today View 这几项的共同
 * 特点是它们的意义来自"跨多个 Domain 汇总"（十年目标不会只关于 Personal
 * Life，本周待办也会同时包含 Property/Investment 的条目）——这类数据一旦
 * 让某一个 Domain OS（比如本项目）来存，要么这个 Domain OS 要反过来读
 * 其它 Domain 的数据（违反"依赖不能跨 Domain"），要么其它 Domain 要反过来
 * 写本项目的表（违反 Schema Authority/单一写入权）。两条路都会破坏
 * "每个 Domain 只对自己的 Business Data 负责"这个更基础的原则，所以
 * 这类"本质上跨 Domain"的数据，只能属于唯一一个既不属于任何具体 Domain、
 * 又被所有 Domain 共同信任的协调层——Life Execution OS。
 */

// ============================================================
// 二、Event Ownership Matrix（沿用 Carson 冻结版本，正式收录）
// ============================================================

/**
 * 下表是 Carson 在本次设计会话中明确要求"这个我认为不要再改了，以后会
 * 很稳定"的版本，本文件原样收录、不改动，作为 Personal Life OS 与
 * Life Execution OS 之间职责划分的权威依据：
 *
 *   对象                  | Owner
 *   ---------------------|------------------
 *   Vision                | Life Execution
 *   Goal                  | Life Execution
 *   Execution Project     | Life Execution
 *   Execution Review      | Life Execution
 *   Today View            | Life Execution
 *   Weekly Plan           | Life Execution
 *   Business Project       | Domain（本项目）
 *   Task                   | Domain（本项目）
 *   Workflow                | Domain（本项目）
 *   Timeline                 | Domain（本项目）
 *   Business Event             | Domain（本项目）
 *   Execution Event              | Life Execution
 *   Reminder Rule                 | Domain（本项目）
 *
 * 本项目新增的四个对象（本次设计新增，原表没有，按同一原则续填，不算
 * 改动原表，是给原表没覆盖到的新对象补充分类）：
 *
 *   对象                  | Owner            | 归类理由
 *   ---------------------|------------------|----------------------------
 *   Note                  | Domain（本项目）  | 转化前是纯 Knowledge，不
 *                          |                  | 跨 Domain 聚合
 *   Review（Daily/Weekly/  | Domain（本项目）  | 跟"Execution Review"是
 *   Monthly，本 Domain 范围| | 同名不同物——本项目的 Review
 *   内的完成率/延期回顾）    | | 只回顾本 Domain 自己的 Task/
 *                          |                  | Project，不聚合其它
 *                          |                  | Domain，见下方「五」
 *                          |                  | 的辨析
 *   BusinessRule           | Domain（本项目）  | 可复用流程模板本身是
 *   （流程模板）             |                  | Business Data 的一种
 *                          |                  | （"以前怎么做过"），不是
 *                          |                  | Execution 意图
 *   Conversion Event        | Domain（本项目）  | 转换发生在 Business Data
 *   （TASK_CONVERTED_TO_    |                  | 内部（Task/Note/Project
 *   PROJECT 等）             |                  | 都是本项目拥有的对象），
 *                          |                  | 不涉及 Execution
 */

// ============================================================
// 三、范围声明：本版本刻意不做的（避免被误判为遗漏）
// ============================================================

/**
 * 以下能力在 Carson 更早前的设计讨论里出现过，但本次正式 Required
 * Modules 清单（Project/Task/Workflow/Timeline/Note/Review/Reminder
 * Connector）没有重新列入，本文件明确记录为"刻意不做"而不是"忘了做"，
 * 沿用 00_Known_Limitations.gs 的既有惯例：
 *
 *   Routine/Habit Engine — 更早讨论中提到"每天喝水/运动/喂猫，以后可以
 *     升级 Habit"，但本次 Required Modules 没有重新列入。当前替代方案：
 *     用 Task Engine 的 Daily Recurring 表达同样的日常事项（"每天喝水"
 *     可以直接是一个 recurring='Daily' 的 Task）。如果未来需要连续打卡
 *     天数/中断提醒这类 Habit 特有的能力，再评估是否值得开一个独立
 *     Engine——当前没有具体近期场景，不提前设计。
 *
 *   Waiting Engine — 更早讨论中把它归在 Life Execution OS 之下（"等
 *     Developer 修复 Defect"这类跨 Domain 等待）。本项目 Task Engine
 *     的 Waiting 是一个 Task 状态值（跟 Blocked/Cancelled/Completed
 *     同级），描述的是"这个 Task 本身在等什么"，不是跨 Domain 的等待
 *     协调——两者概念不同，不要混淆，Waiting Engine 本身不属于本项目。
 *
 *   Project → Task 降级（反向转换） — 本次只要求"Task 可以转去
 *     Project"，没有要求反向操作。完整范围声明见 00_ADR.gs
 *     ADR-2026-07-24-006。
 *
 *   BusinessRule 的语义相似度匹配 — "遇到类似情况可以直接引用"，V1
 *     只做标签/关键词匹配（见 00_Business_Rules.gs），不做 AI 语义
 *     相似度匹配。原因：后者需要具体的匹配失败/成功案例才能设计出
 *     有意义的算法，现在没有任何真实使用数据，属于投机性泛化。
 */

// ============================================================
// 四、Dashboard Ownership 原则（v5.1：Accepted，两轮评审后正式定稿）
// ============================================================

/**
 * 完整 ADR 见 00_ADR.gs ADR-2026-07-24-007（Status: Accepted）。
 * 这里曾经是本文件唯一一处标记"需要 Carson 确认的冲突"（既有
 * 25_DashboardEngine.gs vs 新 Boundary 规则里"Dashboard 不能拥有"字面
 * 冲突）——两轮外部评审都认可 v5.0 提出的方向，并把判断标准写得更精确，
 * 现予正式采纳：
 *
 *   Dashboard 的 Ownership 由它展示的数据决定，不由"Dashboard"这个
 *   名称决定。
 *
 *   Domain Dashboard（允许，属于各 Domain 自己）——只展示单一 Domain
 *   自己的数据。例如：
 *     Personal Life OS：今日 Routine、本周完成率（既有
 *       25_DashboardEngine.gs 提供的 /dashboard /today /week /month
 *       指令，继续保留，不删除、不迁移，见「一」的判断标准，Reminder
 *       Rule 归本项目同理）
 *     Property OS（未来）：未完成维修、本月管理费、保修剩余天数
 *     Investment OS（未来）：今日盈亏、持仓分布
 *
 *   Execution Dashboard（Life Execution OS 专属）——展示聚合多个
 *   Domain 的数据。例如：
 *     Today：Property 2 Tasks / Investment 1 Task / Personal Life
 *       3 Tasks（跨 Domain 汇总）
 *     Goal Progress / Blocked / Waiting（跨 Domain 才有意义的统计口径）
 *
 * 判断方法（可操作、给未来所有 Domain OS 用）：这份 Dashboard 只需要
 * 读本 Domain 自己的表就能拼出来 → Domain Dashboard，属于该 Domain；
 * 需要跨读至少一个其它 Domain 的数据才能拼出来 → Execution Dashboard，
 * 属于 Life Execution OS，本项目不实现。跟本文件「五」区分 Review 归属
 * 的判断标准是同一个模式，两处保持一致，便于记忆。
 */

// ============================================================
// 五、Review（本 Domain）vs Execution Review（辨析）
// ============================================================

/**
 * 两者容易混淆，必须在文档层面写清楚，避免以后有人把 Execution Review
 * 的数据错误地写进本项目的 LIFE_REVIEWS 表（或反过来）：
 *
 *   本 Domain 的 Review（44_ReviewEngine.gs 归属，00_Sheets_Structure.gs
 *   的 LIFE_REVIEWS 表）——范围严格限定为"本 Domain 自己的 Task/Project
 *   完成率、延期数、AI 建议"，是 Blueprint「3. Intelligence → Analytics/
 *   Suggestions」在本 Domain 的具体呈现，不聚合任何其它 Domain 的数据。
 *
 *   Execution Review（Life Execution OS 拥有，不在本项目范围内）——
 *   范围是"Goal Progress / Project Health / Risk / AI Suggestion"，
 *   这些本质上是跨 Domain 汇总（一个 Goal 底下可能同时挂着 Property OS
 *   和 Personal Life OS 的多个 Project），只有 Execution 有资格生成。
 *
 * 判断标准："这份 Review 只需要读本 Domain 自己的数据就能生成" → 属于
 * 本项目；"这份 Review 需要跨读至少一个其它 Domain 的数据才能生成" →
 * 属于 Execution，本项目不实现，最多只提供数据给 Execution 读取
 * （通过本项目自己的 QueryEngine，Execution 侧发起读取，不是本项目
 * 主动推送）。
 */

// ============================================================
// 六、跟 Reminder OS 的边界（沿用 Productivity OS 既有约束，不变）
// ============================================================

/**
 * Reminder Connector（43_ReminderConnector.gs）只发布 REMINDER_REQUESTED
 * 事件，不维护任何提醒调度状态、不发送任何实际通知——这两件事完全属于
 * Reminder OS。本项目跟 Reminder OS 之间唯一的耦合方向是"发布事件"，
 * 不直接调用 Reminder OS 的任何函数（沿用 Productivity OS 现有的
 * reminder_policy 透传模式，见 Productivity OS ADR-2026-07-17-009）。
 */

// ============================================================
// 七、Reference Integrity 契约（v5.1 新增，两轮评审都强调的一条）
// ============================================================

/**
 * 完整 ADR 见 00_ADR.gs ADR-2026-07-24-012（Domain is Producer,
 * Execution is Consumer）。本节是这条原则在"跟本项目具体怎么交互"层面
 * 的落实，本项目侧需要遵守的部分只有一句话：
 *
 *   本项目不知道、也不需要知道 Execution 一侧怎么存它的 Reference——
 *   本项目只负责老老实实按 Schema Authority 发布 Business Event，
 *   剩下的事情（Execution 怎么保存 ReferenceID/SourceOS/EntityType/
 *   EntityID/Snapshot/LastSyncTime、怎么在收到新 Event 时刷新）完全是
 *   Execution 自己的实现细节，本项目不能，也不会替它做这部分工作，
 *   更不能反过来接受 Execution 直接写本项目任何一张表——那会立刻破坏
 *   Schema Authority（同一张表出现两个写入方）。
 *
 * 这跟 00_Data_Ownership.gs「一」的 Schema Authority 矩阵是同一条铁律
 * 在"项目边界"层面的重申：矩阵管的是"本项目内部谁能写哪张表"，本节管
 * 的是"项目之间谁能写谁的表"——答案都是"只有一个，且是数据所有者自己"。
 */
