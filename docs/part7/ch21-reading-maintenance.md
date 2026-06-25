# Ch21 阅读路径与维护规则

这本书不是 Alembic 的一次性宣传材料，而是跟随实现演化的配套技术书。它必须能帮助读者理解当前系统，也必须能帮助后续维护者判断“这段书稿是否已经落后于代码”。

本章给出阅读路径和维护规则。它是全书的索引式收束，也是以后继续修订 AlembicBook 的工作规范。

![AlembicBook 维护闭环图](/images/ch21/01-book-maintenance-loop.png)

## 本章回答

- 新读者应该按什么顺序读。
- 维护者应该如何根据代码变化更新章节。
- 哪些旧叙事必须避免。
- 插图、附录和验证如何保持一致。

## 推荐阅读顺序

第一次读 Alembic，按全书顺序阅读：

1. Part I 建立系统地图、用户旅程和仓库边界。
2. Part II 理解 Core contract、项目模型、分析/检索/Guard。
3. Part III 理解主 Alembic resident runtime。
4. Part IV 理解 Codex Plugin 和 host-agent workflow。
5. Part V 理解 AgentRuntime、Dashboard 和 AI 配置。
6. Part VI 理解知识生命周期、演化治理、Guard/Decision。
7. Part VII 理解发布验证、证据验收和维护规则。

如果是带任务阅读，可以按问题跳转：

- 接入项目：读 Ch02、Ch05、Ch07、附录配置。
- 改 Core：读 Ch04、Ch05、Ch06、Ch19。
- 改 Plugin：读 Ch10、Ch11、Ch12、Ch20。
- 改 Dashboard：读 Ch14、Ch08、Ch20。
- 改 bootstrap/rescan：读 Ch09、Ch13、Ch16、Ch20。
- 查知识生命周期：读 Ch16、Ch17、Ch18。

## 维护时先找事实源

更新某章前，先确定事实源：

- Workspace/path/storage：`AlembicCore/src/shared` 与 `src/workspace.ts`。
- Knowledge/lifecycle/search/guard：`AlembicCore/src/domain`、`src/service`、`src/knowledge.ts`、`src/search.ts`、`src/guard.ts`。
- CLI/daemon/API/jobs：`Alembic/bin`、`Alembic/lib/daemon`、`Alembic/lib/http/routes`、`Alembic/lib/workflows`。
- Host tools/Plugin：`AlembicPlugin/lib/runtime/mcp`、`AlembicPlugin/lib/runtime/status`、`AlembicPlugin/lib/runtime/host-adapter`、`AlembicPlugin/scripts/prepare-codex-plugin-runtime.mjs`。
- Agent runtime：`AlembicAgent/src/agent`、`src/tools`、`src/ai`。
- Dashboard：`AlembicDashboard/src/App.tsx`、`src/api.ts`、`src/components/Views`。
- Release/validation：各仓库 `package.json` 与 `scripts/`。

不要用旧书段落当事实源。旧书可以提示历史意图，但当前书稿必须以当前代码为准。

## 避免三种旧叙事

第一，不再把 Alembic 写成单仓库产品。当前实现是多仓库、多 runtime、多发布物。

第二，不再把“知识有机体”当主要架构解释。这个比喻可以作为产品感觉，但不能替代 projectRoot/dataRoot、Core contract、Plugin tool surface、JobStore、lifecycle state machine 等真实实现。

第三，不再把 AI 扫描写成自动发布规则。Cold start/rescan 首先产生 candidate、mission briefing、dimension completion 和 evidence，Recipe 需要审阅和生命周期治理。

## 插图规则

当前阶段使用 prompt-managed 新插图，不再使用旧图，也不再保留 `.diagram-placeholder` 作为正文图位。

每张图都应有一个 prompt 源文件，推荐图型包括：

- 多仓库系统图。
- 用户旅程图。
- projectRoot/dataRoot 路径图。
- tool surface 分层图。
- Candidate 到 Recipe 生命周期图。
- release validation 矩阵。
- evidence hierarchy 图。

刷新插图时，应先确认图表达的实现仍然准确，再更新 prompt、重新生成图片，并替换同名目标 PNG。

## 附录维护规则

配置附录应跟随 `WorkspaceResolver`、folder names、AI settings/secrets、daemon state 和 plugin status 的当前实现。

MCP tools 附录应跟随 Plugin tool surface catalog、public tools contract、tools.ts 和 clean output probes。

Public API map 应跟随 `@alembic/core` package exports、Agent exports、Plugin runtime artifact、Dashboard API client 和主 Alembic CLI/API。

Glossary 应只收录当前书中真实使用的术语，避免复活旧叙事词。

## 每次书稿更新的最低验证

在 AlembicBook 中至少运行：

```bash
npm run build
git diff --check
```

还应检查：

- Markdown 内链没有断。
- 章节不引用旧图片。
- `npm run illustrations -- --list` 显示所有 prompt-managed 图片 ready。
- 正文没有残留 `.diagram-placeholder`。
- 目录和侧边栏能对应新章节。
- 新增术语在 glossary 或正文首次出现处解释。

如果书稿引用了最新外部平台规则或当前发布状态，必须查官方或权威来源；如果引用本地实现，优先读本地源码。

## 完成定义

一本高质量的 AlembicBook 应该做到：

- 每章能说清对应代码边界。
- 每个关键能力能追到仓库和入口文件。
- 每个用户动作能接到运行链路。
- 每个知识对象能说明生命周期和证据。
- 每个发布/验证建议能对应脚本或 runtime 证据。
- 每张插图都有明确 prompt 来源、目标 PNG 和章节引用。

如果某章只能讲愿景，不能落到代码，就说明还需要继续读实现。

## 本章小结

AlembicBook 的维护方式应该和 Alembic 本身一致：本地优先、证据优先、边界清晰、可恢复、可审阅。随着 Alembic 继续演化，书稿也要跟着源码、工具表、发布脚本和真实用户旅程更新。

到这里，全书的主体章节完成闭环：从系统地图，到 Core 和 resident runtime，到 Codex Plugin、Agent/Dashboard/AI，再到知识治理、验证和维护。后续工作可以继续精修文风、补充代码片段、扩展附录和迭代插图，但主体分层已经建立。
