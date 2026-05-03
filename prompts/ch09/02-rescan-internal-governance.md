Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Rescan 内部治理链路"

Purpose:
Show that internal Knowledge Rescan first preserves and reconciles existing knowledge, then runs shared ProjectIntelligence, then plans audit / impact / prescreen / gap / evolution execution.

Main layout:
- One left-to-right numbered timeline: 已有 Recipes → snapshotRecipes → rescan clean / snapshot-only → syncKnowledgeStore → SourceRefReconciler → ProjectIntelligenceCapability → ProjectSnapshot.
- Under SourceRefReconciler, include short chips: reconcile(force), repairRenames, applyRepairs.
- After ProjectSnapshot, route into a purple planning hub: KnowledgeRescanPlan.
- Planning branches: auditRecipes produces healthy / watch / decay / severe / dead; incremental diff? feeds RecipeImpactPlanner; buildRescanPrescreen produces auto skip / verify / auto deprecate.
- Merge branches into Gap / Evolution Plan.
- Outputs: fully covered → 不执行维度; 异步 gap fill → dimension execution; EvolutionAudit fire-and-forget → proposal.
- Bottom output database: 本地知识库 with Recipes 保留, 缺口补齐, 衰退治理.

Must include these implementation facts:
- SourceRef 修复发生在 ProjectIntelligence 和 audit planning 之前.
- Audit 只审计，不阻塞主流程.
- 增量性在知识治理层，不是简单局部 AST 扫描.

Important visible labels:
- snapshotRecipes
- syncKnowledgeStore
- SourceRefReconciler
- ProjectIntelligenceCapability
- ProjectSnapshot
- KnowledgeRescanPlan
- RecipeImpactPlanner
- Gap / Evolution Plan
- EvolutionAudit fire-and-forget

Legend / footer:
- 增量性在知识治理层：保留、修复、评估、补齐、进化

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
