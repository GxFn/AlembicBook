# Ch13 Agent Runtime 与 Tool System

`@alembic/agent` 是 Alembic 自己的 AI/tool 执行 runtime。它不是 Codex 宿主 Agent，也不是 Core 的一部分；它为主 Alembic 的 provider-backed jobs、scan、evolution、relation、translation 等场景提供统一执行引擎。

这一章讲 AgentRuntime 和 tool system 的边界。读者要分清：Core 提供项目知识与 deterministic contract，Agent 负责非确定性的 AI 调用、工具执行、上下文控制和策略编排。

![AgentRuntime 执行循环图](/images/ch13/01-agentruntime-execution-loop.png)

## 本章回答

- AgentRuntime 为什么是单一执行引擎。
- Capability、Strategy、Policy、ToolRouter 在运行时中分别做什么。
- V2 tool registry 如何把 code、terminal、knowledge、graph、memory 等能力结构化。
- Agent runtime 与 Codex host-agent workflow 有何不同。

## 一个 Runtime，多种配置

`AgentRuntime.ts` 的文件头已经给出设计意图：不存在类型分野，只有一个 runtime，由 Capability、Strategy 和 Policy 配置驱动。它是 ReAct 循环宿主、Capability 组合容器、Policy 执行者，并把具体推理策略委托给 Strategy。

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

## Tool V2 是声明式工具目录

`src/tools/v2/registry.ts` 是 V2 工具注册表。它声明 code、terminal、knowledge、graph、memory、meta 等工具，每个 action 都有 summary、description、params schema、handler、cache、concurrency、risk、maxOutputTokens。

例如 code 工具包含 search、read、outline、structure、write：

- search 用 ripgrep 搜代码，支持 patterns、glob、regex、contextLines。
- read 支持单文件或最多五个文件批量读取，带 delta cache 和行范围。
- outline 走 Tree-sitter AST skeleton。
- structure 输出目录树。
- write 支持创建/覆盖文件，但受 protected path 限制。

terminal 工具声明 exec，标记 side-effect risk、single concurrency 和 output compression。knowledge 工具声明 search 和 submit，强调候选提交、去重和字段完整。

这使工具能力不是 prompt 里的自由文本，而是可验证 contract。

## Policy 和 Strategy 控制执行形状

PolicyEngine 可以加载 BudgetPolicy、SafetyPolicy、QualityGatePolicy 等策略。StrategyRegistry 包含 single、fan-out、adaptive、pipeline 等执行策略。CapabilityRegistry 决定当前任务加载哪些能力。

这种组合让同一个 AgentRuntime 可以服务不同场景：bootstrap 分析、candidate 生产、evolution audit、chat、relation、translation。差异不靠复制 runtime，而靠 profile、capability、policy 和 strategy。

## AI Provider 是可替换边界

Agent 的 AI 层支持 Google Gemini、OpenAI、DeepSeek、Claude、Ollama 等 provider。`AiFactory` 根据配置或环境变量创建 provider，也支持 fallback、geo/provider error 判断和 embedding provider。

Provider 是运行时依赖，不是 Core contract。Core 不应该知道某个 provider 的 retry 策略；主 Alembic 和 Agent 负责 provider 配置、probe、fallback 和 usage。

## Agent runtime 与 Codex host-agent 的区别

Codex host-agent workflow 使用 Codex 自己作为执行者：Plugin 返回 Mission Briefing、prime material、workRef、detailRefs，让 Codex 读代码和提交结果。

`@alembic/agent` 则是 Alembic 自己的执行引擎，通常由主 Alembic daemon/provider-backed job 调用。它拥有 provider、tool router、memory、policy 和 strategy。

两条路径可以共享 Core workflow contract 和 dataRoot，但执行者不同。混淆二者会导致两类错误：把 Codex 插件当成 Agent runtime，或把 AlembicAgent 的 provider 配置当成 Codex 插件必须拥有的能力。

## 本章小结

`@alembic/agent` 是非确定性执行层。它把 AI provider、tool registry、context window、policy、strategy、memory、event 和 evidence 组织成单一 runtime。它消费 Core 的项目知识 contract，也被主 Alembic job workflow 装配，但不拥有 Codex MCP surface 或 Dashboard UI。

下一章转向人类审阅体验：Dashboard 如何把这些后端对象展示出来。
