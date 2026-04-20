Title at top in bold Chinese: "场景 5：文件修改的实时进化审视"

A wide flow diagram showing the complete journey from a developer saving a file in VSCode to knowledge evolution. Split into three clearly labeled horizontal swim lanes. Time flows left to right. IMPORTANT: Each swim lane has exactly ONE label on the left side — do NOT duplicate or stack labels.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons.

SWIM LANE 1 (top) — Single label on left: "IDE 层" with a code editor icon

Box 1 — Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "开发者保存文件"
Below: "PaginationController.swift"
Small icon: floppy disk

Arrow right with label "2s 缓冲"

Box 2 — Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "POST /api/v1/file-changes"
Below: "eventSource: ide-edit"

SWIM LANE 2 (middle) — Single label on left: "服务层" with a server icon

Box 3 — Rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "FileChangeHandler"
Below: "SourceRef 查找 → 2 条 Recipe"

Arrow right, splits into two parallel paths:

Upper path — Small rounded box, pale green (#D1FAE5):
Text: "Recipe A: score 0.45"
Below: "impactLevel = pattern"
Badge: "signal weight 0.6"

Lower path — Small rounded box, pale gray (#E5E7EB):
Text: "Recipe B: score 0.08"
Below: "impactLevel = reference"
Badge: "signal weight 0.3"

Both paths merge into arrow pointing right

Box 4 — Rounded rectangle, pale pink (#FADBD8) fill, with a bell icon:
Bold text: "VSCode 弹窗"
Below: "⚡ 检测到影响，建议进化评估"
Three small buttons below: "Review | Auto Check | 忽略"

SWIM LANE 3 (bottom) — Single label on left: "进化层" with a cycle/evolution icon. Do NOT repeat this label.

Box 5 — Rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "Gateway.submit(update)"
Below: "source: file-change"
Below: "持久化为 update 提案"

Arrow right with label "下次 rescan"

Box 6 — Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "Phase A 进化前置"
Below: "source_modified signal"
Below: "Agent 验证队列"

Arrow right

Box 7 — Rounded rectangle, pale green (#D1FAE5) fill:
Bold text: "Evidence 升级"
Below: "Gateway 去重 → 追加 suggestedChanges"

BOTTOM — Summary annotation in gray box:
Text: "signal 既是弹窗触发器，也是增量扫描的进化前置输入"
Box 7 — Rounded rectangle, pale green (#D1FAE5) fill:
Bold text: "Evidence 升级"
Below: "Gateway 去重 → 追加 suggestedChanges"

BOTTOM annotation:
Text: "signal 既是弹窗触发器，也是增量扫描的进化前置输入"
