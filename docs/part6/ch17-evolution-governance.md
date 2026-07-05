# Ch17 Evolution、Governance 与信号

项目知识如果不会变化，就会很快过期。Alembic 的 evolution/governance 层负责让知识在代码变化、证据衰退、重复候选、规则冲突和人工审阅之间持续更新。它的目标不是自动改一切，而是提出可审阅 proposal、warning、signal 和 lifecycle transition。

本章讲知识演化的治理边界：生命周期状态机、proposal/warning、decay、redundancy、consolidation、signals 和 reports。

![知识演化治理图](/images/ch17/01-knowledge-evolution-governance.png)

源码锚点：`AlembicCore/src/evolution.ts`、`AlembicCore/src/service/sustain/ProposalGateway.ts`、`AlembicCore/src/service/sustain/LifecycleStateMachine.ts`、`AlembicCore/src/repository/evolution/ProposalRepository.ts`、`Alembic/lib/http/routes/signals.ts`。

## 本章回答

- 为什么 LifecycleStateMachine 是知识状态变化的权威路径。
- Evolution proposal 和 warning 解决什么问题。
- 信号如何帮助判断知识是否被使用或过期。
- 自动化演化的边界在哪里。

## 生命周期状态机是唯一权威

Core 的 `LifecycleStateMachine` 注释明确写着：它替代旧的 RecipeLifecycleSupervisor，是生命周期变更的唯一权威。状态转移必须先读取当前 entry，再通过 `isValidTransition(from, to)` Guard，最后更新 lifecycle 并记录 event。

合法转移包括：

- pending → staging / active / deprecated。
- staging → active / pending。
- active → evolving / decaying / deprecated。
- evolving → staging / active / decaying。
- decaying → active / deprecated。
- deprecated → pending。

这防止外层服务绕过规则直接改状态。若 Guard 拒绝，调用者不应 fallback 到普通 updateLifecycle。

## ProposalGateway 汇聚演化决策

当前 Core 中没有旧的 evolution gateway 类口径。统一入口是 `ProposalGateway`：Agent tools、MCP handler、Evolution Agent 或维护 sweep 产生的演化判断，最终都应汇聚成 `update`、`deprecate`、`valid` 三种动作之一。

这个 gateway 的设计意图很明确：消除 Agent tools、MCP handler、Metabolism 各自创建 proposal 的重复逻辑；统一 observation window；让高置信 Agent deprecate 可以立即执行，而规则引擎来源先进入观察窗口；如果 lifecycle 变更被 Guard 拒绝，则降级为 Proposal 让人审阅。

## Evolution proposals 是待审变更

Evolution route 提供 proposals 列表、stats、execute、observe、reject，以及 warnings 列表、stats、resolve、dismiss。proposal 可以来自 decay detector、redundancy analyzer、enhancement suggester、recipe impact planner、consolidation advisor 等。

Proposal 的意义是把“系统建议改变知识”变成可审阅对象。它可以建议更新内容、合并重复、废弃过期 Recipe、观察某个规则、补充证据，但执行前应有明确状态和原因。底层持久化由 `ProposalRepository` 负责；执行路径会继续通过 `ProposalExecutor`、`LifecycleStateMachine`、ContentPatcher 或相关 sustain 服务，而不是 route 直接改知识。

这比自动修改 Recipe 更安全。AI 或规则分析可以提出变更，但是否执行需要治理路径。

## Warnings 是风险提示

Warnings 用于表达还不适合立即修改的风险。例如某个 Recipe 可能证据不足、sourceRef 失效、与新代码冲突、触发过多 Guard 误报、长期无人采用。warning 可以 resolve 或 dismiss，这让团队能区分“已处理”和“不采取行动”。

Warnings 不是失败，它们是知识健康度的输入。

## Signals 记录使用和反馈

主 Alembic 的 `/api/v1/signals` 提供 trace、stats、reports。Core 的 events/signal infrastructure 可以记录 search hit、guard hit、view、adoption、application、lifecycle 等信号。

信号的价值在于回答：

- 哪些 Recipe 经常被搜索或 prime。
- 哪些规则经常被 Guard 命中。
- 哪些知识被采用或应用。
- 哪些知识长期无人使用。
- 哪些 pipeline 产生了 report 或异常。

没有信号，evolution 只能靠静态代码差异；有了信号，系统可以结合真实使用情况判断知识是否值得保留、提升或修复。

## Redundancy 与 consolidation

知识增长会带来重复。RedundancyAnalyzer、ConsolidationAdvisor、SimilarityService 等能力帮助发现相似候选、重叠 Recipe、同 trigger 下的重复规则。它们不应该直接删除知识，而应生成建议、合并方案或 candidate review 信号。

重复治理的目标不是减少数量，而是减少冲突和噪声。两个 Recipe 看似相似，但若适用维度、scope、语言或 sourceRef 不同，可能应该并存。

## Decay 不是删除

`decaying` 状态表达知识证据衰退，需要复核。它不是 deprecated。decaying Recipe 仍可能被 Guard lifecycles 包含，因为旧规则在过渡期仍有参考价值；但 search/prime 应该能显示它的降级状态，rescan/evolve 应该推动它恢复 active 或进入 deprecated。

这让 Alembic 能处理现实项目中的灰区：代码变了，知识未必立刻无效，但也不能假装完全可靠。

## Governance Gateway 与权限

主 Alembic 还有 governance gateway、constitution、permission 等层。它们把角色、权限、规则、能力探测和 audit 组织起来，防止 candidate/Recipe/Guard rule 等操作绕过治理。

治理不是为了增加流程，而是为了保证“谁能创建、谁能接受、谁能删除、谁能批量操作、谁能写 Recipe”这些问题有可解释答案。

## 本章小结

Evolution 和 governance 让 Alembic 知识层保持活的同时不失控。LifecycleStateMachine 控制状态变化，proposals 和 warnings 承载待审建议，signals 和 reports 提供使用证据，governance gateway 和 constitution 保护权限边界。

下一章会聚焦最终约束面：Guard、Code Guard 和当前实现中的决策信号。
