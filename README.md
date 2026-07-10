# Alembic 当前实现架构书

> 这是 Alembic 配套技术书的实现读本。章节以当前源码和可执行验证为权威，账本与需求文档用于定位历史意图和待核问题。

在线阅读：[docs.gaoxuefeng.com](https://docs.gaoxuefeng.com)

## 当前定位

本书解释的是当前 Alembic 系统：

- `Alembic`：本地 CLI、daemon、HTTP/API、Dashboard server、项目 runtime 和发布安装体验。
- `AlembicCore`：`@alembic/core`，共享 headless deterministic kernel。
- `AlembicPlugin`：Codex/Claude Code MCP host adaptation、skills、channel/marketplace、plugin runtime 和 ProjectContext/RecipeContext tool surface。
- `AlembicAgent`：`@alembic/agent`，AgentRuntime、AI providers、tool system、memory/context。
- `AlembicDashboard`：独立 React/Vite Dashboard 前端。

## 阅读架构

- Part I：系统地图
- Part II：事实内核与结构证据
- Part III：项目运行与知识生产
- Part IV：宿主消费与交付
- Part V：执行器、UI 与 Provider
- Part VI：知识对象、新鲜度与治理
- Part VII：验证、证据与维护
- Appendix：当前实现快照、配置、public API、MCP tools、术语表

全书采用两条交叉主轴：一条从 projectRoot 的结构事实走到 Candidate/Recipe，再走到 Search、Prime、Guard 和 Dashboard；另一条从源码锚点走到运行证据、漂移识别和书稿事实断言。仓库边界仍然保留，但不再替代真实调用链。

## 插图策略

当前正文使用重新生成的 prompt-managed 插图。每张图都有对应的 `prompts/chXX/NN-slug.md` 或 `prompts/appendix/NN-slug.md`，最终图片放在 `docs/public/images/` 下的同名路径。旧版章节图不作为正文插图来源。

## 本地开发

~~~bash
npm install
npm run dev
npm run build
npm run preview
~~~

## 验证建议

~~~bash
npm run build
npm run verify:alembic -- --local ../Alembic
npm run illustrations -- --list
rg -n "diagram-placeholder|插图占位" docs
~~~

第二条命令会从五个源码仓读取锚点和关键实现计数，并核对正文中的 `alembic-fact` 断言；后两条命令分别确认插图清单和正文占位块。

## License

MIT © GaoXuefeng
