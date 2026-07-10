Title at top in concise Chinese: "配置与状态来源矩阵".

Draw a compact six-row matrix with columns "来源", "用途", "主要消费者".

Rows:
1. "package.json / alembic config" | "项目默认值" | "CLI / daemon".
2. "ALEMBIC_* env" | "启动覆盖" | "CLI / Plugin shell".
3. "~/.asd/projects.json" | "项目注册" | "runtime control / Plugin".
4. ".asd/settings.json" | "非密钥 AI 设置" | "daemon / Dashboard API".
5. ".asd/secrets.json｜0600" | "密钥" | "daemon only".
6. ".asd/daemon.json" | "resident 状态" | "CLI / Plugin / Dashboard handoff".

Below the matrix draw a separate host projection note: "Codex → .agents/skills" and "Claude Code → .claude/skills"; label both "投影，不是配置源".

Do not invent dataRoot/registry.json, `.asd/project.json`, providers.json, or direct Dashboard/Agent secret reads. Use checkmarks sparingly; prefer text labels over a dense grid of symbols.
