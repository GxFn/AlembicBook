Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "混合搜索管线"

Purpose:
Show how Alembic retrieves relevant Recipes from query, code context, and behavior signals.

Main layout:
- Left: user query plus file context enters IntentExtractor.
- Center: parallel retrieval lanes: field-weighted search, HNSW vector search, graph relation search, signal ranking.
- Merge hub: RRF fusion and scenario weights.
- Right: ranked results with sourceRefs and usage hints.

Important visible labels:
- 意图提取
- 字段加权
- HNSW 向量
- 图谱关系
- 信号排序
- RRF 融合
- sourceRefs

Legend / footer:
- 检索不是只看相似度, 还看场景和信号

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
