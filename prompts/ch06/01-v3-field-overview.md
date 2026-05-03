Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "KnowledgeEntry V3 字段全景"

Purpose:
Explain that Recipe, Rule, Fact, and Pattern share one unified KnowledgeEntry model.

Main layout:
- Draw one large KnowledgeEntry container split into six horizontal bands.
- Bands: 身份, 内容体, 证据链, 约束, 质量维度, 生命周期统计.
- On the right, attach sourceRefs and delivery metadata as small document cards.
- At the bottom, show SQLite row + Markdown file as two synchronized storage outputs.

Must include these implementation facts:
- V3 fields cover metadata, constraints, semantics, evidence, lifecycle, and statistics.
- Knowledge carries 25-dimension classification and quality scores.

Important visible labels:
- id
- kind
- title
- content
- coreCode
- sourceRefs
- constraints
- quality
- lifecycle
- stats

Legend / footer:
- 统一实体减少跨类型重复和 UNION 查询

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
