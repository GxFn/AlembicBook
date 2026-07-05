# Ch11 Host Agent Workflow

Host-agent workflow 是 Alembic 面向 Codex 与 Claude Code 的工作协议。它不要求宿主把全部项目知识塞进上下文，也不让宿主把模型输出直接写成团队规则；它用 status/onboarding、prime、work、guard、bootstrap、rescan 和 dimension completion 把语义工作拆成可追踪步骤。

本章重点讲 Codex 插件路径。主 Alembic daemon 可以跑 provider-backed jobs；Codex 插件则利用宿主 Agent 自己的阅读和执行能力，围绕 Core workflow contract 组织任务。

![host-agent workflow 生命周期图](/images/ch11/01-host-agent-workflow-lifecycle.png)

源码锚点：`AlembicPlugin/lib/shared/schemas/mcp-tools.ts`、`AlembicPlugin/lib/host-runtime/mcp/handlers/agent-public-tools.ts`、`AlembicPlugin/lib/host-runtime/status/OnboardingContract.ts`。

## 本章回答

- 为什么 host-agent workflow 不等于普通 search。
- 三个 agent-facing public tools 如何组成一次宿主 Agent 工作闭环。
- `alembic_bootstrap` 和 `alembic_rescan` 在 host-agent 路径中返回什么。
- source refs、detail refs 和 structured output 如何让结果可审阅。

## Prime 从具体代码任务开始

Host agent 面对用户请求时，第一步不应该是盲目搜索全库。当前 public contract 把原来的 intent tool 收缩到 `alembic_prime` 输入里：宿主需要声明 `taskAction`、`requirementGoal`，并提供 capability、scenario、domainObjects、integrationBoundary 或 qualityConcerns 中至少一个 locator facet。

`alembic_prime` 加载紧凑、带信任标签的项目知识，返回 primeRef、detailRefs、trust posture 和 ProjectContext follow-up guidance。这里的“紧凑”很关键：Alembic 不是把所有 Recipe 展开给模型，而是只把当前任务最相关的知识材料交给宿主。

当前 schema 还会拒绝旧式 `intentRef`、`recognizedIntent`、裸 query 或 hostDeclaredIntent 之类输入。Prime 的职责是从一个明确的编码任务出发装载项目知识，而不是让宿主把任意自然语言塞进“意图识别”工具。

这样做的结果是：Codex 的上下文有来源、有目的、有预算，而不是一堆历史文档堆叠。

## alembic_work 用 phase 建立证据回路

当用户请求实现、修复、重构、审查或其他会产生证据的工作时，`alembic_work` 的 `phase=start` 创建 workRef。这个 workRef 锚定当前工作范围，让后续 finish 和 guard 能知道“这次工作是什么”。

完成工作后，`alembic_work` 的 `phase=finish` 用 changed files、outcome summary、evidenceRefs、validationPlan 和 reason 关闭 workRef。它不直接运行 Guard，而是告诉宿主是否建议对哪些 scoped files 调用 `alembic_code_guard`。

这条设计避免了两个常见错误：

- Agent 改了代码但没有留下可关联证据。
- Guard 被无参数调用，变成不可控的全仓审查。

## code_guard 只接受明确范围

`alembic_code_guard` 的 public contract 明确要求 scope：显式文件、inline code，或当前 workRef 中的 scoped files。它不会从 diffRef、primeRef、acceptedGuards 之类字段推断无限范围，也不会做 no-args whole-diff review。

这是 Alembic 对 AI 工作流的一条硬边界。Guard 是项目规则检查，不是替代人类审查的万能工具；范围越明确，结果越可用。

在代码上，这条边界落在两处：`AlembicPlugin/lib/shared/schemas/mcp-tools.ts` 定义输入形状，`AlembicPlugin/lib/host-runtime/mcp/handlers/agent-public-tools.ts` 处理降级、reason code、detailRefs 和结构化输出。读 public tools 行为时，应同时看 schema 和 handler，不要只看 README 或技能文案。

## Host-agent bootstrap 返回 Mission Briefing

`alembic_bootstrap` 在 Codex 插件路径中是 host-agent 冷启动工具。它返回 Mission Briefing，而不是替 Codex 完成全部分析。Briefing 包含项目元数据、语言统计、维度任务、ideAgentAnalysis packet summary、next units、retrieval hints、unit progress seed、execution plan 和 submission examples。

收到 Briefing 后，宿主 Agent 按维度读代码、提交候选知识，并调用 dimension completion。这条路径不要求 Alembic daemon 的 provider 配置，因为 AI 阅读工作由宿主 Agent 完成。Plugin status 的 onboarding contract 也会给出默认工具顺序：status、recipe_map、graph、search、prime、submit_knowledge、dimension_complete。

## Host-agent rescan 尊重已有 Recipe

`alembic_rescan` 在 host-agent 路径中保留已有 Recipes，重新分析项目，并返回包含 allRecipes、auditHint、analysis packet 和 per-dimension workflow 的 Mission Briefing。典型流程是 evolve、gap-fill、dimension_complete。

这让 Codex 不会把旧知识扫掉重来。它必须先理解已有 Recipe，再补充缺口或标记衰退。

## detailRefs 是可审阅证据索引

Public tools 的输出里经常出现 primeRef、workRef、finishRef、guard result ref 和 detailRefs。这些 ref 的价值是把可见摘要和底层证据分开。Prime 也可能报告 observe-only 的 feedbackDigest，例如 decisionRefCount，但这不是当前 public decision-writing route。

用户不需要每次都看完整 JSON，但系统必须能追溯：

- 这次 prime 用了哪些知识材料。
- 这次 work finish 涉及哪些文件。
- Guard 检查基于什么 scope。
- legacy input 是否降级。

这使得 Alembic 在宿主 Agent 场景下仍然保持可审查。

## 与 resident jobs 的区别

Codex host-agent workflow 和 resident daemon jobs 是两条不同路径。host-agent path 使用 Codex 自身读代码和写候选；daemon job path 使用本地 Alembic resident service 和配置好的 AI provider。两者可以共享 Core workflow contract 和 dataRoot，但不能混淆执行者。

当用户明确要 Alembic daemon job 时，调用 `alembic_job`；当用户要宿主 Agent 利用 Alembic 知识工作时，走 public tools 和 host-agent bootstrap/rescan。

## 本章小结

Host-agent workflow 让 Alembic 进入 Codex/Claude Code 的工作节奏，而不牺牲项目知识治理。prime/work/code_guard 形成日常开发闭环，bootstrap/rescan/dimension completion 形成知识建设闭环，refs 和 structuredContent 让两条闭环都可追踪。

下一章会讲这些 workflow 之外的交付资源：Project Skills、channel、plugin runtime 和 marketplace artifact。
