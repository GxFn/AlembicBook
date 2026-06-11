# Ch11 Host Agent Workflow

Host-agent workflow 是 Alembic 面向 Codex、Claude Code 或其他宿主 Agent 的工作协议。它不要求宿主把全部项目知识塞进上下文，也不让宿主把模型输出直接写成团队规则；它用 intent、prime、work、guard、decision、bootstrap、rescan 和 dimension completion 把语义工作拆成可追踪步骤。

本章重点讲 Codex 插件路径。主 Alembic daemon 可以跑 provider-backed jobs；Codex 插件则利用宿主 Agent 自己的阅读和执行能力，围绕 Core workflow contract 组织任务。

![host-agent workflow 生命周期图](/images/ch11/01-host-agent-workflow-lifecycle.png)

## 本章回答

- 为什么 host-agent workflow 不等于普通 search。
- 六个 public tools 如何组成一次 Codex 工作闭环。
- `alembic_bootstrap` 和 `alembic_rescan` 在 host-agent 路径中返回什么。
- source refs、detail refs 和 structured output 如何让结果可审阅。

## 先 intent，再 prime

Host agent 面对用户请求时，第一步不应该是盲目搜索全库。`alembic_intent` 会把 host-declared intent、turn metadata、source references、user text 规范化成 compact intentRef，并判断 intent kind、prime need、work need、guard need、vector use kind 和 confidence band。

随后 `alembic_prime` 根据 intentRef 或 recognized intent 加载紧凑、带信任标签的项目知识，返回 primeRef 和 detailRefs。这里的“紧凑”很关键：Alembic 不是把所有 Recipe 展开给模型，而是只把当前任务最相关的知识材料交给宿主。

这样做的结果是：Codex 的上下文有来源、有目的、有预算，而不是一堆历史文档堆叠。

## work_start / work_finish 建立证据回路

当用户请求实现、修复、重构、审查或其他会产生证据的工作时，`alembic_work_start` 创建 workRef。这个 workRef 锚定当前工作范围，让后续 finish、guard 和 decision 能知道“这次工作是什么”。

完成工作后，`alembic_work_finish` 用 changed files、outcome summary、detailRefs 和 guard recommendation 关闭 workRef。它不直接运行 Guard，而是告诉宿主是否建议对哪些 scoped files 调用 `alembic_code_guard`。

这条设计避免了两个常见错误：

- Agent 改了代码但没有留下可关联证据。
- Guard 被无参数调用，变成不可控的全仓审查。

## code_guard 只接受明确范围

`alembic_code_guard` 的 public contract 明确要求 scope：显式文件、inline code，或当前 workRef 中的 scoped files。它不会从 diffRef、primeRef、acceptedGuards 之类字段推断无限范围，也不会做 no-args whole-diff review。

这是 Alembic 对 AI 工作流的一条硬边界。Guard 是项目规则检查，不是替代人类审查的万能工具；范围越明确，结果越可用。

## decision_record 只记录确认决策

`alembic_decision_record` 面向 durable Decision Register。它可以 create、update、read、list、revoke、delete，但前提是决策已确认。tentative suggestion、模型猜测、设计备选项不应该写成 durable decision。

Decision Register 的价值在于让后续 search/prime 能消费有效决策，同时保留 revoked/deleted 的审计路径。Plugin 也明确禁止写 Plugin-local fake decision，必须走 Alembic resident Decision Register route。

## Host-agent bootstrap 返回 Mission Briefing

`alembic_bootstrap` 在 Codex 插件路径中是 host-agent 冷启动工具。它返回 Mission Briefing，而不是替 Codex 完成全部分析。Briefing 包含项目元数据、语言统计、维度任务、ideAgentAnalysis packet summary、next units、retrieval hints、unit progress seed、execution plan 和 submission examples。

收到 Briefing 后，宿主 Agent 按维度读代码、提交候选知识，并调用 dimension completion。这条路径不要求 Alembic daemon 的 provider 配置，因为 AI 阅读工作由宿主 Agent 完成。

## Host-agent rescan 尊重已有 Recipe

`alembic_rescan` 在 host-agent 路径中保留已有 Recipes，重新分析项目，并返回包含 allRecipes、auditHint、analysis packet 和 per-dimension workflow 的 Mission Briefing。典型流程是 evolve、gap-fill、dimension_complete。

这让 Codex 不会把旧知识扫掉重来。它必须先理解已有 Recipe，再补充缺口或标记衰退。

## detailRefs 是可审阅证据索引

Public tools 的输出里经常出现 intentRef、primeRef、workRef、finishRef、guard result ref、decisionRef 和 detailRefs。这些 ref 的价值是把可见摘要和底层证据分开。

用户不需要每次都看完整 JSON，但系统必须能追溯：

- 这次 prime 用了哪些知识材料。
- 这次 work finish 涉及哪些文件。
- Guard 检查基于什么 scope。
- Decision Register 记录支持哪些 detail refs。
- legacy input 是否降级。

这使得 Alembic 在宿主 Agent 场景下仍然保持可审查。

## 与 resident jobs 的区别

Codex host-agent workflow 和 resident daemon jobs 是两条不同路径。host-agent path 使用 Codex 自身读代码和写候选；daemon job path 使用本地 Alembic resident service 和配置好的 AI provider。两者可以共享 Core workflow contract 和 dataRoot，但不能混淆执行者。

当用户明确要 Alembic daemon job 时，调用 Codex-local job 工具；当用户要 Codex 利用 Alembic 知识工作时，走 public tools 和 host-agent bootstrap/rescan。

## 本章小结

Host-agent workflow 让 Alembic 进入 Codex 的工作节奏，而不牺牲项目知识治理。intent/prime/work/guard/decision 形成日常开发闭环，bootstrap/rescan/dimension completion 形成知识建设闭环，refs 和 structuredContent 让两条闭环都可追踪。

下一章会讲这些 workflow 之外的交付资源：Project Skills、channel、plugin runtime 和 marketplace artifact。
