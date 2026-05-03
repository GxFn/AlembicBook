Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "基础设施四层底座"

Purpose:
Show the runtime infrastructure that makes the local knowledge engine durable and reactive.

Main layout:
- Four stacked infrastructure bands: SQLite / Repository, Vector / HNSW, Signal / Event / Realtime, DI / AI Provider.
- Left: ServiceContainer wires 9 modules and typed ServiceMap.
- Right: consumers are CLI, MCP, Dashboard, AgentRuntime.
- Add arrows showing database changes triggering cache coordination and search index refresh.

Must include these implementation facts:
- ServiceMap now exposes agentService, agentRuntimeBuilder, and agentRunCoordinator rather than a single agentFactory.
- AiProviderManager is the central authority for provider switching and hot reload.

Important visible labels:
- SQLite WAL
- Repository
- HNSW
- SignalBus
- EventBus
- Realtime
- ServiceContainer
- AiProviderManager

Legend / footer:
- 本地优先, 可审计, 可热重载

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
