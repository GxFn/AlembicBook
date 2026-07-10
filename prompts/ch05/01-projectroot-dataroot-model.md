Title at top in concise Chinese: "projectRoot 与 dataRoot 双根模型".

Draw two large vertical roots with a WorkspaceResolver decision in the center.

Left "projectRoot｜始终读取真实源码": show only src, tests, docs, package config. Add label "realpath → projectId".

Center decision:
- "Standard｜dataRoot = projectRoot"
- "Ghost｜dataRoot = ~/.asd/workspaces/{id}"

Right "dataRoot｜Alembic 写入边界": draw exactly two top-level zones:
- ".asd/": alembic.db, logs, cache, context, settings.json, secrets.json.
- "Alembic/": recipes, candidates, skills, wiki.

At the top add the global registry "~/.asd/projects.json" pointing to project identity. Add a red rule: "绝不把 Ghost 数据写回用户仓库".

Do not use `~/.alembic`, root-level Recipes/Candidates folders, config.json as the only config, or an indexes/artifacts tree without evidence. Keep filesystem labels large.
