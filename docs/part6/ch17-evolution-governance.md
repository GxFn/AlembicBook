# Ch17 SourceRef 新鲜度、Evolution 与 Governance

项目知识如果不能证明仍由当前代码支撑，就会变成比缺少知识更危险的旧规则。Alembic 的新鲜度链先检测 SourceRef 路径和内容漂移，再把结果投影到 Search、rescan 与治理；evolution/governance 才负责 proposal、warning、signal 和 lifecycle transition。检测、消费和修复必须分开。

本章讲完整的 post-generation 链：SourceRef bridge、内容指纹、提交检查点、drift 分类、消费降权、生命周期状态机、proposal/warning、decay、signals 和 reports。

![知识演化治理图](/images/ch17/01-knowledge-evolution-governance.png)

源码锚点：`AlembicCore/src/service/knowledge/SourceRefReconciler.ts`、`AlembicCore/src/service/search/SearchEngine.ts`、`AlembicCore/src/evolution.ts`、`AlembicCore/src/service/sustain/ProposalGateway.ts`、`AlembicCore/src/service/sustain/LifecycleStateMachine.ts`、`AlembicCore/src/repository/evolution/ProposalRepository.ts`、`Alembic/lib/http/routes/signals.ts`。

## 本章回答

- 为什么 LifecycleStateMachine 是知识状态变化的权威路径。
- SourceRef 如何区分路径失效与“文件仍在但被引内容已变”。
- 为什么 drifted 知识是降权、标记和观察，而不是自动删除。
- Evolution proposal 和 warning 解决什么问题。
- 信号如何帮助判断知识是否被使用或过期。
- 自动化演化的边界在哪里。

## 生成后的新鲜度链已经存在

Recipe 的 `reasoning.sources` 会被桥接到 `recipe_source_refs`。`SourceRefReconciler` 先解析并归一项目范围内的 source identity，再检查路径、rename 和 region content fingerprint：

- 文件与区间指纹一致：active。
- 路径失效且无法修复：stale。
- 检测到 Git rename：renamed，进入修复路径。
- 文件仍在但被引区间内容变化：drifted。

新建或演化后的 Recipe 可立即做单条 reconcile，完整 reconcile 则有默认 TTL，避免每次查询都全量读盘。读取失败时实现采取保守策略：不因权限或竞态误报 drift；这能减少假阳性，但也意味着“active”并非永远等于刚刚成功重读。

当提供 baseline commit 和 git reader 时，reconciler 还能把 drifted 观察性细分为 line-shift 与 content-change。当前分类是 observe-only：只写报告与日志，不自动修改 range 或 sourceRefs。自动修复尚未发生，书稿不能把分类能力写成已完成的修复链。

## 漂移已经进入消费现场

SearchEngine 会对 drifted item 降权，并返回 item 级 `sourceRefStatus` 和 `driftedSourceRefs`；Plugin 的 embedded/resident 合并路径会保留这些字段。使用者因此还能看到可能相关的旧知识，同时知道必须回到当前代码核验。

这是一条重要治理原则：漂移首先是可观察证据，不是立即判死刑。路径变化、行号移动和语义改变需要不同处理；自动 deprecated 会误杀，完全忽略又会让旧规则继续支配开发。rescan/evolution 应基于分类、使用信号和人工判断决定 update、恢复 active、进入 decaying 或 deprecated。

## 生命周期状态机是唯一权威

![Knowledge 六态生命周期](/images/ch17/02-lifecycle-state-machine.png)

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

`decaying` 状态表达知识证据衰退，需要复核。它不是 deprecated。decaying Recipe 仍可能被 Guard lifecycles 包含，但 error 规则会降为 warning；Search/Prime 也应显示生命周期和 SourceRef 风险，rescan/evolve 再推动它恢复 active 或进入 deprecated。

这让 Alembic 能处理现实项目中的灰区：代码变了，知识未必立刻无效，但也不能假装完全可靠。

## Governance Gateway 与权限

主 Alembic 还有 governance gateway、constitution、permission 等层。它们把角色、权限、规则、能力探测和 audit 组织起来，防止 candidate/Recipe/Guard rule 等操作绕过治理。

治理不是为了增加流程，而是为了保证“谁能创建、谁能接受、谁能删除、谁能批量操作、谁能写 Recipe”这些问题有可解释答案。

## 本章小结

Alembic 的知识治理从 SourceRef 新鲜度开始，而不是从 proposal 开始。Reconciler 发现路径与内容漂移，Search 把风险带到消费现场，rescan/evolution 决定修复方向，LifecycleStateMachine 才执行合法状态变化；proposals、warnings、signals 和 reports 保留人工审阅与使用证据。

下一章会聚焦最终约束面：Guard、Code Guard 和当前实现中的决策信号。
