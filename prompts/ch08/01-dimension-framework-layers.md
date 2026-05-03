Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "25 维质量框架"

Purpose:
Show how Alembic activates and scores project-specific quality dimensions without inventing fixed weights.

Main layout:
- Zone 1 "DimensionRegistry：25 原子维度": three grouped containers, 13 通用维度, 7 语言维度, 5 框架维度. Add formula 25 = 13 + 7 + 5. Use only representative chips and ellipses, not all dimension names.
- Zone 2 "项目激活": Discovery with chips 语言, 框架, 项目类型 flows to activeDimensions. Example card: Swift + SwiftUI → 通用 + Swift + SwiftUI.
- Zone 3 "评分与聚合": activeDimensions flows into QualityScorer; show several dimension score cards; aggregate into qualityScore 0-100. Do not draw fixed weights or percentages.
- Zone 4 "路由与治理": qualityScore flows to ConfidenceRouter, which outputs pending, staging, publish-ready, audit.
- Add amber dashed loop from usage / guard / feedback signals back to staging / audit.

Must include these implementation facts:
- DimensionRegistry defines 25 dimensions: 13 universal, 7 language-specific, 5 framework-specific.

Important visible labels:
- 25 = 13 + 7 + 5
- DimensionRegistry
- 13 通用
- 7 语言
- 5 框架
- Discovery
- activeDimensions
- QualityScorer
- dimension score
- qualityScore
- ConfidenceRouter

Legend / footer:
- 不同项目激活不同维度 · 同一质量框架保持可比性

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
