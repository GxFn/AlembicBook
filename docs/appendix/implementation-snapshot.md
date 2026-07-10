# Appendix E 当前实现快照

这一页不是版本发布说明，而是本书的**防漂移仪表盘**。正文里出现的规模数字都应该从这里引用；`npm run verify:alembic -- --local ../Alembic` 会重新读取五个源码仓并校验下面的事实断言。源码变化后，验证先失败，书稿再跟着更新。

![当前实现防漂移快照](/images/appendix/05-implementation-snapshot.png)

## 事实快照

| 实现面 | 当前读数 | 权威入口 |
| --- | ---: | --- |
| `@alembic/core` package exports | 66 | `AlembicCore/package.json` |
| Core grammar assets | 11 | `AlembicCore/resources/grammars/` |
| Core knowledge dimensions | 26 | `AlembicCore/src/domain/dimension/DimensionRegistry.ts` |
| Core relation buckets | 14 | `AlembicCore/src/domain/knowledge/values/Relations.ts` |
| Plugin MCP catalog | 19（18 agent + 1 admin） | `AlembicPlugin/lib/host-runtime/mcp/PluginToolSurfaceCatalog.ts:111` |
| Agent-facing workflow tools | 3 | `AlembicPlugin/lib/host-runtime/mcp/public-tools/contract.ts` |
| Agent runtime tools/actions | 7 / 22 | `AlembicAgent/src/tools/runtime/registry.ts:40` |
| 主 HTTP route families | 25 | `Alembic/lib/http/routes/` |
| Provider contract routes | 31 | `Alembic/lib/http/provider-contracts.ts:367` |
| Dashboard tabs | 9 | `AlembicDashboard/src/constants/index.ts:55` |
| Core database tables | 22 | `AlembicCore/src/infrastructure/database/drizzle/schema.ts` |
| 主 runtime DI registrations | 85 | `Alembic/lib/injection/` |
| ProjectContext parser languages | 11 | `AlembicCore/src/service/project-context/shared/parserLanguage.ts:13` |

<!-- alembic-fact: coreExports.count=66 -->
<!-- alembic-fact: grammars.count=11 -->
<!-- alembic-fact: dimensions.count=26 -->
<!-- alembic-fact: relations.count=14 -->
<!-- alembic-fact: pluginMcpTools.count=19 -->
<!-- alembic-fact: pluginMcpTools.agent=18 -->
<!-- alembic-fact: pluginMcpTools.admin=1 -->
<!-- alembic-fact: pluginMcpTools.agentPublic=3 -->
<!-- alembic-fact: agentRuntimeTools.toolCount=7 -->
<!-- alembic-fact: agentRuntimeTools.actionCount=22 -->
<!-- alembic-fact: mainHttp.routeFamilyCount=25 -->
<!-- alembic-fact: mainHttp.providerRouteCount=31 -->
<!-- alembic-fact: mainHttp.panoramaRouteCount=3 -->
<!-- alembic-fact: dashboardTabs.count=9 -->
<!-- alembic-fact: database.count=22 -->
<!-- alembic-fact: serviceMap.registeredCount=85 -->
<!-- alembic-fact: projectContextParsers.languageCount=11 -->

## 数字之外的真实边界

计数只回答“表面有多大”，不回答“链路是否接通”。当前源码还需要同时记住四条语义事实：

1. Plugin 的 `daemon removed (PDR-3)` 只描述宿主插件路径；主 `Alembic` 的 CLI、daemon、HTTP 和 Dashboard server 仍是产品能力。证据在 `AlembicPlugin/lib/host-runtime/mcp/HostMcpServer.ts:995` 与 `Alembic/lib/daemon/runtime/DaemonSupervisor.ts`。
2. ProjectContext 的 file-flow、file-symbols 与 module-layers 已共享 11 语言解析映射，Swift 不再被 TypeScript/JavaScript 白名单挡住；修复入口在 `AlembicCore/src/service/project-context/shared/parserLanguage.ts:13`。
3. SourceRef 漂移已经进入消费面：`drifted` 知识仍可返回，但会降权并携带 `sourceRefStatus`、`driftedSourceRefs`，让使用现场重新核验。证据在 `AlembicCore/src/service/search/SearchEngine.ts:1109` 与 `AlembicPlugin/lib/host-runtime/mcp/handlers/search.ts:1850`。
4. `SourceGraphService.buildFull/buildIncremental` 和 `ProjectSnapshot.sourceGraphResult` 已存在，但当前生产源码扫描没有找到把 build 结果写入 snapshot 的调用方；不能把“有服务和 DTO”写成“冷启动已经构建 source graph”。核验入口是 `AlembicCore/src/service/source-graph/SourceGraphService.ts:45` 与 `AlembicCore/src/types/ProjectSnapshot.ts:374`。

## 如何更新这页

先运行：

```bash
npm run verify:alembic -- --local ../Alembic
```

如果事实断言失败，按以下顺序处理：

1. 读失败项对应的源码入口，确认是实现变化还是校验器过期。
2. 更新正文叙述、这张表和 HTML 事实断言。
3. 对“存在但未接线”的能力额外搜索生产调用方；类型、接口、测试或台账都不能单独证明运行链已接通。
4. 重新运行源码锚点校验和 VitePress build。

这套机制不会证明段落里的每个判断都正确，但会阻止最常见的静默漂移：工具数、route 数、tab 名、包出口、grammar 数和关键公开表面已经变化，书里仍沿用旧快照。
