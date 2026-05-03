Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "代码结构分析链"

Purpose:
Show the deterministic ProjectIntelligence phases that produce the structural context for Agent analysis.

Main layout:
- Left: source files grouped by language.
- Main chain: 文件收集 → Tree-sitter WASM → Entity Graph → Call Graph → Dependency Graph → Panorama → 维度解析.
- Add small side notes for Tarjan SCC, Kahn 拓扑, role inference, and Enhancement Pack.
- Right: ProjectSnapshot consumed by Bootstrap / Rescan / Search / Dashboard.

Must include these implementation facts:
- Tree-sitter WASM has 11 grammar packages: Go, Python, Java, Kotlin, Swift, JavaScript, TypeScript, TSX, Rust, Objective-C, Dart.
- ProjectIntelligence phases are deterministic engineering analysis; LLM is only used later during dimension execution.

Important visible labels:
- 11 个 WASM 语法包
- Entity Graph
- Call Graph
- Dependency Graph
- Panorama
- ProjectSnapshot

Legend / footer:
- 蓝=结构图谱, 绿=可复用快照, 紫=维度激活

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
