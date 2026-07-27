# Personal Life OS — 设计 v5.2 冻结，Sprint 1 代码已交付，Acceptance
# Gate 待跑

正式定名：**Personal Life OS**（GAS Library Identifier:
`PersonalLifeOS`，取代 `ProductivityOS`，见 `00_ADR.js`
ADR-2026-07-24-018）。

## 现在处于哪个阶段

```
设计阶段 v5.0→v5.1→v5.2（完成）
        │
Sprint 1 代码交付（完成，见 personal-life-os-sprint1-code/）
        │
Sprint 1 Acceptance Gate（待跑——见下方，需要 Carson 在真实环境执行）
        │
Sprint 3（Integration：Reminder/BusinessRule/Conversion，未开始）
```

Sprint 2（Goal/Vision/Today-Week View/Review/Waiting）不属于本项目，
属于 Life Execution OS，见下方说明——不在这条链路里。

## Sprint Acceptance Gate（ADR-2026-07-24-019，评审要求新增的流程）

不是一次把 4 个 Sprint 写完才验证，而是 **Sprint → Gate → Sprint**：
每个 Sprint 交付后先过自己的 Gate，通过才允许在其上继续叠加下一层。
Gate 通过还带来 **Reference Domain Certification**——Sprint 1 Gate
通过后，Foundation 层模式（Identity/Task/Project/Workflow/Timeline/
Query/Projection）即被认证为 Canonical，未来 Property OS 等 Domain
OS 可以直接信任、复用这层，不需要重新验证。

### Sprint 1 Gate 的六项测试

代码见 `personal-life-os-sprint1-code/35_Tests_Sprint1Acceptance.js`，
单一入口 `runSprint1AcceptanceGate()`：

1. **Migration Test** — `migrateSchemaPersonalLifeOS()` 正确追加新列，
   不破坏既有列/顺序
2. **Existing Data Compatibility Test** — 模拟一条"迁移前"的旧数据行
   （新列全空），验证读取/更新/完成全部正常
3. **Workflow Test（洗衣流程场景）** — Project→Workflow→Task→完成→
   Workflow 自动 FINISHED 全链路
4. **Timeline Integrity Test** — 每个实体的历史记录完整、按时间正序、
   可追溯回 Events
5. **Metadata Traceability Test** — User 创建 vs AI 创建两种路径下，
   十一字段（含 decision_owner/approval_status）是否正确
6. **Reference Contract Mock Test**（评审唯一明确要求新增的一项）—
   不需要 Life Execution OS 真实存在，用
   `CanonicalRepresentation.composeCanonicalIdentity_` + Query Engine
   模拟"构造 Reference → resolve → Domain 数据变化 → 重新 resolve
   看到最新值"这条契约，提前暴露 Reference 结构本身是否够用

### 一处范围澄清（评审消息内部的不一致，已按 ADR-019 处理）

评审给的四个验证场景和七项测试清单里，"Business Rule → Workflow
Template → Workflow Instance"场景和"Task ⇄ Project Test"引用的是
`42_ConversionEngine.gs` / `41_BusinessRuleEngine.gs`——这两个模块
按 Sprint 1-4 的既定范围（评审同一条消息里也重申了"Sprint 1 范围：
Identity/Task/Project/Workflow/Query/Projection"）属于 **Sprint 3**，
Sprint 1 代码里没有这两个模块的任何实现，无法测试一个不存在的东西。
这两项验收挪到 Sprint 3 自己的 Gate（那两个模块真正落地的时候），
不在 Sprint 1 Gate 里空跑。完整论证见 `00_ADR.js` ADR-2026-07-24-019。

### 重要：Gate 是否通过需要 Carson 亲自跑

这份测试代码不能被这次交付自称"已通过"——没有直接执行 Carson 真实
Spreadsheet 的能力。请在 Apps Script 编辑器里跑一次
`runSprint1AcceptanceGate()`，把 Logger 输出（尤其任何 ❌）贴回来，
再决定要不要正式进 Sprint 3。

## v5.2 Architecture Freeze 变更摘要（不变，见上一版）

ADR-016（Canonical Identity）、ADR-017（Canonical Entity Lifecycle）、
ADR-018（定名）——三条均 Accepted，完整内容见 `00_ADR.js`。

## 阅读顺序

设计文档：10 份 `00_*.js` + README + 两份 Mermaid 图，见
`00_ADR.js` 完整决策清单（现有 19 条：15 条 v5.0/v5.1 + 3 条 v5.2 +
1 条 Sprint 1 实现阶段追加的 ADR-019）。

Sprint 1 代码：`personal-life-os-sprint1-code/` 目录，14 个功能文件 +
1 个验收测试文件，部署顺序见下。

## 部署顺序

1. `setupSheets()`（15_Setup.js）
2. `migrateSchemaPersonalLifeOS()`（11_ProjectionRebuilder 新函数，
   **已有生产数据必须跑这一步**，见 15_Setup.js 文件头说明）
3. Core 项目 Library 引用改指向 `PersonalLifeOS`，`04_Main.gs` 调用点
   同步改名
4. `createTriggers()`
5. `runDiagnostics()`（15_Setup.js，基础冒烟测试）
6. `runSprint1AcceptanceGate()`（35_Tests_Sprint1Acceptance.js，
   **正式验收，见上）
7. 全部通过 → 回报结果 → 讨论是否正式进 Sprint 3

## 本包的生命周期

设计阶段（v5.0 → v5.1 → v5.2）已结束。实现阶段的后续决定（如
ADR-019）直接追加进 `00_ADR.js`，不再新增独立的"设计包版本号"。
