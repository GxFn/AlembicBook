# Appendix B Public API Map

本附录列出当前书稿中经常引用的公开入口。它不是完整 API 文档，而是帮助读者定位“应该从哪个包入口消费能力”。

![Public API map 图](/images/appendix/03-public-api-map.png)

## `@alembic/core`

关键入口：

- `@alembic/core`
- `@alembic/core/workspace`
- `@alembic/core/knowledge`
- `@alembic/core/search`
- `@alembic/core/guard`
- `@alembic/core/project-context`
- `@alembic/core/project-context-capabilities`
- `@alembic/core/recipe-context-capabilities`
- `@alembic/core/host-agent-workflows`
- `@alembic/core/plans`
- `@alembic/core/daemon`
- `@alembic/core/database`
- `@alembic/core/repositories`
- `@alembic/core/config`
- `@alembic/core/io`
- `@alembic/core/events`
- `@alembic/core/dimensions`
- `@alembic/core/evolution`
- `@alembic/core/vector`
- `@alembic/core/report`
- `@alembic/core/core/analysis`
- `@alembic/core/core/ast`
- `@alembic/core/core/discovery`

消费原则：外层仓库应通过 package exports 使用 Core，不绕过入口 deep import sibling `src`。`package.json` exports 是公共 API 边界；新增消费者需要先确认入口存在。

## `@alembic/agent`

关键入口：

- `@alembic/agent`
- `@alembic/agent/agent`
- `@alembic/agent/runtime`
- `@alembic/agent/service`
- `@alembic/agent/prompts`
- `@alembic/agent/domain`
- `@alembic/agent/tasks`
- `@alembic/agent/profiles`
- `@alembic/agent/ai`
- `@alembic/agent/tools/terminal`
- `@alembic/agent/tools/runtime`
- `@alembic/agent/memory`
- `@alembic/agent/context`

消费原则：Agent 发布时使用 registry Core 依赖，workspace 开发时可用 `file:../AlembicCore`。

## `alembic-ai`

用户入口：

- `alembic setup`
- `alembic start`
- `alembic ai status/configure/import-env`
- `alembic daemon start/status/stop`
- `alembic projects ...`
- `alembic coldstart`
- `alembic rescan`
- `alembic search`
- `alembic guard`
- `alembic status`
- `alembic health`
- `alembic embed`
- `alembic task list/sync/list-warnings`

服务入口：

- daemon/API server。
- `/api/v1/*` HTTP routes。
- Dashboard server/handoff。
- JobStore/process events/artifacts。

## AlembicPlugin MCP

入口：

- `alembic_status` / `alembic_init` / `alembic_job` / `alembic_runtime`。
- `alembic_recipe_map` / `alembic_search` / `alembic_graph` / `alembic_plan`。
- `alembic_prime` / `alembic_work` / `alembic_code_guard`。
- `alembic_bootstrap` / `alembic_rescan` / `alembic_submit_knowledge` / `alembic_evolve` / `alembic_consolidate` / `alembic_dimension_complete` / `alembic_project_skill`。
- admin-only `alembic_knowledge_lifecycle`。

消费原则：Codex 或 Claude Code 通过 MCP 调用 Plugin；Plugin 再根据 route policy 消费 resident/project-scope capability、Core workflow contract 或 in-process host runtime。

## Dashboard API

Dashboard 前端统一通过 `/api/v1` API client 消费后端。它不直接拥有 Core runtime，也不应重新定义 Knowledge lifecycle、search ranking 或 Guard semantics。
