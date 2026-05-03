Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "四端接入统一架构"

Purpose:
Show how CLI, Dashboard, IDE Agent, and remote chat all share one local knowledge core.

Main layout:
- Left side: four entry cards: CLI, Dashboard, MCP / IDE, Lark / Remote.
- Center: shared Gateway and ServiceContainer.
- Middle service row: Knowledge, Search, Guard, Workflows, Agent.
- Right: local data stores: SQLite, recipes files, vector index, signal logs.
- Bottom: common workflows: setup, coldstart, rescan, guard, search, delivery.

Must include these implementation facts:
- coldstart is ProjectIntelligence plus 25-dimension execution; rescan preserves Recipes and governs gaps.
- All surfaces share the same Gateway, Constitution, and local database.

Important visible labels:
- CLI
- Dashboard
- MCP / IDE
- Lark
- Gateway
- ServiceContainer
- SQLite
- Recipes
- Vector
- Signals

Legend / footer:
- 四种界面, 一个本地知识内核

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
