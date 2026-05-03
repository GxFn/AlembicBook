Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "MCP 与六通道交付"

Purpose:
Show how Alembic exposes local capabilities through MCP and writes knowledge back into IDE-native files.

Main layout:
- Left: IDE Agent connects over stdio MCP to alembic-local.
- Center: MCP server exposes 19 alembic_* tools grouped into Agent tools and Admin tools.
- Below center: McpCapabilityProjection turns tool definitions into manifests with risk, sideEffect, and trust flags.
- Right: Delivery pipeline writes six channels: Cursor rules, Cursor skills, AGENTS.md, CLAUDE.md, Copilot instructions, mirror targets.
- Bottom: Recipe changes refresh delivery artifacts.

Must include these implementation facts:
- Current MCP tool list has 19 tools: 17 Agent tools and 2 Admin tools.
- Bundled local server is trusted, but outputs can contain untrusted text.

Important visible labels:
- stdio MCP
- 19 工具
- 17 Agent
- 2 Admin
- Manifest
- sideEffect
- Delivery
- 6 通道

Legend / footer:
- MCP 是交互面, Delivery 是持久上下文面

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
