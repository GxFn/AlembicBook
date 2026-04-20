Title at top in bold Chinese: "场景 3：Agent 驱动的知识更新"

A vertical timeline diagram showing how an Agent-initiated update proposal flows through signal-driven evaluation to content patching and re-staging. Clear time markers on left, state transitions and components on right.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons.

LEFT SIDE — Time axis (vertical dashed line):

T+0, T+数小时, T+72h

RIGHT SIDE — Flow boxes:

BOX 1 — Rounded rectangle, pale yellow (#FEF3C7) fill, with a robot/agent icon:
Bold text: "Agent 发起进化"
Below: "asd_evolve → Gateway.submit(update)"
Below: "confidence: 0.8 · evidence: suggestedChanges"

Arrow down with two small labels branching right:

Side box A — Small pale blue pill:
Text: "resolveInitialStatus → observing"

Side box B — Small pale green pill:
Text: "assessRisk → low (24h)"

Arrow down, with a clock icon and label "等待信号..."

BOX 2 — Rounded rectangle, pale blue (#DBEAFE) fill, with a signal/wave icon:
Bold text: "Guard 命中触发评估"
Below: "guard signal → ProposalExecutor.#onSignal()"

Arrow down

BOX 3 — Rounded rectangle, white fill, with a checklist icon:
Bold text: "EvolutionPolicy.evaluateUpdate()"
Below line 1: "✓ FP 率正常 (< 0.4)"
Below line 2: "✓ 有使用记录"
Below line 3: "→ pass"

Arrow down

BOX 4 — Rounded rectangle, pale pink (#FADBD8) fill, with a wrench icon:
Bold text: "内容补丁 + 状态转换"
Below line 1: "active → evolving"
Below line 2: "ContentPatcher.applyProposal()"
Below line 3: "evolving → staging"
State flow shown as: three small state pills connected by arrows: "active" → "evolving" → "staging"

Arrow down with label "72h 无负面反馈"

BOX 5 — Rounded rectangle, pale green (#D1FAE5) fill, with a checkmark icon:
Bold text: "重新发布"
Below: "StagingManager → staging → active"

BOTTOM — Annotation:
Text: "进化后的知识不直接回 active，而是重新走 staging 观察"
