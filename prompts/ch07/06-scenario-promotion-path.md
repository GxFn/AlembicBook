Title at top in bold Chinese: "场景 1：新建候选的晋升之路"

A vertical timeline diagram showing a Recipe's journey from creation to full activation, with clear time markers on the left side and state transitions on the right. Clean layout with generous spacing.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons.

LEFT SIDE — Time axis (vertical dashed line with time markers):

T+0, T+0 (秒级), T+72h, T+72h 后

RIGHT SIDE — State boxes connected by downward arrows:

BOX 1 — Rounded rectangle, pale yellow (#FEF3C7) fill, with a small sparkle icon:
Bold text: "Recipe 创建"
Below: "CookieProviding · 置信度 0.85"
State badge on right: "pending" in gray pill

Arrow down with label: "ConfidenceRouter"

BOX 2 — Rounded rectangle, pale blue (#DBEAFE) fill, with a small eye icon:
Bold text: "自动晋升到暂存"
Below: "0.85 ≥ 阈值 → auto_approve"
State badge on right: "staging" in blue pill
Side annotation: "暂存期 72h"

Arrow down with label: "StagingManager.checkAndPromote()"
Side note near arrow: "无负面反馈 ✓"

BOX 3 — Rounded rectangle, pale green (#D1FAE5) fill, with a checkmark icon:
Bold text: "正式发布"
State badge on right: "active" in green pill

Arrow down

BOX 4 — Rounded rectangle, white fill with green border, with a search + shield icon:
Bold text: "全权重参与"
Below line 1: "搜索 — 全权重命中"
Below line 2: "Guard — 正式规则检查"

BOTTOM — A small annotation box with pale gray background:
Text (IMPORTANT — exactly this text, no extra commas): "80% 的高置信度 Recipe 走此自动路径，无需人工干预"
