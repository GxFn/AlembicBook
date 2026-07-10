# Ch10 MCP 请求链与宿主工具表面

AlembicPlugin 的核心职责是 host adaptation。它把 Alembic 的本地知识能力交给 Codex 和 Claude Code 这类宿主，但不把自己伪装成主 Alembic daemon，也不把 Dashboard 前端、AI provider runtime 或 Core domain 重新实现一遍。

本章不只列工具名，而是沿一次真实调用追踪：宿主 stdio 请求如何进入 HostMcpServer，怎样通过 preflight 与 policy，何时进入 embedded executor/Core handler，何时显式调用 resident service，以及输出如何回到宿主。

![Codex Plugin tool surface 分层图](/images/ch10/01-codex-plugin-tool-surface.png)

## 本章回答

- Plugin 为什么是 host adapter，而不是第二个 daemon。
- 一次 MCP 调用经过哪些 owner、gate、deadline 和 output projector。
- Tool surface catalog 如何统一 owner、handler、gate、resident route policy。
- Local runtime tools、ProjectContext/RecipeContext tools、agent-facing public tools 和 admin tools 如何分层。
- status/diagnostics 为什么必须轻量、只读、fail closed。

## Tool surface catalog 是插件入口表

`AlembicPlugin/lib/host-runtime/mcp/PluginToolSurfaceCatalog.ts` 是 host 可见工具元数据的单一表。每个工具都声明：

- `owner`：`codex-local` 或 `plugin-embedded-core`。
- `handlerOwner`：由 HostMcpServer local、resident jobs、McpServer host-agent、agent public tools、knowledge admin 等谁处理。
- `tier`：agent 或 admin。
- `knowledgeGate`：cold-start、initialized、knowledge-ready、resident-project-scope、admin-opt-in 等。
- `residentRoutePolicy`：status-probe、resident-project-scope、resident-or-embedded-jobs、explicit-resident-search 或 none。
- MCP annotations：readOnly、destructive、idempotent、openWorld。

这个 catalog 的价值是防漂移。工具 schema、ToolPolicy、Codex router 和 output contract 不应该各自解释一遍“这个工具由谁拥有、是否需要知识库、能不能写入、是否要走 resident service”。

## 一次调用的真实路径

宿主通过插件 shell 启动 runtime，stdio 请求进入 `AlembicPlugin/lib/host-runtime/mcp/HostMcpServer.ts`。HostMcpServer 先解析 catalog、当前 tier、知识状态和 route policy，再做 preflight；通过后，本地控制工具由 host local handler 处理，知识/工作流工具则进入 `AlembicPlugin/lib/host-runtime/mcp/host/embedded-executor.ts`，再交给 McpServer 中的具体 handler 与 Core service。只有 catalog 明确允许的搜索、project-scope 或 job 路径才会调用主仓 resident API。

```text
Codex / Claude Code
  -> plugin shell + stdio
  -> HostMcpServer
  -> catalog + preflight + ToolPolicy
  -> local handler | embedded executor | explicit resident client
  -> Core / host-agent handler
  -> clean visible text + structuredContent
```

这个链路解释了为什么“Plugin 使用 Core”不等于“所有工具都通过 daemon”，也解释了为什么 resident 不可用时 pure-local 仍是正常路径，而不是失败后的半功能 fallback。

每次调用还有两类时间保护：普通工具默认软期限 120 秒，重工具 600 秒；它们处理异步挂起。若同步工作堵住 Node event loop，普通计时器本身不会触发，因此 `EventLoopWatchdog.ts` 使用旁路 watchdog 发现卡死。两者保护的是不同故障，不能只保留其中一个就宣称有完整超时治理。

## Local runtime tools 先解决身份和状态

当前本地控制工具已经收敛成四个入口：

- `alembic_status`
- `alembic_init`
- `alembic_job`
- `alembic_runtime`

其中 status 是最重要的第一步。它不应该隐式启动 daemon，也不应该切换项目；它读取当前 host project、Ghost dataRoot、knowledge state、tool visibility、runtime identity、host-project alignment 和 onboarding contract。当前 Plugin status 默认报告 synthetic daemon-less 状态，message 为 `daemon removed (PDR-3)`；这表示 Codex 插件路径不再携带 embedded daemon carrier，而不是主 `Alembic` 仓库的 CLI daemon 消失。

这个设计让宿主在做知识工作前先确认：

- 当前 projectRoot 是否可信。
- Alembic workspace 是否初始化。
- dataRoot、database、recipes、candidates、skills 是否存在。
- Plugin 侧 daemon-less 状态与 resident/project-scope capability 是否可用。
- 当前 Codex host project 是否和 Alembic selected/active runtime 对齐。
- 哪些工具因为知识未准备好而隐藏或降级。

## Knowledge 与 ProjectContext tools 是消费入口

Plugin 当前 catalog 中的知识、结构和治理入口包括 `alembic_recipe_map`、`alembic_search`、`alembic_graph`、`alembic_plan`、`alembic_submit_knowledge`、`alembic_project_skill`、`alembic_bootstrap`、`alembic_rescan`、`alembic_evolve`、`alembic_consolidate`、`alembic_dimension_complete` 和 admin-only `alembic_knowledge_lifecycle`。

这些工具的底层语义大多来自 Core 的 ProjectContext、RecipeContext、host-agent workflow 和主 Alembic 的 project-scope/resident 能力。Plugin 的职责是把它们变成 MCP 工具：输入 schema、visible text、structuredContent、错误 envelope、tool visibility、knowledge gate 和 handler route。

如果知识库为空，search/prime 类工具不应该假装有答案。status 会告诉宿主：先 init、bootstrap 或修复 dataRoot。

当前 catalog 有 19 个 entries。按 handler/用途读，可以分成四类：

- Local/runtime control：`alembic_status`、`alembic_init`、`alembic_job`、`alembic_runtime`。
- ProjectContext、RecipeContext 与知识读写：`alembic_recipe_map`、`alembic_search`、`alembic_graph`、`alembic_plan`、`alembic_submit_knowledge`、`alembic_project_skill`。
- Host-agent 长流程与治理：`alembic_bootstrap`、`alembic_rescan`、`alembic_evolve`、`alembic_consolidate`、`alembic_dimension_complete`。
- Agent-facing public workflow 和 admin：`alembic_prime`、`alembic_work`、`alembic_code_guard`，以及 admin-only `alembic_knowledge_lifecycle`。

这个分组比“工具列表”更重要：它告诉读者哪些工具只读状态，哪些工具消费已有知识，哪些工具驱动知识建设，哪些工具属于宿主 Agent 日常工作闭环。

![19 个 MCP 工具职责分组](/images/ch10/02-mcp-tool-groups.png)

## 三个 agent-facing public tools 是日常工作骨架

`AlembicPlugin/lib/host-runtime/mcp/public-tools/contract.ts` 明确列出三个 agent-facing public tools：

- `alembic_prime`
- `alembic_work`
- `alembic_code_guard`

它们不是普通查询工具，而是宿主 Agent 的工作生命周期。`prime` 要求 `taskAction`、`requirementGoal` 和至少一个 locator facet；`work` 用 `phase=start|finish` 合并原来的 start/finish；`code_guard` 只接受显式 files、inline code 或 workRef-derived scoped files。

这些工具让一次语义工作从“自由文本上下文”变成“有 primeRef、workRef、finishRef、guard result、detailRefs 和 reason code 的可追踪过程”。旧的 `alembic_intent`、`alembic_work_start`、`alembic_work_finish`、`alembic_decision_record` 不再是 active public surface。

## Tool visibility 是安全边界

Plugin 的 preflight 和 tool policy 会根据项目知识状态、tier、admin mode、knowledge gate、resident/project-scope capability 决定工具是否可见。空项目只展示 cold-start/init 类工具；admin 工具需要显式环境变量；legacy `alembic_task` 已退休，调用会 fail closed。

这不是用户体验上的小优化，而是安全边界。没有 projectRoot、没有 knowledge state、没有 trusted host identity 时，Codex 不应该能直接提交候选、做无边界 Guard 或写决策。

## 工具说明有三层职责

工具 catalog 描述稳定能力和 annotations；public tool descriptions 解释 prime/work/Guard 的使用语义；每次响应中的 receipt、warnings、`nextActions` 与 detail refs 则说明当前状态下的下一步。三层不能互相替代：schema 不能承载整份操作手册，响应也不能临时改变工具权限。

这也是宿主 Agent 正确使用 Alembic 的关键。工具名只说明“能做什么”，当前 status/prime receipt 才说明“这个项目现在是否能做、为什么、下一步是什么”。

## Resident route 与 embedded route

Plugin 可以消费本地 resident/project-scope capability，也可以通过公开 runtime package 在宿主进程内运行。但 status 中会明确区分：

- resident service owner 是主 `Alembic`。
- Plugin-owned in-process MCP services、local stage cache 和 local vector 是 host delivery route，不是长期 daemon source of truth。
- Dashboard handoff 只在本地 daemon 宣告 Dashboard capability 时返回 URL。
- Plugin 不重新引入 Dashboard frontend assets。

`daemon removed (PDR-3)` 只指 Plugin 自己的 embedded daemon carrier。`HostMcpServer` 启动后仍会 fire-and-forget 探测主仓持久入口，必要时尝试恢复主 `Alembic` resident daemon；找不到入口时返回 unavailable 并保留 pure-local baseline。主 daemon 与 Plugin 内嵌执行器是两个对象。

这条边界避免了最危险的漂移：Plugin 为了让 Codex 体验顺滑，复制一套主 runtime。

## Clean output 与 structuredContent

Codex MCP 工具需要把人可见文本和机器可读结构分开。Plugin 的 clean output projector、core-tools output、codex-local-tools output 和 public-tools output 都围绕这个目标。用户看到简洁摘要，Codex 可以读取结构化字段，例如 status、route、refs、warnings、nextActions、detailRefs。

好的 Plugin 输出不是越详细越好，而是让下一步可判定：ready、skipped、degraded、blocked、failed 各自为什么发生，需要调用哪个工具，哪些证据可引用。

## 本章小结

AlembicPlugin 的产品边界是 host adapter。它管理 MCP tool surface、preflight/policy、调用期限、status/init/job/runtime、public workflow tools、resident/project-scope route policy、clean output、Project Skill delivery 和 runtime package。理解请求链比记住 19 个工具更重要：它能告诉你一次结果究竟来自 local、embedded Core 还是 resident API。

下一章会沿着 public tools 和 host-agent bootstrap/rescan 展开，说明 Codex 作为宿主 Agent 时，如何参与 Alembic 知识工作流。
