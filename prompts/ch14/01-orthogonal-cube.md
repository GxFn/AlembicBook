Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Profile × Capability × Strategy × Policy"

Purpose:
Show the orthogonal composition model that replaced specialized Agent subclasses.

Main layout:
- Draw a flat orthogonal matrix / cube metaphor with four clearly separated axes labeled Profile, Capability, Strategy, Policy; keep it whiteboard-flat, not rendered in 3D.
- Place example profiles on the Profile axis: chat-default, lark-chat, scan-extract, bootstrap-session, evolution-audit.
- Capability axis: conversation, code_analysis, knowledge_production, system_interaction, evolution_analysis.
- Strategy axis: Single, Pipeline, service-level fanout coordination.
- Policy axis: BudgetPolicy, QualityGatePolicy, SafetyPolicy.

Must include these implementation facts:
- Preset is runtime default composition; Profile is the higher-level unit.
- bootstrap-session uses AgentRunCoordinator with tiered concurrency and child bootstrap-dimension runs.

Important visible labels:
- Profile
- Capability
- Strategy
- Policy
- chat
- insight
- bootstrap-session
- Budget
- Safety
- QualityGate

Legend / footer:
- 正交组合减少特化子类

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
