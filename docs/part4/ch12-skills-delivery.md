# Ch12 双宿主 Skills 与 Runtime 交付

AlembicPlugin 不只暴露 MCP 工具，还要把项目知识和固定版本 runtime 交付给 Codex 与 Claude Code。Project Skill 源、宿主投影、marketplace shell、公开 `alembic-runtime` 包和本地 runtime cache 看起来都像“复制文件”，但每一种有不同的事实源、授权和版本边界。

本章讲交付层：项目 Skill 从哪里生成，怎样由 HostAdapter 选择 `.agents/skills` 或 `.claude/skills`，receipt 为什么必要，轻量 shell 如何下载并校验公开 runtime 包。

![Project Skill delivery 与 plugin artifact 图](/images/ch12/01-project-skill-delivery-artifacts.png)

源码锚点：`AlembicPlugin/lib/service/skills/ProjectSkillDelivery.ts`、`AlembicPlugin/lib/host-runtime/host-adapter/HostAdapter.ts`、`AlembicPlugin/plugins/alembic-codex/bin/alembic-start.mjs`、`AlembicPlugin/plugins/alembic-claude-code/.claude-plugin/plugin.json`、`AlembicPlugin/packages/alembic-runtime/package.json`。

## 本章回答

- Project Skill 源和两个宿主 runtime 投影有什么区别。
- 为什么导出 Skill 需要授权和 receipt。
- Plugin shell、公开 runtime package、cache refresh 各自解决什么问题。
- 为什么不能把 marketplace shell、runtime cache 或 plugin cache 当源码改。

## Project Skill 的源在 dataRoot

Alembic 的项目 Skill 源应该保存在 `dataRoot/Alembic/skills/{skill-name}/SKILL.md`。这是知识层的一部分，属于当前项目 scope。Codex 可见的 `.agents/skills/{skill-name}/SKILL.md` 与 Claude Code 可见的 `.claude/skills/{skill-name}/SKILL.md` 都是投影，不是默认事实源。

这一区分保护两件事：

- Alembic 可以在 Ghost dataRoot 中维护项目知识，而不直接写用户项目。
- 宿主 runtime 只在用户授权后看到项目 Skill。

如果把任一宿主技能目录当成唯一源，就会绕过 Alembic 的 receipt、authorization、conflict 和 refresh 机制。

HostAdapter 统一 project root trust、manifest layout、init marker、saved root 与 Skill root；CodexHostAdapter 选择 `.agents/skills`，ClaudeCodeHostAdapter 选择 `.claude/skills`。双宿主差异应停留在 adapter，不应复制 Skill 业务逻辑。

## Delivery receipt 是交付证据

`ProjectSkillDelivery.ts` 会构建 `ProjectSkillDeliveryReceipt`。receipt 记录 projectRoot、projectScopeId、codexSkillRoot、skillName、sourcePath、contentHash、asset、evidenceRefs、authorization、runtimeExport、managedMarker 和 shoutSummary。

这些字段不是繁文缛节。历史字段名可能仍带 codex，但目标 root 由当前 host adapter 决定。它们回答了交付时最重要的问题：

- 这个 Skill 属于哪个项目 scope。
- 源文件在哪里。
- 内容 hash 是什么。
- 是否需要授权。
- runtime export 状态是什么。
- 目标宿主 Skill 目录里是否已有冲突。
- Alembic 是否管理这个投影。

没有 receipt，后续 refresh、delete、export、冲突处理都会变成猜测。

当前 delivery 代码位于 `AlembicPlugin/lib/service/skills`，不再放在早期 runtime 目录。这符合新的分层：host-runtime 处理 MCP/status/tool route，service/skills 处理 Project Skill 源、receipt、export 和冲突状态，脚本层再把插件级 runtime artifact 打包出去。把这三层混成一个 runtime 目录，会让读者误以为 Skill 交付只是 MCP handler 的副作用。

## 导出需要项目级授权

Project Skill export 默认是 symlink-first，但只有在授权后才会写入宿主 runtime。未授权时，receipt 可以存在，source 可以存在，但 runtimeExportStatus 会 blocked/pending。

这与 Alembic 的 Ghost 理念一致：生成项目知识和让宿主 Agent 自动消费项目知识，是两个不同动作。前者可以在 Alembic dataRoot 中完成，后者需要项目级授权。

## 冲突处理不能靠覆盖

导出时会检查 target dir、target SKILL.md、`.alembic-managed.json`、generation hash、generatedSkillId 和 source path。如果已有目标不是 Alembic 管理，或 hash/id 不匹配，就应返回 conflictStatus，而不是直接覆盖。

这种保守策略很重要，因为 `.agents/skills` 也可能包含用户手写 Skill 或其他工具生成的 Skill。Alembic 只能管理自己有 receipt 和 marker 的投影。

## Built-in skills 与 Project Skills

Plugin 自带 `alembic`、`alembic-create`、`alembic-guard`、`alembic-recipes`、`alembic-structure` 等 built-in skills。这些 skills 是插件能力说明，不属于某个用户项目。

Project Skills 则来自当前项目知识层，可以由 Alembic refresh/upsert/create/update 管理。`alembic_project_skill` 通过 host adapter 查看 runtime projection，再看 dataRoot source，最后使用 built-in plugin skill。

这个优先级让项目本地知识可以覆盖通用指导，同时保留内置能力作为 fallback。

## 轻量 shell 与公开 runtime package

Codex shell 使用 `.codex-plugin/plugin.json` 与 `.mcp.json`，Claude Code shell 把 MCP 声明放在 `.claude-plugin/plugin.json`；二者最终都执行各自 marketplace 目录里的 alembic-start 启动器。shell 不携带另一套业务 runtime，而是固定下载、校验并启动同一版本的公开 `alembic-runtime` 包。

Plugin 根包 `alembic-codex-plugin-runtime` 仍是 private 开发仓，禁止 root npm publish；真正的 registry 交付物是 `AlembicPlugin/packages/alembic-runtime/package.json` 定义的公开 `alembic-runtime@0.3.0`，bin 为 `alembic-codex-mcp`，依赖同版本 registry `@alembic/core`。这把源码开发依赖与用户安装依赖重新收回包边界。

首次启动时，shell 从显式环境、宿主 plugin data、plugin 内 `.runtime` 或用户 cache 选择存储位置，并用安装锁和 stale-lock 清理保护并发。离线且精确版本不在 cache 时，它返回可恢复错误，不会静默换成其他版本。

## Cache refresh 是本地安装维护动作

开发时 `dev:codex-plugin:reload`、`dev:codex-plugin:sync`、`dev:codex-plugin:verify` 会刷新和验证本地 Codex plugin cache。cache 是运行副本，不是 source repo。改源码后需要 build/reload/probe，让安装的 shell/runtime 指向经过验证的新版本。

不要直接在 `~/.codex/plugins/cache/...` 里改源码。那会让本地运行暂时变化，却失去仓库 commit、build、release 和 source metadata 证据。

## 本章小结

AlembicPlugin 的交付层有两类资源：项目级 Project Skills 和插件级 shell/runtime。Project Skills 从 dataRoot 源生成，经 receipt、authorization、conflict 检查后投影到当前宿主 Skill root；Codex/Claude Code 轻壳则固定获取同一个公开 `alembic-runtime`，并用 cache、锁与版本校验保证可恢复启动。

理解这层之后，Plugin 的职责就完整了：它既提供 MCP 工具，也提供可持续的宿主知识交付路径，但仍不越界成为主 daemon、Dashboard 或 Core。
