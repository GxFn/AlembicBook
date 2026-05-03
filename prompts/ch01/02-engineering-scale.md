Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Alembic 工程规模数据卡"

Purpose:
Create a clean data-card whiteboard that summarizes the real implementation scale without looking like a dashboard.

Main layout:
- Arrange 12 compact cards in a 4 by 3 grid.
- Each card has one large number, one short Chinese label, and one tiny implementation note.
- Group cards with subtle colored outlines: 代码理解, Agent 工具, 知识治理, 平台交付.

Must include these implementation facts:
- 12 万行 TypeScript.
- 11 个 Tree-sitter WASM 语法包.
- 25 个知识维度: 13 通用 + 7 语言 + 5 框架.
- 6 个 V2 语义工具 and 19 个 action.
- 19 个 MCP 工具: 17 Agent + 2 Admin.
- 6 态生命周期, 6 个交付通道, 12 种信号, 9 个 DI 模块.

Important visible labels:
- 12万
- 11
- 25
- 6
- 19
- 19
- 6态
- 6通道
- 12信号
- 9模块
- 4层 Guard
- 6层安全

Legend / footer:
- 数据来自当前 Alembic 代码实现

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
