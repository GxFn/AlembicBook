# Appendix D 术语表

本术语表只收录新版主体章节使用的当前实现术语。若术语含义与代码冲突，以源码和运行时输出为准。

![Glossary concept graph 图](/images/appendix/04-glossary-concept-graph.png)

## 核心术语

**Project**：Alembic 识别的逻辑项目，通常对应一个用户源码根。

**ProjectRoot**：真实源码目录，用于分析代码和判断 host identity。

**DataRoot**：Alembic 数据写入边界。Ghost 模式下通常在 `~/.asd/workspaces/{projectId}/`。

**Ghost Mode**：零项目侵入模式。源码仍在 projectRoot，Alembic 数据写入外置 dataRoot。

**ProjectScope**：一个项目覆盖多个源码 folder 的描述。用于 AlembicWorkspace 这类多仓库分析场景。

**Folder**：ProjectScope 中的一个真实源码目录。

**RuntimeDir**：`.asd/`，存放数据库、日志、jobs、context、settings/secrets、daemon state 等运行态。

**KnowledgeDir**：`Alembic/`，存放 recipes、candidates、skills、wiki 等知识资产。

**KnowledgeEntry**：Alembic 统一知识实体，可表示 rule、pattern、fact 等。

**Candidate**：待审知识提案。可以来自 bootstrap、rescan、Agent 或人工输入。

**Recipe**：被接受、可检索、可约束的项目知识。

**SourceRef**：支撑知识可信度的源码、文件、证据或引用位置。

**Wiki**：项目知识的阅读投影，不是 Recipe 的替代事实源。

**Project Skill**：项目知识面向宿主 runtime 的 Skill 投影。源在 dataRoot，导出到 `.agents/skills` 需要授权。

**Host Agent**：外部宿主 Agent，例如 Codex 或 Claude Code。它可以通过 Plugin MCP tools 消费 Alembic。

**AgentRuntime**：`@alembic/agent` 中的 Alembic 内部 AI/tool 执行引擎。

**Resident Service**：主 Alembic daemon/API/Dashboard server 组成的本地长期运行服务。

**Mission Briefing**：host-agent bootstrap/rescan 返回的任务说明，包含项目元数据、维度任务、analysis packet、retrieval hints 和执行计划。

**Dimension**：知识覆盖维度，如 architecture、coding-standards、data-event-flow、testing-quality 等。

**ProjectContext**：space、repo、map、module、file-flow、file-symbols、source-slice、anchor-range 等结构化项目理解能力。

**Guard**：基于项目知识和代码输入的规则检查层。

**Code Guard**：host-facing scoped Guard 工具，要求 explicit files、inline code 或 workRef scope。

**Decision Register**：历史/治理术语。当前 public MCP 不提供 `alembic_decision_record`，主 Alembic provider contract 也不再暴露 decision-register HTTP entry；当前书稿只把它作为退役路径或检索信号背景说明。

**Lifecycle**：知识状态机，包含 pending、staging、active、evolving、decaying、deprecated。

**Proposal**：Evolution 层提出的待审知识变更建议。

**Warning**：知识健康、证据或演化风险提示。

**Signal**：search hit、guard hit、view、adoption、application、lifecycle 等使用或运行信号。

**Portable Runtime**：AlembicPlugin 打包给 Codex 插件使用的 runtime artifact，例如 `runtime.tgz`。

**Plugin Cache**：Codex 已安装插件的本地运行副本，不是源码事实源。
