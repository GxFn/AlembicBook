# Ch05 项目模型、路径和存储

Alembic 的项目模型有一个容易被低估的核心：源码位置和知识写入位置不是同一个概念。`projectRoot` 表示真实用户项目，`dataRoot` 表示 Alembic 数据边界。Ghost 模式、多 folder project scope、Codex host alignment、daemon runtime、Dashboard handoff 和 Project Skills 都依赖这个分离。

如果这层分不清，后面的所有现象都会变得混乱：为什么 Dashboard 看的是外置目录，为什么 Codex status 会强调 host project，为什么 `.asd/` 不能提交，为什么 `Alembic/recipes` 不是数据库缓存，为什么 Plugin 不能拿 runtime-control selected project 覆盖当前 Codex 项目。

![projectRoot 与 dataRoot 路径模型图](/images/ch05/01-projectroot-dataroot-model.png)

## 本章回答

- `ProjectRegistry`、`WorkspaceResolver`、folder names 和 ProjectScope 如何共同确定路径。
- Ghost 模式为什么能做到零项目侵入。
- `.asd/`、`Alembic/`、数据库、向量索引和 settings/secrets 的职责差异。
- 哪些路径可以作为事实源，哪些只是运行缓存或诊断状态。

## ProjectRegistry 先给项目一个身份

Ghost 模式需要项目身份。Core 的 `ProjectRegistry` 负责生成 project id、记录 projectRoot、注册 workspace mode，并提供全局 registry path。`WorkspaceResolver.fromProject()` 会先 inspect registry，再决定当前项目是不是 Ghost。

这个 registry 不是用户业务配置。它是本机 Alembic 运行时识别项目的坐标。外层 status、daemon runtime control、project scope 和 Codex alignment 都会读取它，但不应该随意把 selected/active runtime 状态当成新的 effective project identity。

身份的最小事实包括：

- `projectRoot`：真实源码路径。
- `projectRealpath`：解析 symlink 后的真实路径。
- `projectId`：Ghost dataRoot 的稳定 id。
- `workspaceMode`：standard 或 ghost。
- `dataRootSource`：`project-root` 或 `ghost-registry`。

## WorkspaceResolver 把读写边界拆开

`WorkspaceResolver` 是路径模型的核心。它在构造时接收 projectRoot、ghost、projectId、projectScope 和 folder name 配置，然后导出一组稳定路径事实：

- `runtimeDir`：`.asd/`。
- `databasePath`：`.asd/alembic.db`。
- `logsDir`、`reportsDir`、`signalsDir`、`errorsDir`。
- `contextDir` 与 vector index 相关路径。
- `knowledgeDir`：`Alembic/`。
- `recipesDir`：`Alembic/recipes`。
- `candidatesDir`：`Alembic/candidates`。
- `skillsDir`：`Alembic/skills`。
- `wikiDir`：`Alembic/wiki`。
- `recipesIndexPath`：`Alembic/recipes/index.json`。

在 standard 模式下，`dataRoot` 可以就是 `projectRoot`。在 Ghost 模式下，`dataRoot` 是 `getGhostWorkspaceDir(projectId)`。在 ProjectScope 模式下，resolver 固定 Ghost 写入边界，`projectRoot` 仍指当前源码 folder。

这解释了一个重要设计：Alembic 可以分析用户项目，但不必把运行数据写进用户项目。

## `.asd/` 是运行态，不是协作文档

`.asd/` 下面放的是运行时状态：`config.json`、SQLite 数据库、context/vector index、logs、reports、signals、conversations、cache、bootstrap checkpoint、jobs、decision register、settings/secrets 等。它服务于本机运行、快速检索、任务恢复和诊断。

因此 `.asd/` 不应该被写成长期协作入口。数据库存在不代表知识已经治理；JobStore 里有记录不代表结果被接受；runtime-control state 可以帮助诊断 selected/active project，但不能覆盖当前 host 的真实 projectRoot。

当数据库损坏或索引过期时，Alembic 应该能通过 recipes、candidates、snapshots、rescan 或 sync 恢复，而不是把 `.asd/alembic.db` 当作唯一事实源。

## `Alembic/` 是知识资产区

`Alembic/` 下的内容更接近知识资产：

- `constitution.yaml` 描述权限、角色、治理规则和能力探测。
- `boxspec.json` 描述项目规格。
- `recipes/` 保存被接受、可检索、可约束的知识。
- `candidates/` 保存 AI 或工具提出但尚待审阅的知识。
- `skills/` 保存项目级 Skill 源内容。
- `wiki/` 保存生成或维护的项目文档视图。

但即便在 `Alembic/` 内部，也有生命周期差异。Recipe 可以被 search、prime、Guard 消费；candidate 只是提案；skill 源还需要授权导出到 Codex runtime；wiki 是阅读投影，不应取代 Recipe 和 sourceRef。

## Folder names 是 contract，不是装饰

Core 的 `DEFAULT_FOLDER_NAMES`、`resolveFolderNames` 和 folder name validation 让目录名成为 contract。默认知识根是 `Alembic`，运行目录是 `.asd`，recipes/candidates/skills/wiki/context/logs/cache 也都有统一命名。

这个统一命名让主 Alembic、Plugin、Agent workflow 和 Dashboard 能共享路径事实。否则每个外层仓库都可能猜一遍“知识目录在哪里”，最终导致 Codex、daemon 和 Dashboard 指向不同数据。

## ProjectScope 让一个控制根覆盖多个源码仓库

当前 AlembicWorkspace 就是多 folder project scope 的例子：control root 是 workspace，folder 列表包含 Alembic、AlembicCore、AlembicPlugin、AlembicDashboard 和 AlembicAgent。ProjectScope 允许 Alembic 把这些源码 folder 作为一个分析范围，同时仍然把写入边界放在统一 Ghost dataRoot。

这不是普通 monorepo。每个源码仓库仍有自己的 Git、发布、测试和边界。ProjectScope 只是告诉 Alembic resident service：当前知识层要覆盖哪些 folder，当前 folder 是哪个，哪些 folder active。

## PathGuard 保护写入边界

路径模型最终必须落到安全写入。Core 的 IO/PathGuard 能阻止外层工具把文件写到 `.git`、`node_modules`、`.env` 或越界路径。Agent tool 的 code write、Plugin Project Skill export、主 runtime 的文件写入，都应尊重这个边界。

路径保护不是权限系统的全部，但它是最底层防线。没有路径边界，Ghost 模式和 ProjectScope 都会变成 UI 叙事，不能真正保护用户项目。

## 读者应该记住的路径事实

`projectRoot` 用于读代码和判断项目身份。

`dataRoot` 用于写 Alembic 运行数据和知识资产。

`.asd/` 是运行态、缓存、索引、日志和恢复信息。

`Alembic/recipes` 是被接受知识的长期入口。

`Alembic/candidates` 是待审阅提案，不是最终规则。

`Alembic/skills` 是项目 Skill 源，`.agents/skills` 是 Codex runtime 可见投影，二者之间需要授权和 receipt。

## 本章小结

Alembic 的路径设计服务于一个产品承诺：理解用户项目，但尽量不污染用户项目。`ProjectRegistry` 给项目身份，`WorkspaceResolver` 拆开 projectRoot 和 dataRoot，folder names 统一目录 contract，ProjectScope 支持多仓库分析，PathGuard 保护写入边界。

只有先理解这层，后面讨论 daemon、Codex plugin、Dashboard、bootstrap、rescan、Guard 和 Project Skills 才不会把事实源放错位置。
