# Ch01 当前系统地图：五个仓库，四个闭环

今天的 Alembic 已经不能用“单仓库、单进程、一次 AI 扫描”解释。它是一组围绕本地项目知识层协作的运行时：主 CLI 和 daemon 负责 resident service，Core 提供确定性内核，Plugin 把能力交给 Codex/Claude Code，Agent runtime 承担 AI/tool 执行循环，Dashboard 提供人工审阅界面。

这本书的新结构从这里开始。先画清地图，后面每一章才知道自己在讲哪一层、哪一个入口、哪一种事实源。

![Alembic 多仓库系统上下文图](/images/ch01/01-multi-repo-system-context.png)

## 本章回答

- Alembic 现在由哪些仓库和运行时组成。
- 为什么旧书不能继续用“一个知识有机体”的叙事覆盖所有实现。
- 哪些能力属于确定性 Core，哪些能力属于宿主适配、AI runtime、resident service 或 UI。
- 当一个功能出问题时，读者应先在哪个边界内定位。

## 不要先背仓库，先看四个闭环

Alembic 的产品并非一条从左到右的流水线，而是四个相互约束的闭环：

1. **身份闭环**：host project、projectRoot、dataRoot、selected runtime 必须对齐；身份不可信时，工具应停止或降级。
2. **生产闭环**：ProjectContext 读取结构事实，计划与 cold start/rescan 组织分析，结果先进入 Candidate，再经审阅成为 Recipe。
3. **消费闭环**：RecipeContext、Search、Prime、Guard、Project Skill 和 Dashboard 把已治理知识交给人或 Agent 使用。
4. **新鲜度闭环**：SourceRef 指纹、提交检查点、文件变化、rescan 和 evolution 发现证据漂移；漂移知识降权并显式标记，而不是悄悄继续充当真相。

只有这四个闭环都能回答“输入、输出、状态变化、失败路径和证据”，才能称为可用的本地知识系统。

这句话里至少包含六层：

- 用户项目：真实源码、测试、配置、调用链和团队决策的来源。
- Workspace resolver：把真实源码位置 `projectRoot` 与 Alembic 写入边界 `dataRoot` 分开。
- 本地知识层：`Alembic/recipes`、`Alembic/candidates`、`Alembic/skills`、`Alembic/wiki`、`.asd/alembic.db`、向量索引和日志。
- resident service：daemon、HTTP API、JobStore、Dashboard handoff、file monitor、search、jobs 和项目运行控制。
- 宿主工具层：Codex MCP tools、skills、clean structured output、tool visibility 和 host-agent workflow。
- 人类审阅层：Dashboard、Recipe/candidate review、Guard 报告、Jobs、Panorama、Module Explorer、Skills 和 Help。

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

Agent 与 Core 的关系很直接：Core 提供确定性项目知识和 workflow contract，Agent 负责把 AI、工具调用、上下文压缩、策略和执行循环组织起来。当前 profile-driven 主链是 Profile → AgentService → Builder → AgentRuntime/ReAct → LLMGateway/ToolRouter；host task handler 是另一类入口，不能和 profile run 混写。主 `Alembic` 可以使用 Agent 跑 provider-backed jobs；Codex 插件则必须区分“宿主 Codex Agent”和 Alembic 自己的 Agent runtime。

### AlembicPlugin

`AlembicPlugin` 是 host plugin 和 MCP runtime 仓库，根包 `alembic-codex-plugin-runtime` 为私有开发包。它负责 MCP schema、HostMcpServer、tool policy、public tools、skills、Codex/Claude Code marketplace shell、公开 `alembic-runtime` 包和 cache 刷新。

Plugin 的定位不是“另一个 Alembic daemon”。它把 host project、Alembic dataRoot、resident/project-scope capability、Core workflow contract 和 MCP 可见工具接起来。`daemon removed (PDR-3)` 指 Plugin 自己退休的 embedded daemon carrier；Plugin 仍可探测或拉起主 `Alembic` 的 resident daemon，并在其不可用时使用 pure-local embedded Core 路径。这两种 daemon 不能被一句“系统已无 daemon”混为一谈。当前 MCP catalog 位于 `AlembicPlugin/lib/host-runtime/mcp/PluginToolSurfaceCatalog.ts`。

### AlembicDashboard

`AlembicDashboard` 是 private React/Vite 前端。它有 Recipes、Candidates、Knowledge、Panorama、Module Explorer、Guard、Skills、Jobs、Help 九个顶层页面，并通过 `/api/v1`、SSE 和 WebSocket 访问后端。

Dashboard 不拥有数据库、AST、Agent 决策或 MCP tool execution。它的价值是把本地知识层变成可审阅、可操作、可观察的体验。

## 总控工作区不是产品仓库

`AlembicWorkspace` 是多仓库协作的 controller workspace。它记录计划、分发、验收、边界和长期协作账本，但不实现 Alembic 产品能力。Book 位于这个 workspace 里的 sibling repo，只是文档产品本身；它不应该被误解为主运行时的一部分。

这个边界对读者很重要。看到某个 Wakeflow 文档、dispatch packet 或验收记录时，不要把它当成产品代码；看到某个产品仓库里的实现时，也不要用总控便利去替代它自己的测试和发布边界。

## 当前源码读数是校验器，不是正文常量

本书每次更新都应重新核对一组低成本源码事实。本轮阅读得到的当前读数是：

- Core package exports：66 个子路径，覆盖 `workspace`、`knowledge`、`search`、`guard`、`project-context`、`host-agent-workflows`、`daemon`、`database`、`repositories`、`workflows/*` 等边界。
- 主 Alembic HTTP route families：`lib/http/routes` 下 25 个 route 文件；provider contract table 声明 31 个 routes，其中 Panorama 有 3 个端点。
- Plugin MCP catalog：19 个 entries，其中 18 个 agent tier、1 个 admin-only，3 个 agent-facing public workflow tools。
- Agent runtime registry：7 类工具、22 个 actions，包括只读 `evidence.get` 和 `evidence.search`。
- Dashboard tabs：`recipes`、`candidates`、`knowledge`、`panorama`、`spm`、`guard`、`skills`、`jobs`、`help`。

这些数字不是为了炫耀规模，而是防漂移基线。完整表和可执行断言集中在[当前实现快照](/appendix/implementation-snapshot)；如果校验失败，先读源码，再更新数字和叙述，不能为了让构建变绿而只改断言。

## 四条链路如何落到运行时

第一条是 CLI/resident 链路：用户运行 `alembic setup --ghost`，Core 的 project registry 和 workspace resolver 确定 dataRoot，主 Alembic 初始化 `.asd/` 与 `Alembic/`，随后 `alembic start` 启动 daemon/API/Dashboard。

第二条是 host plugin 链路：插件先做 `alembic_status`/`alembic_init`，再按项目知识状态暴露或调用 `alembic_recipe_map`、`alembic_graph`、`alembic_search`、`alembic_bootstrap`、`alembic_prime`、`alembic_work`、`alembic_code_guard` 等 MCP 工具，把本地知识以 structuredContent 交给宿主 Agent。

第三条是审阅和消费链路：bootstrap/rescan 产生候选知识，Dashboard 或工具流审阅它们，接受后的 Recipe 被同步到数据库与索引，后续 search/prime/Guard 把知识交给当前任务。

第四条是漂移和修复链路：代码读取形成 SourceRef 指纹，消费现场重新核验；发现漂移时 Search 降权并返回 `sourceRefStatus`/`driftedSourceRefs`，rescan/evolution 再决定恢复、更新、衰退或废弃。实现入口包括 `AlembicCore/src/service/knowledge/SourceRefReconciler.ts` 与 `AlembicCore/src/service/search/SearchEngine.ts`。

![Alembic 四个闭环图](/images/ch01/02-three-primary-flows.png)

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

新版 AlembicBook 从多仓库地图开始，但不止于仓库介绍。`Alembic` 是主 resident runtime，`AlembicCore` 是确定性共享内核，`AlembicAgent` 是 AI/tool 执行 runtime，`AlembicPlugin` 是 host adapter，`AlembicDashboard` 是前端审阅体验；真正贯穿全书的是身份、生产、消费和新鲜度四个闭环。

后续章节会沿着这张地图展开：先讲用户旅程，再讲仓库边界；之后进入 Core contract、项目模型、analysis/search/Guard、daemon/API/jobs、Codex plugin、Agent runtime、Dashboard、知识生命周期、发布验证和维护。
