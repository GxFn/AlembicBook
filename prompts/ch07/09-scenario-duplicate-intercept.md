Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "场景：重复知识拦截"

Purpose:
Show duplicate prevention when a new candidate is too similar to an existing recipe.

Main layout:
- Left: new candidate card.
- Center: similarity check compares against active and staging recipes.
- If similarity >= 0.7, a red branch goes to duplicate intercept.
- Right: possible outcomes: reject, merge evidence, supersede proposal.
- Green branch for truly new knowledge continues to ConfidenceRouter.

Must include these implementation facts:
- Duplicate threshold is similarity >= 0.7 for knowledge.submit.

Important visible labels:
- 新候选
- 相似度检查
- >= 0.7
- 重复拦截
- 合并证据
- supersede
- ConfidenceRouter

Legend / footer:
- 防止知识库膨胀和冲突

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
