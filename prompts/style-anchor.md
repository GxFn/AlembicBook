Deprecated: retained only as a historical prompt from the old style-anchor workflow.
Current generation does not use this prompt or docs/public/images/style-anchor.png.
Use prompts/style-prompt-suffix.md as the canonical style, and compare outputs with docs/public/images/ch01/01-core-workflow.png.

Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style.

Visible title at top: "Alembic 风格锚点 — 系统设计白板图"

Purpose:
Establish the canonical visual language for every illustration in the book. This is a style reference, not a full chapter diagram.

Main layout:
- Left side: four stacked numbered context layers: 热上下文, 冷知识库, 技能库, 深层记忆.
- Center: a routing chain: 检索 → 压缩 → 装配上下文.
- Right side: LLM execution box flowing to 输出.
- Bottom strip: 用户请求 → Prime → Search → Assemble → Act → Guard.
- Bottom right principle note: 上下文要小, 细节走检索, 动作可审计.

Important visible labels:
- 热上下文 / 每轮必带
- 冷知识库 / 按需检索
- 技能库 / 流程化能力
- 深层记忆 / 跨会话信号
- Knowledge DB
- Skills
- Signal
- LLM

Legend / footer:
- 红=热路径, 蓝=检索, 绿=技能, 橙=异步, 紫=路由/压缩

Avoid:
- Do not copy the external reference content; only borrow the whiteboard architecture feeling.

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
