# 架构速览与插图索引

这一页汇总新版插图。所有图片都来自当前书稿的 prompt 管理清单，不再引用旧版章节图。

## 全局系统图

![全局系统图](/images/ch01/01-multi-repo-system-context.png)

串起用户项目、本地运行时、Core、Plugin、Agent 与 Dashboard。

## 用户旅程与仓库边界

![用户旅程与仓库边界](/images/ch02/01-user-project-to-local-knowledge.png)

展示 projectRoot、ProjectScope、dataRoot、Candidate 和 Recipe 的路径。

## Core contract spine

![Core contract spine](/images/ch04/01-core-public-entrypoints.png)

展示 @alembic/core public entrypoints 与消费者边界。

## ProjectScope 与存储

![ProjectScope 与存储](/images/ch05/01-projectroot-dataroot-model.png)

展示 projectRoot 和 Ghost dataRoot 的双根模型。

## CLI / daemon / API / JobStore

![CLI / daemon / API / JobStore](/images/ch08/01-daemon-api-jobs-runtime.png)

展示 resident daemon、HTTP routes、JobStore 和 Dashboard events。

## Codex MCP surface

![Codex MCP surface](/images/ch10/01-codex-plugin-tool-surface.png)

展示 Codex MCP host、public workflow tools 与 Core services。

## AgentRuntime 与 Dashboard

![AgentRuntime 与 Dashboard](/images/ch13/01-agentruntime-execution-loop.png)

展示 AgentRuntime tool loop、provider、memory/context 与 evidence。

## Candidate → Recipe → Guard

![Candidate → Recipe → Guard](/images/ch17/01-knowledge-evolution-governance.png)

展示知识演化、source evidence、review 和 downstream consumers。

## Release and evidence lanes

![Release and evidence lanes](/images/ch19/01-multi-repo-release-validation-matrix.png)

展示多仓库 build、test、package、publish/deploy evidence。
