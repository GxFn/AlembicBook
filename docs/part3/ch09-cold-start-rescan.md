# Ch09 Cold Start、Rescan 与 ProjectContext

Cold start 和 rescan 是 Alembic 知识层从空白走向可用、再从可用走向持续新鲜的两条主工作流。它们不是“跑 AI 生成文档”的两个命令，而是围绕 ProjectContext、维度任务、已有 Recipe、candidate、sourceRef、Guard audit、Agent execution 和 Job evidence 组织起来的长任务。

本章从主 Alembic daemon 路径讲起，同时点明 Codex host-agent 路径在哪里分叉。两条路径最终共享同一目标：生成可审阅、可追溯、可消费的项目知识。

![cold start rescan 工作流图](/images/ch09/01-cold-start-rescan-workflow.png)

源码锚点：`Alembic/lib/workflows/cold-start/ColdStartWorkflow.ts`、`Alembic/lib/workflows/knowledge-rescan/KnowledgeRescanWorkflow.ts`、`AlembicPlugin/lib/recipe-generation/host-agent-workflows/cold-start.ts`。

## 本章回答

- Cold start 与 rescan 的输入和输出有什么不同。
- ProjectContext 和 analysis packet 在两条工作流里承担什么。
- 为什么 long-running workflow 必须有 job、events、checkpoint 和 artifact。
- 为什么冷启动完成不等于所有候选都成为 Recipe。

## Cold start 面向空白知识层

Cold start 的目标是给一个项目建立第一批可审阅知识。主 CLI 中有 `coldstart`，Dashboard 也可以启动 bootstrap job；Codex 插件路径里则有 `alembic_bootstrap` 返回 Mission Briefing，让宿主 Agent 执行维度分析。

无论入口怎样，工作流都需要先回答：

- 当前项目有哪些语言、目录、模块和配置。
- 哪些文件可以进入分析预算。
- 哪些维度需要覆盖。
- 是否已有 snapshot 或 checkpoint。
- Guard audit 是否可用。
- 候选知识需要哪些字段和 source refs。

这一步的正确结果不是“直接写满 Recipes”，而是建立分析任务、提交候选知识、记录证据，并让审阅流程决定哪些候选可以成为 Recipe。

## Rescan 面向已有知识层

Rescan 与 cold start 最大区别是它必须尊重已有 Recipe。代码里 `RescanContext` 会读取 existingRecipes、decayingRecipes、coverageByDim、executionDecisions、occupiedTriggers 等信息。它不是把项目重扫一遍然后覆盖旧知识，而是先判断旧知识是否仍有证据、哪些维度需要补齐、哪些 Recipe 应该 watch 或 decay。

Rescan 的典型目标包括：

- 发现新增模块或调用链。
- 检查已有 Recipe 的 sourceRef 是否仍有效。
- 识别 stale、decaying 或证据断裂的知识。
- 补充维度空白。
- 让 Agent 对变化部分做 gap-fill，而不是重写一切。

这解释了为什么 rescan 必须携带 reason、dimension filter、maxFiles、contentMaxLines 等参数。它是增量治理动作，不是简单全量扫描按钮。

## ProjectContext 提供分析包

Cold start 和 rescan 都依赖 ProjectContext 和分析包。它会构建 space/repo/map/module/file refs、AST/grammar 分析、dependency hints、IDE agent analysis packet、unit progress seed 和 retrieval hints。Plugin 的 bootstrap 工具描述中也明确提到 Mission Briefing 会包含 ideAgentAnalysis packet summary、next units、retrieval hints 和 unit progress seed。

这些数据让 Agent 不必盲读全仓。Agent 可以按 stable unit、dimension、evidence kind 和 sourceRef 组织分析。对于大项目，这一点尤其关键，因为上下文预算永远有限。

## 维度不是目录分类

Alembic 的维度覆盖 architecture、coding standards、design patterns、error resilience、concurrency、data/event flow、networking、UI、testing、security、performance、observability、agent guidelines，以及语言/框架层面的细分维度。Dashboard 也把这些维度映射成不同展示分组。

维度不是文件夹标签，而是知识覆盖面。一个文件可能参与多个维度；一个 Recipe 也可以通过 dimensionId 表达它主要服务哪类判断。Cold start 和 rescan 的 completion 也围绕维度推进，避免只扫到容易扫的部分。

## Agent execution 是工作流的一部分，不是全部

主 Alembic 的 provider-backed job 会使用 `@alembic/agent` 执行分析、生产候选、记录过程事件。Agent runtime 负责 AI provider、tool calls、context window、policy、strategy 和错误恢复。

但 Agent 不是 workflow 的全部。workflow 还包括 project snapshot、existing recipe audit、dedup、candidate persistence、dimension completion、JobStore、events、artifacts 和 Dashboard projection。把 AI 回答当成最终结果，会丢掉 Alembic 的审阅和治理层。

## 成功、失败和降级都要可恢复

Cold start/rescan 可能失败：provider 不可用、预算耗尽、某个维度中断、grammar 缺失、数据库暂时不可用、file monitor 降级、candidate 写入失败。Job/event 设计的价值就在这里。用户可以读取 job status、events、display snapshot、artifact，再决定重试、局部 rescan 或人工修复。

Codex 插件路径还区分 host-agent bootstrap/rescan 和 explicit daemon jobs。前者不要求 Alembic resident service 配置第三方 AI provider；后者进入本地 daemon job，并依赖 provider 配置。

## 输出必须进入审阅链路

Cold start/rescan 产出的知识通常先进入 candidates。候选需要字段完整、sourceRef 可信、重复度可控、维度明确、触发条件和 do/don't 约束清楚。只有被接受的知识才成为 Recipe，并参与后续 search、prime、Guard 和 decision。

这条规则保护团队：扫描结果可以很多，但真正约束开发者和 Agent 的知识必须可审阅。

## 本章小结

Cold start 建立第一批项目知识，rescan 维护已有知识的新鲜度。两者都依赖 ProjectContext、维度任务、Agent execution、candidate persistence、Job evidence 和审阅流程。

理解这两条工作流之后，就可以进入 Codex Plugin 部分：当宿主从 CLI/Dashboard 变成 Codex 时，Alembic 如何把这些能力包装成 MCP tools、public workflow tools 和 Project Skills。
