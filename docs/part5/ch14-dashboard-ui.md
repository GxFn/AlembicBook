# Ch14 Dashboard 前端体验

AlembicDashboard 是面向人的审阅和操作界面。它不拥有后端业务事实，也不直接实现 Core 内核；它通过 `/api/v1` API 读取主 Alembic resident service，把 Recipes、Candidates、Knowledge、Guard、Project Pyramid、Skills 和 Jobs 组织成可理解的工作台。

本章讲 Dashboard 的产品边界和页面结构。读者需要分清：Dashboard 是审阅体验，不是数据库，不是 Agent runtime，也不是 MCP server。

![Dashboard 页面与 API 映射图](/images/ch14/01-dashboard-pages-api-map.png)

## 本章回答

- Dashboard 在 Alembic 系统中负责什么。
- `src/App.tsx` 和 `validTabs` 如何定义主要页面。
- API client 为什么是前端与 resident service 的唯一主通道。
- Dashboard 能审阅什么，不能替代什么。

## 前端入口与页面结构

`AlembicDashboard/src/App.tsx` 组织了主要视图：RecipesView、CandidatesView、ModuleExplorerView、GuardView、DepGraphView、KnowledgeView、SkillsView、BootstrapProgressView、JobsView、HelpView，以及 RecipeEditor、CreateModal、SearchModal、LlmConfigModal 等交互组件。

`src/constants/index.ts` 定义 valid tabs：recipes、spm、candidates、knowledge、guard、project-pyramid、skills、jobs、help。用户 URL path 会映射到这些 tab，默认进入 help。

这说明 Dashboard 的主体验不是 landing page，而是工作台。它围绕知识审阅、任务观察和项目理解组织，而不是围绕营销介绍组织。

## API client 是前后端边界

`src/api.ts` 明确写着：前端直接调用 V3 RESTful API，baseURL 为 `/api/v1`。前端使用 V3 KnowledgeEntry 类型，不做字段语义重写。API client 中有大量 normalizer 和 mapper，用来兼容 raw backend fields、runtime records、jobs、project runtime snapshot、knowledge pagination 等。

这条边界很重要：Dashboard 可以格式化展示、缓存 UI 状态、处理 loading/error、发起 API 请求，但不应该在前端重新定义 Knowledge lifecycle、Guard 规则、search ranking 或 JobStore contract。

如果 API response 变化，应该同步后端 contract、front-end types、API mapper 和 dashboard contract tests，而不是在组件里临时猜字段。

## Dashboard 的核心工作流

RecipesView 让用户查看、过滤、编辑和审阅已接受知识。

CandidatesView 让候选知识进入人工审阅路径。

KnowledgeView 展示统一 KnowledgeEntry。

GuardView 和 Guard report 展示规则检查与违规信息。

Project Pyramid 的 `DepGraphView` 和 `ModuleExplorerView` 展示项目结构、模块、扫描和 ProjectContext 投影。

SkillsView 展示 Project Skill 与 runtime 可见性。

JobsView 与 BootstrapProgressView 展示 long-running job、process events、display snapshot 和 artifacts。

这些页面共同构成一个“审阅面”。它们让人看到 Alembic 正在做什么、做到了哪里、哪些结果需要批准或复核。

## Dashboard 不应制造事实

Dashboard 可以发起操作，例如创建 candidate、保存 Recipe、启动 job、打开 reports、配置 AI、触发 scan 或查看 events。但操作的事实结果必须来自后端 response。

前端状态可以缓存 selectedTargetName、guardAudit、scanResults 等，但这些只是用户体验缓存。它们不应替代 `.asd` 中的 JobStore、数据库中的 KnowledgeEntry、Core 中的 lifecycle 判断或 resident service 的 source-of-truth。

## Jobs 页面是验收入口之一

对于 bootstrap/rescan，Dashboard 的 JobsView 特别重要。它不仅显示 job 列表，还能读取 display snapshot、events 和 artifact。用户或 controller 需要验收某个长任务时，应把 JobsView 看成证据入口，而不是只看页面上的 status badge。

如果 job failed，也应读 events 和 artifact，区分 provider 问题、维度中断、预算耗尽、数据写入失败或 UI 映射错误。

## Generated API 类型是漂移门禁

Dashboard 提交了 `src/generated/api-types.ts` 和 `api-types.sha256`。它们来自主 `Alembic/lib/generated/dashboard-api-types.ts`，由主仓库 `npm run build && npm run generate:dashboard-types` 生成，再同步到 Dashboard。`scripts/check-generated-api-types.mjs` 会校验哈希，并在 sibling 主仓库存在时做字节级比较。

这条门禁的意义是：前端不能手写一套“看起来差不多”的 API 类型。如果 live API、provider contract、failure taxonomy 或 Knowledge wire type 改了，应回到主 Alembic 生成 canonical artifact，再同步 Dashboard copy。

## UI 与多语言/维度显示

Dashboard 常量中定义了 bootstrap dimension labels、category configs、language options、language normalization、代码高亮语言、import placeholder 等。这些是展示层的语义辅助。它们帮助用户看懂不同语言和维度，但不应改变 Core 中的 dimensionId、knowledgeType 或 lifecycle。

换句话说，Dashboard 可以把 `ts-js-module` 展示得更友好，但不能改变它在后端 workflow 中的含义。

## 本章小结

AlembicDashboard 是本地知识层的人类审阅和观察界面。它通过 `/api/v1` 消费主 Alembic resident service，展示 Recipes、Candidates、Knowledge、Guard、Project Pyramid、Skills 和 Jobs。

它的边界同样清楚：前端负责体验和投影，后端/Core 负责事实和 contract，Agent 负责非确定性执行，Plugin 负责 Codex host adaptation。下一章会讲 AI provider、配置和密钥边界。
