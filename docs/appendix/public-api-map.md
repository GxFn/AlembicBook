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
- `@alembic/core/project-intelligence`
- `@alembic/core/host-agent-workflows`
- `@alembic/core/daemon`
- `@alembic/core/database`
- `@alembic/core/repositories`
- `@alembic/core/config`
- `@alembic/core/io`
- `@alembic/core/events`
- `@alembic/core/dimensions`
- `@alembic/core/evolution`
- `@alembic/core/vector`

消费原则：外层仓库应通过 package exports 使用 Core，不绕过入口 deep import sibling `src`。

## `@alembic/agent`

关键入口：

- `@alembic/agent`
- `@alembic/agent/agent`
- `@alembic/agent/runtime`
- `@alembic/agent/service`
- `@alembic/agent/prompts`
- `@alembic/agent/domain`
- `@alembic/agent/forge`
- `@alembic/agent/tasks`
- `@alembic/agent/profiles`
- `@alembic/agent/ai`
- `@alembic/agent/tools`
- `@alembic/agent/tools/terminal`
- `@alembic/agent/tools/v2`
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

服务入口：

- daemon/API server。
- `/api/v1/*` HTTP routes。
- Dashboard server/handoff。
- JobStore/process events/artifacts。

## AlembicPlugin MCP

入口：

- `alembic_codex_*` local tools。
- `alembic_intent` / `prime` / `work_start` / `work_finish` / `code_guard` / `decision_record`。
- knowledge/search/structure/graph/call_context/guard tools。
- bootstrap/rescan/evolve/dimension_complete/panorama/project_skill。

消费原则：Codex 通过 MCP 调用 Plugin；Plugin 再根据 route policy 消费 resident service、Core workflow contract 或 embedded runtime。

## Dashboard API

Dashboard 前端统一通过 `/api/v1` API client 消费后端。它不直接拥有 Core runtime，也不应重新定义 Knowledge lifecycle、search ranking 或 Guard semantics。
