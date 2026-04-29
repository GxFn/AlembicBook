Title at top in bold Chinese: "场景 4：提交时的三层重复拦截"

A funnel-shaped diagram showing three progressive layers of duplicate detection, from fast structural checks to deep semantic analysis. Each layer filters candidates, with the rejected ones shown branching to the side.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons.

TOP — Input:

A rounded rectangle, pale yellow (#FEF3C7) fill, with a document icon:
Bold text: "新候选 Recipe 提交"
Below: "RecipeProductionGateway"

Arrow pointing down into a funnel shape ↓

LAYER 1 — Wide rounded rectangle, pale blue (#DBEAFE) fill:
Bold label on left: "Layer 1"
Bold text: "结构化快速过滤"
Below line 1: "Fingerprint 精确去重"
Below line 2: "RecipeSimilarity.compute() → 0.52"
Below line 3: "灰色地带 (< 0.65)"
Right side branch arrow → small gray box: "≥ 0.65 直接拒绝"
Result label: "→ 通过"

Arrow down ↓

LAYER 1.5 — Medium rounded rectangle, pale pink (#FADBD8) fill:
Bold label on left: "Layer 1.5"
Bold text: "字段级分析"
Below as checklist:
"✓ doClauseSubset = true"
"✓ categoryMatch = true"
"✗ triggerConflict = false"
Right side annotation: "不借助 Agent 的深度判断"
Result label: "→ pendingSemanticReview"

Arrow down ↓

LAYER 2 — Narrow rounded rectangle, pale yellow (#FEF3C7) fill, with a robot icon:
Bold label on left: "Layer 2"
Bold text: "语义融合分析"
Below: "外部 Agent 读取代码上下文"
Below: "alembic_consolidate → 判定为子集"

Arrow down ↓

BOTTOM — Result:

A rounded rectangle, pale red (#FEE2E2) fill, with an X icon:
Bold text: "候选被拒绝"
Below: "已有 Recipe 完全覆盖"

SIDE ANNOTATION — A small box with pale gray background:
Text: "三层过滤：代码逻辑 → 字段分析 → Agent 语义"
Below: "80%+ 在 Layer 1 解决，极少数到 Layer 2"
