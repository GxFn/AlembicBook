Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "六态生命周期"

Purpose:
Show the lifecycle state machine that governs every knowledge entry.

Main layout:
- Draw six states in a circular loop: pending, staging, active, evolving, decaying, deprecated.
- Place LifecycleStateMachine in the center as the only authority.
- Add signal arrows from usage, guard, quality, file-change, and audit.
- Add an audit log strip at the bottom for immutable transitions.

Important visible labels:
- pending
- staging
- active
- evolving
- decaying
- deprecated
- LifecycleStateMachine
- Audit Log

Legend / footer:
- 状态由信号驱动, 转换必须可追溯

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
