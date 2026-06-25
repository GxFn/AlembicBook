# Ch03 仓库边界与依赖方向

Alembic 的仓库边界不是目录整理问题，而是产品正确性的基础。一个能力应该落在哪个仓库，取决于它拥有的事实源、运行时、发布形态和消费方，而不是取决于哪里改起来最近。

本章给出阅读和改动 Alembic 时最重要的判断规则：Core 向上被消费；主 Alembic 负责 resident runtime；Agent 负责 AI/tool 执行；Plugin 负责 Codex host adaptation；Dashboard 负责前端体验；Workspace 负责协作控制。任何反向依赖、重复实现、临时 vendor 修改或发布边界混用，都会让系统变得难以验证。

源码锚点：`AlembicCore/package.json`、`Alembic/package.json`、`AlembicPlugin/package.json`、`AlembicAgent/package.json`、`AlembicDashboard/package.json`。

![仓库依赖方向与发布边界图](/images/ch03/01-repository-dependency-boundaries.png)

## 本章回答

- 各仓库的职责边界如何判断。
- 为什么 `file:../AlembicCore` 是本地开发便利，不是发布形态。
- 为什么不能为了“干净”把外层仓库削成空壳，或把 Core 做成万能仓库。
- vendor、portable runtime、plugin cache 和 registry package 各自代表什么。
- 一个需求应如何选择改动落点和验证命令。

## 依赖方向先于代码位置

Core README 已经给出最重要的方向：

```text
AlembicCore
  ^
  |- AlembicAgent
  |- Alembic
  |- AlembicPlugin portable runtime snapshot
```

这个箭头的意思不是“Core 包含一切”，而是“共享确定性能力从 Core 出口向外提供”。外层仓库可以消费 Core 的 public package entrypoints；Core 不反过来依赖主 app、Codex plugin 或 Dashboard。

因此，判断一个改动在哪里落地时，先问三个问题：

1. 这个能力的长期事实源在哪里。
2. 谁在运行它。
3. 谁在发布它。

如果答案分别是“workspace/dataRoot contract、多个 runtime 都要用、需要包入口稳定”，那大概率属于 Core。如果答案是“daemon/API/Dashboard server、用户 CLI、jobs、local resident service”，那属于主 Alembic。如果答案是“Codex MCP 工具、skills、plugin cache、marketplace artifact”，那属于 Plugin。如果答案是“AI provider、tool execution、context compression、Agent loop”，那属于 Agent。如果答案是“React 页面、API client、交互状态、可视化”，那属于 Dashboard。

## 本地开发依赖不等于发布依赖

在这个 workspace 里，主 `Alembic`、`AlembicAgent` 和 `AlembicPlugin` 都可以通过 `file:../AlembicCore` 使用本地 Core 源码。这让跨仓库开发更快：修改 Core 后，外层仓库能直接验证。

但发布边界必须收回来。Core 是 `@alembic/core` 包；Agent 发布预览会把本地 `file:../AlembicCore` 转成 registry 版本，并记录 Core source commit；Plugin root package 是 private，Codex 插件发布的是 channel/marketplace/portable runtime artifact，embedded runtime 里的 Core 是 `file:vendor/AlembicCore` 快照并带 source metadata；主 Alembic 也有 release package boundary guard 和 Core import boundary check。

所以不要把 `file:../` 当成产品 contract。它是 workspace 开发线索，不是用户安装后的依赖事实。

## Core 的边界

Core 应该承载这些能力：

- workspace 与 project registry contract。
- database/repository/migration/persistence contract。
- knowledge、candidate、Recipe、dimension、sourceRef、decision/search/guard 相关确定性模型。
- AST、grammar、project intelligence、panorama、snapshot 和结构分析 contract。
- vector/search/guard 的可复用服务与接口。
- host-agent workflow contract，让 Plugin 和 resident runtime 可以用同一套任务语义。
- daemon/job/runtime control 的共享 shape。

Core 不应该拥有这些能力：

- CLI 命令体验。
- 长期 daemon 进程和 Dashboard server。
- Codex plugin manifest、MCP stdio wrapper、marketplace/channel。
- React UI 页面。
- provider-backed Agent execution loop 的策略细节。

Core 的“瘦”不是空。它必须足够强，才能让多个 runtime 不复制领域逻辑；同时它必须足够克制，不能把外层运行时的职责吸进去。

## 主 Alembic 的边界

主 `Alembic` 发布 `alembic-ai`，是用户安装后最直接接触的产品 runtime。它应该拥有：

- `alembic setup/start/coldstart/rescan/search/guard/status/health` 等 CLI。
- daemon、HTTP API、Dashboard server 和 project runtime control。
- Dashboard 后端路由、JobStore、file monitor、project-scope endpoint、AI provider 配置。
- 本地 resident service 的生命周期、日志、health、runtime state。
- 与 `@alembic/core`、`@alembic/agent` 的组合装配。

它不应该把 Codex marketplace 和 plugin shell 做成自己的发布职责，也不应该把 Core 的 deterministic domain 复制一份。主 Alembic 是产品 resident runtime，不是所有仓库的父类。

## Agent 的边界

`@alembic/agent` 负责非确定性 AI/tool runtime。它的价值在于把 provider、prompt、strategy、policy、tool registry、context window、memory、terminal/code tools、error recovery 和 run tracking 组织成可复用执行引擎。

Agent 可以消费 Core 提供的项目知识、workflow contract 和结构能力，但它不应该拥有 Codex 插件的 tool schema，也不应该写 Dashboard UI。反过来，Core 不应该直接知道某个 provider 的执行策略。

这个边界保护了两件事：AI 行为可以独立迭代，确定性知识 contract 也可以独立验证。

## Plugin 的边界

AlembicPlugin 的关键词是 host adaptation。它拥有 Codex 可见的 MCP tool surface、tool visibility、tier policy、clean output、status/diagnostics/init、Project Skill delivery、Codex local jobs、channel/marketplace 和 portable runtime packaging。

Plugin 可以读取 resident service 状态，可以调用 host-agent workflow，可以把 Dashboard URL 返回给 Codex；但它不应该成为主 daemon 的第二实现，也不应该打包 Dashboard 前端源码作为长期事实源。它的 release guard 已经明确：root package private，root registry publish disabled，Codex plugin 通过 artifact/channel 路径发布。

因此，修改 Plugin 时要问：这个变化是不是 Codex host 可见边界？如果只是后端 API 行为、数据库模型、搜索算法或 Dashboard 页面，大概率不该首先改 Plugin。

## Dashboard 的边界

Dashboard 是 `AlembicDashboard` 的前端仓库。它拥有视图、组件、hooks、i18n、API client、前端状态、用户交互和构建。它展示 Recipes、Candidates、Guard、Panorama、Jobs、Wiki、Skills、Bootstrap progress 等对象，但这些对象的持久化和业务 contract 在后端与 Core。

Dashboard 可以帮助用户审阅和操作知识层，不能被写成权威事实源。一个 UI 修复不应该顺手改 repository contract；一个后端 contract 变更也必须同步前端 API client 和 contract tests。

## Vendor 和 snapshot 只服务发布，不服务日常开发

Alembic 里有几种看起来相似但含义不同的“复制”：

- local sibling source：workspace 中的 `../AlembicCore`，用于开发和验证。
- registry package：发布后的 `@alembic/core`，用于外部消费。
- vendor snapshot：portable runtime 中的 Core 快照，用于离线/插件 artifact。
- plugin cache：Codex 已安装插件的本地缓存，用于运行当前插件版本。

日常代码修改应该回到 source repo。不要直接把 vendor snapshot 当源码改，也不要把 plugin cache 当源仓库改。只有发布、离线安装、portable runtime 或 explicit release repair 才应该触碰 snapshot/cache，并且必须能追溯到 source commit。

## 改动落点速查

| 需求 | 首选仓库 | 验证重点 |
| --- | --- | --- |
| Ghost dataRoot 解析错误 | AlembicCore | workspace resolver、registry tests、consumer import check |
| CLI setup/start 行为 | Alembic | CLI test、daemon/runtime smoke、Dashboard handoff |
| 搜索、Guard、Recipe 模型 | AlembicCore | unit tests、public API、consumer import boundary |
| provider-backed job 执行 | Alembic + AlembicAgent | Agent runtime tests、job API、process events |
| Host plugin tool schema/output | AlembicPlugin | MCP probe、tool visibility、clean output contract |
| Project Skill delivery | AlembicPlugin | plugin route receipt、export authorization、cache refresh |
| Dashboard 页面/交互 | AlembicDashboard | lint、contract test、typecheck、build |
| release/package 边界 | 对应发布仓库 | package guard、staging dry run、source metadata |

表格不是绝对答案，但它能阻止最常见的错误：在看得见的外层临时补逻辑，却没有修真正的事实源。

## 三个反模式

第一，把 Core 当成万能仓库。这样会让 Core 依赖外部 host、UI 或 provider 细节，最终失去可复用和可发布性。

第二，把 Plugin 当成主 runtime。这样会让 host 插件复制 daemon/API/Dashboard 的职责，造成 status、jobs、project identity 和 Dashboard handoff 分裂。

第三，把发布 artifact 当源码。这样会让 vendor、runtime.tgz、plugin cache 和 registry package 失去可追溯关系，后续验证无法判断哪个 commit 才是真实来源。

## 本章小结

Alembic 的多仓库结构不是偶然复杂，而是为了把不同性质的事实分开：Core 是确定性共享内核，Alembic 是 resident runtime，Agent 是 AI/tool runtime，Plugin 是 host adapter，Dashboard 是审阅 UI，Workspace 是协作控制面。

以后读任何章节、定位任何 bug、设计任何功能，都先问：事实源在哪里，运行时在哪里，发布边界在哪里。三者一致，改动才容易验证；三者混乱，代码即使暂时能跑，也会在发布、插件缓存、Dashboard 或 Agent workflow 中重新断开。
