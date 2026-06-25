# Ch07 Alembic 主运行时

主 `Alembic` 仓库发布 `alembic-ai`，是用户安装后最直接接触的本地运行时。它把 Core contract、Agent runtime、数据库、daemon、HTTP API、Dashboard server、CLI 命令、JobStore、file monitor 和项目运行控制装配成一个 resident service。

这一章从 `alembic setup` 和 `alembic start` 讲起。读者要看到的是：主运行时不只是命令集合，而是一个围绕项目身份持续在线的本地服务。

![主 Alembic runtime 启动链路图](/images/ch07/01-local-runtime-startup-chain.png)

## 本章回答

- 主 Alembic 仓库相对 Core、Agent、Plugin 和 Dashboard 拥有哪些职责。
- `setup` 与 `start` 在运行时层分别完成什么。
- ProjectRuntimeControl 为什么是多项目/多 runtime 的中心。
- 主运行时如何把 Core 和 Agent 接进用户体验。

## CLI 是用户入口，也是边界声明

`Alembic/bin/cli.ts` 暴露的命令覆盖用户旅程的大部分动作：`setup`、`start`、`ai status/configure/import-env`、`daemon start/status/stop`、`projects` 系列、`project-scope`、`coldstart`、`rescan`、`evolve-check`、`search`、`guard`、`panorama`、`status`、`health` 等。

这些命令不是全部业务逻辑。CLI 的责任是解析用户意图、创建服务对象、调用 runtime/control/workflow，并把结果以人可读或 JSON 的方式输出。真实事实源仍在 Core contract、主 runtime service 和数据库里。

`setup` 会进入 `SetupService`。`start` 默认进入 `ProjectRuntimeControl.openDashboard()`，开发模式才直接启动 API/dev server。这个分叉非常重要：普通用户路径是项目 runtime control，开发者路径才是直接 server 模式。

## SetupService 建立本地工作空间

`SetupService` 的注释把初始化拆成五步：

1. 创建 `.asd/` 运行时目录和 `config.json`。
2. 初始化 `Alembic/` 知识库目录和 `recipes/`。
3. 初始化 SQLite 数据库并处理迁移。
4. 执行平台相关初始化。
5. 初始化向量索引。

构造 `SetupService` 时，会先读取 `ProjectRegistry` 判断已有模式；显式 `--ghost` 会设置 Ghost workspace。随后 `WorkspaceResolver.fromProject()` 统一计算 runtimeDir、databasePath、knowledgeDir、recipesDir、candidatesDir 和 skillsDir。

这让主运行时不用在每个命令里重新猜路径。CLI 只是入口，路径事实来自 Core workspace contract。

## ProjectRuntimeControl 管理项目选择和 handoff

`ProjectRuntimeControl` 是主运行时的中心类之一。它维护 runtime-control state，能列出项目、选择项目、清除选择、启动项目、切换项目、打开 Dashboard，并把结果组织成 action result。

一个 action result 会包含：

- 当前 action：start、stop、open-dashboard 或 switch。
- target project 与 previous active project。
- daemon/API/Dashboard handoff。
- snapshot、diagnostics、state cleanup。
- ok/error。

这说明 `alembic start` 不只是“起一个进程”。它要判断当前 selected project、active runtime、daemon 是否 ready、是否 stale、Dashboard URL 是否可用，以及是否需要停止或切换旧 runtime。

## DaemonSupervisor 负责进程层

ProjectRuntimeControl 不直接把所有进程细节写在自己里面，而是通过 `DaemonSupervisor` 管理 daemon start/status/stop。daemon state 存在项目 runtimeDir 下，例如 `.asd/daemon.json` 和 `.asd/daemon.pid`。status 会包含 pid、pidAlive、ready、url、dashboardUrl、statePath、logPath 等。

这个进程层使 resident service 可以独立于 CLI 存活。用户执行完 `alembic start` 后，Dashboard、API、file monitor、jobs 和 search 可以继续服务后续请求。

## Bootstrap 初始化 service container

daemon/API server 启动时会进入主仓库的 bootstrap 过程。`lib/bootstrap.ts` 会初始化 WorkspaceResolver、数据库、repositories、services、vector、search、guard、file monitor、bootstrap task manager、AI runtime 相关组件，并把它们放进 ServiceContainer。

这个 container 是主 Alembic resident service 的装配层。Core 提供 contract 和服务实现，Agent 提供 AI runtime，主仓库把它们组合成 API、jobs、Dashboard 和命令可用的对象。

## 主运行时不是 Plugin，也不是 Dashboard

主 Alembic 可以服务 Dashboard，也可以被 Plugin 读取状态，但它不等于二者。

Dashboard 是前端源码仓库，主 Alembic 负责 server/API 和静态/URL handoff。

Plugin 是 Codex/Claude Code host adapter，主 Alembic 负责本地 daemon、resident service、jobs 和 runtime source of truth。

这种边界让用户可以同时用 CLI、Dashboard 和 Codex，而不让任一入口复制另一入口的核心状态。

## 本章小结

主 `Alembic` 仓库是 Alembic 的本地 resident runtime。它通过 CLI 接收用户动作，通过 SetupService 初始化工作空间，通过 ProjectRuntimeControl 管理项目 runtime，通过 daemon/API/Dashboard server 持续在线，并通过 Core 和 Agent 组合出知识、检索、Guard、job 和 AI 分析能力。

下一章会下钻到 daemon、HTTP API 与 Job 事件，看看这个 resident service 如何被 Dashboard、Plugin 和 CLI 同时消费。
