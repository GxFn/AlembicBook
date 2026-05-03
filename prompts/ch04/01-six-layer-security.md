Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "六层安全链路"

Purpose:
Show every request passing through the defense-in-depth pipeline before it can touch project data.

Main layout:
- Left: three request sources: MCP, HTTP, CLI.
- Center: six numbered gates in a horizontal chain: Constitution, Gateway, Permission, SafetyPolicy, PathGuard, ConfidenceRouter.
- Right: allowed actions reach Service / Repository / Files; blocked actions go to Audit.
- Use red stop marks at failed gates and blue audit trail arrows.

Important visible labels:
- 角色权限
- 请求网关
- RBAC
- 行为沙箱
- 文件沙箱
- 质量门控
- Audit

Legend / footer:
- 任一层失败即阻断; 所有副作用可审计

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
