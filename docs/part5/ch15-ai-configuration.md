# Ch15 AI Provider、配置与密钥边界

Alembic 可以使用 AI，但 AI 配置不是所有仓库都拥有的能力。主 Alembic resident service 和 `@alembic/agent` 负责 provider-backed jobs；Codex 插件的 host-agent 路径可以利用 Codex 宿主本身，不要求插件保存第三方 API key；Dashboard 只是显示和配置入口之一。

本章讲 AI provider、配置来源、fallback、embedding 和密钥边界。目的不是列所有环境变量，而是让读者知道哪一层可以读取什么、哪一层不应该保存什么。

![AI 配置边界图](/images/ch15/01-ai-configuration-boundary.png)

## 本章回答

- Alembic 的 AI provider 在哪里创建。
- CLI、workspace settings、environment variables 如何影响 provider。
- Codex Plugin 为什么不应拥有 resident provider 配置。
- Dashboard AI 配置 UI 的边界是什么。

## 主 AI 配置入口

主 CLI 提供 `alembic ai status`、`alembic ai configure`、`alembic ai import-env`。这些命令围绕 `WorkspaceSettingsStore` 工作，把 provider、model、API key、proxy、reasoning effort、embedding provider/model/base URL/key 等配置写入工作区 settings/secrets 或从环境变量导入。

`ai status` 会展示有效来源和 readiness。`ai configure` 用命令参数或 stdin 写入配置。`import-env` 把当前 shell 显式设置的 Alembic AI 环境变量导入工作区配置。

这条路径属于主 Alembic resident service，不属于 Codex 插件。

## Agent AiFactory 创建 provider

`@alembic/agent` 的 `AiFactory` 支持 google/gemini、openai、deepseek、claude/anthropic、ollama。它可以按 `ALEMBIC_AI_PROVIDER` 显式选择，也可以根据 key 自动探测。若 provider 因地理限制或 provider 级错误不可用，还可以尝试 fallback provider。

它还支持独立 embedding provider：`ALEMBIC_EMBED_PROVIDER`、`ALEMBIC_EMBED_MODEL`、`ALEMBIC_EMBED_BASE_URL`、`ALEMBIC_EMBED_API_KEY`。这让生成模型和 embedding 模型可以分离。

这里的关键是：Provider 创建属于 Agent/主 resident job 的运行依赖。Core 不直接拥有 provider；Plugin 也不应该把 provider 配置写成自己的职责。

## Resident job 与 host-agent path 的差别

当用户通过 Dashboard 或 CLI 启动 provider-backed bootstrap/rescan job 时，主 Alembic daemon 需要可用 AI provider。Job events、process artifacts、Agent runtime、tool calls 都在 resident service 中运行。

当用户通过 Codex 插件调用 host-agent `alembic_bootstrap` 或日常 public tools 时，Codex 自己是宿主 Agent。Plugin 可以返回 Mission Briefing、prime material 和 workflow refs，让 Codex 阅读和执行。这条路径不要求 Alembic resident provider key。

把这两条路径混淆，会导致错误的产品要求，例如要求 Codex 插件存第三方 AI key，或认为没有 resident AI provider 就不能做任何 Alembic 知识工作。

## Dashboard 配置只是 UI 投影

Dashboard 中的 LLM config modal、AI chat、language preference、AI status 等功能通过 `/api/v1/ai` 与主后端交互。前端可以展示 readiness、发起保存、启动 chat/stream，但密钥存储和 provider 创建不在前端。

前端也不应该把 key 放进 localStorage 或长期可见状态。任何密钥处理都应走后端 settings/secrets contract。

## 配置来源优先级要可解释

AI 配置可能来自：

- 工作区 settings/secrets。
- 当前进程环境变量。
- CLI 显式参数。
- provider 默认值。
- Dashboard 后端配置接口。

状态输出必须说明来源。用户排查 provider 不可用时，第一步不是猜模型，而是看 effective provider、model、key 是否存在、config source 是哪里、是否触发 fallback、embedding 是否单独配置。

## 日志与错误分类

Provider 失败需要清楚分类：缺 key、未知 provider、provider probe 失败、地理限制、permission denied、rate limit/quota、网络错误、模型不可用。`AiFactory` 中的 geo/provider error 判断就是为了避免把不可恢复问题当普通重试。

日志不能泄露 API key。状态和 Dashboard 应展示 masked config 或 readiness，而不是原始 secret。

## 本章小结

Alembic 的 AI 配置属于主 resident service 和 Agent runtime 的运行边界。CLI 和 Dashboard 可以配置或展示它，Agent AiFactory 负责创建 provider 和 fallback，Core 不拥有 provider，Codex Plugin 的 host-agent 路径也不需要保存 resident provider key。

这条边界让 Alembic 同时支持本地 provider-backed jobs 和 Codex host-agent workflows，而不把密钥责任扩散到每个仓库。
