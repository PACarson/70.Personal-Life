# Personal Life OS v5.1 — Design Phase

Personal Life OS 是 Productivity OS 的演进版本（见 `00_ADR.js`
ADR-2026-07-24-001），是 Personal AI Core 平台下的 **Canonical
Reference Implementation**（v5.1 起正式定稿，见 ADR-2026-07-24-014）。
本目录仍是只有文档、没有代码的设计包。v5.1 综合了两轮独立外部评审的
反馈，在 v5.0 基础上做了六处新增、三处修订。

## v5.1 变更摘要

两轮评审都认可 v5.0 的整体方向和 ADR-003/005/009；针对 ADR-007
（Dashboard）、ADR-008（Branch）给出了具体修改意见，并各自提出了一项
新增建议。综合结果：

| 编号 | 变更 | 状态 |
|---|---|---|
| ADR-007 Dashboard | Proposed → **Accepted**：Ownership 由展示的数据决定，不由名称决定（Domain Dashboard vs Execution Dashboard） | 已定稿 |
| ADR-008 Branch | Proposed → **Accepted**：新增 Branch Resolution Policy（AUTO/KEEP_OPEN/RETURN_TO_QUEUE/WAITING/MANUAL）+ 新状态 NOT_SELECTED，合并两轮评审的不同建议 | 已定稿 |
| ADR-006 Task→Project | Accepted → **Superseded**，由 ADR-015 取代 | 见下 |
| ADR-010（新增） | Business Rule / Workflow Template 必须 Versioning | Accepted |
| ADR-011（新增） | BusinessRule 拆分三层：Business Rule → Workflow Template → Workflow Instance | Accepted |
| ADR-012（新增） | Domain is Producer, Execution is Consumer — Reference Integrity | Accepted |
| ADR-013（新增） | Metadata 新增 decision_owner / approval_status | Accepted |
| ADR-014（新增） | Personal Life OS 正式确立为 Canonical Reference Implementation | Accepted |
| ADR-015（新增） | Task↔Project 转换扩展为双向（取代 ADR-006） | Accepted |

本轮**没有**遗留 Proposed 状态的条目——两轮评审的意见经核对后互相
兼容，均已合并进正式决定。

## 阅读顺序（不变）

1. `00_Architecture.js` — 新增 Principle 12（Producer/Consumer）、
   P2 升级为 Canonical Reference Implementation
2. `00_Domain_Boundary.js` — Dashboard 一节已定稿；新增「七」
   Reference Integrity 契约
3. `00_Module_Responsibility.js` — TaskEngine/ProjectEngine 新增双向
   转换函数；WorkflowEngine 的 Branch 处理改写；BusinessRuleEngine
   重构为管理两张表
4. `00_Data_Ownership.js` — Metadata 由 9 字段扩为 11 字段
5. `00_Entity_Relationship.js` + `Entity_Relationship.mermaid` —
   BusinessRule 三层模型、双向转换关系
6. `00_Event_Flow.js` + `Event_Flow.mermaid` — Business Rule 事件
   改名/新增、PROJECT_CONVERTED_TO_TASK
7. `00_Sheets_Structure.js` — 新增 LIFE_WORKFLOW_TEMPLATES 表
8. `00_File_Map.js` — 无新增文件编号，仅更新既有文件的职责范围说明
9. `00_Business_Rules.js` — 新增「七」Branch Resolution Policy、
   「八」Decision Owner / Approval
10. `00_ADR.js` — 15 条决策记录（8 条不变 + 3 条修订 + 6 条新增，
    含 ADR-006 的 Superseded 记录）

## 两个原有新功能的最新状态

- **Task↔Project 转换**：v5.1 起双向（`00_ADR.js` ADR-015 取代
  ADR-006），Project→Task 有明确前置条件（无 Sub-Project、无非终态
  子 Task），规则见 `00_Business_Rules.js`「一」
- **Project 记录重复性流程**：三层模型定稿（`00_ADR.js` ADR-011），
  同一 BusinessRule 下的版本演进不影响已实例化的旧 Workflow
  Instance（ADR-010），规则见 `00_Business_Rules.js`「三」

## 本包的生命周期（不变）

这些文件仍是设计阶段产物，Carson 确认后进入实现阶段时会并入
Productivity OS 既有的 8 份治理文件，对应关系见 v5.0 版本的说明
（未变化）。

## 血缘与依据

v5.1 的全部变更均来自对两份独立外部评审意见的逐条核对——相同意见
直接采纳、不同意见（如 Branch 处理方式）经分析后判断为互补而非
冲突，予以合并，而不是任选其一。合并过程中发现的唯一潜在张力
（ADR-007 两轮评审的表述方式略有不同）已在 ADR-007 的 Notes 段落
说明取舍理由。
