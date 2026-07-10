Title at top in concise Chinese: "Dashboard 是后端事实的投影".

Left side: group the exact nine top-level tabs into four readable clusters:
- "知识审阅": Recipes, Candidates, Knowledge.
- "项目结构": Panorama, Module Explorer.
- "规则能力": Guard, Skills.
- "运行观察": Jobs, Help.

Center: one large "API client｜唯一 normalizer" card. Draw three channels from it: "HTTP", "SSE", "WebSocket".

Right side: "主 Alembic resident service" with four short facts: "知识", "ProjectContext", "Guard", "Jobs / Panorama". Arrows must point from Dashboard through the client to the backend, never to Core or local files.

Bottom: a separate drift gate: "generated API types" → "hash + byte check" → "前后端一致".

Do not show Project Pyramid, Overview, Settings, invented endpoints, direct `.asd` file reads, secrets.json, or tab-to-storage mappings. Keep labels readable at book page width.
