# Ch04 Core Contract Spine

`@alembic/core` 是 Alembic 多运行时系统的 contract spine。它不是“公共工具包”的松散集合，也不是把主应用拆薄后的残留代码；它定义了外层仓库共同依赖的确定性语义：项目如何定位，知识如何建模，搜索如何排名，Guard 如何执行，host-agent workflow 如何交换任务，daemon/job/runtime 状态如何被描述。

本章的阅读目标是建立 Core 的骨架感。后面讲 workspace、search、Guard、Plugin、Agent、Dashboard 时，都会回到这里判断某个能力究竟是“内核契约”还是“外层适配”。

![@alembic/core public entrypoints 图](/images/ch04/01-core-public-entrypoints.png)

## 本章回答

- Core 为什么是 contract spine，而不是普通 shared utils。
- `src/index.ts` 和子路径 exports 分别承担什么边界。
- Core 的 domain、repository、service、infrastructure 如何分工。
- 外层仓库为什么必须通过 package entrypoint 消费 Core。

## 包出口就是架构边界

Core 的 `package.json` 当前暴露 66 个子路径：根入口、`./workspace`、`./knowledge`、`./search`、`./guard`、`./project-context`、`./project-context-capabilities`、`./recipe-context-capabilities`、`./host-agent-workflows`、`./plans`、`./daemon`、`./database`、`./repositories`、`./config`、`./io`、`./events`、`./dimensions`、`./evolution`、`./sustain`、`./workflows/*`、`./core/analysis`、`./core/ast`、`./core/discovery` 等。这个设计不是为了让所有内部文件都可随意 import，而是为了把稳定 contract 命名出来。

根入口 `src/index.ts` 也刻意收敛。代码里明确说明根入口只暴露外层收敛需要的稳定契约，避免内部重复类型通过 `export *` 撞到一起。也就是说，Core 的 public API 不是目录镜像，而是一组经过挑选的 contract surface。

读者应该把 Core exports 看成一张地图：

- `workspace` 负责 projectRoot、dataRoot、Ghost、ProjectRegistry、folder names。
- `knowledge` 负责 KnowledgeEntry、candidate、Recipe、字段规范、生命周期和写入/同步服务。
- `search` 负责 BM25、hybrid retrieval、ranking、sourceRef adapter、search response meta。
- `guard` 负责 GuardCheckEngine 和规则检查 contract。
- `project-context` 负责 space、repo、map、module、module-layers、file-flow、file-symbols、source-slice、anchor-range 等结构请求。
- `project-context-capabilities` 负责 ProjectContext 查询 facade、architecture intelligence 和 dynamic planning signals。
- `recipe-context-capabilities` 负责 detail、list、search、prime、source-refs、relations 等 RecipeContext facade。
- `core/analysis`、`core/ast`、`core/discovery` 负责 AST、grammar、符号、调用关系和项目发现基础能力。
- `host-agent-workflows` 负责 cold-start/rescan/dimension completion/Project Skill delivery 等宿主 Agent 协议。
- `daemon` 负责 JobStore、runtime control state、process events 和 resident service 状态形状。

这些入口共同形成 Core 的脊柱。外层仓库可以在脊柱上长出 CLI、daemon、MCP、Dashboard 或 AI runtime，但不应该绕过脊柱直接复制内部实现。

## 四层代码组织

Core 代码大致可以分成四层；当前 layer contract 还把更细的类别命名为 `shared`、`types`、`domain`、`core`、`infrastructure`、`repository`、`service`、`workflows`、`daemon`、`root-facade`。这些名字是边界检查的一部分，不只是目录描述。

第一层是 domain。这里定义知识条目、维度、生命周期、字段规范、演化策略等业务语义。domain 的价值是让“candidate 是否可消费”“Recipe 是否 readiness”“lifecycle 是否合法转移”这些问题有确定答案。

第二层是 repository。这里处理数据库、文件、sourceRef、sync、session、token、guard violation、evolution proposal 等持久化边界。repository 不负责 UI 呈现，也不负责 Codex 工具输出。

第三层是 service。这里把 domain 与 repository 组合成可调用能力，例如 KnowledgeService、KnowledgeSyncService、SearchEngine、GuardCheckEngine、VectorService、PanoramaService、RecipeExtractor、SourceRefReconciler。

第四层是 infrastructure/shared。这里提供数据库连接、Drizzle schema、logging、vector adapter、event bus、io/path guard、config loader、project registry、workspace resolver 等技术底座。

这种分层并不是为了教科书式整齐，而是为了让外层 runtime 可以选择合适的入口：CLI 可能调用 service，Plugin 可能通过 host-agent workflow contract 组织输出，Dashboard 只通过 HTTP API 读取结果，Agent 只消费它需要的工具和知识上下文。

## 当前 Core 事实源

几个 Core 文件是阅读全书时反复回到的事实源：

- `src/domain/dimension/DimensionRegistry.ts` 是维度定义单一来源；当前源码包含 26 个 `UnifiedDimension` 常量：13 个 universal、7 个 language、5 个 framework，以及显式启用时才进入编排的 cross-dimension synthesis。Bootstrap、Panorama、Rescan、Dashboard 都从这里消费元数据。
- `src/domain/knowledge/values/Relations.ts` 定义关系桶，当前合法 bucket 包括 `inherits`、`implements`、`calls`、`depends_on`、`data_flow`、`conflicts`、`extends`、`related`、`alternative`、`prerequisite`、`deprecated_by`、`solves`、`enforces`、`references`。
- `src/core/enhancement/index.ts` 注册 enhancement packs；当前按 React、Next.js、Vue、Node server、Django、FastAPI、ML、LangChain、Spring、Android、Go web/gRPC、Rust web/Tokio 等方向懒加载。
- `src/infrastructure/database/drizzle/schema.ts` 与 migrations 共同定义 `.asd/alembic.db` 的持久化边界。

这些文件适合作为章节事实锚点：维度、关系、增强包、数据库 schema 都不应从 Dashboard label 或旧 ledger 散文里反推。

## Core 稳定的是确定性，不是宿主体验

Core 应该回答确定性问题：

- 这个项目的 Alembic 数据写在哪里。
- 这个知识条目是否是 candidate、accepted、degraded 或 deprecated。
- 搜索结果应该如何融合 lexical、BM25、vector 和上下文信号。
- Guard 如何从知识规则和代码输入生成检查结果。
- host-agent bootstrap 需要哪些维度、ProjectContext、unit progress 和 completion contract。

Core 不应该回答宿主体验问题：

- CLI 命令输出长什么样。
- Codex tool 的 visible text 怎样压缩。
- Dashboard 卡片如何布局。
- 某个 provider 的 API key 从哪里读。
- Codex marketplace artifact 如何打包。

外层运行时的差异越多，Core 越需要稳住这些确定性语义。反过来，如果 Core 开始拥有 Codex、Dashboard 或 provider 细节，它就失去了作为公共脊柱的价值。

## Public API 守卫

Core 自己有 `smoke:public-api`、`lint:public-api-boundary`、`lint:consumer-core-imports` 和 `release:check`。外层仓库也通过 consumer import boundary 检查避免随意深 import。主 Alembic 的 `scripts/core-source-command.mjs` 会定位本地或 vendor Core source，然后运行 build 或 consumer import lint；Agent 和 Plugin 也有各自的 Core import boundary 脚本。

这说明 Core 的边界不是口头约定，而是发布和验证流程的一部分。若外层仓库需要一个新能力，正确动作通常不是 `../../AlembicCore/src/internal-file`，而是把能力提升到合适的 Core package entrypoint，再让消费者通过 `@alembic/core/{entry}` 使用。

## 与外层仓库的关系

主 `Alembic` 消费 Core 的 workspace、daemon、search、guard、ProjectContext、host-agent workflow、database 和 config contract，把它们接进 CLI、daemon、HTTP API 和 Dashboard server。

`AlembicPlugin` 消费 Core 的 workspace、daemon contracts、ProjectContext、RecipeContext、host-agent workflows、io/path guard、ProjectSkillDeliveryReceipt、JobStore shape 和 public schemas，把它们投射成 MCP 工具。

`AlembicAgent` 消费 Core 的 logging、知识/工作流 contract 和 runtime 所需类型，但 AI provider、tool registry、policy、strategy 留在 Agent 仓库。

`AlembicDashboard` 不直接拥有 Core；它通过主 Alembic 的 `/api/v1` API 间接消费 Core 产出的状态和对象。

## 读代码时的落点判断

看到 `WorkspaceResolver`、`ProjectRegistry`、`PathGuard`、`KnowledgeEntry`、`SearchEngine`、`GuardCheckEngine`、`ProjectContext`、`RecipeContext`、`buildIDEAgentAnalysisPacket`、`JobStore` 或 host-agent workflow contract，优先在 Core 找事实源。

看到 CLI command、daemon start/stop、HTTP route、Dashboard server、provider-backed job enqueue，优先在主 `Alembic` 找装配。

看到 MCP tool schema、tool visibility、clean output、Codex status/diagnostics、Project Skill export，优先在 `AlembicPlugin` 找适配。

这个判断比目录名字更可靠，因为 Alembic 正处在多仓库收敛过程中，同名概念可能在不同仓库有 adapter、projection 或兼容层。事实源以 contract owner 为准。

## 本章小结

`@alembic/core` 的价值在于稳定共享语义。它把项目定位、知识模型、检索、Guard、ProjectContext、RecipeContext、host-agent workflow 和 daemon state 这些确定性 contract 收敛成包入口，让主运行时、Plugin、Agent 和 Dashboard 能在同一套事实上协作。

后面两章会沿着这条脊柱下钻：先看项目模型、路径和存储，再看分析、检索与 Guard 内核。
