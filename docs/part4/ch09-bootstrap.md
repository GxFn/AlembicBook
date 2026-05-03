# Cold Start 与 Knowledge Rescan — 项目分析工作流

> 冷启动和增量重扫已经从旧的 MCP handler 目录拆成 `lib/workflows/` 下的工作流体系。冷启动负责干净建库，Knowledge Rescan 负责保留 Recipe 的增量治理。

## 问题场景

用户第一次接入项目时，需要从零建立 Alembic 知识库。系统要收集源码、构建 AST、实体图、调用图、依赖图、Panorama、Guard 基线，并激活适合当前语言和框架的分析维度。这是 **Cold Start**。

项目运行一段时间后，已有 Recipe 不能直接丢弃，但代码已经变化。系统需要保留已审核知识、重新分析项目结构、审计 Recipe 是否仍然真实，并只补齐缺口维度或处理衰退知识。这是 **Knowledge Rescan**。

旧章节把两者混在“增量 Bootstrap”里。当前代码已经明确拆分：

```text
lib/workflows/
├── cold-start/
│   ├── ColdStartIntent.ts
│   ├── ColdStartPlan.ts
│   ├── ColdStartPresenters.ts
│   ├── external/ExternalColdStartWorkflow.ts
│   └── internal/InternalColdStartWorkflow.ts
├── knowledge-rescan/
│   ├── KnowledgeRescanIntent.ts
│   ├── KnowledgeRescanWorkflowPlan.ts
│   ├── KnowledgeRescanPresenters.ts
│   ├── external/ExternalKnowledgeRescanWorkflow.ts
│   └── internal/InternalKnowledgeRescanWorkflow.ts
└── capabilities/
    ├── cleanup/
    ├── project-intelligence/
    ├── planning/
    ├── execution/
    ├── persistence/
    ├── completion/
    └── presentation/
```

本章的主代码锚点是 `lib/workflows/cold-start/external/ExternalColdStartWorkflow.ts`、`lib/workflows/cold-start/internal/InternalColdStartWorkflow.ts`、`lib/workflows/knowledge-rescan/external/ExternalKnowledgeRescanWorkflow.ts`、`lib/workflows/knowledge-rescan/internal/InternalKnowledgeRescanWorkflow.ts`。共享的结构分析阶段在 `lib/workflows/capabilities/project-intelligence/ProjectIntelligenceRunner.ts`，重扫的覆盖分类与 gap 计划在 `lib/workflows/capabilities/planning/knowledge/KnowledgeRescanPlanner.ts`。

![Cold Start / Rescan 工作流关系](/images/ch09/01-dual-path-architecture.png)

## 共同底座：ProjectIntelligenceCapability

冷启动和重扫共享同一条项目分析能力：

```text
ProjectIntelligenceCapability.run()
  → prepareProjectAnalysisRun()
  → runAllPhases()
  → ProjectSnapshot
```

`runAllPhases()` 的当前阶段是：

| Phase | 当前函数 | 产物 |
|:---|:---|:---|
| 1 | `runPhase1_FileCollection` | allFiles、allTargets、discoverer、langStats、truncated |
| incremental eval | `evaluateProjectAnalysisIncrementalPlan` | 可选 FileDiffPlan；冷启动默认关闭，重扫在存在增量计划时把 diff 传给 impact / gap planning |
| 1.5 | `runPhase1_5_AstAnalysis` | astProjectSummary、astContext、warnings |
| 1.6 | `runPhase1_6_EntityGraph` | code_entities、knowledge_edges |
| 1.7 | `runPhase1_7_CallGraph` | call graph、data flow、method entities |
| 2 | `runPhase2_DependencyGraph` | dependency graph、module depends_on edges |
| 2.1 | `runPhase2_1_ModuleEntities` | module entities |
| 2.2 | `materializeProjectPanorama` | Panorama 全景 |
| 3 | `runPhase3_GuardAudit` | Guard audit、violations |
| 4 | `runPhase4_DimensionResolve` | activeDimensions、Enhancement Pack、language profile |

这些阶段都是确定性工程分析，不依赖 LLM。AI 只在后续维度执行中介入。

## 冷启动计划

`buildColdStartWorkflowPlan()` 明确声明冷启动是 full reset：

```typescript
cleanup: {
  policy: 'full-reset',
  projectRoot,
  dataRoot,
}
projectAnalysis.scan.incremental = false
materialize = {
  codeEntityGraph: true,
  callGraph: true,
  dependencyEdges: true,
  moduleEntities: true,
  guardViolations: true,
  panorama: true,
}
```

这意味着冷启动不是“能增量就增量”的流程。它的职责是建立干净基线。

`CleanupService.fullReset()` 会使用垃圾桶模式：

- 清除过期 `.trash`。
- 把 candidates、recipes、skills、wiki 移入时间戳垃圾桶。
- 导出 DB 快照到 `db-snapshot.jsonl`。
- 清空知识、边、snapshot、guard、audit、session、memory、code entity、remote 等运行时表。
- 清除向量索引、bootstrap report、signals logs。
- 保留配置、constitution、IDE 集成配置。

## 冷启动双路径

冷启动仍然有内部 Agent 和外部 Agent 两条路径，但它们现在都通过 `ColdStartPlan` 和 `ProjectIntelligenceCapability` 共享底座。

### 外部 Agent 路径

`runExternalColdStartWorkflow()` 对应 MCP `alembic_bootstrap`：

```text
createExternalColdStartIntent()
  → buildColdStartWorkflowPlan()
  → runFullResetPolicy()
  → ProjectIntelligenceCapability.run()
  → buildProjectSnapshot()
  → createExternalWorkflowSession()
  → buildExternalMissionBriefing(profile='cold-start-external')
  → presentExternalColdStartResponse()
```

它不启动内部 AI pipeline，而是返回 Mission Briefing。IDE Agent 根据 briefing 逐维度阅读代码、调用 `alembic_submit_knowledge` 提交知识，再调用 `alembic_dimension_complete` 标记维度完成。

### 内部 Agent 路径

`runInternalColdStartWorkflow()` 适合本地已配置 AI Provider 的场景：

```text
createInternalColdStartIntent(args)
  → buildColdStartWorkflowPlan()
  → runFullResetPolicy()
  → ProjectIntelligenceCapability.run()
  → buildProjectSnapshot()
  → cacheProjectAnalysisSession()
  → startInternalDimensionExecutionSession()
  → dispatchInternalDimensionExecution()
  → presentInternalColdStartResponse()
```

同步阶段返回骨架和 task list。异步阶段由 internal dimension execution 后台填充，Dashboard 通过 bootstrap events 看到进度。

如果 CLI 调用方传入 `skipAsyncFill`，内部路径会只返回骨架，不启动 fire-and-forget 后台填充，避免短生命周期进程退出后 DB 断连。

## Internal Dimension Execution

内部维度执行已经拆成复用能力：

```text
InternalDimensionExecutionWorkflow
  → startInternalDimensionExecutionSession()
  → dispatchInternalDimensionExecution()
  → runInternalDimensionExecution()
```

单维度执行流程：

```text
prepareInternalDimensionFillRun()
  → initializeBootstrapRuntime()
  → runInternalDimensionAgentSession()
  → finalizeInternalDimensionFill()
```

最终它会走 AgentService：

```text
profile: bootstrap-dimension
strategy factory: bootstrapDimensionPipeline
stages:
  analyze → quality_gate → produce → rejection_gate
```

如果存在旧 Recipe 且还没有完成 prescreen，StageFactory 仍保留插入进化阶段的能力：

```text
evolve → evolution_gate
```

但当前 internal rescan 的实装会先构建 `evolutionPrescreen`，再把它传入 `dispatchInternalDimensionExecution()`。因此 rescan 的维度填充通常不会再插入 per-dimension evolve stage，而是运行 `analyze → quality_gate → produce → rejection_gate`；旧 Recipe 的进化判断已经被前置的 `RecipeImpactPlanner + runEvolutionAudit()` 接走。冷启动和重扫仍共用同一套单维度 Agent pipeline，只是输入上下文和阶段组合不同。

## 外部维度完成

外部 Agent 通过 `alembic_dimension_complete` 进入：

```text
runExternalDimensionCompletionWorkflow()
  → resolve session
  → bindSubmittedRecipes()
  → generateWorkflowSkill()
  → session.markDimensionComplete()
  → saveDimensionCheckpoint()
  → persistKeyFindings()
  → emit progress
  → runWorkflowCompletionFinalizer() when complete
```

完成时会做：

- Recipe 绑定到 dimension。
- 生成或更新 workflow skill。
- 保存 dimension checkpoint。
- 记录 key findings。
- 推送 `bootstrap:dimension-complete` / all complete 事件。
- 所有维度完成后进入 completion finalizer。

## Knowledge Rescan 计划

`buildKnowledgeRescanWorkflowPlan()` 是重扫入口。它和冷启动最大的不同是 cleanup policy。当前 intent 可以在三种策略间切换：

```typescript
cleanup: { policy: 'force-rescan' | 'rescan-clean' | 'snapshot-only' }
projectAnalysis.scan.incremental = false
```

默认的 `rescan-clean` 不清空 Recipe，而是：

- `snapshotRecipes()` 先快照 consumable Recipe。
- `rescanClean()` 清理衍生缓存、snapshot、source refs、code entities、guard violations、semantic memories、sessions、audit logs 等。
- 保留 active / published / staging / evolving 等知识记录和 evolution 相关数据。

所以 Rescan 的“增量”不是文件扫描层面的局部 AST 分析，而是**知识治理层面的增量**：保留已有 Recipe，对它们做证据审计，只补齐缺口或处理衰退。

## Rescan 外部路径

`runExternalKnowledgeRescanWorkflow()` 对应 MCP `alembic_rescan`：

```text
createExternalKnowledgeRescanIntent(args)
  → buildKnowledgeRescanWorkflowPlan()
  → runRescanCleanPolicy()
  → syncKnowledgeStoreForRescan()
  → ProjectIntelligenceCapability.run()
  → buildProjectSnapshot()
  → auditRecipesForRescan()
  → buildKnowledgeRescanPlan()
  → buildRescanPrescreen()
  → projectExternalRescanEvidencePlan()
  → createExternalWorkflowSession()
  → buildExternalMissionBriefing(profile='rescan-external')
  → presentExternalKnowledgeRescanResponse()
```

Mission Briefing 会包含：

- preserved recipes。
- audit summary。
- evidencePlan：`allRecipes`、`dimensionGaps`、`executionReasons`、`occupiedTriggers`。
- dimension gaps。
- evolution prescreen。
- execution reasons。

外部 IDE Agent 收到后执行三步：

1. **Evolve**：过滤本维度 `evolutionPrescreen.needsVerification` 中的 Recipe，读取 sourceRefs 源码后调用 `alembic_evolve`。
2. **Gap-Fill**：参考 `dimensionGaps[].gap` 和 `occupiedTriggers`，调用 `alembic_submit_knowledge` 提交未覆盖的新模式，避免重复已有 trigger。
3. **Complete**：调用 `alembic_dimension_complete`，带上 referencedFiles、keyFindings 和 analysisText。

外部路径不会启动内部 Agent。服务端只把证据、gap 和约束放入 Mission Briefing，让 IDE Agent 用自己的上下文窗口和代码阅读能力完成进化判断。

## Rescan 内部路径

`runInternalKnowledgeRescanWorkflow()` 在服务端自动执行：

```text
runRescanCleanPolicy() / runForceRescanCleanPolicy() / snapshotRecipes()
  → syncKnowledgeStoreForRescan()
  → SourceRefReconciler.reconcile(force)
  → repairRenames() + applyRepairs()
  → ProjectIntelligenceCapability.run()
  → RecipeImpactPlanner.plan(incrementalDiff?)
  → runEvolutionAudit() fire-and-forget
  → auditRecipesForRescan()
  → buildKnowledgeRescanPlan(fileDiff?)
  → buildRescanPrescreen()
  → projectInternalRescanGapPlan()
  → cacheProjectAnalysisSession()
  → startInternalDimensionExecutionSession()
  → dispatchInternalDimensionExecution(existingRecipes, evolutionPrescreen)
  → presentInternalKnowledgeRescanResponse()
```

它先返回骨架和 gap plan，再后台填充需要执行的维度。SourceRef 修复和 impact planning 都在同步响应前完成；Evolution Agent 审计是 fire-and-forget，不阻塞本次 rescan 响应。

![Rescan 内部治理链路](/images/ch09/02-rescan-internal-governance.png)

内部路径里有两个容易混淆的“进化”：

- **批量进化审计**：`RecipeImpactPlanner.plan()` 生成候选后，`runEvolutionAudit()` 启动 `evolution-audit` profile。Agent 读取真实代码后调用 `knowledge.manage(operation: "evolve" | "deprecate" | "skip_evolution")`，提案来源标记为 `rescan-evolution`。
- **维度 gap-fill**：后续 internal dimension execution 只补齐 gap。`BootstrapRescanState` 会把有效旧 Recipe 写入去重集合，把 decaying Recipe 和 occupied triggers 注入 prompt，Producer 被限制为最多提交本维度 gap 数量的候选。

因此 internal rescan 不是“每个维度全量重跑并顺便检查旧知识”。它先用工程 diff 和 SourceRef 找出受影响 Recipe，把复杂判断交给 Evolution Agent；然后维度 pipeline 只在有 coverage-gap、recipe-decay 或 file-change reason 的维度里补新知识。

## Recipe 审计与 Gap Plan

重扫的关键逻辑在 `KnowledgeRescanPlanner` 和 `KnowledgeRescanPlanBuilder`。

`auditRecipesForRescan()` 当前是 `KnowledgeRescanPlanner` 中的覆盖分类函数，输入：

- 旧 Recipe 快照。
- 当前文件列表。
- SourceRef / Recipe 文件一致性同步后的知识记录。
- 内部路径还会结合 `RecipeImpactPlanner` 对增量 diff、source refs 和 lifecycle 状态做覆盖分类。

输出 audit verdict：`healthy`、`watch`、`decay`、`severe`、`dead` 等。

分类优先级是 `RecipeImpactPlanner` 候选 → SourceRef 桥接表健康度 → lifecycle 兜底。也就是说，internal rescan 如果拿到了 diff，会优先相信“这次变更具体影响了哪条 Recipe”；外部 rescan 没有 candidatePlan，则主要依赖 SourceRef 和 lifecycle 做覆盖分类。

`buildKnowledgeRescanPlan()` 按维度计算：

```typescript
targetPerDimension = 5
existingCount = active/evolving + healthy/watch staging
gap = max(0, targetPerDimension - existingCount)
executionReasons = [
  manual-request?,
  file-change?,
  recipe-decay?,
  coverage-gap?,
  fully-covered?
]
shouldExecute = 有非 manual-request / fully-covered 的原因
```

执行维度来自三类信号：

1. **coverage-gap**：该维度有效 Recipe 少于目标数量。
2. **recipe-decay**：该维度有衰退或严重衰退 Recipe。
3. **file-change**：内部 rescan 如果拿到 `_incrementalPlan.diff`，会把 `affectedDimensions` 和 changed files 传入 gap plan。

这比旧的“所有维度重新跑”更精细，也比旧的“文件 diff 决定一切”更适合知识库治理：文件变化是一个强信号，但最终是否执行仍由 Recipe 健康、覆盖缺口和用户指定维度共同决定。

## FileDiffPlanner 的位置

代码里仍有文件差异能力：

- `FileDiffSnapshotStore`：保存 workflow 快照、文件 hash、维度文件映射、episodicData。
- `FileDiffPlanner`：计算 added / modified / deleted / unchanged，推断 affectedDimensions，恢复 SessionStore。
- `ProjectIntelligenceIncrementalPlanner`：在 `runAllPhases()` Phase 1 后可选评估 incremental plan。

但要注意当前两个生产计划默认都写了 `incremental: false`：

- `ColdStartPlan`：冷启动强制 full-reset。
- `KnowledgeRescanWorkflowPlan`：重扫会保留知识，默认仍全量重建结构化上下文；如果底层 ProjectIntelligence 产出了 `_incrementalPlan`，内部 rescan 会继续把 diff 用到 `RecipeImpactPlanner` 和 `buildKnowledgeRescanPlan()`。

因此书里不应再把“增量 Bootstrap”描述为当前默认路径。更准确的说法是：**文件 diff 是可复用能力；当前重扫的增量性主要发生在 Recipe 审计、SourceRef 修复、impact planning、维度 gap 和执行计划层。**

## 事件与完成

内部路径使用 `BootstrapTaskManager` 风格的 task session：

```text
skeleton → filling → completed
                → failed
```

事件通过 `BootstrapEventEmitter`、EventBus 和 RealtimeService 推给 Dashboard。外部路径则由 `ExternalWorkflowSession` 保存进度，`dimension_complete` 时更新 session。

所有维度完成后会进入 `WorkflowCompletionFinalizer`，它可以执行：

- Delivery completion。
- Wiki completion。
- Panorama completion。
- Semantic memory consolidation。
- Delivery verification。

## 权衡

当前拆分的核心取舍是：

1. **冷启动必须干净**：full reset 建立可信基线，避免旧候选、旧图谱、旧向量污染首轮知识库。
2. **重扫必须保留知识**：Recipe 是人工审核资产，默认不能因重扫被清空，只能通过 sync、SourceRef reconcile、audit、prescreen、evolution 和 gap-fill 治理；显式 `force-rescan` 才走更强清理。
3. **项目分析统一**：冷启动和重扫都复用 ProjectIntelligenceCapability，避免两套 AST/图谱/Panorama/Guard 管线漂移。
4. **AI 执行分流**：内部路径自动跑 AgentService；外部路径返回 Mission Briefing，让 IDE Agent 使用自己的代码阅读能力。
5. **增量层级明确**：当前默认不是局部 AST incremental scan，而是 knowledge-level rescan；有 diff 时用于影响评估和执行计划，不直接替代项目结构分析。

## 小结

当前实现应这样理解：

> **Cold Start = full reset + full project intelligence + dimension execution。Knowledge Rescan = preserve recipes + rescan clean / snapshot-only + source-ref reconcile + project intelligence + impact / relevance audit + gap/evolution execution。**

冷启动和重扫不再是一个 handler 里的两个分支，而是 `lib/workflows/` 下两套显式工作流，共用 capability、planning、execution、persistence 和 completion 能力。

::: tip 下一章
[Guard — 四层合规检测引擎](./ch10-guard)
:::
