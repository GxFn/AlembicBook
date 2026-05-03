# 界面层 — Dashboard · CLI · 多端接入

> 从命令行到 Web UI 到飞书 — 知识系统的多端触点。

## 问题场景

Alembic 的用户接触系统有四种途径：在终端中敲命令、在浏览器中审核 Recipe、在 IDE 中通过 AI Agent 交互、在飞书群中讨论技术决策。每种途径的用户预期和交互模式完全不同——CLI 用户期望秒级响应和结构化输出，Dashboard 用户期望实时进度条和可视化图表，IDE 用户甚至不知道 Alembic 的存在（他们只是在和 AI 对话），飞书用户说的是自然语言而不是命令。

但它们操作的是**同一个知识库**，经过**同一条 Gateway 管线**，遵守**同一套 Constitution 约束**。本章展示 Alembic 如何让四种界面形态共享一个核心，又各自适配自己的交互范式。

![四端接入统一架构图](/images/ch18/01-four-interface-architecture.png)

## 设计决策

### CLI 命令体系

CLI 是 Alembic 的主要安装和管理入口——用户通过 `alembic` 命令完成项目初始化、知识库扫描、合规检查、向量索引等操作。Commander.js 作为参数解析框架，20+ 命令覆盖系统的全部管理功能：

| 命令 | 职责 | 关键参数 |
|:---|:---|:---|
| `alembic setup` | 初始化项目工作空间 | `--force` · `--seed` · `--repo <url>` |
| `alembic coldstart` | ProjectIntelligence + 25 维冷启动 | `--dims` · `--skip-guard` · `--wait` · `--json` |
| `alembic rescan` | 增量重扫（保留 Recipe） | `--dims` · `--skip-guard` · `--wait` |
| `alembic ais [target]` | AI 扫描目标代码 → 自动发布 | `-m` · `--max-files` · `--dry-run` |
| `alembic search <query>` | 知识检索 | `-t type` · `-m mode` · `-l limit` · `-o format` |
| `alembic guard <file>` | 单文件 Guard 检查 | `-s scope` · `--json` |
| `alembic guard:ci [path]` | CI/CD 合规门禁 | `--fail-on-*` · `--min-coverage` · `--report` |
| `alembic guard:staged` | 检查 git 暂存文件 | `--fail-on-error` |
| `alembic ui` | 启动 Dashboard 后台服务 | `-p` · `--no-open` · `--api-only` |
| `alembic server` | 仅启动 REST API | `-p` · `-H` |
| `alembic embed` | 构建/重建向量索引 | `--force` · `--clear` · `--dry-run` |
| `alembic mirror` | IDE 配置镜像 | `--target all\|qoder\|trae` |
| `alembic cursor-rules` | 生成 Cursor 交付产物 | `--verbose` |
| `alembic sync` | 增量同步知识到数据库 | `--dry-run` · `--force` |
| `alembic upgrade` | 更新 IDE 集成 | `--skills-only` · `--mcp-only` |
| `alembic remote <url>` | 转换为独立 Git 子仓库 | URL |
| `alembic status` | 环境状态检查 | `--json` |
| `alembic health` | 系统健康报告 | `-d` · `--json` |

**命令设计模式**——每个命令遵循相同的三阶段结构：

```text
参数解析（Commander.js）→ 服务调用（ServiceContainer）→ 输出格式化（CliLogger）
```

Commander.js 处理参数定义和帮助文档生成。业务逻辑完全委托给 ServiceContainer 中的服务——CLI 层不包含任何数据访问或算法逻辑。CliLogger 提供统一的输出格式：

```typescript
class CliLogger {
  success(msg)   // ✅ 绿色
  error(msg)     // ❌ 红色
  warn(msg)      // ⚠️ 黄色
  info(msg)      // 💡 蓝色
  json(data)     // JSON.stringify(data, null, 2)
  table(data)    // ASCII 表格
  spinner(msg)   // ora 进度转圈
}
```

长耗时操作（`coldstart`、`embed`、`health`）使用 ora spinner 显示进度。`--json` 标志切换所有输出为机器可读的 JSON 格式，方便脚本集成和 CI/CD 管道消费。

**CI/CD 集成**——`alembic guard:ci` 是专门为持续集成设计的命令。它的退出码语义化：0 表示通过，非 0 表示失败（违规数超过阈值）。`--fail-on-error`、`--fail-on-warning`、`--max-warnings`、`--min-coverage` 等参数让团队可以逐步收紧合规标准——先只检查 error 级别，稳定后加入 warning 级别，最终要求 90% 以上的知识覆盖率。

### Dashboard

Dashboard 是面向人类的知识管理界面——审核 AI 产出的候选知识、监控 Bootstrap 进度、可视化项目架构。

**技术栈**：React 19 + Vite + Tailwind CSS 3 + Socket.IO Client + Framer Motion。

为什么选 React 而不是 Vue？两个原因。第一，React 19 的 Hooks 模型在状态管理上比 Vue 的 Options API / Composition API 更统一——Dashboard 有大量异步数据流（WebSocket 推送、SSE 流式响应），Hooks 的 `useEffect` + `useCallback` 处理这些场景更自然。第二，React 的生态中用于数据面板的组件库（表格、图表、拖拽）更丰富。

**10 个核心页面**：

| 页面 | 组件 | 职责 |
|:---|:---|:---|
| Recipes | `RecipesView` | 浏览已发布的 Recipe——搜索 · 过滤 · 生命周期状态 · 使用统计 |
| Candidates | `CandidatesView` | 管理候选知识——AI 富化 · 精炼预览 · 审核发布 |
| Knowledge | `KnowledgeView` | 统一知识 CRUD——Recipe + 候选 + 规则的合并视图 |
| Bootstrap | `BootstrapProgressView` | 实时冷启动进度——Socket.IO 推送 · 阶段明细 · 进度条 |
| Guard | `GuardView` | Guard 规则管理——违规列表 · 合规度仪表盘 · 覆盖率指标 |
| Panorama | `PanoramaView` | 项目全景——模块拓扑 · 知识覆盖热力图 · 架构层次 |
| AI Chat | `AiChatView` | AI 对话——SSE 流式响应 · 上下文提取 |
| Skills | `SkillsView` | 项目技能管理——列表 · 编辑 · 信号建议 |
| Wiki | `WikiView` | 项目文档——AI 生成 · Markdown 编辑 |
| Signals | `SignalReportView` | 信号分析——统计报告 · 趋势图 |

**路由设计**——Dashboard 使用 Tab 导航而非传统路由。`validTabs` 常量定义所有有效标签：`recipes | candidates | knowledge | guard | ai-chat | skills | wiki | panorama | signals | help`。URL query 参数 `?tab=guard` 控制当前页面，避免了 React Router 的复杂配置。

### VSCode Extension

VSCode Extension 是 Alembic 在 IDE 中的存在形式——不是一个独立的面板，而是**编辑器内嵌的辅助能力**。

核心设计思想：**默认最小侵入，只有高置信事件才打断用户**。Extension 不常驻侧边栏、不强制打开面板，日常能力主要通过命令、状态栏、诊断和 Copilot 工具暴露；只有当源码变化明确影响已有 Recipe 时，才走受控的 Reactive Evolution 弹窗。

当前实现的五个触点：

1. **命令面板**——`alembic.search`、`alembic.create`、`alembic.audit`、`alembic.auditProject`、`alembic.status`
2. **Guard 诊断（Diagnostics）**——手动触发 Guard API 后，把 violations 写入 `DiagnosticCollection`
3. **状态栏指示器（StatusBar）**——只在 Alembic 项目中显示连接状态并轮询健康检查
4. **Reactive Evolution**——`FileChangeCollector` 监听文件变化，后台上报 `/api/v1/file-changes`
5. **Copilot 工具代理**——`vscode.lm.registerTool('alembic')` 暴露任务/决策记忆入口

```typescript
// 指令正则模式
const SEARCH_RE = /\/\/\s*(?:alembic|as):(?:search|s)\s+(.*)/
const CREATE_RE = /\/\/\s*(?:alembic|as):(?:create|c)\b(.*)?/
const AUDIT_RE  = /\/\/\s*(?:alembic|as):(?:audit|a)\b(.*)?/
```

指令检测和 CodeLens Provider 仍保留在代码中，但当前入口以命令面板和 Copilot 工具为主：`onDidSaveTextDocument` 自动执行指令的路径是关闭的。这一点很重要——Guard 波浪线不是每次保存都自动检查，而是由 `alembic.audit` / `alembic.auditProject` 调用 `GuardDiagnostics.checkFile()`。

**RemoteCommandPoller** 是 Extension 的秘密武器——它轮询 HTTP Server 的 `/api/v1/remote/pending` 端点，获取来自飞书或 Dashboard 的远程命令。当飞书用户说"帮我生成 NetworkKit 的单元测试"，LarkTransport 把这条命令加入队列，Extension 在下一次轮询时取到命令，通过 Copilot Chat API 执行，再把结果回传。这实现了**飞书 → 服务端 → IDE** 的跨端指令链路。

**FileChangeCollector：从监听到上报**

文件变化监听不是一个单独 watcher，而是一个统一采集器。`activate()` 创建 `FileChangeCollector(apiClient, context, handleReactiveReport)`；Collector 构造时先检查工作区是否是 Alembic 项目，判断标准是工作区根目录存在 `Alembic/`、`.asd/`，或 `~/.asd/projects.json` 中有 ghost 注册。没有项目标记时，整个文件变化采集链路不会启动。

Collector 启动后三类来源并行进入同一个 `EventBuffer`：

| 来源 | VSCode / Git 入口 | 上报事件 | eventSource | 作用 |
|:---|:---|:---|:---|:---|
| IDE 重命名 | `workspace.onDidRenameFiles` | `renamed` + `oldPath` + `path` | `ide-edit` | 后端可自动重写 Recipe 路径 |
| IDE 删除 | `workspace.onDidDeleteFiles` | `deleted` | `ide-edit` | 后端可判断是否直接弃用 Recipe |
| IDE 创建 | `workspace.onDidCreateFiles` | `created` | `ide-edit` | 后端跳过，留给 rescan 补齐新知识 |
| IDE 保存 | `workspace.onDidSaveTextDocument` | `modified` | `ide-edit` | 进入 diff-based 影响分析，允许弹窗 |
| Git HEAD 变化 | watch `.git/HEAD`，2 秒防抖后 `git diff --name-only old..new` | `modified` | `git-head` | 捕捉批量切换/拉取后的变更路径，不弹窗 |
| Working Tree 扫描 | 窗口重新聚焦 3 秒后 + 5 分钟定时 | `created` 或 `modified` | `git-worktree` | 覆盖外部工具或 AI 在 IDE 外产生的未提交变更，不弹窗 |

这里有两个实现边界需要注意。第一，Git HEAD 路径只 watch `.git/HEAD`，因此它可靠覆盖分支切换、detached HEAD 等 HEAD 文件变化；普通分支内 commit/pull 是否触发，取决于 VS Code 对 `.git/HEAD` 的事件表现，当前实现没有直接 watch `.git/refs/heads/*`。第二，Working Tree 扫描只比较“当前 dirty/untracked 集合中新出现的路径”，因此它用于发现进入 dirty set 的文件，不负责把外部删除精确上报为 `deleted`；外部删除在这条路径上通常以 `modified` 进入，真正的删除分类会在 rescan 的增量 diff 中补上。

**EventBuffer：合并、限流和降噪**

`EventBuffer` 的目标是把 IDE 噪声压成少量领域事件，而不是逐次保存都打到服务端：

```typescript
push(event):
  if modified && same path within 30s:
    skip

  if pending has created:path:
    deleted  -> cancel created
    modified -> keep created

  if same key already has eventSource='ide-edit':
    ignore git-head / git-worktree duplicate

  pending[key] = event
  schedule flush in 3s
```

Flush 时再做最后一层过滤：`.asd/`、`.git/`、`node_modules/` 不上报。之后通过 `ApiClient.reportFileChanges()` POST 到 `/api/v1/file-changes`。API 不可用、HTTP 失败或响应结构不符合 `{ needsReview, details }` 时，客户端返回 `null` 并静默跳过弹窗；文件监听链路不因为服务端离线而影响编辑器。

**从响应到弹窗**

服务端返回的是 `ReactiveEvolutionReport`，Extension 只在非常窄的条件下弹窗：

1. `alembic.enableReactivePopup = true`，并且用户没有在本 session 点过 "Don't Show Again"
2. `report.eventSource === 'ide-edit'`，Git 批量来源一律不弹
3. `report.suggestReview === true`
4. 明细中存在 `impactLevel = direct | pattern`，且 action 是 `needs-review` 或 `deprecate`
5. 全局弹窗冷却已超过 2 分钟
6. 对应 Recipe 没有处在递增退避期内

多条 Recipe 会折叠成一条通知，最多预览 3 个标题。按钮行为也对应真实代码：`Review` 打开 IDE Chat 并预填 evolve prompt；`Auto Check` 新建终端执行 `asd evolve-check --recipes <ids>`；`Don't Show Again` 只关闭当前 VS Code session 的弹窗；直接关闭通知会让这些 Recipe 的退避计数加 1，下一次至少延后 1 天，再忽略则延后 2 天，最多 7 天。

### 飞书 Lark Transport

Lark Transport 是最"非常规"的接入端——它把飞书群聊变成 Alembic 的交互界面。

**意图分类**——LarkTransport 接收飞书消息后，首先通过 IntentClassifier 判断意图类型：

| 意图 | 路由目标 | 典型消息 |
|:---|:---|:---|
| `bot_agent` | AgentRuntime + MCP 工具 | "搜索 Cookie 管理的最佳实践" |
| `ide_agent` | RemoteCommand 队列 → VSCode | "帮我重构 NetworkKit 的错误处理" |
| `system` | 系统命令 | "Alembic 状态" |

`bot_agent` 意图的消息直接进入 AgentRuntime——和 MCP Server 共享同一个 Agent 循环。这意味着飞书用户和 IDE 用户使用的是同一个 AI Agent，同一套工具，同一个知识库。只是输入输出的传输层不同。

`ide_agent` 意图实现了一个有趣的跨端协作——飞书用户描述编程任务，命令被投递到队列，IDE 中的 Extension 取走执行。执行结果通过反向路径回传到飞书。这让"在手机上给 AI 下达编程指令，在电脑上看到代码生成"成为可能。

**会话持久化**——ConversationStore 为每个飞书 chat 维护会话历史（`chatId → conversationId` 映射），保存到 `.asd/conversations/` 目录。每个会话最多保留 20 条消息，超出后自动裁剪最早的消息。消息去重使用 5 分钟窗口——飞书偶尔会重发消息（网络问题），`recentMsgIds` Map 过滤重复。

## 架构与数据流

### 后台服务架构

`alembic ui` 命令启动一个综合的后台服务——不是多个独立进程，而是**单进程中的多个服务共存**：

```bash
alembic ui 启动序列：
  ① Bootstrap.initialize()     → 数据库 · 配置 · Gateway
  ② ServiceContainer.initialize() → 106 个实际 DI 键注册
  ③ HttpServer.initialize()
      → Express 应用 + 中间件栈
      → API 路由注册（/api/v1/*）
  ④ RealtimeService(httpServer) → Socket.IO 绑定到同一 HTTP Server
  ⑤ MCP Server（可选）           → 独立 stdio 进程
  ⑥ Dashboard 静态文件 or Vite Dev Server
      → 开发模式：Vite Dev Server（HMR 热更新）
      → 生产模式：express.static(dist/)
```

为什么单进程而非微服务？Alembic 是**本地工具**——不需要水平扩展，不需要进程隔离。单进程意味着 HTTP API、Socket.IO 和 Dashboard 共享同一个 ServiceContainer 实例——服务之间是直接的函数调用，不是 RPC。这消除了序列化开销和网络延迟。

`alembic server` 是 `alembic ui` 的精简版——只启动 HTTP API，不启动 Dashboard 和 Vite。适合 CI/CD 环境或只需要 API 接口的场景。

**端口管理**默认使用 3000，支持 `-p` 参数自定义。端口冲突时抛出明确的错误提示而非静默失败——用户需要知道端口已被占用。

### Socket.IO 实时推送

RealtimeService 是 Dashboard 实时体验的基础——Bootstrap 进度条、知识状态变更、Token 使用量更新都通过它推送。

```typescript
class RealtimeService {
  constructor(httpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
      transports: ['websocket', 'polling'],  // WebSocket 优先，降级 HTTP 长轮询
      pingInterval: 25000,     // 25 秒心跳
      pingTimeout: 20000       // 20 秒超时判定断连
    });
  }
}
```

**事件类型**——后端服务在关键操作完成后，通过 RealtimeService 向所有连接的 Dashboard 客户端广播：

| 事件 | 触发时机 | 数据 |
|:---|:---|:---|
| `candidate-created` | 新候选知识生成 | `{ candidate, timestamp }` |
| `candidate-status-changed` | 候选状态变更 | `{ candidateId, newStatus, oldStatus }` |
| `recipe-published` | Recipe 发布 | `{ recipe, timestamp }` |
| `rule-created` | 新 Guard 规则 | `{ rule, timestamp }` |
| `token-usage-updated` | AI Token 消耗变化 | `{ timestamp }` |
| `bootstrap:skeleton-ready` | 冷启动骨架就绪 | 任务列表 |
| `bootstrap:filling` | AI 填充任务中 | 当前任务 ID |
| `bootstrap:task-done` | 单任务完成 | 结果或错误 |
| `bootstrap:review:round-*` | AI 审核管线进度 | 轮次 · 进度 |

**客户端订阅**——Dashboard 使用 `useBootstrapSocket` 自定义 Hook 监听 Bootstrap 事件：

```typescript
// dashboard/src/hooks/useBootstrapSocket.ts
useEffect(() => {
  const socket = getSocket();
  socket.on('bootstrap:skeleton-ready', handleSkeleton);
  socket.on('bootstrap:filling', handleFilling);
  socket.on('bootstrap:task-done', handleTaskDone);
  return () => { socket.off('bootstrap:skeleton-ready'); /* ... */ };
}, []);
```

所有客户端加入 `notifications` 房间——这是一个简化设计。Alembic 的典型使用场景是单用户（一个开发者管理一个项目的知识库），不需要多房间隔离。如果未来支持团队协作，房间可以按项目或用户分组。

### Dashboard API 层

`dashboard/src/api.ts` 是前端与后端的唯一通信层——所有 HTTP 调用都经过这个模块。基于 Axios，base URL 为 `/api/v1`。

**关键 API 函数按领域分组**：

```typescript
// 知识管理
getKnowledgeList(page, limit, filters)
searchKnowledge(query, page, limit)
publishKnowledge(id)
batchPublishKnowledge(ids)

// 候选富化
enrichCandidates(candidateIds)        // AI 语义字段自动填充
refineCandidatePreview(id, refinement) // 精炼预览（流式）
applyRefinement(id, refinement)        // 应用精炼结果

// 搜索
search(query, { type, mode, limit, groupByKind })
contextAwareSearch(query, context)     // 上下文感知搜索
searchGraph(query)                     // 知识图谱查询

// Guard
auditFile(filePath, content, language) // 单文件审计
auditBatch(files)                      // 批量审计

// 全景
getPanoramaOverview()                  // 模块拓扑 · 层次 · 覆盖率
getPanoramaHealth()                    // 健康评分
getPanoramaGaps()                      // 知识空白点

// AI 对话
chatStream(messages, options)          // SSE 流式响应
```

**错误处理工具函数**——`dashboard/src/utils/error.ts` 提供类型安全的错误处理：

```typescript
getErrorMessage(err: unknown, fallback?: string): string  // 安全提取错误信息
getErrorStatus(err: unknown): number | undefined           // 提取 HTTP 状态码
isAbortError(err: unknown): boolean     // 检测 fetch AbortError
isAxiosCancel(err: unknown): boolean    // 检测 axios 取消
isTimeoutError(err: unknown): boolean   // 检测超时
isAiError(err: unknown): boolean        // 检测 AI Provider 错误
```

这些工具函数遵循 `catch (err: unknown)` 模式——TypeScript strict 模式下 catch 块的 err 类型是 `unknown`，直接访问 `.message` 会报编译错误。工具函数负责安全的类型检查和降级处理。

### Bootstrap 进度——实时管线

Bootstrap（冷启动）是 Alembic 中最长耗时的操作——分析项目 9 个维度、AI 填充知识、三轮审核。整个过程可能持续数分钟，Dashboard 必须实时展示进度。

后端的 Bootstrap 会话结构：

```typescript
interface BootstrapSession {
  id: string;
  status: 'running' | 'completed' | 'completed_with_errors';
  progress: number;    // 0-100
  total: number;       // 总任务数
  completed: number;
  failed: number;
  tasks: BootstrapTask[];
  review?: {
    activeRound: 0 | 1 | 2 | 3;
    round1: { status, total, progress };  // 去重
    round2: { status, total, progress };  // 精炼
    round3: { status, total, progress };  // 关系发现
  };
}
```

前端的 `BootstrapProgressView` 订阅 Socket.IO 事件，逐步更新 UI：

```text
skeleton-ready → 显示任务列表（全灰色骨架）
filling        → 当前任务变为蓝色（进行中）
task-done      → 任务变为绿色（完成）或红色（失败）
review:round-* → 切换到审核阶段，显示三轮审核进度条
```

**SSE 流式响应**——Dashboard 的 AI Chat 和候选精炼使用 Server-Sent Events（SSE）而非 WebSocket。SSE 是单向推送（服务端 → 客户端），恰好匹配"AI 生成流式内容"的场景——客户端发送一个请求，服务端持续推送 token。SSE 比 WebSocket 轻量，不需要维护双向连接。

## 核心实现

### CLI 命令——alembic guard:ci

`alembic guard:ci` 是 CLI 中最复杂的命令——它不只检查单个文件，而是对整个项目执行合规审计，输出结构化报告，并根据阈值决定退出码。

```bash
alembic guard:ci [path]
  --fail-on-error          # error 级别违规时退出码非零
  --fail-on-warning        # warning 级别违规时退出码非零
  --max-warnings <n>       # 允许的最大 warning 数
  --min-coverage <pct>     # 最低知识覆盖率（0-100）
  --report <format>        # 输出格式：text | json | junit
  --output <file>          # 报告输出文件
```

这个命令设计为 CI/CD 管道的一环——GitHub Actions / GitLab CI 中加入一步 `alembic guard:ci --fail-on-error --min-coverage 80`，就能在合并前强制项目代码符合知识库中定义的规范。

`--report junit` 生成 JUnit XML 格式——这是 CI 系统普遍支持的测试报告格式，可以在 PR 中直接显示违规列表。

### Dashboard 状态管理

Dashboard 没有使用 Redux 或 Zustand——对于 10 个相对独立的页面，React 19 自带的 Hooks（`useState` + `useEffect` + `useCallback`）和 Context 已经足够。

```typescript
// 典型的页面状态模式
function RecipesView() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ lifecycle: 'active' });

  const loadRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getKnowledgeList(1, 50, filters);
      setRecipes(data.items);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);
}
```

每个页面管理自己的状态——加载中、数据、过滤条件。Socket.IO 事件通过自定义 Hook 注入需要实时更新的页面。React Hot Toast 提供全局通知，Framer Motion 提供页面切换动画。

为什么不用全局状态管理？因为页面之间几乎没有共享状态——Recipes 页面的数据和 Guard 页面的数据是独立的。唯一的"全局"状态是 Socket.IO 连接和 AI 配置，通过 Context 共享。引入 Redux/Zustand 会增加样板代码而没有实际收益。

### RemoteCommand——跨端指令桥

RemoteCommand 是连接飞书和 IDE 的桥梁。数据流：

```text
飞书消息 "帮我重构 NetworkKit"
  → LarkTransport.receive()
  → IntentClassifier → ide_agent
  → enqueueIdeCommand({ command: 'refactor NetworkKit', meta: { chatId } })
  → remote_commands 表 INSERT (status: 'pending')

VSCode Extension（每 3 秒轮询）
  → GET /api/v1/remote/pending
  → 获取 pending 命令
  → POST /api/v1/remote/claim/:id (status: 'claimed')
  → 通过 Copilot Chat API 执行
  → POST /api/v1/remote/result/:id (status: 'completed', result: '...')

服务端
  → 检测到 result 写入
  → 回传到飞书 → LarkTransport.reply(messageId, result)
```

整个链路是异步的——飞书用户发送消息后不需要等待 IDE 执行完成。服务端在 Extension 提交结果后才回复飞书。如果 Extension 离线（用户关闭了 VS Code），命令会在队列中等待，直到超时。

## 运行时行为

### 场景 1：项目初始化到首次 Dashboard 使用

```yaml
① 终端：alembic setup
   → 创建 .asd/ 目录结构
   → 生成 MCP 配置（.cursor/mcp.json · .vscode/mcp.json · .claude/mcp.json）
   → 初始化 SQLite 数据库 + 自动迁移
   → 提示"运行 alembic ui 启动 Dashboard"

② 终端：alembic coldstart --wait
   → ProjectIntelligence 结构分析 → 25 维执行 → 候选知识审核
   → 生成 50-100 条候选知识
   → 输出扫描报告（维度 · 文件数 · 候选数）

③ 终端：alembic ui
   → Express + Socket.IO + Vite Dev Server 启动
   → 自动打开浏览器 → http://localhost:3000

④ 浏览器：Dashboard
   → Candidates 页面显示 50 条待审核候选
   → 点击"批量发布"→ batchPublishKnowledge(ids)
   → Socket.IO 推送 recipe-published 事件
   → Recipes 页面实时更新
```

### 场景 2：飞书讨论到知识入库

```yaml
① 飞书群：开发者 A 说"我们的错误处理应该统一用 Result<T> 类型"

② LarkTransport.receive(rawEvent)
   → IntentClassifier.classify("错误处理应该统一用 Result<T> 类型")
   → 意图: bot_agent

③ AgentRuntime 执行：
   → alembic_search("Result 类型错误处理") → 未找到相关 Recipe
   → alembic_submit_knowledge({
       title: "统一使用 Result<T> 错误处理",
       kind: "rule",
       doClause: "Use Result<T> for error handling in all service methods",
       ...
     })
   → 新候选知识入库

④ 飞书回复："已创建知识候选'统一使用 Result<T> 错误处理'，
   请在 Dashboard 中审核发布。"

⑤ Dashboard：candidate-created 事件 → Candidates 页面实时显示新候选
```

### 场景 3：VSCode 中的无感交互

```yaml
① 开发者打开一个 Alembic 项目
   → Extension onStartupFinished 激活
   → hasAnyProject() 命中 Alembic/ 或 .asd/
   → StatusBar 开始健康检查轮询
   → FileChangeCollector 注册 IDE 文件事件 + Git/Working Tree 采集

② 开发者需要查询知识时
   → Command Palette 执行 "Alembic: Search Knowledge Base"
   → ApiClient.search(query)
   → HTTP GET /api/v1/search?q=...
   → QuickPick 展示 Recipe 代码预览
   → 选择后 editor.edit() 插入代码片段

③ 开发者需要 Guard 检查时
   → 执行 "Alembic: Audit Current File"
   → GuardDiagnostics.checkFile(document)
   → POST /api/v1/guard/file
   → violations 写入 DiagnosticCollection
   → Problems 面板和编辑器波浪线显示违规

④ 开发者保存 PaginationController.swift
   → onDidSaveTextDocument 命中 file + in-scope
   → EventBuffer.push({ type: modified, eventSource: ide-edit })
   → 3 秒后批量 POST /api/v1/file-changes

⑤ 服务端返回 ReactiveEvolutionReport
   → 若 suggestReview=true 且存在 pattern/direct 影响
   → handleReactiveReport 通过冷却、退避、来源过滤
   → VS Code 弹窗提示 Review / Auto Check / Don't Show Again
```

## 权衡与替代方案

### CLI 框架选择——Commander vs yargs vs oclif

Commander.js 是最轻量的选择——纯 ESM 兼容，无装饰器依赖。yargs 功能更丰富（自动补全、命令发现），但在 ESM 模块中有已知的兼容性问题。oclif 是企业级 CLI 框架，提供插件系统和自动生成命令文档——但对于 Alembic 的 18 个命令来说过于重型。Commander.js 的"一个文件一个命令"模式足够清晰。

### Socket.IO vs WebSocket 原生

Socket.IO 在原生 WebSocket 之上提供三个关键能力：**自动重连**（网络断开后自动重试）、**传输降级**（WebSocket 不可用时降级到 HTTP 长轮询）和**房间管理**（广播到特定客户端组）。对于 Dashboard 这种需要稳定实时连接的场景，手动实现这三个能力的代码量远超 Socket.IO 本身的体积。

代价是额外的依赖（socket.io + socket.io-client 约 200KB）。如果未来 WebSocket 标准更成熟（如 WebTransport），可以考虑迁移。

### Dashboard 构建——Vite Dev Server vs 预构建

`alembic ui` 在开发模式下启动 Vite Dev Server（支持 HMR 热更新），生产模式下直接用 Express 托管预构建的 `dist/` 目录。

为什么不总是用预构建？因为 Alembic 的 Dashboard 代码随 npm 包一起分发——`npm install -g alembic` 时已经包含了构建好的 `dashboard/dist/`。但开发者修改 Dashboard 源码时（贡献代码），需要 HMR 的即时反馈。`alembic ui` 自动检测：如果 `dashboard/src/` 存在，启动 Vite Dev Server；否则使用静态文件服务。

### 飞书集成的边界

Lark Transport 是一个实验性功能——它展示了知识系统可以接入自然语言渠道的可能性。但飞书消息的噪声比（闲聊 vs 技术讨论）远高于 CLI 和 Dashboard。IntentClassifier 的分类准确率直接影响用户体验——一条闲聊消息被错误分类为 `bot_agent` 会触发不必要的 Agent 循环。

当前的缓解策略是保守分类——不确定的消息默认为 `system`（只返回状态信息，不触发 Agent）。未来可以引入更精确的意图模型，但这需要训练数据的积累。

## 小结

Alembic 的四端接入共享一个核心——ServiceContainer 中的 106 个实际注册 DI 键通过不同的界面层暴露给不同的用户群体，其中 75 个公开 typed keys 由 ServiceMap 提供类型安全覆盖：

- **CLI** 提供 18+ 命令覆盖全部管理功能，`guard:ci` 集成 CI/CD 管道，`--json` 支持脚本消费
- **Dashboard** 用 React 19 + Socket.IO 实现 10 个页面的实时管理界面，Bootstrap 进度条和知识审核流是核心体验
- **VSCode Extension** 通过命令面板、Guard 诊断、Reactive Evolution 文件变化采集和 Copilot 工具代理实现最小侵入的 IDE 集成，RemoteCommand 桥接飞书指令
- **Lark Transport** 把飞书群聊变成知识入口，意图分类路由到 bot_agent（知识操作）和 ide_agent（编程任务）

四种界面形态的共同点是：它们都不包含业务逻辑——业务逻辑在 Service 层和 Domain 层。CLI 是 ServiceContainer 的命令行外壳，Dashboard 是 HTTP API 的可视化外壳，Extension 是 API 的 IDE 嵌入，Lark 是 AgentRuntime 的自然语言外壳。四个外壳，一个内核。

::: info 全书总结
至此，我们从 SOUL 原则出发，经过架构基石、知识领域、核心服务、Agent 智能层，最终到达平台交付。Alembic 的每一层都在践行同样的设计哲学：确定性优先、信号驱动、纵深防御、正交组合。
:::
