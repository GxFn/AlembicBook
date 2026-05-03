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
Show the orthogonal composition model that replaced specialized Agent subclasses. These four dimensions are simultaneous inputs, not a linear pipeline.

Main layout:
- Center: large hub "AgentProfileCompiler" with note compose / validate / compile.
- Four input panels around the compiler, all pointing into AgentProfileCompiler at the same time.
- Top-left Profile panel: chat-default, lark-chat, scan-extract, bootstrap-session, evolution-audit; note ProfileRef / override / params.
- Top-right Capability panel: conversation, code_analysis, knowledge_production, system_interaction, evolution_analysis; note 决定可用工具 action.
- Bottom-left Strategy panel: Single, Pipeline, Analyze → Gate → Produce; dashed note bootstrap-session: AgentRunCoordinator → bootstrap-dimension children.
- Bottom-right Policy panel: BudgetPolicy, SafetyPolicy, QualityGatePolicy; notes maxIterations, timeout, file scope, quality gate.
- Output arrow: Compiled Profile → Agent Runtime Behavior with chips identity, tools, stages, limits.
- Top strip: Preset = 默认值 → Profile = 任务级装配.
- Bottom red warning strip: crossed-out ChatAgent / ScanAgent / BootstrapAgent / ... with note 避免 N 个特化子类.

Must include these implementation facts:
- Preset is runtime default composition; Profile is the higher-level unit.
- bootstrap-session uses AgentRunCoordinator with tiered concurrency and child bootstrap-dimension runs.

Important visible labels:
- Profile
- Capability
- Strategy
- Policy
- AgentProfileCompiler
- Compiled Profile
- Preset defaults
- bootstrap-session
- AgentRunCoordinator
- orthogonal inputs

Legend / footer:
- 正交组合 > 特化子类 · Profile 组合身份、能力、流程和边界

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
