# Ch01 当前系统地图

今天的 Alembic 已经不是一个可以用“单仓库、单进程、单层 DDD”解释清楚的项目。它是一组围绕本地项目知识层协作的运行时：主 CLI 和 daemon 负责 resident service，Core 提供确定性内核，Plugin 把能力交给 Codex/Claude Code 这类宿主，Agent runtime 承担 AI/tool 执行循环，Dashboard 提供审阅界面，Workspace/Wakeflow 只负责多仓库协作和验收。

这本书的新结构从这里开始。先画清地图，后面每一章才知道自己在讲哪一层、哪一个入口、哪一种事实源。

![Alembic 多仓库系统上下文图](/images/ch01/01-multi-repo-system-context.png)

## 本章回答

- Alembic 现在由哪些仓库和运行时组成。
- 为什么旧书不能继续用“一个知识有机体”的叙事覆盖所有实现。
- 哪些能力属于确定性 Core，哪些能力属于宿主适配、AI runtime、resident service 或 UI。
- 当一个功能出问题时，读者应先在哪个边界内定位。

## 一句话系统图

Alembic 的核心产品闭环是：从用户项目读取代码事实，在本地 dataRoot 中生成可审阅知识，经过候选、Recipe、索引、检索、Guard 和决策记录，让宿主 Agent 在后续开发中使用这些知识，并把新的证据继续写回。

这句话里至少包含六层：

- 用户项目：真实源码、测试、配置、调用链和团队决策的来源。
- Workspace resolver：把真实源码位置 `projectRoot` 与 Alembic 写入边界 `dataRoot` 分开。
- 本地知识层：`Alembic/recipes`、`Alembic/candidates`、`Alembic/skills`、`Alembic/wiki`、`.asd/alembic.db`、向量索引和日志。
- resident service：daemon、HTTP API、JobStore、Dashboard handoff、file monitor、search、jobs 和项目运行控制。
- 宿主工具层：Codex MCP tools、skills、clean structured output、tool visibility 和 host-agent workflow。
- 人类审阅层：Dashboard、Recipe/candidate review、Guard 报告、Jobs、Project Pyramid、Skills 和 Help。

如果把这六层压成一句“AI 自动理解项目”，就会丢掉 Alembic 最重要的性质：本地、可审查、可恢复、可治理。

## 五个产品仓库

### Alembic

`Alembic` 是主运行时仓库，发布 npm 包 `alembic-ai`。它拥有 CLI、daemon、HTTP/API、Dashboard server、ProjectRuntimeControl、ProjectScope、JobStore、file monitor、AI provider 配置、bootstrap/rescan job、search、Guard、Wiki、Panorama、release/install/dev-link 等用户可直接接触的能力。

在用户机器上，`alembic setup` 和 `alembic start` 主要来自这个仓库。它的职责不是重新实现 Core 的每个领域对象，而是把 Core、Agent、数据库、API、Dashboard server 和本地项目 runtime 接起来。

### AlembicCore

`AlembicCore` 发布 `@alembic/core`。它是 Alembic family 的 headless deterministic core，承担 workspace、database、repository、domain、search、vector、Guard、AST、project intelligence、host-agent workflow contract、daemon contracts 等共享能力。当前 `package.json` 暴露 66 个 exports，说明它不是一个随意被 deep import 的源码目录，而是被多个外层仓库消费的包边界。

Core 的关键约束是“被消费，不反向依赖外层”。它不应该 import 主 `Alembic` app，不应该依赖 Codex 插件，也不应该携带 Dashboard UI。外层仓库通过包入口消费它，发布时也必须回到 registry/package 边界。

### AlembicAgent

`AlembicAgent` 发布 `@alembic/agent`。它拥有 AgentRuntime、AI provider adapter、tool system、terminal/code/knowledge/graph/memory/meta/evidence tools、memory/context、prompt、strategy、policy、run tracking 和错误恢复等非确定性执行能力。

Agent 与 Core 的关系很直接：Core 提供确定性项目知识和 workflow contract，Agent 负责把 AI、工具调用、上下文压缩、策略和执行循环组织起来。主 `Alembic` 可以使用 Agent 来跑 provider-backed jobs；Codex 插件也要明确区分“宿主 Codex Agent”和 Alembic 自己的 Agent runtime。

### AlembicPlugin

`AlembicPlugin` 是 host plugin 和 MCP runtime 仓库，包名是私有的 `alembic-codex-plugin-runtime`。它负责 MCP tool schema、HostMcpServer、tool policy、agent-facing public tools、status/init/job/runtime、skills、channel/marketplace、portable runtime artifact 和 plugin cache 刷新。

Plugin 的定位不是“另一个 Alembic daemon”。它把 host project、Alembic dataRoot、resident/project-scope capability、Core workflow contract 和 MCP 可见工具接起来。当前 status 路径默认是 daemon-less PDR-3 host route；长期 daemon 和 Dashboard server 的产品源仍在主 Alembic。当前 MCP catalog 位于 `AlembicPlugin/lib/host-runtime/mcp/PluginToolSurfaceCatalog.ts`，不再沿用早期 runtime-era MCP 目录。

### AlembicDashboard

`AlembicDashboard` 是 private React/Vite 前端。它有 Recipes、SPM/Module Explorer、Candidates、Knowledge、Guard、Project Pyramid、Skills、Jobs、Help 等视图，并通过 `/api/v1` 访问后端。

Dashboard 不拥有数据库、AST、Agent 决策或 MCP tool execution。它的价值是把本地知识层变成可审阅、可操作、可观察的体验。

## 总控工作区不是产品仓库

`AlembicWorkspace` 是多仓库协作的 controller workspace。它记录计划、分发、验收、边界和长期协作账本，但不实现 Alembic 产品能力。Book 位于这个 workspace 里的 sibling repo，只是文档产品本身；它不应该被误解为主运行时的一部分。

这个边界对读者很重要。看到某个 Wakeflow 文档、dispatch packet 或验收记录时，不要把它当成产品代码；看到某个产品仓库里的实现时，也不要用总控便利去替代它自己的测试和发布边界。

## 当前源码读数

本书每次更新都应重新核对一组低成本源码事实。本轮阅读得到的当前读数是：

- Core package exports：66 个子路径，覆盖 `workspace`、`knowledge`、`search`、`guard`、`project-context`、`host-agent-workflows`、`daemon`、`database`、`repositories`、`workflows/*` 等边界。
- 主 Alembic HTTP route families：`lib/http/routes` 下 24 个 route 文件；生成的 Dashboard API contract table 声明 28 个 routes、contract version 1。
- Plugin MCP catalog：19 个 entries，其中 18 个 agent tier、1 个 admin-only，3 个 agent-facing public workflow tools。
- Agent runtime registry：7 类工具、21 个 actions，包括新增的 `evidence.get` 和 `evidence.search`。
- Dashboard tabs：`recipes`、`spm`、`candidates`、`knowledge`、`guard`、`project-pyramid`、`skills`、`jobs`、`help`。

这些数字不是为了炫耀规模，而是给读者一个防漂移的基线：如果未来某章仍然写 6 个 Agent tools、旧 Plugin runtime 路径或旧 Dashboard API god file，就应该回到源码重查。

## 三条主链路

第一条是 CLI/resident 链路：用户运行 `alembic setup --ghost`，Core 的 project registry 和 workspace resolver 确定 dataRoot，主 Alembic 初始化 `.asd/` 与 `Alembic/`，随后 `alembic start` 启动 daemon/API/Dashboard。

第二条是 host plugin 链路：插件先做 `alembic_status`/`alembic_init`，再按项目知识状态暴露或调用 `alembic_recipe_map`、`alembic_graph`、`alembic_search`、`alembic_bootstrap`、`alembic_prime`、`alembic_work`、`alembic_code_guard` 等 MCP 工具，把本地知识以 structuredContent 交给宿主 Agent。

第三条是审阅和演化链路：bootstrap/rescan 产生候选知识，Dashboard 或工具流审阅它们，接受后的 Recipe 被同步到数据库与索引，后续 search/prime/Guard/decision 又把知识消费和新增证据带回系统。

![Alembic 三条主链路图](/images/ch01/02-three-primary-flows.png)

## 边界判断表

| 问题 | 首先看哪里 | 不应该先看哪里 |
| --- | --- | --- |
| `setup --ghost` 写到哪里 | `Alembic/lib/cli/SetupService.ts` 与 `@alembic/core/workspace` | Dashboard |
| 项目身份或 dataRoot 错乱 | `ProjectRegistry`、`WorkspaceResolver`、Codex status | Recipe 内容 |
| daemon、Dashboard URL、jobs | `Alembic/lib/daemon`、`Alembic/lib/http` | AlembicAgent prompt |
| Codex 工具不可见或输出不对 | `AlembicPlugin/lib/host-runtime/mcp`、tool policy、status | 主 CLI 命令表 |
| AI job 执行循环 | `AlembicAgent/src/agent` 与主 Alembic job workflow | Core domain object |
| 前端页面或交互 | `AlembicDashboard/src` | 后端 repository |
| Recipe/Guard/search 的确定性 contract | `AlembicCore/src` | Plugin cache snapshot |

这个表不是为了限制阅读，而是为了避免第一步就走错方向。Alembic 的复杂性不是坏事，前提是每个复杂点都有明确归属。

## 本章小结

新版 AlembicBook 必须从多仓库系统地图写起。`Alembic` 是主 resident runtime，`AlembicCore` 是确定性共享内核，`AlembicAgent` 是 AI/tool 执行 runtime，`AlembicPlugin` 是 host adapter，`AlembicDashboard` 是前端审阅体验，`AlembicWorkspace` 是协作控制面。

后续章节会沿着这张地图展开：先讲用户旅程，再讲仓库边界；之后进入 Core contract、项目模型、analysis/search/Guard、daemon/API/jobs、Codex plugin、Agent runtime、Dashboard、知识生命周期、发布验证和维护。
