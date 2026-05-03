Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "检索可信度门控"

Purpose:
Show how search results are filtered before they become Agent context.

Main layout:
- Left: ranked Recipe candidates from SearchEngine.
- Center: gate checks lifecycle state, confidence, sourceRef health, dimension fit, and usage signals.
- Right: three output buckets: inject now, show as optional, hide or warn.
- Bottom: context budget compression keeps only the most useful evidence.

Important visible labels:
- Search Results
- lifecycle
- confidence
- sourceRef
- dimension fit
- 注入
- 可选
- 隐藏
- 上下文预算

Legend / footer:
- 少而准的上下文比大而杂更可靠

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
