# 工具体系与记忆系统

> Tool System V2 把 Agent 可见工具从“几十个平铺函数”收敛为 6 个语义工具、19 个 action。记忆系统仍在 `lib/agent/memory`，但与 V2 工具的 `memory` action 和 `ToolContextFactory` 连接得更紧。

## 问题场景

Agent 的 ReAct 循环需要做很多事：搜索代码、读取文件、查 AST/调用图、搜索知识、提交候选、执行受控终端命令、记录阶段发现、查询工具 schema。旧实现把这些能力拆成几十个独立工具，LLM 每轮都要在一长串名字里选择，文档里也常写成“59 个内部工具”或“Agent 内部 60 个 Tool”。

当前实现已经升级到 **Tool System V2**：

- `lib/tools/v2/registry.ts` 是 Agent 工具的单一真相源。
- LLM 可见的核心工具只有 **6 个**：`code`、`terminal`、`knowledge`、`graph`、`memory`、`meta`。
- 每个工具内部用 `action` 区分操作，当前合计 **19 个 action**。
- Runtime 通过 `V2ToolRouterAdapter` 接入 V2；MCP、Dashboard、Skill、macOS、Workflow 等非 Agent 表面通过 `LightweightRouter` 接入各自 adapter。

因此现在的工具系统不再是“一个 registry 存 60 个 handler”，而是：

```text
CapabilityV2.allowedTools
  → V2CapabilityCatalog 生成轻量 schema
  → LLM function call: code({ action, params })
  → AgentRuntime ToolExecutionPipeline
  → V2ToolRouterAdapter
  → ToolRouterV2
    → parseToolCall()
    → validateParams()
    → concurrency lock
    → ToolContextFactory
    → action.handler()
  → ToolResult
  → ToolResultEnvelope
```

![Tool System V2 调用路径](/images/ch15/01-tools-memory-overview.png)

## 目录边界

当前工具目录分成两层：Agent V2 核心工具，以及平台表面的轻量路由。

```text
lib/tools/
├── v2/
│   ├── registry.ts              # 6 个工具 + 19 个 action 的单一真相源
│   ├── router.ts                # ToolRouterV2：解析、校验、并发、截断
│   ├── types.ts                 # ToolSpec / ToolAction / ToolResult / ToolContext
│   ├── handlers/
│   │   ├── code.ts              # search/read/outline/structure/write
│   │   ├── terminal.ts          # exec
│   │   ├── knowledge.ts         # search/submit/detail/manage
│   │   ├── graph.ts             # overview/query
│   │   ├── memory.ts            # save/recall/note_finding/get_previous_evidence
│   │   └── meta.ts              # tools/plan/review
│   ├── capabilities/            # ConversationV2、BootstrapAnalyze、SystemV2 等
│   ├── cache/                   # DeltaCache、SearchCache
│   ├── compressor/              # OutputCompressor
│   └── adapter/
│       ├── V2CapabilityCatalog.ts
│       ├── V2ToolRouterAdapter.ts
│       └── ToolContextFactory.ts
├── core/
│   ├── LightweightRouter.ts     # 非 Agent 表面的轻量路由
│   └── ToolResultEnvelope.ts    # Runtime 兼容的统一结果信封
├── catalog/
│   ├── CapabilityCatalog.ts
│   └── UnifiedToolCatalog.ts    # Dashboard/Terminal/Skill/MCP/Forge manifest 目录
├── adapters/                    # Dashboard、Terminal、Skill、macOS、Workflow
└── workflow/WorkflowRegistry.ts
```

这里有一个重要边界：**V2 工具服务 Agent Runtime；MCP 工具服务外部 IDE Agent。** 它们共享工具路由契约和结果信封，但不是同一组工具名。

## V2 工具注册表

`TOOL_REGISTRY` 当前声明 6 个工具、19 个 action：

| 工具 | Actions | 作用 |
|:---|:---|:---|
| `code` | `search`、`read`、`outline`、`structure`、`write` | 搜索源码、读文件、自适应 AST 骨架、目录树、受控写文件 |
| `terminal` | `exec` | 在项目目录内执行受治理命令，压缩输出 |
| `knowledge` | `search`、`submit`、`detail`、`manage` | 搜索、提交、查看和管理知识 |
| `graph` | `overview`、`query` | 项目 AST 概览、实体/关系/调用查询 |
| `memory` | `save`、`recall`、`note_finding`、`get_previous_evidence` | 工作记忆、跨维度证据复用、关键发现记录 |
| `meta` | `tools`、`plan`、`review` | 工具自省、计划记录、候选自检 |

这个设计解决了旧工具系统的两个问题：

1. **工具名稳定**：LLM 只需要选择 `code` / `knowledge` 这类大类工具，再用 action 表达意图。
2. **schema 更轻**：首轮 schema 只暴露 `{ action, params }`，完整参数说明按需通过 `meta.tools` 查询。

例如读取文件不再是 `read_project_file`，而是：

```json
{
  "tool": "code",
  "arguments": {
    "action": "read",
    "params": { "path": "src/App.tsx", "startLine": 20, "endLine": 80 }
  }
}
```

提交知识不再是 `submit_knowledge`，而是：

```json
{
  "tool": "knowledge",
  "arguments": {
    "action": "submit",
    "params": {
      "title": "Constructor injection for CookieProviding",
      "kind": "pattern",
      "trigger": "cookie-providing-di"
    }
  }
}
```

## Capability V2

Capability 仍然回答“当前场景能用什么工具”，但 V2 把白名单从 `string[]` 升级为 `tool → action[]`：

```typescript
export abstract class CapabilityV2 extends Capability {
  abstract get allowedTools(): Record<string, string[]>;
}
```

内置 Capability 映射到 V2 工具：

| Capability | 允许工具 |
|:---|:---|
| `conversation` | `code.search/read/outline/structure`、`knowledge.search/detail/submit`、`graph.overview/query`、`memory.save/recall`、`meta.tools` |
| `code_analysis` / `bootstrap_analyze` | `code.search/read/outline/structure`、`terminal.exec`、`graph.overview/query`、`memory.save/recall/note_finding/get_previous_evidence`、`meta.plan` |
| `knowledge_production` / `bootstrap_produce` | `code.read`、`knowledge.submit`、`memory.recall`、`meta.review` |
| `scan_analyze` | `code.search/read/outline`、`terminal.exec`、`knowledge.search`、`graph.query`、`memory.save/note_finding/get_previous_evidence` |
| `scan_production` | `code.read`、`knowledge.submit`、`memory.recall` |
| `system_interaction` | `code.search/read/outline/structure/write`、`terminal.exec`、`graph.overview`、`meta.tools` |
| `evolution_analysis` | `code.search/read`、`knowledge.search/detail/manage`、`graph.query` |

`V2CapabilityCatalog` 从 `TOOL_REGISTRY` 生成 LLM schema。它保留了旧 Runtime 期望的 duck-type 接口（`toToolSchemas()` / `toMixedSchemas()`），所以 Runtime 不需要知道背后已经从几十个平铺工具换成了 6 个 V2 工具。

## ToolRouterV2

`ToolRouterV2.execute(call, ctx)` 的职责非常克制：

```text
1. TOOL_REGISTRY[tool].actions[action] 查找 action
2. validateParams() 检查 required 和 enum
3. 可选 CapabilityV2Def 检查 tool/action 是否允许
4. 按 action.concurrency 获取锁
5. 注入 ctx.toolRegistry，调用 action.handler()
6. 按 maxOutputTokens 截断字符串输出
7. 返回 ToolResult
```

每个 action 的 metadata 同时表达运行策略：

| 字段 | 取值 | 用途 |
|:---|:---|:---|
| `cache` | `none` / `session` / `delta` | 搜索、读取等结果缓存提示 |
| `concurrency` | `parallel` / `single` / `exclusive` | 并行安全、同工具互斥、全局独占 |
| `risk` | `read-only` / `write` / `side-effect` | 用于自省、审计和风险说明 |
| `maxOutputTokens` | number | handler 返回后强制裁剪 |

相比旧的 `GovernanceEngine` 四阶段，V2 更轻：Agent 核心工具把“参数校验、并发、输出预算”放在 Router；更重的权限、Gateway、外部信任仍留在 MCP 和平台表面的 manifest 路由里。

## ToolContextFactory

V2 handler 不直接依赖 ServiceContainer，而是拿到一个精简的 `ToolContext`。`ToolContextFactory` 每次调用前组装上下文：

```text
ToolCallRequest
  → ToolContextFactory.create()
    → projectRoot
    → projectGraph / codeEntityGraph / searchEngine / recipeGateway / knowledgeRepo
    → astAnalyzer / safetyPolicy / sandboxExecutor
    → DeltaCache / SearchCache / OutputCompressor / SessionStore
    → tokenBudget / abortSignal / memoryCoordinator
```

这里的设计很有意思：重量级服务按需从 DI 容器取，轻量组件（`DeltaCache`、`SearchCache`、`OutputCompressor`、`SimpleSessionStore`）在 Factory 构造时创建并跨工具调用复用。这样 `code.read` 的 delta cache、`knowledge.search` 的 search cache、`terminal.exec` 的输出压缩都能共享同一轮 Agent 会话的状态。

终端执行也在这里接入沙箱。`SandboxExecutorBridge` 用 macOS Seatbelt profile 执行 `/bin/sh -c`，默认网络关闭、文件系统限制在 project-write；没有注入 sandbox 时才降级为 plain exec，主要用于测试或非 macOS 环境。

## Runtime ToolExecutionPipeline

Runtime 内仍有一条轻量中间件管线，但它不再承担“安全总控”或“缓存总控”：

| 中间件 | 当前职责 |
|:---|:---|
| `allowlistGate` | 检查工具名是否在当前 Capability / ActionSpace 白名单中；ToolForge 临时工具可放行 |
| `observationRecord` | 写入 `MemoryCoordinator.recordObservation()` |
| `trackerSignal` | 调用 `ExplorationTracker.recordToolCall()` |
| `traceRecord` | 写入 `ActiveContext` 推理链 |
| `submitDedup` | 对 `knowledge.submit` 做 title、trigger、代码模式指纹去重 |

执行阶段统一调用 `runtime.toolRouter.execute()`。在当前 AgentModule 中，`toolRouter` 是 `V2ToolRouterAdapter`，它把 V2 的 `ToolResult` 包装成 Runtime 兼容的 `ToolResultEnvelope`。

旧文档中的 `SafetyGate` 和 `CacheCheck` 已经不在默认 pipeline 中。命令安全在 `terminal.exec` handler 与 sandbox 中处理；缓存由 V2 handler 通过 `DeltaCache` / `SearchCache` / `ToolResultMeta.cached` 表达；Runtime 只负责选择工具、记录观察和维护推理状态。

## 非 Agent 表面

Agent V2 工具不是整个系统唯一的工具入口。Alembic 还有一层平台工具路由：

```text
UnifiedToolCatalog
  → LightweightRouter
    → DashboardOperationAdapter
    → TerminalAdapter
    → SkillAdapter
    → MacSystemAdapter
    → WorkflowAdapter
    → McpToolAdapter
```

`LightweightRouter` 是替代旧重型 ToolRouter 的平台路由器。它只做三件事：查 manifest、找 adapter、包装结果。Dashboard、Terminal、Skill、macOS、Workflow、MCP 等表面仍使用 `ToolCapabilityManifest` 描述风险、执行策略、治理字段和外部信任。

这也是为什么源码中同时存在 `V2CapabilityCatalog` 和 `UnifiedToolCatalog`：

- `V2CapabilityCatalog`：给 Agent Runtime 生成 6 个 V2 工具 schema。
- `UnifiedToolCatalog`：给非 Agent 表面和 ToolForge 管理 manifest、handler 和临时工具。

## MCP 工具

MCP Server 对外仍暴露 `alembic_*` 工具，而不是直接暴露 `code` / `knowledge` 这 6 个 V2 工具。`lib/external/mcp/tools.ts` 当前声明 **19 个 MCP 工具**：

| 层级 | 工具 |
|:---|:---|
| Agent 查询 | `alembic_health`、`alembic_search`、`alembic_knowledge`、`alembic_structure`、`alembic_graph`、`alembic_call_context`、`alembic_guard` |
| Agent 写入/工作流 | `alembic_submit_knowledge`、`alembic_skill`、`alembic_bootstrap`、`alembic_rescan`、`alembic_evolve`、`alembic_consolidate`、`alembic_dimension_complete`、`alembic_wiki`、`alembic_panorama`、`alembic_task` |
| Admin | `alembic_enrich_candidates`、`alembic_knowledge_lifecycle` |

MCP 请求路径是：

```text
CallToolRequest{name, arguments}
  → McpServer._handleToolCall()
  → _resolveMcpGatewayMapping()
  → LightweightRouter
  → McpToolAdapter
  → lib/external/mcp/handlers/*
  → ToolResultEnvelope
```

`buildMcpToolCapabilities()` 会把这些 MCP 声明投影为 `mcp-tool` manifest，附加 risk、execution、governance 和 externalTrust。写操作通过 `TOOL_GATEWAY_MAP` 做动态 Gateway 映射；只读查询不需要 Gateway 预检。

## ToolForge

ToolForge 仍在 `lib/agent/forge`，但它现在投影到 `UnifiedToolCatalog`：

```text
ToolRequirementAnalyzer
  → Reuse / Compose / Generate
  → SandboxRunner 验证
  → TemporaryToolRegistry
  → UnifiedToolCatalog.projectForgedTool()
  → CapabilityCatalog / WorkflowRegistry 参与路由
```

生成出的临时工具不会绕过 Runtime 白名单。`allowlistGate` 只对确认为 `TemporaryToolRegistry` 管理的动态工具放行；真正执行时仍进入统一路由和结果信封。

## 多层记忆体系

记忆系统仍在 `lib/agent/memory`，分为三层：

| 层级 | 类 | 生命周期 | 用途 |
|:---|:---|:---|:---|
| 工作记忆 | `ActiveContext` | 单轮 / 单阶段 | 当前工具观察、scratchpad、plan、推理链 |
| 会话记忆 | `SessionStore` | 一次 bootstrap/rescan 会话 | 跨维度发现、维度报告、tier reflection |
| 长期记忆 | `PersistentMemory` + `MemoryStore` | 跨会话 | fact / insight / preference |

`MemoryCoordinator` 是统一调度入口，负责：

- `recordObservation()`：记录工具结果。
- `buildStaticMemoryPrompt()`：阶段开始前注入长期/会话记忆。
- `buildDynamicMemoryPrompt()`：每轮注入工作记忆。
- `allocateBudget(role)`：按 analyst / producer / user 重新分配预算。
- `cacheToolResult()`：缓存只读工具结果。

V2 增加了两条更直接的记忆通道：

- `memory.note_finding`：分析阶段把关键发现写入 `ActiveContext` scratchpad，并参与 QualityGate 的 evidenceScore。
- `memory.get_previous_evidence`：后续维度先查询前序证据，避免重复搜索、重复读文件。

Chat 场景更偏 `PersistentMemory`；分析阶段更偏 `ActiveContext`；生产阶段更偏 `SessionStore`。V2 工具里的 `memory` action 则给 Agent 一个显式操作这些记忆层的入口。

## ExplorationTracker

ExplorationTracker 仍是系统任务的节奏控制器。它追踪：

- 当前 phase。
- 搜索轮数、提交数、连续空闲轮数。
- uniqueFiles、uniquePatterns、uniqueQueries。
- Nudge 和 toolChoice。

`SignalDetector` 从 V2 工具调用结果里判断是否产生新信息；`NudgeGenerator` 在预算紧张、信息饱和或需要强制退出时生成提示。

## 权衡

Tool System V2 的代价是 action 需要多一层参数包装：`tool + action + params` 比单个函数名更抽象。收益更大：

1. **LLM 选择更稳定**：6 个工具名比几十个函数名更容易选对。
2. **schema 负担更小**：首轮只给轻量 schema，细节按需查询。
3. **执行边界更清楚**：Agent V2 工具、MCP 工具、Dashboard/Skill/macOS/Workflow 表面各走自己的 router。
4. **记忆与证据更顺手**：`memory.note_finding` 和 `get_previous_evidence` 把跨维度协作变成一等工具能力。
5. **旧 Runtime 可平滑迁移**：`V2ToolRouterAdapter` 继续产出 `ToolResultEnvelope`，不破坏 ReAct 循环和诊断链路。

## 小结

当前工具体系的核心结论是：

> **Agent 面前不再是 59 个内部工具，而是 6 个 V2 语义工具；复杂度被收进 action、handler、context 和 router。**

`lib/tools/v2/` 负责 Agent 核心工具；`LightweightRouter + UnifiedToolCatalog` 负责平台表面；`lib/agent/` 负责选择工具、组织推理、记录记忆。三者的边界清楚以后，Alembic 的工具系统才真正从“工具集合”变成了“工具平台”。
