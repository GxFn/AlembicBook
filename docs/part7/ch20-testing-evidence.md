# Ch20 测试、证据与验收

Alembic 是多仓库、本地运行、AI 参与的系统。这里的“测试通过”不能只理解为一个绿色命令；验收需要看 raw evidence、运行边界、输入输出、状态变化和可重复性。尤其是 bootstrap/rescan、Codex MCP、Dashboard、daemon、Project Skills 这类能力，摘要和状态表只是入口，不是结论。

本章讲如何解释 Alembic 的测试证据。

![测试证据层级图](/images/ch20/01-testing-evidence-hierarchy.png)

源码锚点：`Alembic/test/unit/ResidentServiceBoundary.test.ts`、`AlembicPlugin/test/unit/McpCleanOutputContract.test.ts`、`AlembicDashboard/scripts/dashboard-contract.test.mjs`。

## 本章回答

- 哪些证据能支持“功能完成”。
- 为什么 target result、Dashboard badge 或工具摘要不是最终验收。
- 如何读 job events、process artifacts、runtime status 和 MCP structured output。
- 何时需要真实场景测试，何时仓库本地验证足够。

## 证据必须回答完整闭环

一个 Alembic 功能的验收至少要回答：

- 用户场景是什么。
- 输入是什么。
- 输出是什么。
- 状态或数据发生了什么变化。
- 哪条调用链实际运行了。
- 哪个仓库拥有这个能力。
- 成功时用户能看到什么。
- 失败时如何诊断。
- 哪些边界没有被改动。

只说“构建通过”通常不够。构建能证明类型和打包没断，但不能证明 runtime route、MCP output、Dashboard interaction 或 Job evidence 正确。

## 不同证据的含义

Unit test 证明某个函数或服务在受控输入下行为正确。

Typecheck 证明类型边界没有破。

Lint/import boundary 证明代码没有越过约定边界。

Package guard 证明发布物不会带错依赖或走错发布路径。

Smoke test 证明关键链路能在代表性环境跑通。

MCP probe 证明插件工具在真实 MCP surface 上可见、可调用、输出 clean structuredContent。

Job events/artifacts 证明长任务实际执行到了哪些阶段。

Dashboard screenshot 或用户操作证明前端体验可见、可操作。

Controller acceptance 证明证据被独立读过，并且符合原始完成定义。

这些证据可以互补，不能互相替代。

## Job 证据要读 events 和 artifacts

Bootstrap/rescan job 的 status 可能是 completed、failed、cancelled、running，但 status 不是全部。应查看：

- request 参数。
- createdAt/updatedAt/completedAt。
- progress summary。
- process events。
- display snapshot。
- artifacts。
- active task 与 dimension results。
- error event 与 source class。

一个 failed job 可能仍然产出有用 artifact；一个 completed job 也可能有 degraded dimension。验收时要读过程证据，而不是只看终态。

## MCP 证据要看 structuredContent

Codex 插件工具输出通常有 visible summary 和 structuredContent。visible summary 给人看，structuredContent 给宿主和验证脚本判断。清洁输出要求每个工具有明确 schema、status、reason、refs、nextActions、detailRefs、payload。

验证 MCP 工具时，不能只看 stdout 有一段文字。需要确认：

- tool 是否出现在 tools/list。
- input schema 是否符合预期。
- structuredContent 是否存在且字段正确。
- blocked/degraded/ready 状态是否合理。
- legacy/retired 工具是否 fail closed。
- projectRoot、dataRoot、route、owner 是否正确。

## Dashboard 证据要连回 API

Dashboard 页面显示正常是一类证据，但如果要验收后端行为，还要确认 API response。比如 JobsView 显示一个 job completed，需要能读 `/api/v1/jobs/:jobId`、events、display snapshot 或 artifact。SkillsView 显示 runtime visible，需要能读 Project Skill receipt 和 marker。

前端验收最好同时包含：用户看到什么、API 返回什么、后端数据写在哪里。

## Codex host-agent 证据要区分执行者

Codex host-agent workflow 的执行者是 Codex。AlembicPlugin 提供 Mission Briefing、prime material、work refs、guard/decision tools。验收时要区分：

- Plugin 是否正确给出 workflow contract。
- Codex 是否实际读了代码并提交候选。
- dimension completion 是否完成。
- candidate/Recipe 是否进入 dataRoot。
- Guard/decision 是否走 durable route。

不能把“Plugin 发出了 Briefing”当成“项目知识已经完成”。Briefing 是任务入口，不是任务结果。

## 真实场景测试何时需要

如果改动只影响纯 Core 函数，unit tests 和 public API smoke 可能足够。

如果改动影响 daemon、jobs、file monitor、Dashboard handoff、MCP tool surface、Project Skill export 或 plugin cache，就需要真实 runtime/probe。

如果改动影响用户可见流程，如 cold start、rescan、Dashboard review、Codex public tools，就需要端到端场景证据。

如果改动只影响 Book 文档，VitePress build、link/image/diff checks 足够，但内容事实仍应来自源码阅读。

## 本章小结

Alembic 的验收是证据解释，不是命令崇拜。每个证据都要说明它覆盖的边界和不能支持的结论。高质量验收会把代码、命令输出、runtime JSON、events、artifacts、API response、Dashboard 可见行为和用户目标连成一条闭环。

最后一章给出这本书后续维护的阅读路径和更新规则。
