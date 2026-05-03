# 正交组合 — Profile × Capability × Strategy × Policy

> Agent 不是子类，而是一份可编译的运行说明书。当前实现里，Profile 把 Capability、Strategy、Policy、ActionSpace 和并发计划包装成可复用的执行单元。

## 问题场景

一个知识引擎需要很多 Agent 行为：聊天问答、代码分析、知识提取、冷启动维度填充、重扫进化审计、飞书消息处理、远程执行、扫描总结、关系发现、翻译。

如果用继承建模，很快会出现 `ChatAgent`、`BootstrapAgent`、`EvolutionAgent`、`RemoteExecAgent`、`ScanAgent` 等一串子类。更麻烦的是，冷启动和重扫都需要“多维度并发 + 单维度流水线”，聊天需要“单循环”，翻译需要“一轮 JSON 输出”。这些差异不是类型差异，而是配置差异。

当前代码的解法是：

```text
AgentRun = Profile(
  basePreset,
  Capability[],
  Strategy,
  Policy[],
  ActionSpace,
  ConcurrencyPlan
)
```

![Profile × Capability × Strategy × Policy 正交组合](/images/ch14/01-orthogonal-cube.png)

`AgentRuntime` 不关心自己是 Chat、Bootstrap 还是 Rescan。它只接收已经展开好的 Capability、Strategy 和 Policy，然后执行。

## Profile 是组合边界

旧章节以 Preset 为核心。现在 Preset 仍然存在，但它是 Runtime 默认组合；真正的上层组合单位是 Profile。

| 概念 | 文件 | 职责 |
|:---|:---|:---|
| Preset | `lib/agent/profiles/presets.ts` | 定义基础 Runtime 组合，例如 `chat`、`insight`、`evolution` |
| Profile Definition | `lib/agent/profiles/definitions/*.profile.ts` | 定义可复用运行任务，例如 `bootstrap-session`、`scan-extract` |
| Profile Compiler | `lib/agent/profiles/AgentProfileCompiler.ts` | 将 Profile 引用或覆盖项编译成 `CompiledAgentProfile` |
| Stage Factory | `lib/agent/profiles/AgentStageFactoryRegistry.ts` | 按场景生成 Pipeline stage |
| Runtime Builder | `lib/agent/service/AgentRuntimeBuilder.ts` | 把编译结果展开成 Runtime |

Preset 回答“Runtime 的默认人格、能力、策略、预算是什么”。Profile 回答“这次系统任务要怎么使用这些默认值”。

## 内置 Preset

当前内置 Preset 有五个：

| Preset | Capability | Strategy | Policy | 场景 |
|:---|:---|:---|:---|:---|
| `chat` | `conversation` + `code_analysis` | `SingleStrategy` | Budget 8 轮 / 120s | Dashboard 对话 |
| `insight` | `code_analysis` + `knowledge_production` | `PipelineStrategy` | Budget 24 轮 / 3600s + QualityGate | 深度分析与知识生产 |
| `evolution` | `evolution_analysis` | `PipelineStrategy` | Budget 16 轮 / 180s | Recipe 进化决策 |
| `lark` | `conversation` + `code_analysis` | `SingleStrategy` | Budget + Safety sender allowlist | 飞书入口 |
| `remote-exec` | `conversation` + `code_analysis` + `system_interaction` | `SingleStrategy` | Budget + Safety | 远程执行 |

`getPreset(name, overrides)` 会合并覆盖项并把声明式 Strategy 解析成 Strategy 实例。Profile 编译器可以通过 `runtimeOverrides` 覆盖 Preset 的 capabilities、strategy、policies、persona 和 memory。

## 内置 Profile

Profile 定义在 `lib/agent/profiles/definitions/`，它们是业务运行形态，而不是 Runtime 类型：

| Profile | 运行形态 |
|:---|:---|
| `chat-default` | 使用 `chat` Preset，返回 `chat-reply` |
| `lark-chat` | 使用 `lark` Preset，返回 `chat-reply` |
| `remote-exec` | 使用 `remote-exec` Preset |
| `scan-extract` | 使用 `insight` Preset + `scanPipeline` |
| `scan-summarize` | 使用 `insight` Preset + `scanPipeline`，默认 task 为 summarize |
| `relation-discovery` | 使用 `insight` Preset + `relationsPipeline` |
| `evolution-audit` | 使用 `evolution` Preset，并按 recipes 数量动态调整预算 |
| `translation-json` | 使用 `chat` Preset，但一轮 JSON 翻译，无记忆 |
| `signal-analysis` | 使用 `chat` Preset 的 single 策略，无工具 action space |
| `bootstrap-session` | 父 Profile，声明 tiered concurrency，拆成多个 `bootstrap-dimension` |
| `bootstrap-dimension` | 子 Profile，使用 `bootstrapDimensionPipeline` |

这让系统可以新增一种运行形态而不新增 Agent 子类。

## Capability

Capability 仍然回答“能做什么”。基类在 `lib/agent/capabilities/Capability.ts`：

```typescript
class Capability {
  get name(): string
  get promptFragment(): string
  get tools(): string[]
  buildContext(context: unknown): string | null
  onBeforeStep(stepState: unknown): void
  onAfterStep(stepResult: unknown): void
}
```

当前 Capability 已迁到 V2 工具模型。每个 Capability 声明的是 `tool → action[]`，而不是一串平铺工具名：

| Capability | 主要工具 |
|:---|:---|
| `conversation` | `code.search/read/outline/structure`、`knowledge.search/detail/submit`、`graph.overview/query`、`memory.save/recall`、`meta.tools` |
| `code_analysis` | `code.search/read/outline/structure`、`terminal.exec`、`graph.overview/query`、`memory.save/recall/note_finding/get_previous_evidence`、`meta.plan` |
| `knowledge_production` | `code.read`、`knowledge.submit`、`memory.recall`、`meta.review` |
| `scan_analyze` | `code.search/read/outline`、`terminal.exec`、`knowledge.search`、`graph.query`、`memory.save/note_finding/get_previous_evidence` |
| `scan_production` | `code.read`、`knowledge.submit`、`memory.recall` |
| `system_interaction` | `code.search/read/outline/structure/write`、`terminal.exec`、`graph.overview`、`meta.tools` |
| `evolution_analysis` | `code.search/read`、`knowledge.search/detail/manage`、`graph.query` |

注意 `system_interaction` 已经不再使用旧的 `run_safe_command`，也不再把终端拆成多个 LLM 可见工具。Agent 侧统一调用 `terminal({ action: "exec", params: { command } })`；命令黑名单、cwd 约束、Seatbelt 沙箱和输出压缩在 `terminal` handler 与 `ToolContextFactory` 中处理。

Capability 只声明工具白名单和提示词，不执行工具逻辑。实际执行在 `lib/tools/`。

## Strategy

Strategy 回答“怎么组织工作”。

| Strategy | 当前用途 |
|:---|:---|
| `SingleStrategy` | Chat、Lark、Remote、Translation 这类单循环任务 |
| `PipelineStrategy` | Insight、Scan、Relation、Evolution、Bootstrap Dimension 等多阶段任务 |
| `FanOutStrategy` | Runtime 内部仍可用的 fan-out 组合策略 |
| `AdaptiveStrategy` | 在 single / pipeline / fanout 之间组合选择 |

现在要区分两种 fan-out：

- **Runtime Strategy fan-out**：`FanOutStrategy`，一个 Runtime 内部对 items 并发执行。
- **Service-level coordination**：`AgentRunCoordinator`，根据 Profile 的 `concurrency` 把一个父 `AgentRunInput` 拆成多个子 `AgentRunInput`。

冷启动的 `bootstrap-session` 当前使用第二种。它的并发计划在 Profile 中声明，而不是写死在 Strategy 里。

## Policy

Policy 回答“边界在哪”。

| Policy | 职责 |
|:---|:---|
| `BudgetPolicy` | maxIterations、maxTokens、temperature、timeoutMs |
| `SafetyPolicy` | sender allowlist、文件范围、命令安全等运行时约束 |
| `QualityGatePolicy` | 执行后检查证据长度、文件引用、工具调用数量 |
| `PolicyEngine` | 组合多个 Policy，并把 `SafetyPolicy` 等运行时约束透传给工具上下文 |

工具安全的职责已经分层：

```text
Runtime allowlistGate
  → V2ToolRouterAdapter
    → ToolRouterV2.parseToolCall()
    → validateParams()
    → concurrency lock
    → ToolContextFactory
    → action.handler()
```

因此 Policy 不再承担所有工具治理。Runtime 层用 `allowlistGate` 管“这个阶段能不能叫这个工具”；V2 Router 管“这个 action 参数是否合法、是否需要互斥、输出是否超预算”；MCP / Dashboard 等外部表面再通过 `LightweightRouter + manifest` 处理 Gateway、角色和外部信任。

## ActionSpace

Profile 还引入了 `actionSpace`：

```typescript
type AgentActionSpace =
  | { mode: 'none' }
  | { mode: 'listed'; toolIds: string[] }
  | { mode: 'all'; reason: string };
```

这解决了一个过去 Capability 难以表达的问题：某个任务只想临时开放一小组工具，但不想为此创建新的 Capability。`AgentProfileCompiler` 会把 `actionSpace.mode === 'listed'` 转成 `additionalTools`，由 Runtime 合并进白名单。

## StageFactory

`AgentStageFactoryRegistry` 把“阶段怎么生成”从 Preset 里提出来。目前内置三类：

| Factory | 产物 |
|:---|:---|
| `scanPipeline` | 按 extract/summarize 生成扫描分析与生产阶段 |
| `relationsPipeline` | 生成关系发现阶段 |
| `bootstrapDimensionPipeline` | 复用 insight/evolution preset 阶段，按 cold-start/rescan 上下文组合 |

`bootstrapDimensionPipeline` 会根据参数动态变化：

- `needsCandidates === false`：只跑 analyze。
- 没有已有 Recipe：`analyze → quality_gate → produce → rejection_gate`。
- 有已有 Recipe 且未 prescreen：`evolve → evolution_gate → analyze → quality_gate → produce → rejection_gate`。
- internal rescan 已完成 prescreen 时：不再插入 per-dimension evolve，运行 `analyze → quality_gate → produce → rejection_gate`，并把 Producer 的 `maxSubmits` / `softSubmitLimit` 设为 `rescanContext.gap`。

这就是当前“冷启动和增量重扫共用单维度执行 Profile”的关键：Profile 不变，StageFactory 按上下文改变阶段和预算。

## 组合示例

### Chat

```text
Profile: chat-default
basePreset: chat
Capability: conversation + code_analysis
Strategy: SingleStrategy
Policy: BudgetPolicy
ActionSpace: listed []
```

### Bootstrap Session

```text
Profile: bootstrap-session
basePreset: insight
actionSpace: none
concurrency:
  mode: tiered
  childProfile: bootstrap-dimension
  partitioner: bootstrapSessionDimensions
  merge: bootstrapSessionResults
```

### Bootstrap Dimension

```text
Profile: bootstrap-dimension
basePreset: insight
strategy:
  type: pipeline
  factory: bootstrapDimensionPipeline
```

### Evolution Audit

```text
Profile: evolution-audit
basePreset: evolution
skills: evolution_analysis
policy:
  maxIterations = min(recipes.length * 4 + 10, 120)
```

## 权衡

这个设计比“一个 Preset 直接 new 一个 Runtime”多了 Profile 编译层和并发协调层。代价是阅读路径变长。收益是：

1. **任务可注册**：系统任务不再散落在调用点，而是统一表达为 Profile。
2. **并发可声明**：父任务如何拆分、如何合并，可以由 Profile 描述。
3. **阶段可生成**：Pipeline 不必写死在 Preset 中，可以由 StageFactory 按上下文生成。
4. **工具可治理**：Capability 和 ActionSpace 共同决定白名单，V2 Router 统一执行 Agent 工具；MCP / Dashboard 等表面由 `LightweightRouter` 接入 manifest 治理。

## 小结

当前正交组合可以概括为：

> **Preset 是 Runtime 默认组合，Profile 是系统任务组合，AgentService 是执行入口。**

Capability、Strategy、Policy 仍然是核心三维，但它们现在被 Profile 包装，并由 `AgentProfileCompiler`、`AgentRunCoordinator` 和 `AgentRuntimeBuilder` 串成真实运行链路。

::: tip 下一章
[工具体系与记忆系统](./ch15-tools-memory)
:::
