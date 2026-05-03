Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Guard 四层检测引擎"

Purpose:
Show the forward immunity system that checks code changes and returns pass, violation, or uncertain.

Main layout:
- Left: changed files or staged diff enter Guard.
- Main chain: 正则规则 → 代码级多行 → Tree-sitter AST → 跨文件语义.
- Right: three verdict outputs: pass, violation, uncertain.
- Bottom: Agent repair loop receives violation plus relevant Recipes.
- Side note: ReverseGuard checks stale source references and symbol drift.

Important visible labels:
- 正则
- 多行代码
- AST
- 跨文件
- pass
- violation
- uncertain
- Agent 修复
- ReverseGuard

Legend / footer:
- 正向查违规, 反向查知识是否过期

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
