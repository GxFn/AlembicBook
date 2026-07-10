Title at top in concise Chinese: "@alembic/core 公共契约脊柱".

Draw a large package boundary labeled "package exports｜66" rather than a single src/index.ts file. Inside, group representative public subpaths into four readable clusters:
- "项目与上下文": workspace, project-context, recipe-context.
- "知识与约束": knowledge, search, guard, evolution.
- "运行契约": host-agent-workflows, plans, daemon.
- "基础设施": database, repositories, vector, events.

Outside the boundary place only three consumer cards: "alembic-ai", "@alembic/agent", "alembic-runtime". Each enters through package exports. Add a separate note: "Dashboard 通过 /api/v1，不直连 Core".

On the right place a red crossed boundary: "禁止 sibling src deep import". Bottom principles: "public API first", "deterministic core", "consumer contracts".

Do not draw a unique `src/index.ts` gateway. Do not include decision-register or Dashboard as a Core package consumer. Avoid enumerating all 66 exports; show representative groups only.
