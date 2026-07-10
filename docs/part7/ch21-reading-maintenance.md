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
2. Part II 分清结构事实、知识投影、检索与 Guard。
3. Part III 沿计划、主 runtime、daemon/jobs 读知识生产链。
4. Part IV 沿 MCP 请求链理解宿主消费与交付。
5. Part V 分清 Agent 执行器、Dashboard 投影和 provider 配置。
6. Part VI 理解知识对象、SourceRef 新鲜度、演化与 Guard。
7. Part VII 理解发布验证、证据验收和维护规则。

如果是带任务阅读，可以按问题跳转：

- 接入项目：读 Ch02、Ch05、Ch07、附录配置。
- 改 Core：读 Ch04、Ch05、Ch06、Ch19。
- 改 Plugin：读 Ch10、Ch11、Ch12、Ch20。
- 改 Dashboard：读 Ch14、Ch08、Ch20。
- 改 bootstrap/rescan：读 Ch09、Ch13、Ch16、Ch20。
- 查知识生命周期：读 Ch16、Ch17、Ch18。
- 核对易漂移数字：先读[当前实现快照](/appendix/implementation-snapshot)，再回到对应源码。

## 维护时先找事实源

更新某章前，先确定事实源：

- Workspace/path/storage：`AlembicCore/src/shared` 与 `src/workspace.ts`。
- Knowledge/lifecycle/search/guard：`AlembicCore/src/domain`、`src/service`、`src/knowledge.ts`、`src/search.ts`、`src/guard.ts`。
- CLI/daemon/API/jobs：`Alembic/bin`、`Alembic/lib/daemon`、`Alembic/lib/http/routes`、`Alembic/lib/recipe-pipeline`。
- Host tools/Plugin：`AlembicPlugin/lib/host-runtime/mcp`、`AlembicPlugin/lib/host-runtime/status`、`AlembicPlugin/lib/host-runtime/host-adapter`、`AlembicPlugin/lib/service/skills`、`AlembicPlugin/scripts/prepare-codex-plugin-runtime.mjs`。
- Agent runtime：`AlembicAgent/src/agent`、`src/tools`、`src/ai`。
- Dashboard：`AlembicDashboard/src/App.tsx`、`src/api/index.ts`、`src/api/` route-family files、`src/components/Views`。
- Release/validation：各仓库 `package.json` 与 `scripts/`。

不要用旧书段落当事实源。旧书可以提示历史意图，但当前书稿必须以当前代码为准。

Wakeflow ledger 下的仓库文档适合当阅读索引，而不是最终证明。它们记录了某个日期、某个 commit 附近的架构深读、需求设计和未闭合风险，能帮助快速定位概念与历史决策；但如果 ledger 路径、类名、数量或完成判断与当前源码冲突，必须以当前源码、package scripts、调用方和验证输出为准。

## 用纠错链维护判断，不只覆盖段落

维护书稿时，关键不是把旧句子改成新句子，而是保留判断如何变化：

1. 记录原判断来自哪份账本、README、注释或旧代码。
2. 找到当前实现入口、真实调用方和反例。
3. 明确哪些部分被证实、哪些被推翻、哪些仍无法证明。
4. 更新正文和附录，并给易漂移数字增加机器断言。
5. 运行验证，再审读“存在资产”和“运行链已接通”是否被混写。

例如，旧 Plugin 深读曾把 post-ingest freshness 评为缺失；后续 Core 设计与当前 `AlembicCore/src/service/knowledge/SourceRefReconciler.ts`、`SearchEngine.ts` 证明 reconcile、fingerprint、drift status 和消费降权已经存在。与此同时，line-shift/content-change 仍是 observe-only，不能反向夸大成自动修复完成。高质量书稿应同时记录这两半事实。

## 用事实断言约束易漂移表面

`scripts/verify-alembic-docs.mjs` 除了检查源码锚点，还识别以下内联格式：

```html
<!-- alembic-fact: agentRuntimeTools.actionCount=22 -->
```

校验器会从五个 sibling 源码仓重算 Core exports/grammars、Agent tools/actions、Plugin MCP catalog、HTTP/provider routes、Dashboard tabs、parser languages 等读数，再与[当前实现快照](/appendix/implementation-snapshot)比较。断言失败表示需要调查，不表示应该机械更新数字；收集器本身也可能因源码结构变化而过期。

这套断言适合“计数与枚举”，不适合证明语义链。例如存在 `SourceGraphService` 和 DTO 不能证明 cold start 已把结果写入 snapshot；这种判断仍需搜索生产调用方、测试真实入口与运行证据。

## 避免三种旧叙事

第一，不再把 Alembic 写成单仓库产品。当前实现是多仓库、多 runtime、多发布物。

第二，不再把“知识有机体”当主要架构解释。这个比喻可以作为产品感觉，但不能替代 projectRoot/dataRoot、Core contract、Plugin tool surface、JobStore、lifecycle state machine 等真实实现。

第三，不再把 AI 扫描写成自动发布规则。Cold start/rescan 首先产生 candidate、mission briefing、dimension completion 和 evidence，Recipe 需要审阅和生命周期治理。

## 插图规则

当前阶段使用 prompt-managed 新插图，不再使用旧图，也不再保留旧占位文件作为正文图位。

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
npm run verify:alembic -- --local ../Alembic
git diff --check
```

还应检查：

- Markdown 内链没有断。
- 章节不引用旧图片。
- `npm run illustrations -- --list` 显示所有 prompt-managed 图片 ready。
- 正文没有残留旧占位文件。
- `verify:alembic` 没有 missing source anchors，并且报告的 Plugin MCP tools、Agent runtime tools、Core dimensions/relations 等事实与章节叙述一致。
- `Fact assertions` 全部匹配当前源码；任何修改都能解释是实现变化、正文漂移还是收集器失效。
- 目录和侧边栏能对应新章节。
- 新增术语在 glossary 或正文首次出现处解释。

如果书稿引用了最新外部平台规则或当前发布状态，必须查官方或权威来源；如果引用本地实现，优先读本地源码。

## 完成定义

一本高质量的 AlembicBook 应该做到：

- 每章能说清对应代码边界。
- 每个关键能力能追到仓库、入口文件和实际调用方。
- 每个用户动作能接到运行链路。
- 每个知识对象能说明生命周期、SourceRef 新鲜度和漂移消费方式。
- 每个发布/验证建议能对应脚本或 runtime 证据。
- 每张插图都有明确 prompt 来源、目标 PNG 和章节引用。

如果某章只能讲愿景，不能落到代码，就说明还需要继续读实现。

## 本章小结

AlembicBook 的维护方式应该和 Alembic 本身一致：本地优先、证据优先、边界清晰、可恢复、可审阅。账本提供调查入口，源码与调用链裁决现状，运行证据裁决闭环，事实断言阻止静默数字漂移。

到这里，全书的主体章节完成闭环：从系统地图，到 Core 和 resident runtime，到 Codex Plugin、Agent/Dashboard/AI，再到知识治理、验证和维护。后续工作可以继续精修文风、补充代码片段、扩展附录和迭代插图，但主体分层已经建立。
