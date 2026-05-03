# 图解速览 — 一张图读懂 Alembic

> 34 张手绘风格架构图，5 分钟快速理解整个系统。

Alembic 是一个 **AI 驱动的项目知识引擎**——它从代码中提取知识、持续进化知识、在开发时交付知识。本文用图解方式，沿着系统的六大部分快速走一遍。

## Part I · 起点与哲学

### 核心工作流

Alembic 本质上做两件事：**一次构建有限答案，持续回答无限问题**。

代码经过 AST 分析和 Agent 推理挖掘后，经由人工审核，沉淀为知识有机体（Knowledge Organism）。之后通过 MCP 协议被各种 IDE Agent 消费——Guard 检查合规、Search 检索知识、Agent 回答问题。

![核心工作流](/images/ch01/01-core-workflow.png)

### 工程规模

从工程规模看，Alembic 是一个 12 万行 TypeScript 的完整系统，支持 11 个 Tree-sitter WASM 语法包、Tool System V2（6 个语义工具 / 19 个 action）、19 个 MCP 工具和 25 维度知识覆盖。

![工程规模](/images/ch01/02-engineering-scale.png)

### SOUL 原则

所有设计决策遵循 SOUL 宪章——3 条硬约束（安全、确定性、隐私）+ 5 条设计哲学（渐进式、信号驱动、有机进化、纵深防御、诚实边界），构成系统的身份约束。

![SOUL 宪章](/images/ch02/01-soul-charter.png)

### 本地记忆主权

Alembic 的所有知识、记忆、行为信号都存储在项目本地——四层记忆架构（知识库 → 行为信号 → Agent 记忆 → 会话上下文）从临时到永久递进，信息密度逐层提升。PathGuard 文件沙箱 + stdio 零网络架构确保数据不外泄。

<!-- ![本地记忆主权](/images/ch02b/01-local-memory-sovereignty.png) -->

## Part II · 工程基石

### 七层分层架构

代码组织在 `lib/` 目录下，形成 7 个逻辑层：Entry Points → Bootstrap → Injection → Agent → Service → Core+Domain → Infrastructure。每层有严格的单向依赖规则：上层可以依赖下层，反之不行。

![七层架构](/images/ch03/01-seven-layer-architecture.png)

### 六层安全链路

每个请求（MCP / HTTP / CLI）经过六层纵深防御：Constitution 角色权限 → Gateway 管线 → PermissionManager RBAC → SafetyPolicy 行为沙箱 → PathGuard 文件系统沙箱 → ConfidenceRouter 知识质量门控。任何一层失败即阻断请求。

![六层安全链路](/images/ch04/01-six-layer-security.png)

### 结构分析链

代码理解是五阶段管线：单文件 AST 解析（Tree-sitter WASM，11 个语法包）→ 继承图构建 → 调用图推断（5 步增量管线）→ 设计模式检测（Singleton/Delegate/Factory/Observer）→ Tarjan SCC + Kahn 拓扑分层。最终输出 ProjectGraph 供 Panorama 消费。

![结构分析链](/images/ch05/01-structural-analysis-chain.png)

## Part III · 知识领域

### KnowledgeEntry — 统一实体

所有知识（Recipe、Rule、Fact、Pattern）共享同一个 `KnowledgeEntry` 实体。V3 版本包含 25+ 字段，覆盖元数据、约束、语义、统计四个维度。

![V3 字段全景](/images/ch06/01-v3-field-overview.png)

### 继承 vs 统一

早期版本曾用继承模型（RecipeEntry / RuleEntry / FactEntry 分别建表），V3 重构为统一实体+ `kind` 字段区分。这消除了 70% 的重复代码和跨类型查询的 UNION 操作。

![继承 vs 统一](/images/ch06/02-inheritance-vs-unified.png)

### 候选到 Recipe 的旅程

一条知识从候选（Candidate）到正式发布（Recipe）经过：AI 富化 → 25 维质量评分 → 置信度路由 → 宽限期观察 → 发布。

![候选到 Recipe](/images/ch06/03-candidate-to-recipe.png)

### 六态生命周期

每条知识的生命周期是六态状态机：`pending → staging → active → evolving → decaying → deprecated`。状态转换由信号驱动，每次转换通过 `LifecycleStateMachine` 唯一权威执行并记录不可变审计日志。

![六态生命周期](/images/ch07/01-six-state-lifecycle.png)

### 进化提案流程

当系统检测到知识需要更新时（衰退、文件变更、冗余），通过 `EvolutionGateway` 统一入口创建 EvolutionProposal（update / deprecate 两种类型）。`ProposalExecutor` 订阅 guard/search/decay/quality/usage/lifecycle 信号评估提案，`EvolutionPolicy` 用纯函数判断 update/deprecate 是否通过。

![进化提案流程](/images/ch07/02-evolution-proposal-flow.png)

### 衰退评分模型

衰退检测基于四维加权评分（freshness 0.3 + usage 0.3 + quality 0.2 + authority 0.2）计算 0-100 分数，映射到 5 个级别（healthy → dead）。六种衰退策略（no_recent_usage、high_false_positive、symbol_drift、source_ref_stale、superseded、contradiction）任一命中即产生衰退信号。

![衰退评分模型](/images/ch07/03-decay-scoring-model.png)

### Diff-Based 文件变更影响分析

文件修改时，ContentImpactAnalyzer 通过 `git diff HEAD -U0 -- <file>` 获取变更行 tokens，与 Recipe tokens（coreCode + markdown 代码块 + pattern + steps）做加权交集。modified 路径分为 pattern（0.6）和 reference（0.3）；文件删除且无其他 active sourceRef 时标记 direct（0.8）。pattern 级别持久化为 update 提案，quality signal 供 ProposalExecutor 和增量扫描消费，VSCode 弹窗消费 HTTP report。

![Diff-Based 影响分析](/images/ch07/04-diff-based-impact-analysis.png)

### 全链路数据流

从 IDE 文件事件到知识进化的完整链路，分为四层：触发层（VSCode FileChangeCollector + EventBuffer → HTTP → FileChangeDispatcher → FileChangeHandler）→ 信号层（quality signal 供内部治理消费，HTTP report 供 VSCode 弹窗消费）→ 决策层（RecipeImpactPlanner + auditRecipesForRescan + EvolutionGateway + RecipeProductionGateway）→ 落地层（staging/pending、提案创建、外部 Agent 融合决策）。

![全链路数据流](/images/ch07/05-full-dataflow-pipeline.png)

### 维度框架

质量评分采用三层结构：25 个原子维度 → 分组聚合 → 总分。每个维度有独立的评分函数和权重，确保不同类型的知识有针对性的质量标准。

![维度框架](/images/ch08/01-dimension-framework-layers.png)

### 置信度路由

评分完成后，ConfidenceRouter 根据总分将知识分流到不同路径：高置信度自动发布、中置信度进入宽限期、低置信度等待人工审核。

![置信度路由](/images/ch08/02-confidence-router-pipeline.png)

## Part IV · 核心服务

### Bootstrap 双路径架构

Cold Start 和 Knowledge Rescan 是两条显式工作流：前者干净建库，后者保留 Recipe 并治理缺口。它们各自完成前置治理，再复用 ProjectIntelligence 做结构化分析。

![Bootstrap 双路径](/images/ch09/01-dual-path-architecture.png)

### Rescan 内部治理

Knowledge Rescan 的增量性主要发生在知识治理层：先保留并同步已有 Recipe，修复 SourceRef，再结合 ProjectSnapshot、impact planning、audit 和 prescreen 生成 gap/evolution 执行计划。

![Rescan 内部治理链路](/images/ch09/02-rescan-internal-governance.png)

### Guard 四层检测

合规检测是四层渐进深入：正则匹配（微秒级）→ 代码级跨行分析（毫秒级）→ AST 语义查询（十毫秒级）→ AST 深度度量+跨文件分析（百毫秒级）。输出三态结果：pass / violation / uncertain。

![Guard 四层检测](/images/ch10/01-four-layer-detection.png)

### Search 混合检索

搜索引擎融合双路召回：FieldWeighted 字段加权（trigger ×5、title ×3、tags ×2）+ HNSW 向量语义（本地 Ollama Embedding，毫秒级推理）。结果经过自适应 alpha RRF 融合 + 三级重排（CoarseRanker → MultiSignalRanker → ContextBoost）后返回。

![Search 管线](/images/ch11/01-search-pipeline.png)

### Confidence Gate 查询路由

SearchEngine 的 auto 模式先跑关键词评估 Confidence（0–100），基于标题匹配、CamelCase 识别、分数断崖等正负向信号决定是否调用语义搜索。高置信度（≥60）直接返回关键词结果（40ms）；低置信度走 RRF 融合，alpha 自适应：`α = 0.4 + 0.35 × (1 - conf/60)`——confidence 越低，语义权重越高。

![Confidence Gate](/images/ch11/02-confidence-gate.png)

### Panorama · Signal · 代谢

三个子系统构成知识的自我治理链路：Panorama（感知项目结构与覆盖率）→ Signal（捕获 12 种行为信号）→ Evolution Governance（文件变更、rescan 审计、RecipeWarning 与进化提案）。

![三系统数据链路](/images/ch12/01-three-system-dataflow.png)

## Part V · Agent 智能层

### AgentRuntime — ReAct 循环

Agent 采用 ReAct（Reasoning + Acting）推理循环：思考 → 调用工具 → 观察结果 → 再思考。每轮最多 12 次工具调用，支持流式输出。

![ReAct 循环架构](/images/ch13/01-react-loop-architecture.png)

### 正交组合

Agent 的行为由 Profile × Capability × Strategy × Policy 四个正交输入共同决定。Profile 是任务级组合单位，编译后决定身份、工具、流程和边界，避免 Agent 类型的组合爆炸。

![正交组合立方体](/images/ch14/01-orthogonal-cube.png)

### 工具与记忆

Tool System V2 把 Agent 可见工具收敛为 `code`、`terminal`、`knowledge`、`graph`、`memory`、`meta` 6 个语义工具，并通过 19 个 action 覆盖代码分析、知识管理、终端执行、图谱查询、记忆记录和工具自省。记忆系统包含短期记忆（对话上下文）和长期记忆（项目事实），支持跨会话持久化。

![工具与记忆全景](/images/ch15/01-tools-memory-overview.png)

## Part VI · 平台与交付

### 数据基础设施

四层数据架构：ServiceContainer（DI 容器，9 模块，106 个实际注册 DI 键；`lib/injection/ServiceMap.ts` 覆盖 75 个公开 typed keys）→ SQLite 关系存储（better-sqlite3 + WAL）→ Vector 向量存储（HNSW + SQ8 量化）→ Cache 缓存体系（LRU + GraphCache + CacheCoordinator）。底层是审计与监控（AuditLogger + Winston Logger + ConfigLoader）。

![数据基础设施四层](/images/ch16/01-infrastructure-four-layers.png)

### MCP 六通道交付

通过 MCP（Model Context Protocol）将知识交付到 6 种 IDE Agent：Cursor、Windsurf、Copilot、Qodo、Cline、Trae。每种 IDE 有各自的配置格式，但消费的是同一个知识库。

![MCP 交付全景](/images/ch17/01-mcp-delivery-overview.png)

### Task 意图生命周期

MCP 工具中最特殊的 `alembic_task` 管理 Agent 自身的行为——五阶段闭环：Prime（IntentExtractor 意图识别 + PrimeSearchPipeline 多查询知识检索）→ Create（生成任务锚点）→ 行为自动采集（工具调用、搜索查询、文件引用、意图漂移检测）→ Close（IntentChain 持久化到 SignalBus → JSONL）→ Guard Review（git diff 增量审计 + inline Recipe 修复）。Close 返回 `nextAction.required: true` 强制 Agent 执行 Guard——协议层驱动，不依赖 Agent 自觉。

![Task 意图生命周期链](/images/ch17/02-task-lifecycle-chain.png)

### 四端接入

四种界面形态共享一个 ServiceContainer 内核：CLI（Commander.js 18+ 命令）、Dashboard（React 19 + Socket.IO 实时推送）、VSCode Extension（CodeLens + Guard 诊断）、飞书 Lark Transport（群聊→知识入口）。业务逻辑在 Service 层，界面层不含数据访问。

![四端接入架构](/images/ch18/01-four-interface-architecture.png)

## 一句话总结

> **Alembic = 代码理解（AST）+ 知识建模（KnowledgeEntry）+ 质量治理（Guard + Evolution）+ 智能交付（Agent + MCP）**
>
> 从源代码到项目知识，从知识到开发者手中——这就是 Alembic 的完整故事。
