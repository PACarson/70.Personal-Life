/**
 * 00_Data_Ownership.gs
 * Personal Life OS v5.1（Design Phase）— Data Ownership
 *
 * Changelog: v5.0 → v5.1——Metadata Standard 由 9 字段扩为 11 字段，
 * 新增 decision_owner / approval_status（见「三」），支撑 AI 创建、
 * 人类批准的 Audit Trail。见 00_ADR.gs ADR-2026-07-24-013。
 *
 * 本文件对应需求「4. Data Ownership」。回答三个问题：每张表谁能写、
 * Metadata 标准长什么样、Priority 标准长什么样——后两者是 Carson 在
 * 需求里明确要求"所有 Project/Task/Workflow/Note 必须记录"的强制字段，
 * 独立成节，避免分散在各个 Entity 定义里以后维护时漏改。
 */

// ============================================================
// 一、Schema Authority（延伸自 Productivity OS 既有 ADR-2026-07-06-002）
// ============================================================

/**
 * 沿用既有原则："每一张表只有一个模块可以写，查询可以有多个入口，写入
 * 永远只有一个。" 本次扩大到十一张表后的完整矩阵：
 *
 *   表名                | 写入权唯一持有者                | 说明
 *   --------------------|--------------------------------|------------------
 *   Events               | 02_EventBus.gs                 | 不变，唯一
 *                        |                                | 事实来源
 *   Tasks                | 10_ProjectionEngine.gs          | 不变
 *   ActiveTasks           | 10_ProjectionEngine.gs          | 不变
 *   ArchiveTasks           | 13_ActiveTasksEngine.gs         | 不变
 *   TaskStatistics          | 11_ProjectionRebuilder.gs        | 不变，每日
 *                        |                                |批量重算
 *   TaskFilters              | 10_ProjectionEngine.gs           | 不变
 *   LIFE_PROJECTS             | 10_ProjectionEngine.gs（扩展）    | 新增
 *   LIFE_WORKFLOWS              | 10_ProjectionEngine.gs（扩展）     | 新增
 *   LIFE_TIMELINE                 | 10_ProjectionEngine.gs（扩展）      | 新增，
 *                        |                                |见「二」特殊说明
 *   LIFE_NOTES                     | 10_ProjectionEngine.gs（扩展）       | 新增
 *   LIFE_REVIEWS                     | 10_ProjectionEngine.gs（扩展）        | 新增
 *   LIFE_BUSINESS_RULES                | 10_ProjectionEngine.gs（扩展）         | 新增
 *
 * 铁律不变："真相来源永远是 Events 表；上面十张 Read Model 表都是
 * Projection，理论上可以从 Events 表全量重放重建（Everything
 * Rebuildable）；任何 Engine 都不允许绕过 EventBus.publish() 直接写
 * Events 表，也不允许绕过 ProjectionEngine 直接写任何一张 Read Model
 * 表——唯一例外是既有的 Projection 失败安全兜底（event.projection_ok
 * ===false 时的一次性额外写入），本次新增六张表继续沿用同一个例外
 * 通道，不新开其它例外。"
 */

// ============================================================
// 二、LIFE_TIMELINE 的特殊写入规则
// ============================================================

/**
 * LIFE_TIMELINE 不对应"某一个实体自己的状态"，而是跨 Task/Project/
 * Workflow/Note/Review/BusinessRule 六类实体的统一历史流水账，
 * ProjectionEngine 在 dispatch() 处理任何一个属于本项目的事件时
 * （不只是 LIFE_ 前缀，也包括既有的 TASK_ 前缀事件），除了更新该事件
 * 对应的主 Read Model 之外，都会顺带向 LIFE_TIMELINE 追加一行——这是
 * 本文件唯一一处"一个事件触发两张表更新"的写入模式，完整论证（为什么
 * 不单独给 Timeline 发一次事件）见 00_ADR.gs ADR-2026-07-24-004。
 */

// ============================================================
// 三、Metadata Standard（强制字段，Carson 需求原文逐项落实）
// ============================================================

/**
 * 需求原文："所有 Project / Task / Workflow / Note 必须记录"以下九个
 * 字段；v5.1 经两轮外部评审补充第十、十一个字段（decision_owner /
 * approval_status，完整 ADR 见 00_ADR.gs ADR-2026-07-24-013）。本节把
 * 每个字段的取值范围、写入时机钉死，避免实现阶段各个 Engine 各自理解出
 * 不同版本。
 *
 *   字段              | 类型/枚举                          | 写入时机
 *   ------------------|-------------------------------------|------------------
 *   creator            | 'User' \| 'AI'                       | 创建时一次性
 *                      |                                       | 写入，不可变
 *   suggested_by        | 'User' \| 'Claude' \| 'ChatGPT' \|     | 创建时一次性
 *                      | 'Gemini' \| 'DeepSeek' \| 'Local AI' \| | 写入，不可变；
 *                      | 'Rule Engine'                          | creator='User'
 *                      |                                       | 且非 AI 建议时，
 *                      |                                       | 取值固定为
 *                      |                                       | 'User'（自己
 *                      |                                       | 建议自己）
 *   source_domain        | 见 20_TaskEngine.gs 顶层 OS_REGISTRY（当前： | 【2026-09-01
 *                      | 'PersonalLifeOS' \| 'PropertyOS' \|      | 起，ADR-2026-
 *                      | 'RiderOS' \| 'InvestmentOS' \| 'Other'）  | 09-01-027】
 *                      | ——单点注册，Task/Project 共用同一份，     | Task/Project
 *                      | 不在别处另抄一份枚举                      | 均可编辑，不
 *                      |                                          | 再是创建时
 *                      |                                          | 一次性写入；
 *                      |                                          | 语义是"这条
 *                      |                                          | 记录的业务
 *                      |                                          | OS/Domain 归
 *                      |                                          | 属"，不是
 *                      |                                          | provenance
 *                      |                                          | ——"谁创建/
 *                      |                                          | 谁建议"继续
 *                      |                                          | 由 creator/
 *                      |                                          | suggested_by/
 *                      |                                          | source_module
 *                      |                                          | 表达，两组
 *                      |                                          | 概念不混用。
 *                      |                                          | 新建记录默认
 *                      |                                          | 'PersonalLifeOS'；
 *                      |                                          | 2026-09-01
 *                      |                                          | 之前创建的
 *                      |                                          | 既有记录仍是
 *                      |                                          | 旧默认值
 *                      |                                          | 'Personal
 *                      |                                          | Life'（无 OS
 *                      |                                          | 后缀），两者
 *                      |                                          | 尚未统一，见
 *                      |                                          | ADR-2026-09-
 *                      |                                          | 01-027 的
 *                      |                                          | Consequences。
 *                      |                                          | Workflow/Note
 *                      |                                          | 不适用本条，
 *                      |                                          | 继续维持
 *                      |                                          | 原本"创建时
 *                      |                                          | 一次性写入，
 *                      |                                          | 不可变，固定
 *                      |                                          | 填 'Personal
 *                      |                                          | Life'"的旧
 *                      |                                          | 行为不变。
 *   source_module         | 自由文本，如 'NoteEngine' /             | 创建时一次性
 *                      | 'BusinessRuleEngine'                    | 写入，不可变
 *   source_event_id        | Events 表的 event_id，可空             | 创建时一次性
 *                      |                                        | 写入，不可变；
 *                      |                                        | 手动创建（非
 *                      |                                        | 转换/非规则
 *                      |                                        | 生成）时为空
 *   source_task_id          | 可空，转换/规则实例化时指向源 Task     | 创建时一次性
 *                      |                                        | 写入，不可变
 *   created_method            | 'Manual' \| 'AI Suggestion' \|         | 创建时一次性
 *                      | 'Rule Generated' \| 'Imported' \|       | 写入，不可变
 *                      | 'Converted'（本次新增第五个值，见       |
 *                      | Notes）                                 |
 *   created_time               | ISO 8601 时间戳                        | 创建时一次性
 *                      |                                        | 写入，不可变
 *   updated_time                | ISO 8601 时间戳                        | 每次
 *                      |                                        | update 类
 *                      |                                        | 操作重写
 *   decision_owner（v5.1新增）  | 自由文本，通常是用户本人标识              | 创建时一次性
 *                      | （单用户场景下恒为固定值；预留给未来           | 写入，不可变
 *                      | 多人共用同一 Domain OS 的情况）                |
 *   approval_status（v5.1新增） | 'APPROVED' \| 'PENDING' \|              | 见下方 Notes
 *                      | 'REJECTED'                                    |
 *
 * Notes（created_method）：新增 'Converted' 这个第五个枚举值，是本次
 * Task→Project / Note→Task/Project 两个转换功能带来的必然要求——
 * 转换产生的目标实体，既不是 Manual（用户没有从零手动创建它）、也不是
 * AI Suggestion/Rule Generated/Imported（这三者描述的都是"内容从哪来"，
 * 不是"这个实体本身怎么诞生的"）。完整论证见
 * 00_ADR.gs ADR-2026-07-24-006（已被 ADR-2026-07-24-015 部分取代，
 * 见该 ADR——created_method='Converted' 本身不变，只是 Task↔Project
 * 现在双向都可能产生这个值）。
 *
 * Notes（decision_owner / approval_status，v5.1 新增，完整论证见
 * 00_ADR.gs ADR-2026-07-24-013）：解决的问题是"AI 建的东西，人有没有
 * 批准"要能被审计、而不是只能靠"这条记录一直没人删除/修改"这种默认
 * 事实去反推。写入规则：
 *   - creator='User' 时，decision_owner 恒等于该用户自己，
 *     approval_status 恒为 'APPROVED'（用户自己创建的东西天然算已批准，
 *     不需要多此一举再走一次批准流程）
 *   - creator='AI' 时（即 created_method 为 'AI Suggestion' 或
 *     'Rule Generated'），decision_owner 记录"谁有权批准这条"（当前
 *     单用户场景固定是 Carson），approval_status 初始为 'PENDING'
 *   - 'PENDING' 状态的实体正常出现在 ActiveTasks/Dashboard 等既有视图
 *     里（不隐藏、不阻塞——隐藏会违反"AI Suggests, Human Confirms"里
 *     "人类要看得到才能确认"的前提），只是在展示层面额外标注"待确认"
 *   - approval_status 翻转为 'APPROVED' 有两条路径：(a) 显式调用
 *     approveEntity_(entityType, entityId, decisionOwner)；(b) 用户对
 *     该实体发起任何 update/complete 类操作时，系统隐式视为已确认，
 *     自动翻转（避免每一条 AI 建议都要求用户多点一次"批准"，造成不必要
 *     的操作摩擦）——两条路径都会在 LIFE_TIMELINE 留痕，区分是显式批准
 *     还是隐式批准
 *
 * 存储位置：以上十一个字段作为 Tasks/LIFE_PROJECTS/LIFE_WORKFLOWS/
 * LIFE_NOTES 四张表的固定列（不是塞进一个 JSON 字段），保持跟现有
 * Tasks 表其它字段一致的"按表头名字找列"约定（05_SheetUtils.gs），
 * 也方便未来 Personal AI Core 或其它 AI 调用方直接按列名读取，呼应
 * UEF Checklist C3 AI Readiness"结构化字段而非需要重新解析的自由文本"
 * 这一条。
 */

// ============================================================
// 四、Priority Standard（双轨，User 永远拥有最终裁决权）
// ============================================================

/**
 * 需求原文："必须支持：Priority（User）/ AI Recommended Priority。
 * User 永远拥有最终 Priority。"
 *
 *   字段                     | 类型                | 说明
 *   -------------------------|---------------------|------------------------
 *   priority_user              | 'HIGH'\|'MEDIUM'\|'LOW' | 用户显式设置，
 *                            |                     | 未设置时默认 'MEDIUM'
 *                            |                     | （沿用既有 Tasks 表
 *                            |                     | 默认值，不改变既有
 *                            |                     | 行为）
 *   priority_ai_recommended      | 'HIGH'\|'MEDIUM'\|'LOW'\| | 22_PriorityEngine
 *                            | ''（空表示尚未生成建议） | 生成，用户未采纳前
 *                            |                     | 不影响任何排序/展示
 *                            |                     | 逻辑
 *
 * "User 永远拥有最终 Priority" 在实现层面的具体含义：所有排序、筛选、
 * Dashboard 展示，只读 priority_user，绝不读 priority_ai_recommended
 * 参与排序——后者只在 UI/Telegram 回复里以"建议"的形式单独展示
 * （例如"建议优先级：HIGH（当前设置：MEDIUM）"），是否采纳需要用户
 * 显式发起一次 updateTask 把 priority_user 改掉，AI 的建议不会自动
 * "生效"。这是 Architecture Principle "AI Suggests, Human Confirms"
 * 在 Priority 这个具体字段上的落实。
 *
 * 迁移说明：既有 Tasks 表目前只有一个 'priority' 列，本次拆成
 * priority_user（沿用既有列，改名或保留原名待实现阶段决定，倾向保留
 * 原名 'priority' 只是语义上等同于 priority_user，避免一次无谓的列
 * 改名——参考 00_ADR.gs ADR-2026-07-24-003 同一种判断标准）+ 新增列
 * priority_ai_recommended。完整 ADR 见 00_ADR.gs
 * ADR-2026-07-24-009。
 */

// ============================================================
// 五、跨表引用完整性（谁负责校验，谁负责清理）
// ============================================================

/**
 * project_id / workflow_id / parent_task_id / depends_on_task_ids /
 * source_task_id 这类跨表外键式字段，本项目不使用 Google Sheets 原生
 * 能力做强制外键约束（Sheets 没有这个能力），校验责任落在写入方
 * Engine 身上（见 00_Module_Responsibility.gs 各 Engine 的 Reads 一栏
 * "创建前校验引用对象是否存在"）。若引用的对象后续被删除（本设计包
 * 不提供任何"物理删除"的 Public API，只有状态流转到终态），不存在
 * "悬空引用"风险——这是刻意的设计取舍：只增不删，用状态字段表达
 * "结束"，不用物理删除表达。
 */

// ============================================================
// 六、UI Identity & Ownership（2026-08-16 新增，UI Phase 0 → Slice 1，
//     见 00_Project_State.gs「九」、00_Module_Responsibility.gs「十四」）
// ============================================================

/**
 * 50_UIBridge.gs 不新增任何一张表的写入权——所有写操作最终落到既有
 * Command（29_NoteEngine.createNote / 42_ConversionEngine.
 * convertNoteToTask），既有 Command 已经是各自表的唯一写入者（本文件
 * 「一」的矩阵不需要变）。UI 只是多了一个"发起写请求"的入口，跟
 * Telegram 指令层并列，不是替代关系。
 *
 * Web Identity（decision_owner）：07_IdentityEngine.gs 核实过，只是
 * 内容去重哈希生成器，没有 Actor/User Identity 概念，无法复用；也不
 * 直接复用 Telegram chatId（Telegram Identity ≠ Web Identity ≠ Domain
 * Identity）。改用 Session.getEffectiveUser().getEmail()。
 *
 * chat_id 的双重角色（这次排查 Bug 时确认，值得记下来避免以后重新
 * 踩一次）：这个字段在既有代码里同时承担 (a) 每个实体的 owner/tenant
 * key，(b) 03_Output.sendMessage / 43_ReminderConnector 用来真的投递
 * Telegram 消息的地址——两者此前一直是同一个值，因为所有实体都来自
 * Telegram。UI 引入了第二个创建渠道后，这两个角色被拆开处理：
 * decision_owner 用 Web Identity（谁的决定），chat_id 参数位继续传
 * 真实 SecureConfig 'TELEGRAM_CHAT_ID'（提醒该送到哪）。两个字段本来
 * 就允许分开传，没有新增字段、没有改任何既有 Engine 的 Metadata
 * Standard（「三」不变）。
 */
