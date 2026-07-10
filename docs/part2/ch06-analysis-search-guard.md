# Ch06 结构事实、知识投影、检索与 Guard

Core 的第二条主线是把“项目理解”拆成四个不同对象：ProjectContext 读取当前代码结构，RecipeContext 投影已治理知识，Search 按多信号检索知识，Guard 把规则应用到明确代码范围。Graph 和 Recipe Map 又分别站在结构与知识的交界处。若把它们统称为“AI 扫描”，就会同时丢掉事实来源和失败边界。

本章不把这些能力写成一个“AI 智能扫描”的黑箱，而是分别说明它们输入什么、输出什么、如何被后续 workflow 使用。

源码锚点：`AlembicCore/src/project-context.ts`、`AlembicCore/src/domain/project-context/ProjectContextContracts.ts`、`AlembicCore/src/domain/recipe-context/RecipeContextContracts.ts`、`AlembicCore/src/search.ts`、`AlembicCore/src/guard.ts`。

![analysis search guard 内核关系图](/images/ch06/01-analysis-search-guard-kernel.png)

## 本章回答

- ProjectContext、RecipeContext、Graph 与 Recipe Map 为什么不是同一件事。
- Search 为什么不是简单字符串匹配。
- Guard 的正则、代码级、AST 和跨文件层怎样协作。
- 已声明的 SourceGraph 能力为何还不能写成生产链已接通。

## ProjectContext 只回答当前代码结构

`ProjectContextRequest` 当前有九类：space、repo、map、module、module-layers、file-flow、file-symbols、source-slice、anchor-range。默认 `ProjectContextService` 为每类请求注册独立 handler，结果可以包含 entrypoint、command、module/layer、caller/callee、source slice、结构热点和稳定 ref。它的目标是给调用者一张可定位、可裁剪的结构地图，而不是直接生产 Recipe。

ProjectContext 的 file-flow、file-symbols 和 module-layers 共用 `AlembicCore/src/service/project-context/shared/parserLanguage.ts` 中的解析映射。当前支持 11 种语言；Swift 等语言不再被旧的 TypeScript/JavaScript 局部白名单拦截。grammar 资产存在只是第一层证据，handler 实际选择 parser 才能证明某条语言路径接通。

结构事实是 bootstrap/rescan 的地基。Agent 可据此阅读代码、Dashboard 可投影 Panorama/Module Explorer、Plugin 可给宿主返回 analysis packet。但 ProjectContext 不读取 Recipe 生命周期，也不替代 Search。

## RecipeContext、Graph 与 Recipe Map

RecipeContext 是数据库支持的只读知识投影，支持 detail、list、search、prime、source-refs、relations；它没有 mutation handle，生命周期写入仍归 KnowledgeService。这条边界阻止“读取上下文”悄悄变成“修改知识”。

Plugin 的两个图工具也必须分开：

- `alembic_graph` 是 Recipe-free 的 ProjectContext 投影。它从结构 refs/relations 构图，并支持 path、impact、neighborhood、stats 等派生遍历。
- `alembic_recipe_map` 先取得同一个 ProjectContext region，再通过 RecipeContext 的 list/source-refs 把 Recipe 挂到区域上；它不是语义搜索的别名。

因此正确的心智模型是：Graph = 当前项目结构；Recipe Map = 结构区域 + 已治理知识挂载。一个项目即使没有 Recipe，也应能请求结构图；没有结构区域时，Recipe Map 也不应伪造代码归属。

当前还有一个必须诚实标注的缺口：`AlembicCore/src/service/source-graph/SourceGraphService.ts` 已有 `buildFull/buildIncremental`，`ProjectSnapshot` 也有 `sourceGraphResult` 字段，但生产源码扫描尚未找到把构建结果写入 snapshot 的调用方。存在 service、DTO 和测试不等于 cold start 已经生产 SourceGraph。

## Search 是多信号检索

Core 的 `search` 入口暴露 `SearchEngine`、BM25 scorer、field-weighted scorer、hybrid retriever、multi-signal ranker、context boost、sourceRef adapter、search response meta 和 tokenization。它不是 `grep` 的包装。

典型搜索会综合多类信号：

- lexical/BM25 相关度。
- 字段权重，例如 title、trigger、doClause、content。
- authority、difficulty、popularity、recency、context match。
- vector/semantic hit。
- sourceRef 和 lifecycle 过滤。
- Slim response 与 meta，告诉调用方实际使用了哪些模式、是否降级、耗时和向量状态。

这种设计让 Alembic 可以在没有语义索引时退回 lexical/database search，也可以在 vector 可用时加入 semantic retrieval。SourceRef 漂移也进入了排序与输出：`AlembicCore/src/service/search/SearchEngine.ts` 对 drifted item 降权，并返回 `sourceRefStatus` 与 `driftedSourceRefs`；Plugin 会保留这些字段。漂移知识不是直接消失，而是以降低可信度、要求现场复核的方式继续可见。

## Guard 是规则检查引擎，不是泛化代码审查

Core 的 `guard` 入口暴露 `createGuardCheckEngine` 和 service/guard 能力。代码注释很清楚：Core 稳定规则检查、跨文件检查、报告和正向治理闭环；MCP tool schema、CLI 参数、Codex 输出格式由外层 adapter 包装。

Guard 的具体引擎落在 `AlembicCore/src/service/guard/GuardCheckEngine.ts`；主 HTTP wrapper 落在 `Alembic/lib/http/routes/guard.ts`；Plugin public wrapper 落在 `AlembicPlugin/lib/host-runtime/mcp/handlers/agent-public-tools.ts`。同一个 Guard 概念在三层分别承担 engine、route、host-facing scoped wrapper，不能互相替代。

引擎会合并数据库 Recipe 规则、内置规则和 Enhancement Pack 规则，再按正则、code-level、AST rules、AST 深层检查执行；批量模式还会做跨文件检查。AST 不可用时结果应带 uncertainty，不能把“没分析到”伪装成“没有违规”。处于 decaying 的 error 规则会降为 warning，这正是知识新鲜度影响消费行为的一个实例。

这句话定义了 Guard 的边界。Guard 的职责是把项目知识中的规则应用到明确代码输入上，生成可解释结果。它不应该假装自己是全能 reviewer，也不应该在没有文件、inline code 或 workRef scope 时做无边界全仓检查。

Guard 的输入应该是显式的：

- 文件列表。
- 单个文件路径。
- inline code。
- 已跟踪 workRef 中的 scoped files。

输出应该能说明：

- 哪些规则命中。
- 严重级别和阈值。
- 对应代码位置或证据。
- 是否建议继续人工复核。
- 是否产生 signal 或 violation record。

## 四类能力在 bootstrap/rescan 中协作

Cold start 和 rescan 不只是“扫描文件”。它们需要先建立项目结构事实，再读取已有 Recipe/candidate/sourceRef，再决定每个维度应该补什么，最后把候选知识和 completion 状态写回。

ProjectContext 提供结构 refs 和 analysis units。RecipeContext 提供已有知识的只读投影。Search 提供相关 Recipe、sourceRef 状态和 retrieval hints。Guard 提供规则审计和代码约束信号。Agent 或 host-agent workflow 在这些基础上完成维度分析和知识提交。

这就是为什么 bootstrap/rescan 的结果不应该被理解成“模型总结了一遍项目”。它是结构分析、知识检索、规则检查和 Agent 阅读共同形成的工作流。

## 与外层 adapter 的边界

主 Alembic 会把 Core 能力接入 CLI、daemon jobs、HTTP routes 和 Dashboard server。例如 `/api/v1/search`、Guard routes、module/project-scope routes、jobs bootstrap/rescan routes。

AlembicPlugin 会把 Core 能力接入 MCP tool surface，例如 `alembic_recipe_map`、`alembic_graph`、`alembic_search`、`alembic_prime`、`alembic_code_guard`、`alembic_bootstrap`、`alembic_rescan`。

AlembicDashboard 通过 API client 展示 Search、Guard、Panorama、Module Explorer、Jobs 和 Candidates。

AlembicAgent 通过 tool system 或主 Alembic job workflow 使用这些能力，但 Agent 的 LLM prompt、provider 和 strategy 不属于 Core。

## 降级是 contract 的一部分

分析、检索和 Guard 都必须能表达降级。Tree-sitter grammar 缺失、vector index 不可用、database 未初始化、sourceRef 不完整、file monitor 降级、AI provider 不可用，这些都不应该被吞掉。

Core contract 应该保留 enough meta，让外层说清楚：

- 当前结果来自 lexical、BM25 还是 semantic。
- vector 是否可用。
- workspace identity 是什么。
- 结构分析是否缺失某类 parser。
- Guard 是否因为缺少 scope 而 fail closed。

高质量的 Alembic 体验不是永远成功，而是失败和降级也可诊断。

## 本章小结

ProjectContext、RecipeContext、Search 和 Guard 分别提供结构事实、知识投影、多信号检索和规则检查。Graph 与 Recipe Map 建立结构和知识之间的可见连接，但不会消除二者边界。

记住边界：Core 稳定算法、数据形状和确定性语义；外层 runtime 负责命令、HTTP、MCP、UI、AI provider 和输出体验。下一部分会进入主 `Alembic` 仓库，看这些 Core contract 如何成为本地 resident service。
