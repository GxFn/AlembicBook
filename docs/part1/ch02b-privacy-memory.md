# 本地记忆主权 — 当 AI 平台争夺你的上下文

> Agent 是消耗品，知识是资产。谁控制记忆，谁就控制了 AI 编程的未来。
>
> **相关章节**：记忆的工程实现见 [ch15 工具与记忆系统](../part5/ch15-tools-memory)，信号持久化见 [ch12 代谢引擎](../part4/ch12-metabolism)，交付通道见 [ch17 MCP 协议](../part6/ch17-mcp-delivery)

## 一个正在发生的故事

2024 年 2 月 13 日，OpenAI 为 ChatGPT 加入 [Memory 功能](https://openai.com/index/memory-and-new-controls-for-chatgpt/)。到 2025 年 4 月，Memory 进一步增强——ChatGPT 不仅保存你明确要求它记住的内容，还会**自动回溯所有历史对话**来构建用户画像。同期，Anthropic 将 Claude Code SDK 更名为 Claude Agent SDK，数据收集条款写明：收集"usage data（如代码的采纳或拒绝）以及 associated conversation data"。2026 年，Anthropic 推出 [Managed Agents](https://www.anthropic.com/engineering/managed-agents)——替你在云端长期运行 Agent 的托管服务。Agent 的记忆、上下文、决策历史被打包为持久化 session log，存储在 Anthropic 的基础设施上；你的 agent 积累的上下文越丰富，你就越难迁走。

然后事情发生了。2026 年 1 月，瑞士研究员 Marcel Bucher 在 [*Nature*](https://www.nature.com/articles/d41586-025-04064-7) 上讲述：当他在 ChatGPT 设置中关闭数据同意选项后，**两年的学术对话历史全部消失**。他没有备份——因为那些"记忆"从来就不在他的硬盘上。

你的编码习惯、项目架构理解、技术决策偏好——这些最私密的开发者画像，存储在别人的数据中心里。仔细看 Managed Agents 的架构，三个结构性问题已经浮现：

**锁定。** Managed Agents 将 agent 的全部上下文存储为一条 durable append-only session log——这条日志越长、积累的项目理解越深，你就越难迁移到另一个平台。锁的不是代码，不是数据，而是**上下文本身**。

**失控。** session log 对 harness 开放（"durable and available for interrogation"），但对你不开放。OpenAI 更直白："我们可能会使用您提供给 ChatGPT 的内容（包括记忆）来改进模型。"你无法审计 AI 到底"记住"了什么，更无法导出为通用格式。

**易碎。** Anthropic 自己说，harness 对上下文的压缩和裁剪是"irreversible decisions about what to keep"。Marcel Bucher 关闭一个设置选项，两年对话消失。团队成员 A 花三个月教会 agent 的项目规范，成员 B 完全无法继承——因为那些"记忆"从来就不在你的文件系统里。

::: info 公平地说
并非所有设计都走服务器路线。Claude Code 的 `CLAUDE.md`、Cursor 的 `.cursorrules` 存储在项目本地——方向正确，但只覆盖最浅层的"指令偏好"。项目的知识体系、行为信号、质量守卫规则，仍然没有本地化的解决方案。
:::

每一个 AI 编程平台都在用"更好的记忆"作为卖点，同时把你的知识资产变成它们的平台壁垒。

## 设计决策：知识和记忆都属于项目

Alembic 做了两件事，它们服务于不同目的，但共享同一个原则——**本地优先，零数据上传**。

**Recipe 是本职。** 经过 AST 验证、质量评分、人工审核的项目知识——编码规范、架构模式、最佳实践——以 Markdown 文件存储在 `Alembic/recipes/`，跟代码一起 Git 管理。这是确定性资产，团队共享，可审计、可迁移。

**记忆同样在本地。** Agent 的行为信号、对话历史、跨会话事实——这些帮助 Agent 记住你的习惯和项目上下文的"软知识"——存储在 `.asd/` 目录下，不提交 Git，不上传到任何服务器。记忆是个人的——每个开发者的 Agent 独立积累对你行为和偏好的理解。

```text
┌─────────────────────────────────────────────────┐
│  知识（本职·团队共享）         Git 版本控制          │
│  Alembic/recipes/      正式 Recipe            │
│  Alembic/candidates/   候选知识               │
│  Alembic/skills/       项目技能               │
├─────────────────────────────────────────────────┤
│  记忆（个人·不提交 Git）       .asd/       │
│    ├── alembic.db      关系数据 + 向量索引     │
│    ├── signals/            行为信号 JSONL          │
│    ├── conversations/      对话历史                │
│    └── session-store/      会话快照                │
├─────────────────────────────────────────────────┤
│         ↓ 六通道交付（零数据上传）↓                  │
│                                                 │
│  Cursor · Windsurf · Copilot · Claude Code       │
│  Trae · Qoder · 未来任何 MCP 兼容 IDE             │
└─────────────────────────────────────────────────┘
```

换 IDE 只是换了一个交付通道。换模型只是换了一个推理引擎。底层的 Recipe 和记忆——全部留在本地，不因任何外部变动而损失。

这和 Git 的故事有深层的相似性。Git 之前，代码版本历史被锁在 SourceSafe、Perforce 等集中式平台里——服务器挂了历史就没了，换平台历史带不走。Git 把版本历史变成了**本地优先的、可移植的资产**。Alembic 正在对 AI 编程的"项目记忆"做同样的事。

## 知识与记忆的四层架构

Recipe 是 Alembic 的本职——结构化的项目知识。记忆则帮助 Agent 记住你的行为习惯和项目上下文。两者服务于不同目的，分布在四个层次上。

### 第一层：知识库（Recipe — 本职）

这不是记忆，而是 Alembic 的核心产出——经过 AST 验证、质量评分、人工审核的项目知识。每条 Recipe 是一个独立的 Markdown 文件，存储在 `Alembic/recipes/` 目录下，跟代码一起 Git 管理。

```text
存储：Alembic/recipes/*.md + SQLite 索引
时间尺度：永久（跟项目生命周期一致）
版本控制：Git 跟踪，团队共享
迁移方式：git clone 即完成
```

知识库是**人工审核过的确定性资产**——经过 25 维质量评分和六态生命周期管理的结构化知识。它的可信度不来自 AI 的判断，而来自人类的审批。Recipe 独立于任何 AI 模型存在：纯文本 Markdown，任何能读文件的 Agent 都能消费。

以下三层是记忆——帮助 Agent 记住你的行为和项目，全部存储在本地。

### 第二层：行为信号（持续积累）

Agent 的每次工具调用、每次知识搜索、每次 Guard 审计、每次意图漂移——都被 SignalBus 捕获并持久化为 JSONL 文件：

```text
存储：.asd/signals/{type}.jsonl
时间尺度：持续积累，代谢引擎周期性消费
类型：guard · search · usage · intent · lifecycle
迁移方式：文件复制
```

行为信号是知识进化的燃料。代谢引擎从中发现：哪些 Recipe 被频繁搜索（说明它有价值），哪些 Guard 规则一直没命中（可能过时了），哪些知识在 Prime 时被检索但 Agent 最终没用（可能需要修订）。

信号的价值在于它是**去中心化的观测**——不是平台在观察你，而是你的项目在观察自己。数据不离开本地，消费者是你自己的代谢引擎。

### 第三层：Agent 记忆（项目级持久化）

Agent 在多次交互中积累的项目事实——"这个项目用 MVVM 架构"、"团队偏好 protocol 而不是 abstract class"、"网络层基于 Alamofire 封装"。

```text
存储：SQLite semantic_memories 表
时间尺度：跨会话持久化，按重要度衰减
评分：Recency × Importance × Relevance 三维评分
迁移方式：数据库文件复制
```

Agent 记忆采用三维评分模型——最近使用过的（Recency）、被标记为重要的（Importance）、与当前上下文相关的（Relevance）记忆优先被召回。不常用的记忆不会被删除，而是评分逐渐降低，在上下文窗口竞争中自然被挤出——这模仿了人类记忆的遗忘曲线。

关键区别：这些记忆存储在项目本地的 SQLite 数据库中，不在任何云端，但也不提交 Git——它是个人的。团队成员 A 积累的项目理解，成员 B 无法直接继承；但成员 A 的高价值发现一旦晋升为 Recipe，就通过 `git pull` 成为整个团队的共享知识。

### 第四层：会话上下文（临时工作区）

单次对话中的工作状态——当前正在分析哪个模块、已经调用了哪些工具、做了什么决策。

```text
存储：.asd/conversations/{id}.jsonl + session-store/
时间尺度：单次会话（可跨会话恢复）
预算：12K token 滑动窗口，超限自动摘要
迁移方式：会话结束后自动整合到第二、三层
```

会话上下文有严格的 Token 预算管理——超过 12K token 时自动触发摘要压缩：保留开头的概览和最近的交互，压缩中间的历史轮次。这不是信息丢失，而是信息密度的提升。

## 从记忆到知识：信息的向上流动

四个层次不是静态的抽屉——记忆会向上沉淀，最终可能跨越边界成为正式知识：

```text
第四层（会话上下文）
  │ close → IntentChainRecord
  ↓
第二层（行为信号）
  │ 代谢引擎消费：衰退检测 · 冗余分析 · 进化提案
  ↓
第三层（Agent 记忆）
  │ Extract-Update 模式：新事实 ADD · 旧事实 UPDATE · 冲突 MERGE
  ↓
第一层（知识库）
  │ Evolution Proposal → 人工审核 → Recipe 发布
  ↓
  永久资产（Git 版本控制）
```

一条知识的典型旅程：Agent 在一次会话中发现"这个项目的错误处理遵循特定模式"（第四层）。会话结束后，这个发现作为意图信号持久化（第二层）。多次会话积累后，模式被确认为项目事实（第三层）。当代谢引擎检测到足够的信号支撑时，生成一条 Evolution Proposal，经人工审核后成为正式 Recipe（第一层）。

**关键设计：记忆逐层沉淀，最终跨越边界成为知识。** 从临时的对话片段，到结构化的行为信号，到评分过的项目事实，到人工审核的正式 Recipe——每一步都伴随着确定性的增强。记忆帮 Agent 记住你，知识帮项目记住自己。

## 隐私的工程实现

"本地存储"不是喊口号——它需要在代码中的每个角落防止数据意外外泄。Alembic 的隐私保护是多层次的工程实现。

### PathGuard——文件系统沙箱

PathGuard 是第一道防线——严格限制 Alembic 可以写入的文件路径：

```typescript
// lib/shared/PathGuard.ts
// Layer 1: assertSafe() — 不允许写出项目目录
// Layer 2: assertProjectWriteSafe() — 只允许写入以下前缀：
//   .asd/     → 运行时数据
//   Alembic/      → 知识库文件
//   .cursor/          → IDE 集成
//   .vscode/          → IDE 集成
//   .github/          → Copilot 指令
```

PathGuard 防止的不是恶意攻击，而是**工程事故**——AI Agent 在推理过程中可能幻觉出不合理的文件写入操作。双层检查确保即使 Agent 行为异常，也无法写入项目之外的任何位置。

### Constitution——角色权限矩阵

AI Agent（`external_agent` 角色）的权限被严格约束：

```yaml
# config/constitution.yaml
roles:
  - id: "external_agent"
    constraints:
      - "cannot delete any data"
      - "cannot modify system configuration"
      - "cannot access audit logs"
```

只有项目 owner（`developer` 角色）才能执行删除操作。所有删除都记录审计日志。AI 永远不能静默地销毁知识。

### 零外传架构

Alembic 的 MCP Server 使用 **stdio 传输**——标准输入/输出流，不开网络端口。数据路径是：

```text
IDE Agent ←stdio→ MCP Server ←文件系统→ .asd/ + Alembic/
                       ↑
                   无网络连接
                   无遥测上报
                   无第三方 API 调用
```

MCP Server 进程没有任何出站网络连接（AI Provider 的 API 调用由 IDE 侧完成，不经过 MCP Server）。知识检索、Guard 审计、信号持久化——所有操作都在本地文件系统内完成。

即使 AI Provider 的模型能从对话上下文中"看到"项目知识（因为 IDE 把搜索结果注入了上下文窗口），模型也无法直接访问知识库。它只能通过 MCP 工具接口获取 Alembic 允许返回的内容——工具的返回值经过 `SlimSearchResult` 投影，只包含标题、触发器、摘要和评分，不包含完整的 Recipe 内容和内部元数据。

### 开发仓库自保护

Alembic 自身的源码仓库有特殊保护——防止开发期间的测试在源码目录中产生垃圾数据：

```typescript
// lib/shared/isOwnDevRepo.ts
// 检测条件：package.json name === 'alembic' && lib/bootstrap.ts 存在 && SOUL.md 存在
// 命中时：
//   DatabaseConnection → 重定向到 $TMPDIR/alembic-dev/
//   PathGuard → 阻止创建 .asd/ 和 Alembic/
//   SetupService → 拒绝执行 setup
```

这是一个元层面的隐私设计——系统保护自己的源码不被自己的运行时污染。

## 飞轮效应：越用越好

本地知识和记忆共同产生了平台方案无法复制的**飞轮效应**。

### 冷启动：知识先行

一个项目跑完 Bootstrap，产出 50-200 条 Recipe——这是知识层的即时产出。新来的 Agent（无论是 Claude、GPT 还是未来的某个开源模型）直接享用，不需要重新"教"。同时，Agent 的每次交互都在本地积累行为信号和项目记忆，让后续的 Agent 越来越懂你的习惯。

平台方案的问题是：换模型 = 从头开始。Alembic 的设计是：**知识独立于模型，记忆跟着项目走**。

### 信号积累

Agent 的行为记忆反哺知识库——每次交互产生的信号被代谢引擎持续消费：

```text
搜索信号 → 发现高频使用的知识 → 提升其交付优先级（通道 A Top 15）
Guard 信号 → 发现频繁违规的规则 → 增强其检测权重
意图信号 → 发现知识覆盖盲区 → 生成 Gap 分析报告
漂移信号 → 发现 Agent 的意图偏移模式 → 优化 Prime 的知识检索策略
```

使用越多，记忆越丰富，知识越精准，Guard 越准确——这是一个正反馈循环，而且循环的每一步都发生在本地。

### 团队积累

知识库跟代码仓库走，`git pull` 就能同步团队最新的 Recipe、Guard 规则、项目技能。记忆则是个人的——每个开发者的 Agent 独立积累行为信号和项目事实，但高价值的发现会通过记忆→知识晋升机制变成 Recipe，进而成为团队共识。新成员加入时，不需要花一个月"让 AI 熟悉项目"——Recipe 已经包含了团队积累的所有编码约定，Agent 自己的记忆则从第一次交互开始积累。

这是平台方案完全做不到的——Claude 记住的是某一个用户的偏好，不是一个团队的共识；而且那些记忆锁在云端，连用户自己都带不走。

## 记忆系统的完整蓝图

前面描述的四层架构和飞轮效应已经部分实现。以下是记忆系统的完整设计蓝图——如何让 Agent 更好地记住你的行为和项目，如何让高价值记忆自动晋升为正式知识。

### 记忆→知识晋升引擎（规划中）

当前从记忆到知识的晋升还是半自动的——Agent 记忆（第三层）到正式 Recipe（第一层）的跃迁需要人工触发 Evolution Proposal。规划中的晋升引擎将自动化这个过程：

```text
MemoryConsolidationEngine:
  ① 周期性扫描 semantic_memories 表
  ② 对频繁出现的事实进行聚类（相同主题的记忆合并）
  ③ 达到阈值（3+ 次独立出现 · confidence > 0.8）时自动生成 Candidate
  ④ Candidate 进入标准审核流程（25 维评分 → 置信度路由 → 人工审批）
```

Agent 记住的项目事实不再需要开发者手动提炼——系统自动识别高价值记忆并提名为正式 Recipe 候选。记忆服务于 Agent，但最有价值的记忆终将毕业为服务于整个团队的知识。

### 记忆衰减与遗忘（部分实现）

PersistentMemory 已经实现了基于 Recency × Importance × Relevance 的三维评分，但**主动遗忘**机制还在完善中：

```text
遗忘策略（规划）:
  ① 时间衰减：30 天未访问的记忆，Recency 分降至 0
  ② 矛盾消解：新记忆与旧记忆冲突时，保留高 confidence 一方
  ③ 容量整合：记忆总量超过阈值时，低分记忆被摘要压缩后合并
  ④ 源失效：记忆引用的源文件被删除时，标记为 stale
```

遗忘不是丢信息——而是信息密度的持续提升。100 条碎片化的记忆不如 10 条经过整合的高质量事实。

### 跨项目记忆迁移（规划中）

同一个开发者可能维护多个项目。某些记忆是项目特定的（"这个项目用 Alamofire"），某些是个人通用的（"我偏好 protocol-oriented programming"）。

```text
记忆分层（规划）:
  └── 全局记忆（~/.asd/global-memories/）
       │  开发者个人偏好 · 通用编码习惯
       │  跨项目共享 · 不跟 Git
       │
  └── 项目记忆（.asd/）
       │  项目特定事实 · 团队共识
       │  跟 Git · 团队共享
       │
  └── 会话记忆（内存 + session-store/）
         当前工作状态 · 会话结束后整合
```

全局记忆让开发者在不同项目间保持一致的 AI 体验——不需要每个新项目都重新教 Agent "我喜欢用 guard let 而不是 if let"。

### 记忆质量反馈环（规划中）

当 Agent 基于某条记忆做出决策后，用户的反应（接受/拒绝/修改）应该回流到记忆的评分中：

```text
Agent 引用记忆 #42 生成代码 → 用户接受 → 记忆 #42 importance +0.5
Agent 引用记忆 #42 生成代码 → 用户拒绝 → 记忆 #42 importance -1.0
Agent 引用记忆 #42 生成代码 → 用户修改 → 记忆 #42 标记为 needs_revision
```

这形成了记忆的质量闭环——高质量的记忆被强化，低质量的被衰减，错误的被标记修正。不需要人工审查每条记忆，用户的自然行为就是最好的反馈信号。

## 与平台方案的本质区别

回到起点。Alembic 和平台方案的区别不是"数据存在哪里"这个技术细节——而是**谁拥有你的知识和记忆**这个根本问题。

| 维度 | 平台记忆 | Alembic |
|:---|:---|:---|
| **所有权** | 平台拥有 | 项目拥有 |
| **可审计性** | 用户只能看到摘要条目 | 完整 JSONL / Markdown 可审计 |
| **可迁移性** | 锁定在单一平台 | `git clone` 即完成 |
| **团队共享** | 个人绑定 | `git pull` 即同步 |
| **模型独立性** | 绑定特定模型 | 任何 MCP 兼容 Agent |
| **存活性** | 平台停运 = 消失 | 文件在 = 知识和记忆都在 |
| **进化机制** | 黑盒（平台决定） | 透明（信号驱动 + 人工审核） |
| **数据用途** | 可能用于模型训练 | 仅供本地消费 |

最深层的区别是**激励对齐**。平台的激励是让你留在平台上——记忆越丰富，迁移成本越高。Alembic 的激励是让你的项目越来越好——知识和记忆增值的受益者是你，不是某个平台。

> **AI 工具会更新换代，编程语言会推陈出新，但项目的知识和记忆不应该因为任何外部变动而归零。**

这是 Alembic 的第零个设计决策——比 SOUL 原则更底层的存在性选择：知识和记忆属于创造它的人。

::: tip 下一章
[SOUL 原则 — 知识引擎的身份约束](./ch02-soul)
:::
