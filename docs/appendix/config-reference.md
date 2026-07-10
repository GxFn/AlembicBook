# Appendix A 配置和运行目录参考

本附录记录 Alembic 当前书稿需要理解的配置来源和运行目录。它不是各仓库 README、release playbook 或 CLI help 的替代品；遇到实现细节，以本地源码和实际 status 输出为准。

![配置来源矩阵图](/images/appendix/01-config-source-matrix.png)

## 项目路径

| 名称 | 含义 | 主要消费者 |
| --- | --- | --- |
| `projectRoot` | 真实源码项目目录 | Core analysis、CLI、daemon、Codex host alignment |
| `dataRoot` | Alembic 数据写入边界 | `.asd/`、`Alembic/`、resident service、Plugin |
| `.asd/` | 本地运行态目录 | daemon、SQLite、jobs、logs、vector index、settings/secrets |
| `Alembic/` | 项目知识资产目录 | recipes、candidates、skills、wiki |
| `.agents/skills/` | Codex runtime 可见 Skill 投影 | Codex host agent |
| `.claude/skills/` | Claude Code runtime 可见 Skill 投影 | Claude Code host agent |

Ghost 模式下，`projectRoot` 仍指向真实源码目录，`dataRoot` 通常位于 `~/.asd/workspaces/{projectId}/`。ProjectScope 模式下，一个 dataRoot 可以覆盖多个源码 folder。

## `.asd/` 常见内容

- `config.json`：项目配置。
- `settings.json` / `secrets.json`：工作区配置和密钥。
- `alembic.db`：SQLite 运行缓存和索引入口。
- `context/`：向量索引和上下文缓存。
- `logs/`：daemon、reports、signals、errors。
- `jobs/`：bootstrap/rescan 等长任务记录。
- `daemon.json` / `daemon.pid`：resident service 状态。

`.asd/` 是运行态，不是长期协作文档。

## `Alembic/` 常见内容

- `constitution.yaml`：权限、角色、治理规则和能力探测。
- `boxspec.json`：项目规格。
- `recipes/`：被接受、可检索、可约束的知识。
- `candidates/`：待审候选知识。
- `skills/`：Project Skill 源。
- `wiki/`：阅读投影。

## AI 配置来源

AI provider 可以来自 workspace settings/secrets、环境变量、CLI 参数或 Dashboard 后端配置接口。常见字段包括 provider、model、API key、proxy、reasoning effort、embedding provider/model/base URL/key。

主 Alembic resident service 和 `@alembic/agent` 使用这些配置跑 provider-backed jobs。Codex Plugin 的 host-agent workflow 不要求保存第三方 provider key。

## 仓库配置

- `Alembic/package.json`：CLI、daemon、main runtime、Dashboard server、release、local Core build。
- `AlembicCore/package.json`：public exports、Core check、public API boundary、release readiness。
- `AlembicAgent/package.json`：AgentRuntime、AI、tools、release staging。
- `AlembicPlugin/package.json`：Plugin 开发根、MCP、shell/runtime package、cross-shell 与 session verification。
- `AlembicDashboard/package.json`：React/Vite frontend、contract test、typecheck、build。

## 配置排查顺序

1. 确认当前 `projectRoot`。
2. 确认 registry 中的 `projectId` 和 Ghost/standard mode。
3. 确认 `dataRoot`、`.asd/`、`Alembic/` 是否存在。
4. 确认 daemon state 和 Dashboard URL。
5. 确认 workspace settings/secrets 与 provider readiness。
6. 确认 Codex host project 与 Alembic runtime alignment。
