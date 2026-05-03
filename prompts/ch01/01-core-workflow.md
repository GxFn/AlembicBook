Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Alembic 核心工作流"

Purpose:
Show how Alembic turns a finite project scan into an evolving local knowledge organism that answers infinite future questions.

Main layout:
- Left: 用户请求 and 代码库 enter a shared analysis lane.
- Center top: ProjectIntelligence pipeline: 文件收集 → AST/图谱 → Panorama → 维度激活.
- Center middle: AgentService lane with ProfileCompiler, RuntimeBuilder, V2 工具.
- Center bottom: 人工审核 turns Candidates into Recipes.
- Right: MCP / IDE Agent consumes Recipes through Search, Guard, Answer.
- A dashed feedback loop returns usage, guard, quality, and lifecycle signals to the knowledge organism.

Must include these implementation facts:
- Tree-sitter WASM: 11 个语法包, 10 个主要语言族.
- Tool System V2: 6 个语义工具, 19 个 action.
- MCP: 19 个 alembic_* 工具.
- Knowledge framework: 25 个维度.

Important visible labels:
- 一次构建有限答案
- 持续回答无限问题
- ProjectIntelligence
- AgentService
- Candidates
- Recipes
- MCP / IDE
- Signal 回流

Legend / footer:
- 蓝=结构化分析, 紫=Agent 路由, 绿=知识交付, 橙=信号反馈

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
