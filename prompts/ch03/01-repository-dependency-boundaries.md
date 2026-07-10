Title at top in concise Chinese: "仓库依赖与交付边界".

Draw a dependency map with a visible legend: "A → B 表示 A 依赖 B". Use these package/runtime cards:
- "@alembic/core"
- "@alembic/agent"
- "alembic-ai"
- "alembic-runtime"
- "AlembicPlugin 根包｜private"
- "Codex 轻壳"
- "Claude Code 轻壳"
- "AlembicDashboard｜Vite build"
- "/api/v1"

Draw only these relations: Agent → Core; alembic-ai → Core and Agent; alembic-runtime → Core; Dashboard → /api/v1 → alembic-ai; Dashboard build → alembic-ai; Plugin private root → both shells and the runtime package.

Add a bottom red boundary strip with three concise warnings: "禁止 internal import", "file:../ 仅开发", "禁止直接改 cache".

Do not draw Dashboard depending directly on Core. Do not invent `@alembic/plugin`, runtime.tgz, vendor ownership, or a single linear release chain. Keep labels large and arrows sparse.
