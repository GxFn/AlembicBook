Title at top in concise Chinese: "MCP 请求路由".

Draw one central request chain: "Codex / Claude Code" → "plugin shell + stdio" → "HostMcpServer" → "catalog" → "preflight" → "ToolPolicy".

From ToolPolicy create exactly three branches:
- "local handler"
- "embedded executor" → "Core"
- dashed "resident client" → "主 Alembic"

All three return to one output card: "visible text + structuredContent".

Add four compact protection labels around the chain: "软期限 120s / 600s", "EventLoopWatchdog", "pure-local baseline", and "主 daemon｜可选 resident". Add a small crossed-out carrier labeled "Plugin 内嵌 daemon 已移除" without implying the main daemon is gone.

Do not list individual tool names in this figure. Do not invent local tools or admin tools. Keep the request path and the distinction between embedded and resident visually dominant.
