Title at top in bold handwritten Chinese: "Alembic 风格锚点 — 系统设计白板图"

Subtitle below the title: "知识不是文档堆积，而是一次可路由、可压缩、可审计的上下文装配。"
Underline the phrase "可路由" in purple.

Create a landscape whiteboard architecture diagram that establishes the visual standard for this book. It should NOT document a real chapter in full detail; it should be a canonical style reference showing the drawing vocabulary.

LEFT SIDE — four numbered context layers stacked vertically:

1. Red layer:
Numbered circle "1" in red outline.
Heading: "热上下文"
Subheading: "每轮必带"
Small notes:
"极小 · 稳定 · 直接注入"
Arrow points right to a document box labeled:
"AGENTS.md"
"规则摘要"

2. Blue layer:
Numbered circle "2" in blue outline.
Heading: "冷知识库"
Subheading: "按需检索"
Small notes:
"SQLite · 向量索引 · Recipe"
Arrow points right to a database box labeled:
"Knowledge DB"
"search / graph"

3. Green layer:
Numbered circle "3" in green outline.
Heading: "技能库"
Subheading: "流程化能力"
Small notes:
"Skill · Workflow · Tool"
Arrow points right to a folder box labeled:
"Skills"
"按需加载"

4. Amber layer:
Numbered circle "4" in amber outline.
Heading: "深层记忆"
Subheading: "跨会话信号"
Small notes:
"行为链 · 偏好 · 证据"
Dashed arrow points right to a dashed box labeled:
"Signal"
"长期演化"

CENTER — routing and compression chain:
Place three rounded rectangles in a horizontal chain:
"检索" → "压缩" → "装配上下文"

Use blue arrow from Knowledge DB to "检索".
Use purple arrow from "检索" to "压缩".
Use black arrow from "压缩" to "装配上下文".
Use green arrow from Skills to "装配上下文".
Use dashed amber arrow from Signal to "装配上下文".

RIGHT SIDE — LLM execution:
Large rounded rectangle with very pale green fill labeled:
"LLM"
"编码 / 审查 / 回答"
Small doodle brain icon inside.
Arrow from "装配上下文" to LLM.
Arrow from LLM to a response box labeled:
"输出"
"代码 · 文档 · 决策"

BOTTOM — a long dashed process strip:
"用户请求" → "Prime" → "Search" → "Assemble" → "Act" → "Guard"

BOTTOM RIGHT — key principle card:
Title: "核心原则"
Bullets:
"上下文要小"
"细节走检索"
"动作可审计"

BOTTOM LEFT — legend strip:
Show five small colored labels:
"红 = 热路径"
"蓝 = 检索"
"绿 = 技能"
"橙 = 可选"
"紫 = 压缩/路由"

The diagram should demonstrate the final visual system: wide whiteboard layout, handwritten Chinese labels, thin colored arrows, numbered layers, simple system boxes, dashed optional flows, and a compact legend.
