Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "ProjectIntelligence 结构分析链"

Purpose:
Show the deterministic ProjectIntelligence phases that produce the structural context for Agent analysis.

Main layout:
- Left input card: 代码库, 11 Tree-sitter WASM 语法包, and compact language chips: Go, Python, Java, Kotlin, Swift, JS, TS, TSX, Rust, ObjC, Dart.
- Segment A "1. 收集与解析": 文件收集 → Tree-sitter AST, with notes targets / langStats and 单文件语法树.
- Segment B "2. 关系建模": Entity Graph → CallGraph → Dependency Graph, with notes code_entities, 调用 / data flow, module edges.
- Segment C "3. 项目全景与基线": Panorama → Guard Audit, with notes 角色 / 分层 / 健康雷达 and 违规基线.
- Segment D "4. 维度激活": Dimension Resolve → activeDimensions.
- Center-right output artifact: ProjectSnapshot with compartments files, graphs, panorama, guard, dimensions.
- Downstream fanout from ProjectSnapshot to Cold Start, Knowledge Rescan, Search / Graph, Dashboard.
- Bottom optional amber dashed lane: incremental plan? → changed files → affectedDimensions → Rescan planning.

Must include these implementation facts:
- Tree-sitter WASM has 11 grammar packages: Go, Python, Java, Kotlin, Swift, JavaScript, TypeScript, TSX, Rust, Objective-C, Dart.
- ProjectIntelligence phases are deterministic engineering analysis; LLM is only used later during dimension execution.

Important visible labels:
- 11 个 WASM 语法包
- ProjectIntelligenceCapability
- Entity Graph
- Call Graph
- Dependency Graph
- Panorama
- ProjectSnapshot
- activeDimensions
- 确定性分析（不调用 LLM）

Legend / footer:
- 结构事实先行 · Agent 只消解不确定维度

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
