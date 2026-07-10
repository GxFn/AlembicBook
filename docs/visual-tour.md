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

展示 Codex/Claude Code MCP host 的请求路由、三类执行 owner、显式 resident 策略，以及主 daemon 与 Plugin 内嵌 daemon 的边界。

![19 个 MCP 工具职责分组](/images/ch10/02-mcp-tool-groups.png)

把 Catalog 中的 19 个工具按本地控制、知识与结构、长流程、公开工作流和管理能力分组；最终可见集合仍受 tier、knowledge gate 与 admin 过滤。

## AgentRuntime 与评测

![AgentRuntime 与 Dashboard](/images/ch13/01-agentruntime-execution-loop.png)

展示 AgentRuntime build chain、ReAct loop、provider 出口、tool router 与七类工具。

![在线质量门与离线评测](/images/ch13/02-online-offline-evaluation.png)

分开表达每次运行的确定性质量门与手工离线评测，避免把 judge、promotion 或 critic 误写成默认在线路径。

## SourceRef 新鲜度与生命周期

![SourceRef 新鲜度闭环](/images/ch17/01-knowledge-evolution-governance.png)

展示漂移检测、消费时降权、Rescan/Evolution 与人工生命周期治理。

![Knowledge 六态生命周期](/images/ch17/02-lifecycle-state-machine.png)

展示 LifecycleStateMachine 允许的六态转换；UI、扫描和评测只能提出信号，不能绕过状态机写状态。

## Release and evidence lanes

![Release and evidence lanes](/images/ch19/01-multi-repo-release-validation-matrix.png)

展示多仓库 build、test、package、publish/deploy evidence。

## 当前实现快照

![当前实现防漂移快照](/images/appendix/05-implementation-snapshot.png)

汇总本轮源码核验得到的关键规模事实、三条语义边界，以及 Book 的 fact assertion 更新闭环。
