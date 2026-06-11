# Ch18 Guard、Code Guard 与 Decision Records

Guard 和 Decision Register 是 Alembic 把项目知识用于真实工作的两个约束面。Guard 负责把已知规则应用到代码输入，Decision Register 负责保存已确认的 durable decisions。一个面向“这段代码是否符合项目知识”，一个面向“这个决定以后还要被记住”。

本章把主 Core Guard、Codex `alembic_code_guard` 和 resident Decision Register 放在一起讲，因为它们经常在同一次开发工作中出现。

![Guard 与 Decision Register 工作图](/images/ch18/01-guard-decision-register-workflow.png)

## 本章回答

- Guard 与 Code Guard 的区别是什么。
- 为什么 Code Guard 必须有明确 scope。
- Decision Register 存什么，不存什么。
- Guard result 和 decision 如何回到后续 search/prime。

## Guard 是规则检查引擎

Core 的 GuardCheckEngine 使用知识库中的规则和代码输入生成检查结果。它可以被主 CLI、HTTP route、resident MCP tool、Codex Plugin adapter 包装，但核心语义在 Core：规则检查、跨文件检查、报告和治理闭环。

Guard lifecycles 包含 staging、active、evolving、decaying。也就是说 Guard 不只看 active；某些处于演化或衰退中的规则仍然可能参与检查，但结果应该能表达状态和可信度。

## Code Guard 是 Codex-facing scoped wrapper

Codex public tool `alembic_code_guard` 是面向宿主 Agent 的 wrapper。它支持三类 scope：

- inline code。
- explicit files。
- active workRef 中的 scoped files。

如果没有 code、files 或 workRef scope，它会 blocked，reason code 是 missing-guard-scope。若传了 workRef 但当前 Plugin session 找不到，也会 blocked。若 workRef 存在但没有 scoped source files，会 skipped。

这条 fail-closed 规则很重要。AI 工具很容易把“检查一下”扩展成全仓审查，但全仓审查成本高、结果噪声大、边界不清。Code Guard 必须围绕当前工作范围。

## Guard 不是验收本身

Guard result 是证据，不是最终验收。它可以指出规则命中、违规、建议、风险或需要人工复核；但它不能替代测试、构建、运行场景和用户确认。

一个变更通过 Guard，只说明它没有触发已知项目规则或当前 scope 下检查通过。它不说明功能正确、发布安全或用户目标完成。

## Decision Register 是 durable 记录

主 Alembic 的 `/api/v1/decision-register` 提供 create、update、revoke、delete、read、list、searchable。capability 中明确 storage scope 是 project-scope dataRoot，store dir 是 `.asd/decision-register`，audit 是 append-only jsonl，key privacy 使用 sha256，path privacy 会 redacted。

Decision Register 解决的是“这个决定以后还要被 Alembic 检索和引用”。例如选择某个架构边界、废弃某个兼容层、确认某个 release 策略、接受某个修复方向。

它不应该存 tentative suggestion，也不应该把用户绝对路径、线程 id 或 secret 泄露到长期文件。

## Codex decision_record 必须走 resident route

`alembic_decision_record` 不写 Plugin-local fake decision。它会解析 action、检查 decision scope，确认 residentDecisionRegisterClient 可用，再调用 Alembic durable Decision Register route。若 resident route 不可用，会 blocked，并说明没有写本地假记录。

这条边界让决策记录成为 Alembic 数据层的一部分，而不是某个 Codex 插件会话里的临时 JSON。

## Searchable view 服务后续检索

Decision Register 的 searchable endpoint 默认只暴露 active-effective 视图，排除 revoked/deleted；但可以 include audit 做 readback。retrieval policy 中 sourceRef gate 是 observe-only，vector admission 是 accepted-only。

这意味着后续 prime/search 可以消费有效决策，但不会把已撤销或删除的决策默认当成当前规则。审计仍然可以读到历史。

## Guard 与 Decision 的协同

一次理想工作闭环可能是：

1. `alembic_intent` 识别任务。
2. `alembic_prime` 加载相关 Recipe 和 decisions。
3. `alembic_work_start` 建立工作范围。
4. Codex 修改代码。
5. `alembic_work_finish` 记录 changed files 和 outcome。
6. `alembic_code_guard` 检查 scoped files。
7. 若产生已确认长期选择，`alembic_decision_record` 写入 durable decision。

Guard 负责检查当前变更，Decision 负责记住新的长期判断。二者都需要证据和 scope。

## 本章小结

Guard 和 Decision Register 是 Alembic 知识层进入实际开发的两个关键约束面。Guard 用项目规则检查明确代码范围；Decision Register 保存已确认、可审计、可检索的长期决策。它们都必须 fail closed，避免无边界审查和假持久化。

最后一部分会讲发布、验证、测试证据和如何长期维护这本书。
