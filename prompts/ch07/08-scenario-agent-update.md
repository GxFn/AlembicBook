Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "场景：Agent 请求更新知识"

Purpose:
Show how an IDE Agent can propose a better recipe without directly overwriting the old one.

Main layout:
- Left: IDE Agent finds a newer pattern in code.
- Middle: knowledge.submit or knowledge.manage update creates a proposal.
- Add duplicate / supersede check before the proposal is accepted.
- Right: human review chooses approve, reject, or keep watching.
- Bottom: old Recipe remains active until the state machine transitions it.

Important visible labels:
- IDE Agent
- 新证据
- knowledge.manage
- supersede
- 人工审核
- 旧 Recipe 保留

Legend / footer:
- 更新走提案, 不走静默覆盖

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
