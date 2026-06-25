# Ch02 从用户项目到本地知识层

Alembic 的第一性原理不是“把代码总结成一份文档”，而是在用户项目旁边建立一层可审查、可复用、可演化的本地知识层。它把 AI 编程工具临时塞进上下文窗口里的理解，拆成更稳定的对象：项目身份、外置数据根、候选知识、已接受 Recipe、检索索引、Guard 结果、决策记录和 Dashboard 可视化。

这一章先从用户动作讲起，再把动作背后的实现链路展开。读者需要记住一件事：Alembic 的知识层不是某个 LLM 的记忆，也不是某个 IDE 的配置文件。它是一个本地运行系统，既能被人审阅，也能被 Codex 这样的宿主 Agent 通过 MCP 工具消费。

![从用户项目到本地知识层的旅程图](/images/ch02/01-user-project-to-local-knowledge.png)

## 本章回答

- 用户第一次把 Alembic 接入一个项目时，真正创建了哪些边界。
- Ghost workspace 为什么是默认推荐路径，它和普通项目写入有什么差别。
- CLI、daemon、Dashboard、Codex 插件和 Core 的职责怎样在一个用户旅程里接上。
- 冷启动、增量扫描、候选知识、Recipe、Guard 和决策记录如何形成最小闭环。
- 为什么 Alembic 不应该被理解成“把所有扫描结果自动发布成团队规则”。

## 第一眼看到的是命令，不是架构

从用户角度看，Alembic 的接入入口很短：

```bash
npm install -g alembic-ai
alembic setup --ghost
alembic start
```

这三步背后有两条分支。第一条是主 CLI 路径，由 `Alembic/bin/cli.ts` 暴露 `setup`、`start`、`coldstart`、`rescan`、`search`、`guard` 等命令。第二条是宿主插件路径，由 `AlembicPlugin` 暴露 `alembic_status`、`alembic_init`、`alembic_recipe_map`、`alembic_graph`、`alembic_search`、`alembic_bootstrap`、`alembic_prime`、`alembic_work`、`alembic_code_guard` 等 MCP 工具。两条路径的入口不同，但最终都要落到同一个项目身份和同一套本地知识数据上。

CLI 的 `setup` 命令会构造 `SetupService`，把当前目录解析为一个 Alembic 项目。`start` 命令则通过 `ProjectRuntimeControl` 选择或启动项目 runtime，并把 Dashboard URL 交给用户。Plugin 不会假装自己就是主 daemon；它先做 status，确认当前 host project、Ghost dataRoot、knowledge state、tool visibility、runtime identity 和 host-project alignment，再决定是否调用 host-agent bootstrap、rescan 或知识消费工具。

这个设计让用户旅程保持简单，但不会把所有责任揉在一个进程里。用户输入的是一个短命令；系统内部确认的是项目身份、数据位置、运行服务、知识可用性和宿主工具权限。

## Ghost 模式先保护项目，再建立知识层

`alembic setup --ghost` 的关键不是“隐身”，而是“零项目侵入”。在 Ghost 模式下，用户源码仍在原来的项目目录，Alembic 的运行态和知识资产写入外置 dataRoot。Core 的 `WorkspaceResolver` 明确区分两个位置：

- `projectRoot` 是真实源码目录，用于代码分析、路径解析和项目身份判断。
- `dataRoot` 是 `.asd/` 与 `Alembic/` 的写入边界。

在普通模式下，`dataRoot` 可以等于 `projectRoot`；在 Ghost 模式下，`dataRoot` 来自全局 ProjectRegistry，例如 `~/.asd/workspaces/{projectId}/`。这个差异非常重要，因为它决定了 Alembic 可以在不污染用户仓库的前提下创建数据库、索引、日志、候选知识和 Project Skills。

初始化时，`SetupService` 会按步骤创建：

- `.asd/config.json`，保存项目配置、数据库位置、知识库目录、AI provider 配置入口和 Guard 开关。
- `Alembic/constitution.yaml`，保存角色、权限、治理规则和能力探测。
- `Alembic/boxspec.json`，描述项目规格。
- `Alembic/recipes/`，保存已接受知识的 Markdown 形式。
- `Alembic/candidates/`，保存等待审阅的候选知识。
- `Alembic/skills/`，保存项目级 Skill 源内容。
- `.asd/alembic.db` 与 `.asd/context/`，保存检索、缓存和向量索引运行态。

这些目录不属于同一种事实源。`Alembic/recipes/` 面向人类审阅和长期协作，`.asd/` 面向运行时加速和可恢复状态，`Alembic/candidates/` 面向“AI 提议但尚未接受”的中间层。把它们混成一个“知识库文件夹”会掩盖 Alembic 最重要的治理边界。

## 启动后得到的是本地 resident service

初始化只建立目录和配置，`alembic start` 才把本地运行服务带起来。主仓库的 `ProjectRuntimeControl` 负责项目选择、daemon 状态、Dashboard handoff 和 runtime control state。成功后，用户通常看到的是一个 Dashboard URL；实现上则包含 daemon health、HTTP API、JobStore、Dashboard server、search endpoint、project-scope endpoint、file monitor 和 AI job capability。

这一层的职责是“让知识层持续在线”。它不是一次性脚本。Dashboard 能读取 candidates、Recipes、Jobs、Guard、Project Pyramid、Skills 等 API；Codex/Claude Code 插件能通过 status 确认当前 host project 是否和 Alembic runtime 对齐；daemon 能在文件变化、扫描任务、搜索请求和 Guard 请求之间保持同一个项目身份。

这里也解释了为什么 Book 不能把 Dashboard 写成后端，也不能把 Plugin 写成 daemon。Dashboard 是 `AlembicDashboard` 的前端体验，server 和 API 在 `Alembic` 主仓库；Codex 插件只负责宿主 Agent 的 MCP surface、tool policy、skills 和 portable runtime，它通过 contract 消费 daemon/Core 能力。

## 冷启动不是“自动生成团队规范”

很多误解从 `coldstart` 或 `alembic_bootstrap` 开始。用户看到“冷启动知识库”，容易以为 Alembic 会把项目扫描结果直接发布成权威规则。当前实现不是这样。

在 CLI daemon 路径里，`coldstart` 或 Dashboard bootstrap 会进入 provider-backed job；在 Codex 插件路径里，`alembic_bootstrap` 是 host-agent 冷启动工具，会返回 Mission Briefing，让宿主 Agent 按维度阅读项目、提交候选知识，并调用 dimension completion 结束维度。插件工具描述里也把这个流程写得很清楚：bootstrap 返回项目元数据、语言统计、维度任务、分析包摘要、检索提示和提交示例；后续完成要靠按维度分析、提交知识、审阅和补齐。

所以冷启动的输出首先是候选知识和分析任务，不是直接生效的组织规范。候选知识需要进入 `Alembic/candidates/` 或数据库候选表，等待人或受控流程审阅。只有被接受、稳定下来、可引用的知识，才应成为 Recipe，并参与后续检索、prime 和 Guard。

这也是 Alembic 与“生成一份项目说明文档”的分水岭：文档可以一次性写完，知识层必须允许质疑、降级、演化和重建。

## 从候选知识到 Recipe

Alembic 的知识对象有一个生命线：

1. 项目被初始化，`WorkspaceResolver` 固定 projectRoot 与 dataRoot。
2. bootstrap/rescan/code reading 产生候选知识。
3. 候选知识保存在 candidates 中，并带上 source refs、维度、类型和证据。
4. 审阅通过后，知识进入 Recipes。
5. Recipes 被同步到数据库、索引和检索层。
6. Agent 在语义任务中通过 prime/search/ProjectContext 获取紧凑上下文。
7. 代码变更后通过 `alembic_work` finish 和 `alembic_code_guard` 把证据带回工作流。

这个生命线里最关键的词是“证据”。Recipe 不是一句偏好，也不是某次模型回答的摘要；它必须能说明自己来自哪些文件、哪些调用链、哪些约束或哪些已确认决策。没有证据的知识最多是候选建议，不能成为项目规则。

![Candidate 到 Recipe 生命周期图](/images/ch02/02-candidate-to-recipe-lifecycle.png)

## Codex 看到的是三件套 public workflow

在 Codex 插件路径里，最重要的不是旧式的“查知识工具”，而是一组 agent-facing public workflow tools：

- `alembic_prime` 为具体代码任务加载紧凑、带信任标签的项目知识。
- `alembic_work` 用 `phase=start|finish` 创建或关闭 workRef，并记录变更文件、结果摘要和证据。
- `alembic_code_guard` 对明确文件、内联代码或当前 workRef 的 scoped files 做规则检查。

这三个工具把“AI 正在做什么”从自由文本对话里抽出来。先 prime，再 work，再 Guard，形成一个可审计的节奏。它不会替宿主 Agent 写代码，也不会把 tentative suggestion 当成最终决策。Codex 仍然是执行者，Alembic 提供的是项目知识、边界和证据轨道。

## 日常闭环：读、写、验、记

接入完成后，用户的日常体验大致有四步。

第一步是读。Codex 或人类开发者提出一个具体问题，例如“这个模块的错误分类应该怎样扩展”。Alembic 通过 prime/search/recipe_map/graph 返回相关 Recipe、source refs、调用上下文或结构信息，而不是把整库内容塞进模型上下文。

第二步是写。Agent 根据真实源码和被 prime 的知识完成修改。这里 Alembic 不应该替代代码阅读；它只缩短定位和约束理解的距离。

第三步是验。变更完成后，`alembic_code_guard` 或 CLI `guard` 检查显式文件或代码片段。Guard 的价值在于把已知项目规则应用到当前变更，而不是无边界地审查整个仓库。

第四步是记。如果这次工作产生了稳定、可复用、经确认的判断，就通过 decision register 或候选知识提交进入 Alembic。反过来，如果 Recipe 变旧，rescan/evolve 会发现证据断裂、触发 decay 或要求补齐。

这四步构成 Alembic 的最小产品闭环：项目知识被发现、被审阅、被消费、被验证、再被更新。

## 几个必须分清的边界

`Alembic/recipes` 不是 `Alembic/candidates`。前者是已接受、可检索、可用于约束的知识；后者是待审阅提案。

`.asd/alembic.db` 不是唯一事实源。它是本地运行缓存和索引入口，应该能从文件、扫描和同步链路恢复；不能把数据库存在本身当成知识已被治理。

MCP 配置不是知识源。它只是宿主 Agent 调用 Alembic 的入口。真正的项目事实仍来自源码、Recipe、candidate、decision 和 runtime evidence。

Dashboard 不是权威后端。它是面向人的审阅和观察界面，背后依赖 Alembic API 和 Core contract。

Plugin 不是主 daemon。它负责 host adaptation、工具 schema、tier policy、clean output 和 portable runtime；长期 resident service 仍由 Alembic 主仓库提供。当前 Plugin status 默认报告 daemon-less PDR-3 route，这不等同于主 `Alembic` daemon 被移除。

## 失败时先查身份和边界

用户旅程里最常见的问题不是“AI 不够聪明”，而是身份和边界错了：

- 当前目录不是用户项目，setup 被排除项目保护拒绝。
- Codex host project 与 Alembic selected/active runtime 不一致。
- Ghost dataRoot 存在，但 `.asd/config.json`、数据库或 knowledge dir 缺失。
- daemon stale、Dashboard URL 不可用，或 file monitor 降级到 git-worktree fallback。
- 没有可用知识，prime/search 只能返回空结果，需要先 bootstrap 或 rescan。
- Guard 没有显式文件、inline code 或 workRef scope，因此应 fail closed，而不是做无边界全仓审查。

这些失败都应该回到同一个排查顺序：先确认 projectRoot，再确认 dataRoot，再确认 runtime，再确认知识状态，最后再看具体工具。

## 本章小结

Alembic 的用户旅程可以压缩成一句话：在不污染用户项目的前提下，为这个项目建立一个本地、可审阅、可恢复、可被 Agent 消费的知识层。

`setup --ghost` 建立边界，`start` 启动 resident service，bootstrap/rescan 发现候选知识，review 把候选变成 Recipe，prime/search/ProjectContext 把 Recipe 交给 Agent，work/code_guard 把工作证据带回系统。理解了这一条链路，后面的章节就能分别展开项目模型、Core 内核、运行时服务、Codex 插件、Agent runtime 和 Dashboard，而不会再把它们写成一个模糊的“知识有机体”。
