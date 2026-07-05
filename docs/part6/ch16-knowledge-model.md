# Ch16 Knowledge、Candidate、Recipe 与 Wiki

Alembic 的知识层不是一堆 Markdown，也不是一个 SQLite 表。它是一套有生命周期、字段规范、sourceRef、审阅路径和消费规则的知识对象系统。Candidate、Recipe、KnowledgeEntry、Wiki、Project Skill 都是这个系统的不同投影，不能混用。

本章讲知识模型本体：什么是候选，什么是可消费知识，Recipe 为什么需要证据，Wiki 为什么只是阅读投影。

![Alembic 知识对象关系图](/images/ch16/01-knowledge-object-relationship.png)

源码锚点：`AlembicCore/src/knowledge.ts`、`AlembicCore/src/domain/knowledge/KnowledgeEntry.ts`、`AlembicCore/src/domain/knowledge/Lifecycle.ts`、`AlembicCore/src/domain/knowledge/values/Relations.ts`、`AlembicCore/src/service/knowledge/RecipeFreshnessService.ts`。

## 本章回答

- KnowledgeEntry 如何统一 candidate、Recipe、rule、pattern、fact。
- 生命周期状态如何决定知识是否可消费。
- Candidate 和 Recipe 的边界是什么。
- Wiki 和 Project Skill 为什么不能替代 Recipe。

## KnowledgeEntry 是统一实体

Core 的 `knowledge` 入口导出 KnowledgeEntry、KnowledgeRepository、FieldSpec、RecipeReadinessChecker、UnifiedValidator、KnowledgeFileWriter、KnowledgeSyncService、RecipeProductionGateway、SourceRefReconciler 等能力。

这说明 Alembic 不把“规则”“模式”“事实”“候选”“Recipe”写成完全分裂的对象。它们共享一套字段和生命周期，只是在来源、状态、审阅程度和消费权限上不同。

常见字段包括：

- title、description、trigger、language、category、tags。
- kind、knowledgeType、scope、complexity、difficulty、authority。
- whenClause、doClause、dontClause、topicHint、coreCode。
- content、constraints、reasoning、quality、stats、relations。
- dimensionId、sourceRefs、lifecycle、createdAt、updatedAt。

这些字段让知识既能被人阅读，也能被 search、prime、Guard、Dashboard 和 Agent workflow 使用。

当前关系字段已经统一为分桶结构，而不是扁平 relation 数组。`Relations.ts` 负责把字符串数组、扁平数组或分桶输入归一化到 `inherits`、`calls`、`depends_on`、`solves` 等 bucket 中；Dashboard 需要扁平展示时再调用 flat view。这一点很重要：关系图的内部事实源是 bucket，UI 展示只是投影。

## 生命周期决定可消费性

Core 的 `Lifecycle.ts` 定义六态：pending、staging、active、evolving、decaying、deprecated。

不同状态有不同含义：

- pending：候选待审。
- staging：已进入可观察/预发布状态。
- active：正式可消费。
- evolving：正在演化中。
- decaying：证据衰退或需要复核。
- deprecated：已废弃。

Core 还定义了 candidate states、consumable states、guard lifecycles、published lifecycles、non-deprecated lifecycles 等集合。Search、Guard、Evolution、Dashboard 都应尊重这些集合。例如 Guard 可以考虑 staging、active、evolving、decaying；默认搜索和 prime 应优先消费 active/staging/evolving，而不是 deprecated。

生命周期不是 UI 标签，而是知识治理 contract。

## Candidate 是提案，不是规则

Candidate 代表一个知识提案。它可以来自 bootstrap、rescan、Agent 阅读、手动创建、Dashboard refine、Codex `alembic_submit_knowledge`。Candidate 可以很有价值，但它还没有被接受为团队规则。

Candidate 必须带证据：

- 它来自哪些文件或 source refs。
- 它解决哪个维度或知识类型。
- 它的触发条件是什么。
- 它建议做什么、不做什么。
- 它为什么不是已有知识的重复。

没有证据的 candidate 最多是灵感，不应该进入 Recipe 消费路径。

## Recipe 是被接受的知识

Recipe 是被接受、可检索、可用于约束的知识。它可以存为 Markdown，也会同步到数据库和索引。`Alembic/recipes` 是长期知识入口，`.asd/alembic.db` 是运行时缓存和检索入口。

Recipe 的价值在于它能被多种场景消费：

- Search 返回给人或 Agent。
- Prime 给 Codex 当前任务提供 compact context。
- Guard 从中抽取规则和约束。
- Dashboard 展示、过滤、编辑和审阅。
- Rescan/evolution 检查它是否仍然有证据。

Recipe 不是模型输出的终点，而是后续开发中的输入。

## SourceRef 是可信度基础

Alembic 知识必须尽可能带 sourceRef。sourceRef 说明知识来自哪个文件、哪段代码、哪次 evidence、哪个维度或哪个审阅结果。没有 sourceRef，知识难以演化，也难以在代码变化后判断是否 stale。

SourceRefReconciler、RecipeSourceRefRepository、search sourceRef adapter 和 Recipe freshness gate 都围绕这点展开。sourceRef 不一定每次都决定知识是否可消费，但它是审计和修复的基础。

## Wiki 是阅读投影

Wiki 让项目知识更适合人类阅读。它可以按模块、主题或工作流组织内容，但它不应该替代 Recipe、candidate、sourceRef 或 lifecycle。Wiki 的正确角色是“阅读视图”，不是“权威事实源”。

如果 Wiki 与 Recipe 冲突，应回到 Recipe/sourceRef/代码事实检查；如果 Wiki 发现新稳定规则，应通过 candidate/Recipe 路径回写，而不是只改 Wiki 页面。

## Project Skill 是宿主投影

Project Skill 可以把项目知识交给宿主 runtime，但它也不是 Recipe 本体。Skill 源在 dataRoot，runtime projection 需要授权和 receipt。Skill 可以总结项目规则、常用路径、操作流程，但真正的长期知识仍要回到 Recipe、sourceRef 和受控演化路径。

## 本章小结

Alembic 知识层的关键不是“存在哪里”，而是“处于什么生命周期、由什么证据支撑、能否被消费”。Candidate 是提案，Recipe 是被接受知识，Wiki 是阅读投影，Project Skill 是宿主投影，KnowledgeEntry 和 lifecycle contract 把它们统一起来。

下一章会继续讲这些知识如何演化、衰退、合并、治理和产生信号。
