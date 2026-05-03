Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Cold Start / Rescan 双路径架构"

Purpose:
Show the latest workflow split: Cold Start builds a clean baseline, Knowledge Rescan preserves and governs existing Recipes.

Main layout:
- Top shared lane: ProjectIntelligenceCapability produces ProjectSnapshot through file collection, AST, entity graph, call graph, dependency graph, Panorama, Guard, dimension resolve.
- Left fork: Cold Start path: full reset → cache session → internal dimension execution or external mission briefing → Candidates / Recipes / Wiki.
- Right fork: Knowledge Rescan path: rescan clean or snapshot-only → sync knowledge store → SourceRef reconcile → impact planning → audit → prescreen → gap/evolution execution.
- Bottom convergence: same knowledge base, same 25 dimensions, same completion finalizer.
- Use dashed amber arrows for async internal dimension execution and fire-and-forget evolution audit.

Must include these implementation facts:
- Internal rescan runs SourceRefReconciler.reconcile(force), repairRenames, and applyRepairs.
- Internal rescan can pass incremental diff to RecipeImpactPlanner and buildKnowledgeRescanPlan.
- bootstrap-session coordination is handled by AgentRunCoordinator, not an old FanOutStrategy.

Important visible labels:
- Cold Start
- Knowledge Rescan
- ProjectIntelligence
- ProjectSnapshot
- SourceRef 修复
- Impact Plan
- Prescreen
- Gap Fill

Legend / footer:
- 冷启动干净建库; 重扫保留知识并治理缺口

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
