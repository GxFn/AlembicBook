---
layout: home
hero:
  name: Alembic
  text: 真实实现架构书
  tagline: 沿代码事实、知识生产、宿主消费与新鲜度闭环理解 Alembic
  actions:
    - theme: brand
      text: 开始阅读
      link: /part1/ch01-system-map
    - theme: alt
      text: 当前实现快照
      link: /appendix/implementation-snapshot
    - theme: alt
      text: GitHub
      link: https://github.com/GxFn/Alembic

features:
  - title: Part I · 系统地图
    details: 从用户项目、仓库边界和运行入口重新建立 Alembic 的当前整体模型。
  - title: Part II · 事实内核与结构证据
    details: 分开解释 ProjectContext、RecipeContext、Graph、Recipe Map、检索和 Guard，不把结构与知识混成一个黑箱。
  - title: Part III · 项目运行与知识生产
    details: 沿 CLI、daemon、HTTP、Jobs、计划、cold start 与 rescan 追踪知识如何产生。
  - title: Part IV · 宿主消费与交付
    details: 沿 stdio 到 Core handler 的真实请求链解释 MCP、public workflow、skills 与双宿主交付。
  - title: Part V · 执行器、UI 与 Provider
    details: 区分 AlembicAgent 的非确定性执行、Dashboard 的后端投影，以及 provider 与密钥边界。
  - title: Part VI · 知识对象、新鲜度与治理
    details: 解释 Candidate、Recipe、六态生命周期、SourceRef 漂移、evolution、Guard 与人工审阅。
  - title: Part VII · 验证、证据与维护
    details: 用发布矩阵、运行证据、源码权威梯级和可执行事实断言约束书稿漂移。
---
