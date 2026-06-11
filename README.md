# Alembic 当前实现架构书

> 这是 Alembic 配套技术书的新版结构。它不再沿用旧的单仓库章节和旧插图，而是按当前多仓库实现重新解释 Alembic。

在线阅读：[docs.gaoxuefeng.com](https://docs.gaoxuefeng.com)

## 当前定位

本书解释的是当前 Alembic 系统：

- `Alembic`：本地 CLI、daemon、HTTP/API、Dashboard server、项目 runtime 和发布安装体验。
- `AlembicCore`：`@alembic/core`，共享 headless deterministic kernel。
- `AlembicPlugin`：Codex MCP、skills、channel/marketplace、plugin runtime 和 Codex host adaptation。
- `AlembicAgent`：`@alembic/agent`，AgentRuntime、AI providers、tool system、memory/context。
- `AlembicDashboard`：独立 React/Vite Dashboard 前端。

## 新章节结构

- Part I：系统地图
- Part II：Core 内核
- Part III：本地运行时
- Part IV：Codex 插件
- Part V：Agent 与 Dashboard
- Part VI：知识生命周期
- Part VII：发布与证据
- Appendix：配置、public API、MCP tools、术语表

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
npm run illustrations -- --list
rg -n "diagram-placeholder|插图占位" docs
~~~

第二条命令用于确认 prompt 清单里的目标图全部存在；第三条命令用于确认正文不再残留占位块。

## License

MIT © GaoXuefeng
