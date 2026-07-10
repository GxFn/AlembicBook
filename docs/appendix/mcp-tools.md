# Appendix C MCP Tool Surface

本附录概览当前 Plugin MCP tool surface。完整事实以 `AlembicPlugin/lib/host-runtime/mcp/PluginToolSurfaceCatalog.ts`、`AlembicPlugin/lib/shared/schemas/mcp-tools.ts`、public-tools contract 和真实 `tools/list` 为准。

![MCP tool grouping 图](/images/appendix/02-mcp-tool-grouping.png)

## Catalog 分组

当前 catalog 有 19 个 entries。

Local/runtime control：

- `alembic_status`
- `alembic_init`
- `alembic_job`
- `alembic_runtime`

ProjectContext、RecipeContext 与知识读写：

- `alembic_recipe_map`
- `alembic_search`
- `alembic_graph`
- `alembic_plan`
- `alembic_submit_knowledge`
- `alembic_project_skill`

Host-agent 长流程与治理：

- `alembic_bootstrap`
- `alembic_rescan`
- `alembic_evolve`
- `alembic_consolidate`
- `alembic_dimension_complete`

Agent-facing public workflow：

- `alembic_prime`
- `alembic_work`
- `alembic_code_guard`

Admin-only：

- `alembic_knowledge_lifecycle`

## 三个 public workflow tools

`alembic_prime`、`alembic_work`、`alembic_code_guard` 是当前 active public surface。它们返回 refs、status、reason、detailRefs 和结构化 payload。旧的 `alembic_intent`、`alembic_work_start`、`alembic_work_finish`、`alembic_decision_record` 不再是 public tool；legacy `alembic_task` 已退休，调用应 fail closed。

`alembic_work` 用 `phase=start|finish` 合并工作生命周期。`alembic_code_guard` 必须有 explicit files、inline code 或 workRef scope，不接受 no-args whole-diff review。

## ProjectContext 先行

当前 onboarding contract 推荐先用 `alembic_recipe_map` 和 `alembic_graph` 做 compact orientation，再用 raw source reads、Guard 和仓库验证证明当前行为。`alembic_graph` 是 Recipe-free ProjectContext 图；`alembic_recipe_map` 是结构区域加 Recipe 挂载。二者都是定位证据，不是最终验收。

## 请求与期限

一次工具调用依次经过 HostMcpServer、catalog/preflight/ToolPolicy，再进入 local handler、embedded executor 或显式 resident client。普通工具默认软期限 120 秒，重工具 600 秒；同步 event-loop stall 由独立 watchdog 观察。工具数量是 catalog 上限，最终 `tools/list` 还受 tier、knowledge gate、admin opt-in 与 resident capability 过滤。

## 输出规则

- 人类可见文本应是摘要。
- 机器可读结论应在 structuredContent 中。
- blocked/degraded/skipped/failed 都必须有 reason。
- Admin tool 需要显式 admin gate。
- Plugin status 的 `daemon removed (PDR-3)` 只指退休的 embedded daemon carrier；主 `Alembic` resident daemon 仍归主仓库，Plugin 也可探测它。
