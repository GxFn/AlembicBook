# Ch14 Dashboard：后端事实的审阅工作台

AlembicDashboard 是面向人的审阅和操作界面。它没有 `@alembic/*` package 依赖，不拥有后端业务事实，也不直接实现 Core 内核；运行时只通过 `/api/v1`、SSE 与 WebSocket 读取主 Alembic resident service，把 Recipes、Candidates、Knowledge、Panorama、Module Explorer、Guard、Skills 和 Jobs 组织成工作台。

本章讲 Dashboard 的产品边界和页面结构。读者需要分清：Dashboard 是审阅体验，不是数据库，不是 Agent runtime，也不是 MCP server。

![Dashboard 页面与 API 映射图](/images/ch14/01-dashboard-pages-api-map.png)

## 本章回答

- Dashboard 在 Alembic 系统中负责什么。
- `src/App.tsx` 和 `validTabs` 如何定义主要页面。
- API client 为什么是前端与 resident service 的唯一主通道。
- quick approve 与编辑审核为什么是两条不同路径。
- 哪些组件存在于源码但尚未形成可用入口。

## 前端入口与页面结构

`AlembicDashboard/src/App.tsx` 组织主要视图和编辑/搜索/配置交互；`Sidebar.tsx` 给出用户可见导航。

`src/constants/index.ts` 当前定义九个 valid tabs：recipes、spm、candidates、knowledge、guard、panorama、skills、jobs、help。path 首段通过 `useTabNavigation` 映射成 tab 并调用 history API；这里没有引入独立 router 库。

这说明 Dashboard 的主体验不是 landing page，而是工作台。它围绕知识审阅、任务观察和项目理解组织，而不是围绕营销介绍组织。

## API client 是前后端边界

`src/api/index.ts` 是当前 API 聚合出口。旧的单文件 API god file 已按后端 route family 拆成 `src/api/` 目录下的族文件，`index.ts` 再聚合成单一 `api` 对象。当前源码聚合 14 组 API 族；README 里的“16”属于历史数字，不能覆盖实际出口。

前端仍然直接调用 V3 RESTful API，baseURL 为 `/api/v1`。前端使用 V3 KnowledgeEntry 类型，不做字段语义重写。API client 中的 normalizer 和 mapper 分散在 client、problem、sse、projects、projectScope、jobs、search、guard、fetchData 等模块，用来兼容 raw backend fields、runtime records、jobs、project runtime snapshot、knowledge pagination 等。

这条边界很重要：Dashboard 可以格式化展示、缓存 UI 状态、处理 loading/error、发起 API 请求，但不应该在前端重新定义 Knowledge lifecycle、Guard 规则、search ranking 或 JobStore contract。

如果 API response 变化，应该同步后端 contract、front-end types、API mapper 和 dashboard contract tests，而不是在组件里临时猜字段。

当前 `src/api/index.ts` 的命名出口还暴露 provider adapter policy、failure normalization、SSE projection、project/job/search/guard/runtime normalizers 等稳定工具面。它们是前端 contract 的守门层，不应被页面组件绕过。

## Dashboard 的核心工作流

RecipesView 让用户查看、过滤、编辑已接受知识，并检查 authority、relations 与 source metadata。

CandidatesView 让候选知识进入人工审阅路径，但至少有两种语义不同的动作：quick approve 直接接受候选；Module Explorer 的编辑审核会构建 V3 entry、发布 active，并移除原 candidate。Book 和测试都应分别验证两条路径，不能用一个“Approve 按钮”概括所有状态变化。

KnowledgeView 展示统一 KnowledgeEntry。

GuardView 和 Guard report 展示规则检查与违规信息。

Panorama 通过 overview、dependencies、graph、gaps 四个子标签展示项目全貌；ModuleExplorerView 展示模块、扫描与 ProjectContext 投影。

SkillsView 展示 Project Skill 与 runtime 可见性。

JobsView 与 BootstrapProgressView 展示 long-running job、process events、display snapshot 和 artifacts。

这些页面共同构成一个“审阅面”。它们让人看到 Alembic 正在做什么、做到了哪里、哪些结果需要批准或复核，但计算来源仍在后端。

## ProjectContext 与 Panorama 只在前端投影

`AlembicDashboard/src/api/panorama.ts` 调用主仓 `/panorama`、`/panorama/health` 与 `/panorama/gaps`；`PanoramaView.tsx` 使用 `Promise.allSettled`，允许一个面板失败而其他面板继续显示。ProjectScopePanel 和 projects API 则读取、切换或停止 runtime project，并显示 source-of-truth diagnostics。

这类编排不会让 Dashboard 获得结构分析所有权。依赖图、健康度、gaps、项目身份和 scope 都来自后端；前端只负责发起请求、归一 wire data、展示 partial/degraded 状态和接受用户操作。

## Dashboard 不应制造事实

Dashboard 可以发起操作，例如创建 candidate、保存 Recipe、启动 job、打开 reports、配置 AI、触发 scan 或查看 events。但操作的事实结果必须来自后端 response。

前端状态可以缓存 selectedTargetName、guardAudit、scanResults 等，但这些只是用户体验缓存。它们不应替代 `.asd` 中的 JobStore、数据库中的 KnowledgeEntry、Core 中的 lifecycle 判断或 resident service 的 source-of-truth。

## Jobs 页面是验收入口之一

对于 bootstrap/rescan，Dashboard 的 JobsView 特别重要。它不仅显示 job 列表，还能读取 display snapshot、events 和 artifact。用户或 controller 需要验收某个长任务时，应把 JobsView 看成证据入口，而不是只看页面上的 status badge。

JobsView 会对 active job 做 2.5 秒轮询；`useJobProcessEvents` 组合初始/增量 REST、Socket、断线恢复和 5 秒 polling。页面能展示 timeline、snapshot、evidence、artifact 与 validation。如果 job failed，也应读 events 和 artifact，区分 provider 问题、维度中断、预算耗尽、数据写入失败或 UI 映射错误。

## Generated API 类型是漂移门禁

Dashboard 提交了 `src/generated/api-types.ts` 和 `api-types.sha256`。它们来自主 `Alembic/lib/generated/dashboard-api-types.ts`，由主仓库生成后再同步到 Dashboard。`scripts/check-generated-api-types.mjs` 会校验哈希，并在 sibling 主仓库存在时做字节级比较；`src/generated/README.md` 记录这条来源关系。

这条门禁的意义是：前端不能手写一套“看起来差不多”的 API 类型。如果 live API、provider contract、failure taxonomy 或 Knowledge wire type 改了，应回到主 Alembic 生成 canonical artifact，再同步 Dashboard copy。

## UI 与多语言/维度显示

Dashboard 常量中定义了 bootstrap dimension labels、category configs、language options、language normalization、代码高亮语言、import placeholder 等。这些是展示层的语义辅助。它们帮助用户看懂不同语言和维度，但不应改变 Core 中的 dimensionId、knowledgeType 或 lifecycle。

换句话说，Dashboard 可以把 `ts-js-module` 展示得更友好，但不能改变它在后端 workflow 中的含义。

## 存在于源码不等于可用功能

当前 `ModuleExplorerView.tsx` 虽然渲染了 `ContextAwareSearchPanel`，其 `isContextSearchOpen` 初始为 false，源码没有把它设为 true 的入口；`src/api/fetchData.ts` 的 `insertAtSearchMark` 也明确仍是 stub。它们可以是后续接线候选，但不能写进当前主用户旅程。

这是阅读 UI 代码时最容易犯的错误：组件、类型和 API 方法的存在，只能证明代码资产存在；还要找到可达交互、请求、后端状态变化与失败路径，才能称为已交付功能。

## 本章小结

AlembicDashboard 是本地知识层的人类审阅和观察界面。它通过 HTTP/SSE/WebSocket 消费主 Alembic resident service，展示 Recipes、Candidates、Knowledge、Panorama、Module Explorer、Guard、Skills 和 Jobs。

它的边界同样清楚：前端负责体验和投影，后端/Core 负责事实和 contract，Agent 负责非确定性执行，Plugin 负责 Codex host adaptation。下一章会讲 AI provider、配置和密钥边界。
