# Ch10 Codex 插件表面

AlembicPlugin 的核心职责是 host adaptation。它把 Alembic 的本地知识能力交给 Codex，但不把自己伪装成主 Alembic daemon，也不把 Dashboard 前端、AI provider runtime 或 Core domain 重新实现一遍。

本章讲 Codex 插件表面：哪些工具可见，谁处理工具，什么时候需要知识库，什么时候只做本地状态检查，什么时候走 resident service，什么时候走 embedded/host-agent workflow。

![Codex Plugin tool surface 分层图](/images/ch10/01-codex-plugin-tool-surface.png)

## 本章回答

- Plugin 为什么是 Codex host adapter，而不是第二个 daemon。
- Tool surface catalog 如何统一 owner、handler、gate、resident route policy。
- Codex-local tools、Core tools、agent-facing public tools 和 admin tools 如何分层。
- status/diagnostics 为什么必须轻量、只读、fail closed。

## Tool surface catalog 是插件入口表

`AlembicPlugin/lib/codex/mcp/PluginToolSurfaceCatalog.ts` 是 Codex 可见工具元数据的单一表。每个工具都声明：

- `owner`：`codex-local` 或 `plugin-embedded-core`。
- `handlerOwner`：由 CodexMcpServer local、resident jobs、resident dashboard、McpServer host-agent 等谁处理。
- `tier`：agent 或 admin。
- `knowledgeGate`：cold-start、initialized、knowledge-ready、resident-project-scope、admin-opt-in 等。
- `residentRoutePolicy`：status-probe、dashboard-handoff、resident-or-embedded-jobs、explicit-resident-search 等。
- MCP annotations：readOnly、destructive、idempotent、openWorld。

这个 catalog 的价值是防漂移。工具 schema、ToolPolicy、Codex router 和 output contract 不应该各自解释一遍“这个工具由谁拥有、是否需要知识库、能不能写入、是否要走 resident service”。

## Codex-local 工具先解决身份和状态

Codex-local 工具包括 `alembic_codex_status`、`alembic_codex_diagnostics`、`alembic_codex_init`、`alembic_codex_dashboard`、`alembic_codex_bootstrap`、`alembic_codex_rescan`、`alembic_codex_job`、`alembic_codex_stop`、`alembic_codex_cleanup` 等。

其中 status 和 diagnostics 是最重要的第一步。它们不应该隐式启动 daemon，也不应该切换项目；它们读取当前 Codex host project、Ghost dataRoot、daemon state、knowledge state、plugin cache、tool visibility、runtime identity 和 host-project alignment。

这个设计让 Codex 在做知识工作前先确认：

- 当前 projectRoot 是否可信。
- Alembic workspace 是否初始化。
- dataRoot、database、recipes、candidates、skills 是否存在。
- daemon 是否 ready、stale 或 unavailable。
- 当前 Codex host project 是否和 Alembic selected/active runtime 对齐。
- 哪些工具因为知识未准备好而隐藏或降级。

## Core tools 是知识消费入口

Plugin 还暴露 `alembic_health`、`alembic_search`、`alembic_knowledge`、`alembic_structure`、`alembic_graph`、`alembic_call_context`、`alembic_guard`、`alembic_submit_knowledge`、`alembic_bootstrap`、`alembic_rescan`、`alembic_evolve`、`alembic_dimension_complete`、`alembic_panorama`、`alembic_project_skill` 等工具。

这些工具的底层语义大多来自 Core 或主 Alembic resident service。Plugin 的职责是把它们变成 Codex MCP 工具：输入 schema、visible text、structuredContent、错误 envelope、tool visibility、knowledge gate 和 handler route。

如果知识库为空，普通 knowledge/search/prime 工具不应该假装有答案。status 会告诉 Codex：先 cold start 或初始化。

## 六个 agent-facing public tools 是新工作流骨架

Plugin 的 public tools contract 明确列出六个主工具：

- `alembic_intent`
- `alembic_prime`
- `alembic_work_start`
- `alembic_work_finish`
- `alembic_code_guard`
- `alembic_decision_record`

它们不是普通查询工具，而是 Codex 工作流生命周期。`intent` 规范化宿主任务，`prime` 加载紧凑知识，`work_start` 建立证据工作范围，`work_finish` 关闭 workRef 并给出 Guard 建议，`code_guard` 只检查显式范围，`decision_record` 写入 durable decision。

这些工具让 Codex 的一次语义工作从“自由文本上下文”变成“有 intentRef、primeRef、workRef、detailRefs 和 guard result 的可追踪过程”。

## Tool visibility 是安全边界

Plugin 的 preflight 和 tool policy 会根据项目知识状态、tier、admin mode、knowledge gate、resident capability 决定工具是否可见。空项目只展示 cold-start/init 类工具；admin 工具需要显式环境变量；legacy `alembic_task` 已退休，调用会 fail closed。

这不是用户体验上的小优化，而是安全边界。没有 projectRoot、没有 knowledge state、没有 trusted host identity 时，Codex 不应该能直接提交候选、做无边界 Guard 或写决策。

## Resident route 与 embedded route

Plugin 可以消费本地 resident service，也可以携带 portable runtime artifact 用于 Codex plugin 运行。但 status 中会明确区分：

- resident service owner 是主 `Alembic`。
- Plugin-owned embedded runtime 是 Codex delivery route，不是长期 daemon source of truth。
- Dashboard handoff 只在本地 daemon 宣告 Dashboard capability 时返回 URL。
- Plugin 不重新引入 Dashboard frontend assets。

这条边界避免了最危险的漂移：Plugin 为了让 Codex 体验顺滑，复制一套主 runtime。

## Clean output 与 structuredContent

Codex MCP 工具需要把人可见文本和机器可读结构分开。Plugin 的 clean output projector、core-tools output、codex-local-tools output 和 public-tools output 都围绕这个目标。用户看到简洁摘要，Codex 可以读取结构化字段，例如 status、route、refs、warnings、nextActions、detailRefs。

好的 Plugin 输出不是越详细越好，而是让下一步可判定：ready、skipped、degraded、blocked、failed 各自为什么发生，需要调用哪个工具，哪些证据可引用。

## 本章小结

AlembicPlugin 的产品边界是 Codex host adapter。它管理 MCP tool surface、tool visibility、status/diagnostics/init、public workflow tools、resident route policy、clean output、Project Skill delivery 和 portable runtime artifact。

下一章会沿着 public tools 和 host-agent bootstrap/rescan 展开，说明 Codex 作为宿主 Agent 时，如何参与 Alembic 知识工作流。
