Title at top in concise Chinese: "Alembic 五仓库运行边界".

Create a readable left-to-right architecture map with five distinct repository cards. Keep only these primary labels:
- "用户项目" with two separate roots: "projectRoot｜代码事实" and "dataRoot｜知识写入".
- "Alembic｜CLI · daemon · HTTP" as the resident runtime.
- "AlembicCore｜确定性内核" and "AlembicAgent｜AI / tool runtime" as two separate dependencies below Alembic.
- "AlembicPlugin｜MCP host adapter" connected from "Codex / Claude Code".
- "AlembicDashboard｜审阅 UI" connected through "/api/v1" to Alembic, never directly to Core.

Show Alembic consuming Core and Agent. Show Plugin consuming Core in-process, plus one dashed optional arrow from Plugin to "主 Alembic resident API". Put "AlembicWorkspace / Book｜协作与文档" in a small dashed box outside the product runtime.

Bottom legend: "代码事实", "知识写入", "可选 resident".

Avoid merging Agent and Dashboard. Do not place SQLite inside Core. Do not use `.alembic/`. Do not imply Workspace or Book participates in runtime execution. Keep all labels large; no paragraphs or tiny file lists.
