# MCP 工具参考

> 当前 MCP Server 在 `lib/external/mcp/tools.ts` 中声明 19 个工具：17 个 Agent 层工具，2 个 Admin 层工具。工具名统一使用 `alembic_*` 前缀。

## Agent 层工具

### `alembic_health`

服务健康检查与知识库统计。常用于首次确认 Alembic 后台是否可用，以及判断知识库是否为空。

### `alembic_search`

知识搜索。支持 auto、keyword、bm25、semantic、context 等模式，返回按 kind 分组的 Recipe / Fact / Pattern。

### `alembic_knowledge`

知识浏览与使用记录。支持 list、get、insights、confirm_usage。

### `alembic_structure`

项目结构查询。支持 targets、files、metadata。

### `alembic_graph`

知识关系图谱查询。支持 query、impact、path、stats。

### `alembic_call_context`

函数/方法调用上下文查询。支持 callers、callees、impact、both。

### `alembic_guard`

代码合规检查。无参数时自动检查 git diff 增量文件；也支持 files、code、reverse_audit、coverage_matrix。

### `alembic_submit_knowledge`

统一知识提交管线。支持单条或批量 items，走 V3 字段校验、合并/重叠分析、ConfidenceRouter 和 evolution/consolidation 后续动作。

### `alembic_skill`

Skill 管理。只读操作包括 list、load、suggest；写操作包括 create、update、delete。

### `alembic_bootstrap`

冷启动入口。外部 Agent 路径返回 Mission Briefing；内部路径由 HTTP/CLI/Dashboard 调用对应 workflow 自动填充。

### `alembic_rescan`

知识重扫入口。保留现有 Recipe，清理衍生缓存，重新构建项目上下文，执行 Recipe relevance audit，并返回 rescan Mission Briefing 或内部 gap-fill 计划。

### `alembic_evolve`

批量 Recipe 进化决策。用于 propose_evolution、confirm_deprecation、skip 等操作。

### `alembic_consolidate`

外部 Agent 对语义重叠、合并、保留、拒绝等灰区候选做显式决策。

### `alembic_dimension_complete`

外部 Agent 完成一个冷启动或重扫维度后的回调。负责绑定 Recipe、保存 checkpoint、生成 Skill、更新 session 进度并触发 completion finalizer。

### `alembic_wiki`

Wiki 工作流。plan 为只读规划，finalize 会写入生成结果。

### `alembic_panorama`

项目全景查询。返回模块、分层、耦合、覆盖率等汇总。

### `alembic_task`

意图生命周期管理。支持 prime、create、close、fail、record_decision，用于让外部 IDE Agent 在编码前后显式锚定任务和强制 Guard。

## Admin 层工具

### `alembic_enrich_candidates`

候选知识富化。Admin/CI 工具链使用。

### `alembic_knowledge_lifecycle`

知识生命周期管理。Admin/CI 工具链使用。

## Gateway 映射

只读工具通常不需要 Gateway 写权限。写操作或高风险操作会映射到 Gateway action：

| 工具 | Gateway Action | Resource |
|:---|:---|:---|
| `alembic_submit_knowledge` | `knowledge:create` | `knowledge` |
| `alembic_rescan` | `knowledge:bootstrap` | `knowledge` |
| `alembic_dimension_complete` | `knowledge:bootstrap` | `knowledge` |
| `alembic_wiki` finalize | `knowledge:create` | `knowledge` |
| `alembic_evolve` | `knowledge:evolve` | `knowledge` |
| `alembic_consolidate` | `knowledge:consolidate` | `knowledge` |
| `alembic_guard` files 模式 | `guard_rule:check_code` | `guard_rules` |
| `alembic_skill` create | `create:skills` | `skills` |
| `alembic_skill` update | `update:skills` | `skills` |
| `alembic_skill` delete | `delete:skills` | `skills` |
| `alembic_task` create | `task:create` | `intent` |
| `alembic_task` close/fail | `task:update` | `intent` |
| `alembic_task` record_decision | `task:create` | `intent` |
| `alembic_enrich_candidates` | `knowledge:update` | `knowledge` |
| `alembic_knowledge_lifecycle` | `knowledge:update` | `knowledge` |

MCP Server 自身也通过 `ToolRouter` 执行工具。`buildMcpToolCapabilities()` 会把这些声明投影为 `mcp-tool` manifest，并附加 externalTrust、surface、risk、execution 和 governance profile。
