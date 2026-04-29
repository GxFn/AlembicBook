# 工具体系与记忆系统

> 工具系统已经从 `lib/agent/tools` 拆成独立的 `lib/tools/` 子系统；记忆系统仍在 `lib/agent/memory` 中，为 Runtime 提供工作记忆、会话记忆和长期语义记忆。

## 问题场景

Agent 的 ReAct 循环需要调用工具：搜索知识、读源码、查 AST、提交知识、执行受治理的终端命令、加载 Skill、触发 Dashboard 操作。过去文档把这些都描述为“Agent 内部 60 个 Tool”。当前实现已经更清晰：

- `lib/tools/handlers/` 中有 **59 个内部工具定义**，供 Runtime 通过 internal adapter 调用。
- `lib/external/mcp/tools.ts` 暴露 **19 个 MCP 工具**，供 IDE Agent 调用。
- 终端、Skill、macOS、Dashboard、Workflow 都作为不同 `CapabilityKind` 接入 ToolRouter。
- Runtime 不直接执行 handler，而是通过 `ToolRouter` 走统一治理。

因此现在的工具系统不是一个注册表加 handler，而是：

```text
Capability / ActionSpace
  → CapabilityCatalog.toToolSchemas(ids)
  → LLM function calls
  → AgentRuntime ToolExecutionPipeline
  → ToolRouter
    → GovernanceEngine
    → Adapter
    → ToolResultEnvelope
```

## 目录边界

当前 `lib/tools/` 分层如下：

```text
lib/tools/
├── catalog/
│   ├── ToolRegistry.ts          # 内部工具 handler 存储，不再承担统一治理
│   ├── CapabilityCatalog.ts     # capability manifest 查询与 schema 投影
│   ├── CapabilityManifest.ts    # 风险、执行、治理、信任等 manifest 类型
│   └── CapabilityProjection.ts  # 从 ToolDefinition 推导 ToolCapabilityManifest
├── core/
│   ├── ToolRouter.ts            # 统一执行入口
│   ├── GovernanceEngine.ts      # discover / plan / approve / execute 决策
│   ├── ToolContracts.ts         # ToolCallRequest / Adapter contract
│   ├── ToolResultEnvelope.ts    # 统一结果信封
│   └── Tool*Services.ts         # 传给 handler 的服务契约
├── handlers/                    # 59 个内部工具定义
├── adapters/
│   ├── InternalToolAdapter.ts
│   ├── DashboardOperationAdapter.ts
│   ├── TerminalAdapter.ts
│   ├── SkillAdapter.ts
│   ├── MacSystemAdapter.ts
│   └── WorkflowAdapter.ts
└── workflow/WorkflowRegistry.ts
```

工具已经成为独立平台层。Agent 只是它的一个调用表面。

## ToolRegistry 的新角色

`ToolRegistry` 仍然存在，但职责收窄：

- 注册 `ToolDefinition`。
- 暴露 `getInternalTool(name)` 给 `InternalToolAdapter`。
- 存储 ToolForge 投影出来的临时内部工具。
- 保存 `ToolRouter` 引用，方便 RuntimeBuilder 获取。

它不再负责参数归一化、安全治理、surface 判断、Gateway 权限或结果信封。这些都已迁到 ToolRouter 体系。

```typescript
class ToolRegistry implements InternalToolHandlerStore, ForgedInternalToolStore {
  register(toolDef: ToolDefinition): void
  registerAll(defs: ToolDefinition[]): void
  getInternalTool(name: string): InternalToolHandlerEntry | null
  projectForgedTool(tool: ForgedInternalToolDefinition): void
  revokeForgedTool(name: string): boolean
  setRouter(router: ToolRouterContract | null): void
  getRouter(): ToolRouterContract | null
}
```

`AgentModule` 初始化时会：

1. 创建 `CapabilityCatalog`，合并内部工具、Dashboard 操作、Terminal、Skill、macOS manifest。
2. 创建 `ToolRegistry` 并注册 `ALL_TOOLS`。
3. 创建 `ToolRouter`，挂载多个 Adapter。
4. 把 router 设置回 registry。

## Capability Manifest

每个可执行能力都投影成 `ToolCapabilityManifest`：

| 区域 | 内容 |
|:---|:---|
| 基础信息 | `id`、`title`、`kind`、`description`、`owner`、`lifecycle`、`surfaces` |
| 输入输出 | `inputSchema`、`outputSchema`、examples、failureModes |
| 风险画像 | sideEffect、dataAccess、writeScope、network、credentialAccess、confirmation、OWASP tags |
| 执行画像 | adapter、timeoutMs、maxOutputBytes、abortMode、cachePolicy、concurrency、artifactMode |
| 治理画像 | gatewayAction、auditLevel、policyProfile、approvalPolicy、allowedRoles、composer/remote/nonInteractive |
| 外部信任 | MCP、Skill、macOS 等外部来源的 trust profile |

`CapabilityProjection.ts` 会从内部工具的 metadata 推导 manifest：

- 只读工具默认 `policyProfile: read`，可 session cache，并行安全。
- 副作用工具默认 `policyProfile: write`，需要完整审计，单工具并发。
- `rebuild_index`、`bootstrap_knowledge` 这类工具提升到 admin。
- side-effect 且没有明确治理策略会 fail closed。

## ToolRouter

`ToolRouter.execute(request)` 是统一执行入口。它的流程是：

```text
1. catalog.getManifest(toolId)
2. normalizeRequestArgs(args, manifest.inputSchema)
3. governance.decide(request, manifest)
4. adapter.preview() 补充执行预览
5. 不允许 / 需确认 / 无 manifest → 返回 blocked 或 needs-confirmation envelope
6. 命中 cache → 返回 cached envelope
7. acquireConcurrencySlot()
8. createExecutionSignalScope()
9. adapter.execute()
10. timeout / cache write / diagnostics record / release
```

统一路由带来三个工程收益：

- **surface 一致**：Runtime、MCP、Dashboard、Skill 都走相同的 manifest 和治理字段。
- **结果一致**：所有工具都返回 `ToolResultEnvelope`，Runtime 不用猜测 handler 返回结构。
- **安全一致**：Gateway、Policy、角色、确认、超时、并发、外部信任都在同一处处理。

## GovernanceEngine

GovernanceEngine 分四步：

| 阶段 | 检查 |
|:---|:---|
| discover | capability 是否存在、是否 disabled、当前 surface 是否暴露 |
| plan | input schema 是否存在、参数是否通过 schema 校验 |
| approve | 角色、Runtime Policy、side-effect fail-closed、确认策略、Gateway checkOnly |
| execute | abortSignal 是否已触发 |

Runtime 的 `SafetyPolicy` 会作为 `request.runtime.policyValidator` 传入 approve 阶段。MCP/HTTP/Dashboard surface 会额外检查 allowedRoles 和 Gateway mapping。

## Adapter

当前 Adapter 代表不同执行后端：

| Adapter | kind | 说明 |
|:---|:---|:---|
| `InternalToolAdapter` | `internal-tool` | 执行 `lib/tools/handlers` 中的内部 handler |
| `DashboardOperationAdapter` | `dashboard-operation` | 执行 Dashboard 操作，例如 bootstrap/rescan/cancel |
| `TerminalAdapter` | `terminal-profile` | 执行结构化终端命令、脚本、shell、PTY、session 管理 |
| `SkillAdapter` | `skill` | 搜索、加载、校验 Skill 文档和资源 |
| `MacSystemAdapter` | `macos-adapter` | 本机 macOS 信息、权限状态、窗口列表、截图 |
| `WorkflowAdapter` | `workflow` | 执行注册到 `WorkflowRegistry` 的 workflow |
| `McpToolAdapter` | `mcp-tool` | MCP Server 内部用于把 MCP tool handler 接入 ToolRouter |

终端执行是这次拆分里变化最大的部分。旧的 `run_safe_command` 被拆成：

- `terminal_run`：结构化 `{ bin, args }`。
- `terminal_script`：非交互 `/bin/sh` 脚本，脚本写入 artifact，默认需要确认。
- `terminal_shell`：受治理的 `/bin/sh -lc` 命令字符串。
- `terminal_pty`：一次性 PTY transcript，适合需要伪终端行为的命令。
- `terminal_session_status` / `terminal_session_close` / `terminal_session_cleanup`：session metadata 管理。

TerminalAdapter 在 preview 阶段就会用 terminal policy 评估风险，执行阶段再走 `TerminalExecutors`。

## Runtime ToolExecutionPipeline

Agent Runtime 中仍有一条轻量中间件管线：

| 中间件 | 当前职责 |
|:---|:---|
| `allowlistGate` | 检查工具是否在当前 Capability / ActionSpace 白名单中；ToolForge 临时工具可放行 |
| `observationRecord` | 写入 MemoryCoordinator observation |
| `trackerSignal` | 调用 ExplorationTracker 记录工具信号 |
| `traceRecord` | 写入 ActiveContext action/observation |
| `submitDedup` | 对 `submit_knowledge` / `submit_with_check` 做标题、trigger、模式指纹去重 |

旧文档中的 SafetyGate 已经迁到 ToolRouter/GovernanceEngine；CacheCheck 也以 envelope cache 信息表达。

## ToolResultEnvelope

所有 Adapter 都返回同一种信封：

```typescript
interface ToolResultEnvelope<T = unknown> {
  ok: boolean;
  toolId: string;
  callId: string;
  parentCallId?: string;
  startedAt: string;
  durationMs: number;
  status: 'success' | 'error' | 'blocked' | 'aborted' | 'timeout' | 'needs-confirmation';
  text: string;
  structuredContent?: T;
  artifacts?: ToolArtifactRef[];
  resources?: ToolResourceRef[];
  cache?: ToolResultCacheInfo;
  diagnostics: ToolResultDiagnostics;
  trust: ToolResultTrust;
  nextActionHint?: string;
}
```

Runtime 使用 `structuredContent` 给 LLM；MCP Server 把 envelope 序列化成 MCP text content；DiagnosticsCollector 记录 envelope 元数据。

## MCP 工具

`lib/external/mcp/tools.ts` 当前声明 19 个 MCP 工具：

| 层级 | 工具 |
|:---|:---|
| Agent | `alembic_health`、`alembic_search`、`alembic_knowledge`、`alembic_structure`、`alembic_graph`、`alembic_call_context`、`alembic_guard` |
| Agent 写入/工作流 | `alembic_submit_knowledge`、`alembic_skill`、`alembic_bootstrap`、`alembic_rescan`、`alembic_evolve`、`alembic_consolidate`、`alembic_dimension_complete`、`alembic_wiki`、`alembic_panorama`、`alembic_task` |
| Admin | `alembic_enrich_candidates`、`alembic_knowledge_lifecycle` |

MCP Server 自身也通过 `ToolRouter` 执行这些工具，只是 adapter 是 `McpToolAdapter`，真正 handler 仍在 `lib/external/mcp/handlers/`。

## ToolForge

ToolForge 仍在 `lib/agent/forge`，但它现在投影到新的工具体系：

```text
ToolRequirementAnalyzer
  → Reuse / Compose / Generate
  → SandboxRunner 验证
  → TemporaryToolRegistry
  → ToolRegistry.projectForgedTool()
  → CapabilityCatalog / WorkflowRegistry 参与治理
```

生成出的临时工具不会绕过治理。`allowlistGate` 只对确认为 `TemporaryToolRegistry` 管理的动态工具放行；执行仍进入 ToolRouter。

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

Chat 场景更偏 PersistentMemory；分析阶段更偏 ActiveContext；生产阶段更偏 SessionStore。

## ExplorationTracker

ExplorationTracker 仍是系统任务的节奏控制器。它追踪：

- 当前 phase。
- 搜索轮数、提交数、连续空闲轮数。
- uniqueFiles、uniquePatterns、uniqueQueries。
- Nudge 和 toolChoice。

`SignalDetector` 从工具调用结果里判断是否产生新信息；`NudgeGenerator` 在预算紧张、信息饱和或需要强制退出时生成提示。

## 权衡

工具拆分的代价是概念更多：ToolRegistry、CapabilityCatalog、ToolRouter、GovernanceEngine、Adapter、Envelope 都要理解。收益是更大的：

1. **治理集中**：所有 surface 共用 manifest 与 governance。
2. **结果标准化**：Runtime、MCP、Dashboard 不再各自处理返回格式。
3. **扩展更干净**：新增终端、Skill、macOS、Workflow 能力时，不必塞进 AgentRuntime。
4. **安全边界更清楚**：Runtime 白名单管“当前 Agent 能不能用”，ToolRouter 管“这个能力能不能执行”。

## 小结

当前工具体系的核心结论是：

> **工具不再属于 Agent；Agent 只是 ToolRouter 的一个调用者。**

`lib/tools/` 负责工具注册、manifest、治理、adapter 和结果信封。`lib/agent/` 负责选择工具、组织推理、记录记忆。两者通过 Capability 白名单和 ToolRouter 连接。
