Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Candidate 到 Recipe 的门控链"

Purpose:
Show how submitted knowledge becomes a trusted Recipe through validation, routing, and human review.

Main layout:
- Zone 1 "提交与候选形成": IDE Agent / Internal Agent calls knowledge.submit; V3 校验 checks title, content, coreCode, sourceRefs, constraints; 证据检查 validates sourceRefs; output card is Candidate with note 尚未可信.
- Zone 2 "质量与路由门控": Candidate goes to red diamond 相似度 >= 0.7?; duplicate branch goes to 重复保护 with reject, merge evidence, supersede proposal; main branch goes to 25 维质量评分 and then ConfidenceRouter.
- ConfidenceRouter outputs three lanes: pending: 证据不足; staging: 观察期; publish-ready: 高置信.
- Add an amber dashed observation loop into staging: usage / search / guard / feedback signals.
- Zone 3 "人工审核与可信复用": 人工审核 gate with 确认, 补证据, 拒绝; output active Recipe.
- active Recipe flows into Knowledge DB (Markdown + SQLite), Search, Guard, Delivery.

Must include these implementation facts:
- knowledge.submit requires V3 fields and performs duplicate check at similarity >= 0.7.
- ConfidenceRouter decides pending, staging, or publish path.

Important visible labels:
- 提交知识
- Candidate 尚未可信
- V3 校验
- 相似度 >= 0.7
- 25 维评分
- ConfidenceRouter
- staging 观察期
- 人工审核
- active Recipe

Legend / footer:
- 候选进入系统 · 门控保护质量 · 审核后才成为可复用知识

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
