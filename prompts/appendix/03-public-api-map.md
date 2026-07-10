Title at top in concise Chinese: "Alembic Public Surface Map".

Use three vertical columns.

Left "Registry packages": "@alembic/core｜66 exports", "@alembic/agent", "alembic-runtime｜alembic-codex-mcp". Show Agent and runtime depending on Core.

Center "用户与宿主入口": "alembic-ai｜CLI / daemon", "Codex 轻壳", "Claude Code 轻壳", "MCP catalog｜19". Connect both shells to the same alembic-runtime package.

Right "UI / HTTP": "AlembicDashboard｜Vite build", "/api/v1", "route families 25", "provider routes 31". Connect Dashboard only to `/api/v1`, and `/api/v1` to alembic-ai.

Bottom red boundary: "private Plugin 根包不发布" and "禁止 deep import / cache 充当源码".

Do not show @alembic/agent as an MCP client. Do not include decision-register. Do not draw Dashboard as a Core consumer.
