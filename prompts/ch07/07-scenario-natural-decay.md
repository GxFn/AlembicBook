Title at top in bold Chinese: "场景 2：重构导致的自然衰退"

A horizontal-then-vertical flow diagram showing how deleting a source file cascades through the system to deprecate related Recipes. Two phases clearly separated: immediate reaction (T+0) and next scan (T+N).

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons.

TOP — Trigger event:

A rounded rectangle, pale red (#FEE2E2) fill, with a trash-can icon:
Bold text: "NetworkManager.swift 被删除"
Below: "团队重构 → async/await 原生并发"

Split into two vertical lanes below, separated by a dashed vertical line:

LEFT LANE — Label: "即时反应 T+0" in bold

Box 1 — Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "FileChangeHandler"
Below: "deleted 事件 → 检测 sourceRef"

Arrow down

Box 2 — Rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "3 条 Recipe 全部 sourceRef 失效"
Below: "Gateway.submit(deprecate, conf=0.9)"

Arrow down

Box 3 — Rounded rectangle, pale red (#FEE2E2) fill, with a lightning icon:
Bold text: "立即废弃"
Below: "shouldImmediateExecute(0.9) → true"
Below: "LifecycleStateMachine → deprecated"

RIGHT LANE — Label: "下次扫描 T+N" in bold

Box 4 — Rounded rectangle, pale blue (#DBEAFE) fill:
Bold text: "SourceRefReconciler"
Below: "发现间接引用 Recipe → stale"

Arrow down

Box 5 — Rounded rectangle, pale yellow (#FEF3C7) fill:
Bold text: "RelevanceAuditor · Phase A"
Below: "codeFilesExist ↓ symbolsAlive ↓"
Below: "→ decay / severe"

Arrow down

Box 6 — Rounded rectangle, pale pink (#FADBD8) fill:
Bold text: "Agent 验证 + 信号评估"
Below: "decay score 无回升"
Below: "decaying → deprecated"

BOTTOM — Summary annotation in gray box:
Text: "确信路径立即执行，间接影响由下次扫描兜底"
