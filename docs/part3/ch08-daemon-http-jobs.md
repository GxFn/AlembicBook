# Ch08 Daemon、HTTP API 与 Job 事件

Alembic resident service 的外观是一个本地 Dashboard URL，内部则是一组 HTTP routes、daemon 状态、JobStore、process events、artifact reader、file-change dispatcher 和 runtime source-of-truth。它们共同解决一个问题：本地知识系统必须可观察、可恢复、可被多个入口安全消费。

本章关注主 `Alembic` 仓库的服务面。这里不是前端 UI，也不是 Codex MCP，而是它们背后的本地 API。

![daemon API jobs 运行结构图](/images/ch08/01-daemon-api-jobs-runtime.png)

## 本章回答

- daemon 如何把一次性 CLI 变成持续服务。
- `/api/v1` routes 覆盖哪些产品面。
- JobStore、process events 和 display snapshot 为什么重要。
- file-change endpoint 如何把代码变化接回知识演化。

## Daemon 是本地 resident boundary

daemon 的职责是守住当前项目的 resident boundary。它知道项目 dataRoot、runtimeDir、databasePath、API base URL、Dashboard URL、file monitor 状态、jobs capability、api-ai 配置、runtime source of truth。

这些状态会出现在 `alembic status`、Codex `alembic_codex_status`、Dashboard handoff 和 ProjectRuntimeControl snapshot 中。它们是诊断证据，但也有明确限制：selected/active runtime state 是诊断和控制数据，不能随意覆盖当前 host project 的 identity。

## HTTP routes 是 Dashboard 和工具的共同后端

主仓库 `lib/http/routes` 下有大量 routes：`ai`、`auth`、`candidates`、`decision-register`、`evolution`、`file-changes`、`guard`、`guardRules`、`health`、`intent-episodes`、`jobs`、`knowledge`、`logs`、`monitoring`、`panorama`、`project-scope`、`projects`、`recipes`、`search`、`signals`、`skills`、`task`、`wiki` 等。

这说明 Dashboard 不是直接读文件，也不是自己决定知识生命周期。它通过 API client 调 `/api/v1`。Codex Plugin 的 status/dashboard/job 能力也会读取这些 resident capability。CLI 的一部分命令同样可以走本地服务或共享底层 service。

API route 的价值是把“本地知识层”变成可交互系统，而不是把所有东西藏在命令行输出里。

## Jobs 让长任务可恢复

Bootstrap 和 rescan 不是毫秒级操作。主仓库用 JobStore、DaemonJobRunner、process event recorder 和 display snapshot store 管理它们。`/api/v1/jobs` 能列出 job，按 kind/status 过滤，读取单个 job，读取 process events，读取 display snapshot，读取 artifact。

Job API 的响应不只是 status。它会装饰 progress、summary、displaySnapshot、active task、percent、tool call count、session id 等信息。Dashboard 的 JobsView 和 BootstrapProgressView 依赖这些投影；Codex status 也能看到 jobs capability。

这让长任务具备三个性质：

- 可恢复：CLI 结束后 job 记录仍在。
- 可观察：process events 和 snapshots 能说明任务阶段。
- 可审阅：artifact 可以被读取，而不是只剩一行成功/失败。

## Process events 是运行证据

Job process events 支持 workflow、LLM input/reflection/output、tool、artifact、checkpoint、error、summary 等类型，并带有 display policy、retention policy、source class。这个设计让 Alembic 能区分开发者可见信息、机器内部信息、raw provider 信息、secret 或 hidden reasoning。

对书稿读者来说，重点是：Alembic 的运行证据不是日志碎片，而是有类型、有保留策略、有 artifact ref 的事件流。未来验收某个 bootstrap/rescan 结果时，应读这些 raw evidence，而不是只看 Dashboard 上的一句 summary。

## File changes 触发演化入口

`/api/v1/file-changes` 接收 created、renamed、deleted、modified 等事件，来源可以是 daemon file monitor、host-edit、git-head、git-worktree 等。route 会校验输入、过滤非法事件，然后交给 `FileChangeDispatcher`。

响应体是 `ReactiveEvolutionReport`：fixed、deprecated、skipped、needsReview、suggestReview、details 等。也就是说文件变化不直接等于“自动修改 Recipe”。它先进入调度和报告，告诉系统哪些知识可能需要复核。

当前本地 daemon 也可能降级到 git-worktree fallback。降级不是失败，只要 status 能说明 activeEventSource、degradedReason 和 fallback reason，系统仍然可诊断。

## ProjectScope API 让多仓库项目可见

`project-scope` routes 负责读取 scope、添加 folder、列出 folder、解析 folder。它让 resident service 明确当前 project scope 覆盖哪些源码仓库，以及当前 folder 是哪个。Codex status 中展示的 Alembic/AlembicCore/AlembicPlugin/AlembicDashboard/AlembicAgent folder 列表就来自这条能力。

ProjectScope API 是本地运行时对多仓库项目的投影。它不是 Git submodule 管理，也不是 workspace 总控文档；它只是告诉 Alembic 当前知识层覆盖哪些代码事实。

## API 不应替代 Core contract

HTTP routes 是外层服务边界，Core contract 仍是确定性语义来源。例如 search route 调用 SearchEngine，Guard route 调用 GuardCheckEngine，knowledge route 使用 KnowledgeService，jobs route 使用 Core daemon JobStore shape。

如果一个改动只是调整 API response 或 Dashboard 需要的投影，主仓库是合理落点。如果一个改动改变 KnowledgeEntry 生命周期、search ranking、Guard engine 或 workspace path 语义，就应该回到 Core。

## 本章小结

主 Alembic daemon 把本地知识系统变成持续服务。HTTP routes 给 Dashboard、CLI 和 Plugin 提供统一后端；JobStore 和 process events 让长任务可恢复、可观察、可审阅；file-change endpoint 把代码变化接入演化报告；ProjectScope API 让多仓库项目保持可见。

下一章会聚焦两个最重要的长任务：cold start 和 rescan。
