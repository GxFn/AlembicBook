Title at top in concise Chinese: "从用户项目到本地知识层".

Draw a five-step user journey: "projectRoot｜真实源码" → "ProjectScope｜多文件夹" → "WorkspaceResolver" → "dataRoot｜本地写入" → "Candidate → 人工审阅 → Recipe".

At WorkspaceResolver show two explicit modes:
- "Standard｜dataRoot = projectRoot"
- "Ghost｜~/.asd/workspaces/{id}"

Inside dataRoot draw two nested zones only: ".asd｜数据库 · 日志 · cache" and "Alembic｜recipes · candidates · skills · wiki". Keep source reads pointing back to projectRoot.

On the right show two consumers: "主 Alembic｜CLI / daemon / Dashboard" and "Codex / Claude Code｜Plugin MCP". Add a bottom privacy rule: "源码不搬家｜知识本地写入｜身份先对齐".

Do not use `~/.alembic/data`, scope.json, remote SaaS, or a Codex-only branch. Do not put project source code inside dataRoot.
