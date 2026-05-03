# Agent 子系统 — Profile 驱动的 ReAct 执行层

> Alembic 的 AI 中枢已经不再是一个孤立的 `AgentRuntime` 文件，而是 `lib/agent/` 下的完整子系统：入口服务、Profile 编译、并发协调、运行时循环、策略、策略门控、记忆与上下文一起构成执行层。
>
> **相关章节**：工具执行见 [ch15](./ch15-tools-memory)，Capability/Strategy/Policy 的组合见 [ch14](./ch14-orthogonal)，冷启动与重扫工作流见 [ch09](../part4/ch09-bootstrap)。

## 问题场景

用户说“分析这个模块的设计模式”。这不是一次 LLM 调用能稳定完成的事情。Agent 要先搜索知识库，再读取源码，必要时查询 AST、代码实体图和调用图，最后把发现整理成回答或结构化知识。

过去书里把这条路径简化成“Preset → AgentRuntime”。现在代码实现已经拆成了更清晰的服务化链路：

```text
AgentRunInput
  → AgentService.run()
  → AgentProfileCompiler.compile()
  → AgentRunCoordinator.run()       # 可选：并发/分层拆分
  → AgentRuntimeBuilder.build()
  → AgentRuntime.execute()
  → Strategy.execute()
  → AgentRuntime.reactLoop()
  → ToolExecutionPipeline
  → V2ToolRouterAdapter
```

这个拆分的意义是把“运行一个 Agent”从单类职责拆成四层：

| 层级 | 代表文件 | 职责 |
|:---|:---|:---|
| 服务入口 | `lib/agent/service/AgentService.ts` | 接收统一 `AgentRunInput`，编译 Profile，构建 Runtime，归一化结果 |
| 配置编译 | `lib/agent/profiles/AgentProfileCompiler.ts` | 把 Profile 引用、覆盖项和内置定义编译成 `CompiledAgentProfile` |
| 并发协调 | `lib/agent/coordination/AgentRunCoordinator.ts` | 按 Profile 的 `concurrency` 计划拆分子任务、分层执行、合并结果 |
| Runtime 内核 | `lib/agent/runtime/AgentRuntime.ts` | 承载 ReAct 循环、Policy 校验、消息压缩、工具调用和错误恢复 |

`AgentRuntime` 仍然是大脑，但它现在只负责“怎么执行一轮认知循环”。“跑哪个 Profile”“是否拆成多个维度”“阶段怎么生成”这些问题都被移到了 `service/`、`profiles/` 和 `coordination/`。

## 目录边界

当前 `lib/agent/` 的边界如下：

```text
lib/agent/
├── service/        AgentService、AgentRuntimeBuilder、AgentRunContracts
├── profiles/       ProfileRegistry、ProfileCompiler、StageFactoryRegistry、内置 profile 定义
├── coordination/   AgentRunCoordinator，处理 tiered/parallel 子任务
├── runtime/        AgentRuntime、LoopContext、MessageAdapter、SystemPromptBuilder、ToolExecutionPipeline
├── strategies/     Single、Pipeline、FanOut、Adaptive
├── policies/       BudgetPolicy、SafetyPolicy、QualityGatePolicy、PolicyEngine
├── capabilities/   Conversation、CodeAnalysis、KnowledgeProduction、ScanProduction、SystemInteraction、EvolutionAnalysis
├── context/        ContextWindow、ExplorationTracker、NudgeGenerator、SignalDetector
├── memory/         ActiveContext、SessionStore、PersistentMemory、MemoryCoordinator 等
├── runs/           scan、translation、relation、evolution 等特定运行封装
├── forge/          ToolForge、DynamicComposer、TemporaryToolRegistry、SandboxRunner
└── prompts/        insight / scan / evolution 阶段提示词构造器
```

这说明一个关键变化：Agent 不再等同于 Runtime。`Runtime` 是执行引擎，`Profile` 是运行说明书，`AgentService` 是统一入口，`AgentRunCoordinator` 是并发编排层。

## CoALA 映射

AgentRuntime 仍然遵循 CoALA 的五阶段认知模型，但组件映射已经更新：

| CoALA 阶段 | 当前组件 | 职责 |
|:---|:---|:---|
| Perception | `AgentMessage` + `AgentService.buildAgentMessage()` | 统一 HTTP/MCP/Lark/内部工作流输入 |
| Working Memory | `LoopContext` + `MessageAdapter` + `ContextWindow` + `ActiveContext` | 保存消息历史、压缩上下文、记录推理链 |
| Reasoning | `SystemPromptBuilder` + `aiProvider.chatWithTools()` | 构建系统提示词，调用 LLM 决策下一步 |
| Action | `ToolExecutionPipeline` + `V2ToolRouterAdapter` | 先做 runtime 白名单与观察记录，再进入 V2 工具路由 |
| Reflection | `ExplorationTracker` + `MemoryCoordinator` + `PolicyEngine` | 收集信号、阶段转换、记忆注入、质量约束 |

旧文档里写的是 `ToolExecutionPipeline + ToolRegistry`。现在 Runtime 实际调用的是 `V2ToolRouterAdapter.execute()`：LLM 看到 `code`、`terminal`、`knowledge`、`graph`、`memory`、`meta` 6 个 V2 工具，具体操作放在 `action` 字段里。MCP、Dashboard、Skill 等外部表面不走这 6 个工具名，而是通过 `LightweightRouter` 和各自 adapter 执行。

## 入口：AgentService

`AgentService.run(input)` 是新入口。它接收的是结构化 `AgentRunInput`，而不是直接的字符串 prompt：

```typescript
interface AgentRunInput {
  profile: AgentProfileRef | AgentProfileOverride;
  message: {
    content: string;
    role?: 'user' | 'system' | 'internal';
    history?: Array<{ role: string; content: string }>;
    metadata?: Record<string, unknown>;
    sessionId?: string;
  };
  params?: Record<string, unknown>;
  context: {
    source: 'http-chat' | 'http-stream' | 'lark' | 'bootstrap' | 'system-workflow' | 'mcp' | 'internal';
    runtimeSource?: 'user' | 'system' | 'analyst' | 'producer' | 'remote';
    strategyContext?: Record<string, unknown>;
    memoryCoordinator?: unknown;
    contextWindow?: unknown;
    trace?: unknown;
    sharedState?: Record<string, unknown>;
    childContexts?: Record<string, Partial<AgentRunContext>>;
    childInputFactories?: Record<string, AgentChildInputFactory>;
    coordination?: AgentRunCoordinationHooks;
  };
  execution?: {
    abortSignal?: AbortSignal;
    shouldAbort?: () => boolean | Promise<boolean>;
    budgetOverride?: Record<string, unknown>;
    toolChoiceOverride?: 'auto' | 'required' | 'none';
    onProgress?: (event: ProgressEvent) => void;
    onToolCall?: ToolCallHook;
  };
}
```

入口层做三件事：

1. **编译 Profile**：`AgentProfileCompiler` 把 profile 引用、覆盖项、内置定义和运行参数合并成 `CompiledAgentProfile`。
2. **协调并发**：如果 Profile 声明了 `concurrency`，交给 `AgentRunCoordinator` 拆分子任务。
3. **构建 Runtime**：`AgentRuntimeBuilder` 根据编译后的 Profile 创建 `AgentRuntime`，然后执行。

这让不同调用方可以复用同一个入口。Dashboard Chat、Lark、内部冷启动、重扫、扫描、翻译、关系发现都可以表达为 `AgentRunInput`。

## Profile 编译

Profile 是当前 Agent 子系统的核心配置单位。内置定义在 `lib/agent/profiles/definitions/`：

| Profile | basePreset | 策略 | 用途 |
|:---|:---|:---|:---|
| `chat-default` | `chat` | preset single | Dashboard 默认对话 |
| `lark-chat` | `lark` | preset single | 飞书知识问答 |
| `remote-exec` | `remote-exec` | preset single | 远程执行 |
| `scan-extract` / `scan-summarize` | `insight` | `scanPipeline` | 扫描模式知识提取或总结 |
| `relation-discovery` | `insight` | `relationsPipeline` | 知识关系发现 |
| `evolution-audit` | `evolution` | preset pipeline | Recipe 进化审计 |
| `translation-json` | `chat` | single | 技术文档 JSON 翻译 |
| `signal-analysis` | `chat` | single | 后台信号分析 |
| `bootstrap-session` | `insight` | service-level fanout | 冷启动维度会话 |
| `bootstrap-dimension` | `insight` | `bootstrapDimensionPipeline` | 单维度分析与生产 |

`AgentProfileCompiler` 有三种输入路径：

- `AgentProfileRef`：按 `id` 查内置 Profile；找不到时退回为 preset 引用。
- `AgentProfileOverride`：基于某个 `basePreset` 临时覆盖 skills、strategy、policies、persona、memory、actionSpace。
- `CompiledAgentProfile`：已经编译好的 Profile，直接透传。

编译结果除了 basePreset，还包含 `actionSpace`、`additionalTools`、`runtimeOverrides`、`projection`、`concurrency` 等信息。也就是说，Profile 不只是 Preset 名字，而是一份完整的运行计划。

## 并发协调：AgentRunCoordinator

旧章节把冷启动并发写成 `FanOutStrategy`。当前代码里，`bootstrap-session` 的并发主要由 `AgentRunCoordinator` 处理，而不是直接走 runtime 内的 `FanOutStrategy`。

`bootstrap-session` 的 Profile 声明：

```typescript
concurrency: {
  mode: 'tiered',
  concurrency: { env: 'ALEMBIC_BOOTSTRAP_CONCURRENCY', default: 2 },
  partitioner: 'bootstrapSessionDimensions',
  childProfile: 'bootstrap-dimension',
  merge: 'bootstrapSessionResults',
  abortPolicy: 'finish-tier',
}
```

`AgentRunCoordinator` 做的事情是：

1. 用 `bootstrapSessionDimensions` 把父输入里的 `params.dimensions` 拆成多个子 `AgentRunInput`。
2. 每个子任务指定 `bootstrap-dimension` Profile，并把 `dimId`、tier、promptContext 注入进去。
3. 如果模式是 `tiered`，先按 tier 分组，再按并发度逐层执行。
4. 支持 `shouldAbort` 和 `abortSignal`，在父任务取消时停止启动新子任务。
5. 每个子任务完成后触发 `onChildResult`，每个 tier 完成后触发 `onTierComplete`。
6. 用 `bootstrapSessionResults` 把子结果合并为父结果。

`FanOutStrategy` 仍然存在，作为 Runtime 策略的一种；但冷启动 Profile 的主并发边界已经上移到服务层。这一点是当前架构最重要的变化之一。

## RuntimeBuilder

`AgentRuntimeBuilder` 把编译后的 Profile 展开为 Runtime 构造参数：

```typescript
const preset = getPreset(presetName, overrides);
const capabilities = preset.capabilities.map((name) =>
  CapabilityRegistry.create(name, capabilityOpts)
);
const policies = preset.policies.map((policyOrFactory) =>
  typeof policyOrFactory === 'function' ? policyOrFactory(overrides) : policyOrFactory
);

return new AgentRuntime({
  presetName,
  aiProvider,
  toolRegistry,
  toolRouter: toolRegistry.getRouter(),
  container,
  capabilities,
  strategy: preset.strategyInstance,
  policies: new PolicyEngine(policies),
  persona,
  memory,
  additionalTools,
  projectRoot,
});
```

两个细节值得注意：

- Runtime **必须有 toolRouter**。当前 AgentModule 注入的是 `V2ToolRouterAdapter`；如果缺失，构造阶段直接抛错。
- `actionSpace.mode === 'listed'` 会变成 `additionalTools`，在不污染 Capability 的前提下给某个 Profile 临时开放额外工具。

## ReAct 循环

`AgentRuntime.reactLoop()` 已经被拆成多个私有阶段方法，主循环只保留编排骨架：

```text
#initLoop()
  → while true
    → ctx.iteration++
    → trace.startRound()
    → #shouldExit()
    → #prepareIteration()
    → #callLLM()
    → #processToolCalls() 或 #processTextResponse()
  → #finalize()
```

`LoopContext` 封装了原本散落在循环里的局部变量：

| 字段 | 用途 |
|:---|:---|
| `messages` | 统一消息适配器，背后可接 `ContextWindow` |
| `tracker` | ExplorationTracker，管理阶段、Nudge、退出条件 |
| `trace` | ActiveContext，记录 thought/action/observation |
| `memoryCoordinator` | 记录观察、构建动态记忆提示 |
| `sharedState` | 跨阶段去重与维度上下文，例如 submittedTitles、_dimensionMeta |
| `budget` | maxIterations、maxTokens、temperature、timeoutMs |
| `allowedToolIds` | 当前 loop 的工具白名单 |
| `toolSchemas` | 从 `V2CapabilityCatalog.toToolSchemas(ids)` 投影出的 LLM 工具定义 |
| `abortSignal` | 上游取消信号，贯穿 LLM 与工具执行 |
| `diagnostics` | 阶段工具集、拦截工具、AI 错误、超时等诊断 |

`SystemPromptBuilder` 负责组装 persona、fileCache、Capability prompt fragment、动态上下文和语言偏好。系统场景还会根据预算注入“轮次预算”。

## 工具执行

Runtime 内的 `ToolExecutionPipeline` 现在只做 Runtime 横切关注点：

```text
allowlistGate
  → runtime.toolRouter.execute()
  → observationRecord
  → trackerSignal
  → traceRecord
  → submitDedup
```

默认管线不再包含旧文档中的 `SafetyGate` 和 `CacheCheck`。V2 中，参数校验和并发控制在 `ToolRouterV2`；命令安全、cwd 约束和 sandbox 在 `terminal.exec` handler；搜索/读取缓存由 `DeltaCache`、`SearchCache` 和 `ToolResultMeta.cached` 表达。`V2ToolRouterAdapter` 再把这些结果包装成 Runtime 兼容的 `ToolResultEnvelope`。

Runtime 在调用 `V2ToolRouterAdapter` 时会传入完整的运行时上下文：

- `surface: 'runtime'`
- `actor: { role: 'runtime', user: runtime.id }`
- `source.name`: 当前 pipeline phase 或 preset
- `policyValidator`: `PolicyEngine`
- `safetyPolicy`: 从 PolicyEngine 中取出的 `SafetyPolicy`
- `fileCache`、`dataRoot`、`lang`、`aiProvider`
- `submittedTitles`、`submittedPatterns`、`submittedTriggers`
- `bootstrapDedup`、`dimensionScopeId`、`terminalTest` 等工作流上下文

因此 Runtime 不再自己执行 handler，也不再维护一套独立工具缓存。Runtime 只保留“当前阶段允许调用哪些工具名”的白名单；具体 action、参数、并发和输出预算交给 V2 工具层处理。

## Strategy

当前内置策略仍然是四类：

| Strategy | 文件 | 职责 |
|:---|:---|:---|
| `SingleStrategy` | `lib/agent/strategies/SingleStrategy.ts` | 直接调用一次 `runtime.reactLoop()` |
| `PipelineStrategy` | `lib/agent/strategies/PipelineStrategy.ts` | 顺序执行多阶段，每阶段可有 Capability、Prompt、预算、Gate |
| `FanOutStrategy` | `lib/agent/strategies/FanOutStrategy.ts` | Runtime 内部的 item fan-out，仍可用于配置化扇出 |
| `AdaptiveStrategy` | `lib/agent/strategies/AdaptiveStrategy.ts` | 在 single/pipeline/fanout 之间做组合选择 |

`PipelineStrategy` 是知识生产的核心。它支持：

- 每个 stage 独立 `capabilities`、`additionalTools`、`budget`、`systemPrompt`。
- `promptBuilder(ctx)` 从 `strategyContext` 构建阶段提示。
- Gate evaluator 返回 `pass` / `retry` / `degrade`。
- Gate retry 时回退到上一阶段。
- 每个阶段隔离 `ContextWindow` 和 `ExplorationTracker`。
- `AbortSignal` 和 hard timeout 贯穿阶段执行。

Profile 的 StageFactory 会按场景生成阶段。例如 `bootstrapDimensionPipeline` 会复用 `insight` 的 analyze / quality_gate / produce / rejection_gate，并在重扫场景插入 evolution pass。

## 错误恢复

Runtime 仍保留几类引擎级恢复机制：

| 机制 | 当前行为 |
|:---|:---|
| Policy 前置拒绝 | `execute()` 开始前调用 `validateBefore`，失败则返回 diagnostics |
| 全局超时 | `execute()` 创建 `AbortController`，与父级 abort 联动，并用 `Promise.race` 包住 Strategy |
| 阶段超时 | `PipelineStrategy` 的 stage budget 通过 `budgetOverride.timeoutMs` 控制 |
| LLM 错误 | 连续错误计数，AbortError 不计入普通错误 |
| 空响应 | 系统源允许有限重试，用户源更快退出 |
| SUMMARIZE | `toolChoice = 'none'`，并对仍返回工具调用的情况做兜底 |
| 强制总结 | 信息不足或熔断时用 `forced-summary.ts` 合成收尾 |

`DiagnosticsCollector` 贯穿入口、Runtime 和工具层，记录 stage toolset、blocked tool、AI error、empty response、timeout、gate failure 和 tool envelope。它是现在排查 Agent 行为的主渠道。

## 运行时行为

### Chat

```text
AgentService.run(chat-default)
  → compile basePreset=chat
  → RuntimeBuilder(capabilities: conversation + code_analysis)
  → SingleStrategy
  → reactLoop()
  → V2ToolRouterAdapter(runtime surface)
```

Chat 的 `source` 会被映射成 `user`，空响应和错误恢复更保守，预算默认 8 轮 / 120 秒。

### Bootstrap Dimension

```text
AgentService.run(bootstrap-session)
  → AgentRunCoordinator tiered fanout
  → child profile: bootstrap-dimension
  → StageFactory: bootstrapDimensionPipeline
  → PipelineStrategy
  → analyze → quality_gate → produce → rejection_gate
```

冷启动并发不在 Runtime 里硬编码，而是 Profile + Coordinator 声明式控制。单维度仍然使用 Runtime 的 PipelineStrategy。

### Rescan Dimension

重扫会在 `bootstrapDimensionPipeline` 中根据 `hasExistingRecipes` 和 `prescreenDone` 决定是否插入 evolution 阶段：

```text
evolve → evolution_gate → analyze → quality_gate → produce → rejection_gate
```

这样同一个 `bootstrap-dimension` Profile 可以服务冷启动和知识重扫，只是上下文不同。

## 权衡

这次拆分增加了间接层，但换来了三个好处：

1. **入口统一**：不同调用方都表达为 `AgentRunInput`，不需要各自 new Runtime。
2. **Profile 可治理**：运行形态可以序列化、注册、编译、覆盖，适合工作流复用。
3. **并发上移**：冷启动这种“父任务拆子任务”的逻辑放在服务层，Runtime 专注执行单个认知循环。

代价是阅读链路变长。调试一个 Agent 需要依次看 Profile 定义、ProfileCompiler、StageFactory、Coordinator、RuntimeBuilder、Strategy 和 Runtime。但这些边界与代码实现一致，问题定位反而更精确。

## 小结

当前 Agent 子系统的核心结论不是“一个 AgentRuntime 统治所有场景”，而是：

> **Agent 是 Profile 驱动的服务化运行单元；Runtime 是执行内核，不是全部架构。**

`AgentService` 负责入口，`AgentProfileCompiler` 负责配置归一，`AgentRunCoordinator` 负责并发拆分，`AgentRuntimeBuilder` 负责装配，`AgentRuntime` 负责 ReAct 循环，`V2ToolRouterAdapter + ToolRouterV2` 负责 Agent 工具执行。这个分层就是当前 `lib/agent/` 的真实结构。

::: tip 下一章
[正交组合 — Capability × Strategy × Policy](./ch14-orthogonal)
:::
