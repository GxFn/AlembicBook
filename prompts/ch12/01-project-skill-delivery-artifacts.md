Title at top in concise Chinese: "Project Skill 与 Runtime 交付".

Use two horizontal lanes.

Top green lane, Project Skill projection:
"dataRoot/Alembic/skills/{skill}/SKILL.md" → "receipt" → "授权" → "冲突检查", then split to ".agents/skills/{skill}" and ".claude/skills/{skill}". Add small labels "symlink-first", "投影，不是源", "contentHash", "runtimeExport", "managedMarker". Add one red stop branch: "非 Alembic 管理 → 停止".

Bottom blue/purple lane, runtime delivery:
"AlembicPlugin｜private" → two shells "Codex 轻壳" and "Claude Code 轻壳" → "alembic-runtime@固定版本" → "精确版本 cache" → "alembic-codex-mcp". Draw `@alembic/core` as a dependency below the public runtime package. Add one red failure branch: "离线且缺精确版本 → 可恢复错误".

Do not invent skills.json, channel/version/signature receipt fields, runtime.tgz, vendor source ownership, or a single Codex-only projection. Keep visible text concise and file paths large enough to read.
