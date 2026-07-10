# Ch13 Agent Runtime、Profiles、Tools 与评测

`@alembic/agent` 是 Alembic 自己的 AI/tool 执行 runtime。它不是 Codex 宿主 Agent，也不是 Core 的一部分；它为主 Alembic 的 provider-backed jobs、scan、evolution、relation、translation 等场景提供统一执行引擎。

这一章沿当前主链讲 Agent：Profile 经 AgentService 编译并构建 Runtime，ReAct 循环只通过 LLMGateway 调 provider、只通过 ToolRouter 执行工具；在线质量门与离线 mining eval 则分别回答“这次运行能否继续”和“系统长期表现是否可信”。

![AgentRuntime 执行循环图](/images/ch13/01-agentruntime-execution-loop.png)

## 本章回答

- AgentRuntime 为什么是单一执行引擎。
- Profile-driven run 与 host task handler 为什么不能混为一谈。
- Capability、Strategy、Policy、ToolRouter 在运行时中分别做什么。
- runtime tool registry 如何把 code、terminal、knowledge、graph、memory、meta、evidence 等能力结构化。
- 在线 deterministic gate 与离线 judge/calibration 有什么差别。
- Agent runtime 与 Codex host-agent workflow 有何不同。

## 主链从 Profile 进入 AgentService

当前内置 preset 是 `chat`、`insight`、`evolution`，不是旧 README 中的 `chat/bootstrap/scan`。`AlembicAgent/src/agent/service/AgentService.ts` 校验并编译 profile，再通过 Builder 构造 Runtime，并把成功与失败统一投影为结构化结果。

```text
Profile
  -> AgentService validation/compile
  -> Builder
  -> AgentRuntime + ReAct
  -> LLMGateway / ToolRouter
  -> structured run result
```

scan、module、plan、evolution、relation、translation 等 domain run 可以包装同一个 AgentService；`AgentTaskHandlers.ts` 则是另一类 host task handler，许多路径直接走 ToolRouter。两者共享能力不代表生命周期相同，书稿不能用“有 task handler”证明某个 profile run 已接线。

## 一个 Runtime，多种配置

`AgentRuntime.ts` 的设计意图是：不存在按任务复制的多套 runtime，只有由 Capability、Strategy 和 Policy 配置驱动的单一引擎。它是 ReAct 循环宿主、Capability 组合容器、Policy 执行者，并把具体推理策略委托给 Strategy。所有 provider 请求汇入 LLMGateway，所有工具调用汇入 ToolRouter，这两条单一出口才让可靠性、配额和审计可统一。

这个 runtime 具备一些引擎级能力：

- ContextWindow 三级递进压缩和 token 预算控制。
- ExplorationTracker、信号收集、nudge 和 graceful exit。
- AI 错误恢复、空响应重试、context reset 和 forced summary。
- circuit breaker 感知。
- 工具调用数量限制。
- submitted title/pattern 去重。
- final answer 清理。
- progress process events 和 PCV evidence 记录。

这些能力说明 AgentRuntime 不是一个简单 `provider.generate()` 包装，而是一个可审计的执行系统。

## Runtime 构造依赖

AgentRuntime 构造时需要 aiProvider、toolRegistry、toolRouter、capabilities、strategy、policies、persona、memoryConfig、projectRoot、dataRoot、modelRef 等。它会创建 ToolExecutionPipeline、HookSystem、SystemPromptBuilder 和 AgentState，并通过 AgentEventBus 发布生命周期事件。

缺少 ToolRouter 会直接抛错，因为运行时工具执行必须走统一 router path。这条边界很重要：Agent 的工具调用不能绕过 tool registry 和 policy，随意执行宿主代码。

## Runtime tool registry 是声明式工具目录

`AlembicAgent/src/tools/runtime/registry.ts` 是当前工具注册表。它声明 code、terminal、knowledge、graph、memory、meta、evidence 七类工具，每个 action 都有 summary、description、params schema、handler、cache、concurrency、risk、maxOutputTokens。

例如 code 工具包含 search、read、outline、structure、write：

- search 用 ripgrep 搜代码，支持 patterns、glob、regex、contextLines。
- read 支持单文件或最多五个文件批量读取，带 delta cache 和行范围。
- outline 走 Tree-sitter AST skeleton。
- structure 输出目录树。
- write 支持创建/覆盖文件，但受 protected path 限制。

terminal 工具声明 exec，标记 side-effect risk、single concurrency 和 output compression。knowledge 工具声明 search、submit、detail、manage，强调候选提交、去重、详情读取和 lifecycle/evolution 管理。graph 工具提供 overview 和 query；memory 工具提供 save、recall、note_finding、get_previous_evidence；meta 工具提供 tools、plan、review；evidence 工具提供 get 和 search。

按当前 registry 统计，7 类工具共 22 个 actions：code 5 个、terminal 1 个、knowledge 5 个、graph 2 个、memory 4 个、meta 3 个、evidence 2 个。这个数字可以作为维护时的漂移检查：如果新增工具没有进入本章，读者就会低估 Agent runtime 的可审计证据能力。

这使工具能力不是 prompt 里的自由文本，而是可验证 contract。

## Policy 和 Strategy 控制执行形状

PolicyEngine 可以加载 BudgetPolicy、SafetyPolicy、QualityGatePolicy 等策略。StrategyRegistry 包含 single、fan-out、adaptive、pipeline 等执行策略。CapabilityRegistry 决定当前任务加载哪些能力。

这种组合让同一个 AgentRuntime 可以服务不同场景：bootstrap 分析、candidate 生产、evolution audit、chat、relation、translation。差异不靠复制 runtime，而靠 profile、capability、policy 和 strategy。

## Context 不是一段越来越长的 prompt

`SystemRunContextFactory` 会同时建立 token budget、MemoryCoordinator、ActiveContext、ContextWindow 和 ExplorationTracker；`SystemRunContext` 再把它们投影为嵌套/扁平上下文。Agent 因此拥有运行时编排责任，Core 提供契约和共享能力，但“memory 全由 Core 实现”并不符合当前边界。

ContextWindow 按模型预算和阈值压缩、保留任务与证据；输出还受配额约束。上下文不足时应产生摘要、重置或 graceful exit，而不是暗示模型看过所有文件。grounding guard 也只有显式开启时才生效，不能被写成所有运行默认具备的保证。

## AI Provider 是可替换边界

`AiFactory` 负责 provider alias、显式配置和自动检测；没有可用 provider 时返回空结果，由上层诊断。真正的生成链集中在 `AlembicAgent/src/ai/gateway/LLMGateway.ts`：model resolve → parameter guard → transport → reliability → normalize。OpenAI、DeepSeek 等 provider 是 gateway 上的薄壳，模型能力和 quirks 集中在 ModelRegistry/ModelQuirks，而不是散落到每个 workflow。

Provider 是运行时依赖，不是 Core contract。Core 不应该知道某个 provider 的 retry 策略；主 Alembic 和 Agent 负责 provider 配置、probe、fallback 和 usage。

## 在线质量门不等于离线评测

![在线质量门与离线评测](/images/ch13/02-online-offline-evaluation.png)

`AlembicAgent/src/agent/evaluation/qualityGates.ts` 和 stage builders 属于在线确定性门：它们在一次运行中检查证据、结构、输出质量与是否可继续。`AlembicAgent/scripts/eval-mining.mjs` 与 mining judge 则是手工运行的离线评测入口，用真实样本比较 mining 质量。

离线 judge 的 promotion 条件包括至少 30 个已判样本、Cohen's κ 不低于 0.6、至少 5 个负样本、负样本召回不低于 0.6，并防止 self-bias。它当前不是 CI 默认门，源码也没有已上线的 critic 实现。因此正确表述是：在线 gate 已进入生产链，离线 eval/judge 已有可运行基线，critic 与自动 promotion 仍是能力缺口。

## Agent runtime 与 Codex host-agent 的区别

Codex host-agent workflow 使用 Codex 自己作为执行者：Plugin 返回 Mission Briefing、prime material、workRef、detailRefs，让 Codex 读代码和提交结果。

`@alembic/agent` 则是 Alembic 自己的执行引擎，通常由主 Alembic daemon/provider-backed job 调用。它拥有 provider、tool router、memory、policy 和 strategy。

两条路径可以共享 Core workflow contract 和 dataRoot，但执行者不同。混淆二者会导致两类错误：把 Codex 插件当成 Agent runtime，或把 AlembicAgent 的 provider 配置当成 Codex 插件必须拥有的能力。

## 本章小结

`@alembic/agent` 是非确定性执行层。Profile → AgentService → Runtime 建立主链，LLMGateway 与 ToolRouter 收束 provider/tool 出口，SystemRunContext 管理预算和证据，在线 gate 与离线 eval 分别治理单次运行和长期质量。它消费 Core contract，也被主 Alembic job workflow 装配，但不拥有 Codex MCP surface 或 Dashboard UI。

下一章转向人类审阅体验：Dashboard 如何把这些后端对象展示出来。
