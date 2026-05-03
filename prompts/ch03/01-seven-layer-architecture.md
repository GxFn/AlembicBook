Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Alembic 七层架构"

Purpose:
Show the current DDD architecture and the real Agent / Tool routing split.

Main layout:
- Stack seven horizontal layers from top to bottom: Entry Points, Bootstrap, Injection, Agent, Service, Core + Domain, Infrastructure.
- Inside the Agent layer, show AgentService → ProfileCompiler → AgentRunCoordinator → RuntimeBuilder → AgentRuntime.
- Add a side lane from AgentRuntime to V2ToolRouterAdapter and ToolRouterV2.
- Add a separate platform lane from MCP / Dashboard / Skill / Workflow to UnifiedToolCatalog + LightweightRouter.
- Use downward arrows to show dependency direction and a red blocked arrow for forbidden upward imports.

Must include these implementation facts:
- Agent Runtime uses 6 V2 semantic tools and 19 actions.
- Non-Agent surfaces use UnifiedToolCatalog + LightweightRouter.
- DI has 9 modules and typed ServiceMap entries such as agentService, agentRuntimeBuilder, agentRunCoordinator.

Important visible labels:
- Entry
- Bootstrap
- Injection
- Agent
- Service
- Core + Domain
- Infrastructure
- V2ToolRouterAdapter
- UnifiedToolCatalog

Legend / footer:
- 黑=依赖方向, 紫=Agent 工具路由, 蓝=平台工具目录

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
