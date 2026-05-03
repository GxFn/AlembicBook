Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "继承模型 vs 统一实体"

Purpose:
Compare the old fragmented inheritance model with the current KnowledgeEntry + kind design.

Main layout:
- Left side: four separate old boxes: RecipeEntry, RuleEntry, FactEntry, PatternEntry with duplicated fields highlighted.
- Center: migration arrow labeled kind 字段.
- Right side: one large KnowledgeEntry box with kind = recipe / rule / fact / pattern.
- Bottom: query path changes from UNION to single repository query.

Important visible labels:
- 旧模型
- 重复字段
- 跨表查询
- 统一实体
- kind
- 单仓储查询

Legend / footer:
- 从类型继承转向统一模型, 保留语义差异但消除结构重复

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
