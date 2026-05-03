Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Candidate 到 Recipe 旅程"

Purpose:
Show how submitted knowledge becomes a trusted Recipe through validation, routing, and human review.

Main layout:
- Left: IDE Agent or internal Agent submits knowledge.
- Main chain: knowledge.submit → V3 校验 → 相似度查重 → 25 维评分 → ConfidenceRouter → pending / staging → 人工审核 → active Recipe.
- Add a red branch for duplicate similarity >= 0.7 leading to duplicate intercept.
- Right: active Recipe flows into Delivery and Search.

Must include these implementation facts:
- knowledge.submit requires V3 fields and performs duplicate check at similarity >= 0.7.
- ConfidenceRouter decides pending, staging, or publish path.

Important visible labels:
- 提交知识
- V3 校验
- 相似度 >= 0.7
- 25 维评分
- ConfidenceRouter
- 人工审核
- active Recipe

Legend / footer:
- 绿=可信发布, 红=重复拦截, 紫=路由决策

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
