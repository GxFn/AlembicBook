Title at top in bold Chinese: "知识进化全链路数据流"

A large vertical flow diagram showing the complete data pipeline from IDE file events to knowledge evolution, divided into 4 horizontal tiers by thin dashed lines with tier labels. The diagram uses a top-down flow direction.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons. Keep text concise — short labels only, no full sentences.

TIER 1 — Label on left margin: "触发层"

Top center — a rounded rectangle, pale gray (#E5E7EB) fill, with a small monitor/IDE icon:
Bold text: "IDE / 编辑器"
Below: "create · rename · delete · modify"

Arrow pointing down, labeled "POST /api/v1/file-changes"

Below — a wider rounded rectangle, pale blue (#DBEAFE) fill, with a small routing icon:
Bold text: "FileChangeHandler"
Inside, three sub-rows arranged vertically, each with a small arrow and label:
Row 1: "renamed → ContentPatcher（自动修复路径）"
Row 2: "deleted → Gateway.submit(deprecate, 0.9)"
Row 3: "modified → ContentImpactAnalyzer（diff-based 分析）"

TIER 2 — Label on left margin: "信号层"

Four arrows fan out downward from FileChangeHandler to four destinations arranged in a horizontal row:

Destination 1 (leftmost) — small rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "Signal 沉淀"
Below: "影响摘要累积"

Destination 2 — small rounded rectangle, pale green (#D1FAE5) fill:
Bold text: "用户触发 rescan"
Below: "Phase A 进化前置"

Destination 3 — small rounded rectangle, pale purple (#EDE9FE) fill:
Bold text: "ProposalExecutor"
Below: "#onSignal() + §9.1"

Destination 4 (rightmost) — small rounded rectangle, soft orange (#FED7AA) fill, with a small bell icon:
Bold text: "VSCode 弹窗"
Below: "direct / pattern"
Below that, three small button labels in a row: "Review · Auto Check · Don't Show"

TIER 3 — Label on left margin: "决策层"

Destination 2 (Phase A) has a downward arrow into a wider box:

Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "RelevanceAuditor"
Inside three outcome rows:
"healthy → Gateway.submit(valid) → lastVerifiedAt"
"dead → Gateway.submit(deprecated) → 立即废弃"
"decay / impacted → Agent 验证"

Arrow from "Agent 验证" pointing down splits into two paths:

Left path — rounded rectangle, pale green (#D1FAE5) fill:
Bold text: "EvolutionGateway"
Below line 1: "submit(update / deprecate)"
Below line 2: "→ Proposal 创建或 evidence 升级"
Below line 3: "→ 信号驱动评估 → StateMachine"

Right path — rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "Phase B: 纯新增"
Below: "Analyze → QualityGate"
Below: "→ Produce → RejectionGate"

Arrow from Phase B pointing down into:

Rounded rectangle, pale blue (#DBEAFE) fill, slightly wider:
Bold text: "RecipeProductionGateway"
Inside three layer labels:
"Layer 1: 结构化过滤（fingerprint 去重 · 批内互重叠 · 相似度）"
"Layer 1.5: 字段级分析（trigger · doClause · coreCode）"
"Layer 2: 语义融合（ConsolidationGate · MCP → asd_consolidate）"

TIER 4 — Label on left margin: "落地层"

Three arrows fan out from RecipeProductionGateway to three destinations:

Left — rounded rectangle, pale green (#D1FAE5) fill:
Bold text: "create 新 Recipe"
Below: "→ ConfidenceRouter"
Below: "→ staging / pending"

Center — rounded rectangle, pale purple (#EDE9FE) fill:
Bold text: "merge / update"
Below: "→ EvolutionGateway"
Below: "→ Proposal → StateMachine"

Right — rounded rectangle, soft orange (#FED7AA) fill:
Bold text: "pendingSemanticReview"
Below: "→ MCP nextAction"
Below: "→ asd_consolidate"

At the very bottom, a thin dashed line connecting all three boxes, with a centered annotation:
"所有状态转换通过 LifecycleStateMachine 唯一权威执行"
