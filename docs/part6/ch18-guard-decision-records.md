# Ch18 Guard、Code Guard 与决策信号

Guard 是 Alembic 把项目知识用于真实代码工作的约束面。它负责把已知规则应用到明确代码输入，并把结果作为证据交给 CLI、HTTP route、Dashboard 或宿主插件。当前 public MCP surface 不再暴露 `alembic_decision_record`，decision-register HTTP entry 也已从 provider contract 中退休；书里不能再把它写成现役路径。

本章把主 Core Guard、Codex/Claude Code `alembic_code_guard`、prime 中的 decision/feedback 信号和 evolution decision 放在一起讲，因为它们经常在同一次开发工作中被误读。

![Guard 与决策信号工作图](/images/ch18/01-guard-decision-register-workflow.png)

源码锚点：`AlembicCore/src/service/guard/GuardCheckEngine.ts`、`AlembicPlugin/lib/shared/schemas/mcp-tools.ts`、`AlembicPlugin/lib/host-runtime/mcp/handlers/agent-public-tools.ts`、`Alembic/test/unit/AlembicProviderContracts.test.ts`。

## 本章回答

- Guard 与 Code Guard 的区别是什么。
- 为什么 Code Guard 必须有明确 scope。
- 当前实现中哪些 decision 是检索/演化信号，哪些不是 public writing route。
- Guard result 如何回到后续 search/prime。

## Guard 是规则检查引擎

Core 的 GuardCheckEngine 使用知识库中的规则和代码输入生成检查结果。它可以被主 CLI、HTTP route、resident service 或 Plugin adapter 包装，但核心语义在 Core：规则检查、跨文件检查、报告和治理闭环。

Guard lifecycles 包含 staging、active、evolving、decaying。也就是说 Guard 不只看 active；某些处于演化或衰退中的规则仍然可能参与检查，但结果应该能表达状态和可信度。

## Code Guard 是 host-facing scoped wrapper

Public tool `alembic_code_guard` 是面向宿主 Agent 的 wrapper。它支持三类 scope：

- inline code。
- explicit files。
- active workRef 中的 scoped files。

如果没有 code、files 或 workRef scope，它会 blocked，reason code 是 missing-guard-scope。若传了 workRef 但当前 Plugin session 找不到，也会 blocked。若 workRef 存在但没有 scoped source files，会 skipped。

这条 fail-closed 规则很重要。AI 工具很容易把“检查一下”扩展成全仓审查，但全仓审查成本高、结果噪声大、边界不清。Code Guard 必须围绕当前工作范围。

## Guard 不是验收本身

Guard result 是证据，不是最终验收。它可以指出规则命中、违规、建议、风险或需要人工复核；但它不能替代测试、构建、运行场景和用户确认。

一个变更通过 Guard，只说明它没有触发已知项目规则或当前 scope 下检查通过。它不说明功能正确、发布安全或用户目标完成。

## 当前没有 public decision_record

当前 active public tools 是 `alembic_prime`、`alembic_work`、`alembic_code_guard`。Plugin 测试明确要求 active guidance 不再广告 `alembic_intent`、`alembic_work_start`、`alembic_work_finish`、`alembic_decision_record`，并要求 `alembic_task` 退休。

这条事实可以从两个地方证明：Plugin public tool contract 只列出 prime/work/code_guard；主 Alembic provider contract 测试记录 decision-register HTTP entry 退休。维护本章时，这两个测试/contract 比旧文档更可靠。

这不代表系统完全没有 decision 概念。Prime public package 里可能有 observe-only 的 `feedbackDigest.decisionRefCount`；rescan/evolution 路径里也有 recipe impact decisions、`alembic_evolve` 和 Agent runtime 的 `knowledge.manage` evolution decisions。但这些不是“Codex public tool 直接写 durable Decision Register”的路径。

## decision-register HTTP entry 已退休

主 Alembic 的 provider contract 测试记录了 DRR-2：decision-register HTTP entry retired 后，Alembic 不再把它作为当前 required failure fixture 来源。当前 `lib/http/routes` 也没有 `decision-register.ts` route file。

因此本书只能把 Decision Register 写作历史/治理语义或检索信号来源，不能声称当前 `/api/v1/decision-register` 是活跃产品 route，也不能声称 Plugin 会写 Plugin-local fake decision。正确读法是：当前公开闭环以 Recipe、sourceRef、Guard、evolution proposal/decision 和 work evidence 为主。

## Guard 与演化决策的协同

一次当前实现中的理想工作闭环可能是：

1. `alembic_prime` 为具体代码任务加载相关 Recipe、ProjectContext guidance 和反馈信号。
2. `alembic_work` phase=start 建立工作范围。
3. 宿主 Agent 修改代码。
4. `alembic_work` phase=finish 记录 changed files、outcome 和 evidenceRefs。
5. `alembic_code_guard` 检查 scoped files。
6. 若 rescan/evolution 发现 Recipe 需要变更，通过 `alembic_evolve`、`alembic_consolidate` 或 Agent runtime 的 knowledge.manage decision 路径处理。

Guard 负责检查当前变更，evolution decisions 负责推动知识生命周期变化。二者都需要证据和 scope。

## 本章小结

Guard 和 Code Guard 是 Alembic 知识层进入实际开发的关键约束面。当前 public MCP 不再提供 decision_record；decision-register HTTP entry 也不应被写成活跃 route。读者应把 Guard result、prime feedback、work refs 和 evolution decisions 当作可审阅证据，而不是把旧 public decision tool 当成仍存在的写入入口。

最后一部分会讲发布、验证、测试证据和如何长期维护这本书。
