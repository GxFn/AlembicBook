# Appendix C MCP Tool Surface

本附录概览 Codex 插件当前 MCP tool surface。完整事实以 `AlembicPlugin/lib/codex/mcp/PluginToolSurfaceCatalog.ts`、`tools.ts`、public-tools contract 和实际 `tools/list` 为准。

![MCP tool grouping 图](/images/appendix/02-mcp-tool-grouping.png)

## Codex-local tools

这些工具由 Plugin 本地处理，主要负责状态、诊断、初始化、Dashboard handoff、recoverable jobs 和清理：

- `alembic_codex_status`
- `alembic_codex_diagnostics`
- `alembic_codex_init`
- `alembic_codex_dashboard`
- `alembic_codex_bootstrap`
- `alembic_codex_rescan`
- `alembic_codex_job`
- `alembic_codex_stop`
- `alembic_codex_cleanup`

status 和 diagnostics 应保持轻量只读，不隐式启动 daemon。

## Agent-facing public workflow tools

这六个工具是 Codex 日常语义工作的主路径：

- `alembic_intent`
- `alembic_prime`
- `alembic_work_start`
- `alembic_work_finish`
- `alembic_code_guard`
- `alembic_decision_record`

它们返回 refs、status、reason、detailRefs 和结构化 payload。legacy `alembic_task` 已退休，不应作为新路径。

## Knowledge/query tools

常见知识和结构工具包括：

- `alembic_health`
- `alembic_search`
- `alembic_knowledge`
- `alembic_structure`
- `alembic_graph`
- `alembic_call_context`
- `alembic_guard`
- `alembic_panorama`

这些工具通常需要项目已初始化和知识状态满足 gate。

## Workflow tools

长流程和知识治理相关工具包括：

- `alembic_bootstrap`
- `alembic_rescan`
- `alembic_submit_knowledge`
- `alembic_evolve`
- `alembic_consolidate`
- `alembic_dimension_complete`
- `alembic_enrich_candidates`
- `alembic_knowledge_lifecycle`

bootstrap/rescan 在 host-agent 路径中返回 Mission Briefing，不等同于任务已经完成。

## Project Skill tool

`alembic_project_skill` 管理 Project Skill source、load、refresh、upsert/create/update、export、delete。导出到 `.agents/skills` 需要项目级授权和 delivery receipt。

## 输出规则

- 人类可见文本应是摘要。
- 机器可读结论应在 structuredContent 中。
- blocked/degraded/skipped/failed 都必须有 reason。
- Code Guard 必须有 explicit files、inline code 或 workRef scope。
- Decision Record 必须走 resident durable route，不写 Plugin-local fake decision。
