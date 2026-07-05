# Ch12 Skills、Channel 与交付资源

AlembicPlugin 不只暴露 MCP 工具，还要把项目知识以 Codex 可以长期识别的资源形式交付出去。这里最重要的是 Project Skills、plugin channel、portable runtime 和本地 plugin cache。它们看起来都像“文件复制”，但每一种都有不同的事实源和授权边界。

本章讲交付层：项目 Skill 从哪里生成，什么时候能导出到 `.agents/skills`，receipt 为什么必要，channel/runtime artifact 如何与源码保持关系。

![Project Skill delivery 与 plugin artifact 图](/images/ch12/01-project-skill-delivery-artifacts.png)

源码锚点：`AlembicPlugin/lib/service/skills/ProjectSkillDelivery.ts`、`AlembicPlugin/lib/service/skills/ProjectSkillService.ts`、`AlembicPlugin/scripts/prepare-codex-plugin-runtime.mjs`。

## 本章回答

- Project Skill 源和 Codex runtime 投影有什么区别。
- 为什么导出 Skill 需要授权和 receipt。
- Plugin channel、runtime.tgz、cache refresh 各自解决什么问题。
- 为什么不能把 plugin cache 或 portable runtime 当源码改。

## Project Skill 的源在 dataRoot

Alembic 的项目 Skill 源应该保存在 `dataRoot/Alembic/skills/{skill-name}/SKILL.md`。这是知识层的一部分，属于当前项目 scope。Codex runtime 可见的 `.agents/skills/{skill-name}/SKILL.md` 是投影，不是默认事实源。

这一区分保护两件事：

- Alembic 可以在 Ghost dataRoot 中维护项目知识，而不直接写用户项目。
- Codex runtime 只在用户授权后看到项目 Skill。

如果把 `.agents/skills` 当成唯一源，就会绕过 Alembic 的 receipt、authorization、conflict 和 refresh 机制。

## Delivery receipt 是交付证据

`ProjectSkillDelivery.ts` 会构建 `ProjectSkillDeliveryReceipt`。receipt 记录 projectRoot、projectScopeId、codexSkillRoot、skillName、sourcePath、contentHash、asset、evidenceRefs、authorization、runtimeExport、managedMarker 和 shoutSummary。

这些字段不是繁文缛节。它们回答了交付时最重要的问题：

- 这个 Skill 属于哪个项目 scope。
- 源文件在哪里。
- 内容 hash 是什么。
- 是否需要授权。
- runtime export 状态是什么。
- 目标 `.agents/skills` 里是否已有冲突。
- Alembic 是否管理这个投影。

没有 receipt，后续 refresh、delete、export、冲突处理都会变成猜测。

当前 delivery 代码位于 `AlembicPlugin/lib/service/skills`，不再放在早期 runtime 目录。这符合新的分层：host-runtime 处理 MCP/status/tool route，service/skills 处理 Project Skill 源、receipt、export 和冲突状态，脚本层再把插件级 runtime artifact 打包出去。把这三层混成一个 runtime 目录，会让读者误以为 Skill 交付只是 MCP handler 的副作用。

## 导出需要项目级授权

Project Skill export 默认是 symlink-first，但只有在授权后才会写入 Codex runtime。未授权时，receipt 可以存在，source 可以存在，但 runtimeExportStatus 会 blocked/pending。

这与 Alembic 的 Ghost 理念一致：生成项目知识和让宿主 Agent 自动消费项目知识，是两个不同动作。前者可以在 Alembic dataRoot 中完成，后者需要项目级授权。

## 冲突处理不能靠覆盖

导出时会检查 target dir、target SKILL.md、`.alembic-managed.json`、generation hash、generatedSkillId 和 source path。如果已有目标不是 Alembic 管理，或 hash/id 不匹配，就应返回 conflictStatus，而不是直接覆盖。

这种保守策略很重要，因为 `.agents/skills` 也可能包含用户手写 Skill 或其他工具生成的 Skill。Alembic 只能管理自己有 receipt 和 marker 的投影。

## Built-in skills 与 Project Skills

Plugin 自带 `alembic`、`alembic-create`、`alembic-guard`、`alembic-recipes`、`alembic-structure` 等 built-in skills。这些 skills 是插件能力说明，不属于某个用户项目。

Project Skills 则来自当前项目知识层，可以由 Alembic refresh/upsert/create/update 管理。`alembic_project_skill` 会在 load 时优先看 `.agents/skills` runtime projection，再看 dataRoot source，再看 built-in plugin skill。

这个优先级让项目本地知识可以覆盖通用指导，同时保留内置能力作为 fallback。

## Channel 和 runtime artifact

Codex 插件交付还包括 channel metadata、plugin shell、assets、`.codex-plugin/plugin.json`、`.mcp.json`、skills、runtime.tgz 等。`prepare-codex-plugin-runtime.mjs` 会把 dist、config、templates、injectable skills、channels、`.agents`、plugin shell snapshot、embedded Core package 和 bundled runtime dependencies 打进 portable runtime。

`verify-release-package-boundary.mjs` 则明确 root package private，root registry publish disabled，Codex plugin 通过 artifact/channel 释放，embedded runtime 使用 `@alembic/core: file:vendor/AlembicCore` 并记录 source metadata。

这说明 Plugin 的发布物不是普通 npm root package，而是 Codex plugin artifact。

## Cache refresh 是本地安装维护动作

开发时 `dev:codex-plugin:reload`、`dev:codex-plugin:sync`、`dev:codex-plugin:verify` 会刷新和验证本地 Codex plugin cache。cache 是运行副本，不是 source repo。改源码后需要 build/reload/probe，让安装的插件指向新 dist 或新 runtime artifact。

不要直接在 `~/.codex/plugins/cache/...` 里改源码。那会让本地运行暂时变化，却失去仓库 commit、build、release 和 source metadata 证据。

## 本章小结

AlembicPlugin 的交付层有两类资源：项目级 Project Skills 和插件级 channel/runtime artifact。Project Skills 从 dataRoot 源生成，经 receipt、authorization、conflict 检查后投影到 `.agents/skills`；插件 artifact 从 Plugin 源构建，经 release boundary guard 和 cache refresh 进入 Codex。

理解这层之后，Plugin 的职责就完整了：它既提供 MCP 工具，也提供可持续的宿主知识交付路径，但仍不越界成为主 daemon、Dashboard 或 Core。
