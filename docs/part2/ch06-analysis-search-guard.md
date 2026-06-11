# Ch06 分析、检索与 Guard 内核

Core 的第二条主线是把“项目理解”拆成三个确定性能力：分析项目结构，检索已有知识，检查代码是否违背项目规则。它们分别对应 `project-intelligence`、`search` 和 `guard`。外层 CLI、daemon、Plugin、Dashboard 都可以包装这些能力，但不应该改变它们的核心语义。

本章不把这些能力写成一个“AI 智能扫描”的黑箱，而是分别说明它们输入什么、输出什么、如何被后续 workflow 使用。

![analysis search guard 内核关系图](/images/ch06/01-analysis-search-guard-kernel.png)

## 本章回答

- Project Intelligence 与普通文件扫描有什么差别。
- Search 为什么不是简单字符串匹配。
- Guard 在 Core 中稳定什么，在外层 adapter 中包装什么。
- 分析、检索和 Guard 如何共同支撑 host-agent workflow。

## Project Intelligence 先建立结构事实

`@alembic/core/project-intelligence` 暴露 AST analyzer、grammar loading、discoverer registry、config parser、ProjectGraph、project snapshot、Panorama、IDE agent analysis packet 等能力。它的目标不是直接产出最终 Recipe，而是给后续分析提供结构化事实。

结构事实包括：

- 语言和文件统计。
- AST 提取到的 class、function、interface、type、method 等符号。
- 配置文件、构建文件、框架线索和模块边界。
- 依赖图、调用关系和 structural evidence。
- Project snapshot 与 stable unit key。
- 给 host agent 使用的 analysis packet、unit progress 和 retrieval hints。

这些事实是 bootstrap/rescan 的地基。Agent 可以在此基础上阅读代码、提交候选知识、完成维度；Dashboard 可以展示 Panorama；Plugin 可以把 Mission Briefing 交给 Codex；主 daemon 可以记录 job process events。

## Search 是多信号检索

Core 的 `search` 入口暴露 `SearchEngine`、BM25 scorer、field-weighted scorer、hybrid retriever、multi-signal ranker、context boost、sourceRef adapter、search response meta 和 tokenization。它不是 `grep` 的包装。

典型搜索会综合多类信号：

- lexical/BM25 相关度。
- 字段权重，例如 title、trigger、doClause、content。
- authority、difficulty、popularity、recency、context match。
- vector/semantic hit。
- sourceRef 和 lifecycle 过滤。
- Slim response 与 meta，告诉调用方实际使用了哪些模式、是否降级、耗时和向量状态。

这种设计让 Alembic 可以在没有语义索引时退回 lexical/database search，也可以在 vector 可用时加入 semantic retrieval。Codex prime、Dashboard search、resident search API 和 CLI search 都应消费这条 contract，而不是各写一套排序逻辑。

## Guard 是规则检查引擎，不是泛化代码审查

Core 的 `guard` 入口暴露 `createGuardCheckEngine` 和 service/guard 能力。代码注释很清楚：Core 稳定规则检查、跨文件检查、报告和正向治理闭环；MCP tool schema、CLI 参数、Codex 输出格式由外层 adapter 包装。

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

## 三者在 bootstrap/rescan 中协作

Cold start 和 rescan 不只是“扫描文件”。它们需要先建立项目结构事实，再读取已有 Recipe/candidate/sourceRef，再决定每个维度应该补什么，最后把候选知识和 completion 状态写回。

Project Intelligence 提供 snapshot 和 analysis units。Search 提供已有知识、相关 Recipe、sourceRef 和 retrieval hints。Guard 提供规则审计和代码约束信号。Agent 或 host-agent workflow 在这些基础上完成维度分析和知识提交。

这就是为什么 bootstrap/rescan 的结果不应该被理解成“模型总结了一遍项目”。它是结构分析、知识检索、规则检查和 Agent 阅读共同形成的工作流。

## 与外层 adapter 的边界

主 Alembic 会把 Core 能力接入 CLI、daemon jobs、HTTP routes 和 Dashboard server。例如 `/api/v1/search`、Guard routes、Panorama routes、jobs bootstrap/rescan routes。

AlembicPlugin 会把 Core 能力接入 MCP tool surface，例如 `alembic_search`、`alembic_structure`、`alembic_call_context`、`alembic_code_guard`、`alembic_bootstrap`、`alembic_rescan`。

AlembicDashboard 通过 API client 展示 search、Guard、Panorama、Jobs 和 candidates。

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

Project Intelligence、Search 和 Guard 是 Core 中最直接服务 AI 编程体验的三个内核。它们分别提供结构事实、知识检索和规则检查，三者共同支撑 bootstrap、rescan、prime、Dashboard 和 code guard。

记住边界：Core 稳定算法、数据形状和确定性语义；外层 runtime 负责命令、HTTP、MCP、UI、AI provider 和输出体验。下一部分会进入主 `Alembic` 仓库，看这些 Core contract 如何成为本地 resident service。
