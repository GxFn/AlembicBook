# 生命周期与进化 — 知识的生老病死

> 知识不是静态快照，它有诞生、成长、衰退和消亡 — 六态状态机管理整个旅程。

## 问题场景

你提取了一条 "所有网络请求必须通过 NetworkManager 单例" 的 Recipe。半年后，团队重构为 async/await 原生并发，`NetworkManager` 已经被弃用。但 Recipe 还在，AI 继续按旧模式生成代码——更糟的是，Guard 会对新代码报出 violation，因为它没有经过早已废弃的 `NetworkManager`。

另一种场景：Agent 在冷启动时生成了两条几乎相同的 Recipe，描述同一个设计模式但措辞略有不同。搜索时两条都被命中，用户无法确定哪条是权威版本。

还有一种场景：某条 Recipe 的 `reasoning.sources` 引用了三个文件，其中两个在最近的重构中被删除了。这条知识的"证据链"已经断裂，但系统不会自动发现。

这三个场景指向同一个根本问题：**代码在持续进化，知识库如果不跟上，就会从资产变成负债**。

一个知识引擎不能只解决"如何提取知识"的问题。它必须同时解决：知识什么时候生效？如何安全地更新？什么时候过时？怎样退出？整个进化子系统遵循一个核心原则：**确定性高的自动化，需要理解力的交给 Agent**。

## 设计决策

### 六态状态机

传统知识库通常只有两种状态：`active`（有效）和 `archived`（归档）。这对于人工维护的文档也许够用——人可以在切换状态时完成所有必要的判断。但对于 AI 驱动的知识引擎，二态模型无法区分两种截然不同的情况：

- 一条知识"正在被评估中"和"已经完全可用"——消费方（搜索、Guard）应该给予不同的权重
- 一条知识"正在被修改"和"正在衰退"——前者只是暂时不稳定，后者可能需要永久退出

Alembic 设计了六态生命周期模型：

```text
pending → staging → active → evolving → decaying → deprecated
```

每个状态有明确的语义和消费规则：

| 状态 | 语义 | 搜索可见 | Guard 参与 | 权重 |
|:---|:---|:---|:---|:---|
| `pending` | 待审核，所有新条目的初始状态 | ✗ | ✗ | — |
| `staging` | 暂存期，高置信度条目在此观察 | ✓ | ✓ | 降权 |
| `active` | 已发布，正式知识 | ✓ | ✓ | 全权重 |
| `evolving` | 进化中，有 Evolution Proposal 附着 | ✓ | ✓ | 全权重 |
| `decaying` | 衰退观察期，可能已过时 | ✓（降权） | ✓（降级为 warning） | 降级 |
| `deprecated` | 已废弃 | ✗ | ✗ | — |

状态分组在代码中定义为常量数组，供搜索、Guard、统计等模块直接引用：

```typescript
// lib/domain/knowledge/Lifecycle.ts

/** 可消费状态（Guard/Search/Delivery 可使用的状态） */
export const CONSUMABLE_STATES = [
  Lifecycle.STAGING,
  Lifecycle.ACTIVE,
  Lifecycle.EVOLVING,
];

/** 降级消费状态（Guard violation 降为 warning，Search 降权） */
export const DEGRADED_STATES = [Lifecycle.DECAYING];

/** Guard 可消费状态（含降级 decaying）*/
export const GUARD_LIFECYCLES = [
  Lifecycle.STAGING,
  Lifecycle.ACTIVE,
  Lifecycle.EVOLVING,
  Lifecycle.DECAYING,
] as const;
```

注意 `CONSUMABLE_STATES` 和 `GUARD_LIFECYCLES` 的区别：Guard 检查会遍历 `GUARD_LIFECYCLES`（包括 `decaying`），但 `decaying` 状态的规则产生的 violation 会被降级为 warning——提示开发者可能有问题，但不阻断工作流。这是一个刻意的设计：衰退期的知识仍然可能是有价值的，只是不够确定。

合法的状态转换定义在一张静态表中：

```typescript
// lib/domain/knowledge/Lifecycle.ts
const VALID_TRANSITIONS: Record<string, string[]> = {
  [Lifecycle.PENDING]:    [Lifecycle.STAGING, Lifecycle.ACTIVE, Lifecycle.DEPRECATED],
  [Lifecycle.STAGING]:    [Lifecycle.ACTIVE, Lifecycle.PENDING],
  [Lifecycle.ACTIVE]:     [Lifecycle.EVOLVING, Lifecycle.DECAYING, Lifecycle.DEPRECATED],
  [Lifecycle.EVOLVING]:   [Lifecycle.STAGING, Lifecycle.ACTIVE, Lifecycle.DECAYING],
  [Lifecycle.DECAYING]:   [Lifecycle.ACTIVE, Lifecycle.DEPRECATED],
  [Lifecycle.DEPRECATED]: [Lifecycle.PENDING],
};

export function isValidTransition(from: string, to: string): boolean {
  const normalFrom = normalizeLifecycle(from);
  const normalTo = normalizeLifecycle(to);
  const allowed = VALID_TRANSITIONS[normalFrom];
  return Array.isArray(allowed) && allowed.includes(normalTo);
}
```

几个值得注意的转换路径：

- **`deprecated → pending`**：已废弃的知识可以被"复活"——回到待审核状态重新走一遍晋升流程。这不是随意设计的，而是因为在实践中确实存在"某个被废弃的库重新被采用"的情况。
- **`evolving → staging`**：进化后的知识不直接回到 `active`，而是进入 `staging` 重新观察。即使是对已有知识的修改，也要经过一个 grace period——这是 SOUL 原则中"永不覆盖"精神的体现。
- **`staging → pending`**：暂存期的知识可以打回待审核。这发生在用户通过 Dashboard 发现某条自动晋升的候选存在问题时。

![六态生命周期状态机](/images/ch07/01-six-state-lifecycle.png)

### 进化而非直接修改

知识库最危险的操作不是"删除一条知识"——而是"悄悄修改一条知识的内容"。

假设 Agent 在一次代码分析中"发现"某条 Recipe 的 `coreCode` 需要更新。如果系统允许 Agent 直接修改，会产生两个风险：

1. **AI 幻觉风险**：Agent 可能产生错误的判断，用一段有问题的代码替换了正确的代码。由于修改是原地发生的，旧内容不可恢复。
2. **静默漂移**：知识的内容在没有任何人知道的情况下发生了变化。下次 Guard 根据修改后的规则检查代码时，开发者完全不知道规则已经变了。

Alembic 的安全设计是：**Agent 永远不能直接修改已有知识，只能提出进化提案（Evolution Proposal）**。

进化提案是一种"附加"机制——它不修改原有知识的任何字段，而是创建一条独立的提案记录，关联到目标 Recipe。提案只有两种类型：

| 类型 | 语义 | 典型来源 |
|:---|:---|:---|
| `update` | 更新现有知识（增强内容、修正代码片段、扩展适用场景） | Agent 工具、增量扫描、文件变更 |
| `deprecate` | 标记为过时（来自衰退检测、证据链断裂） | 衰退检测器、关联性审计、Agent 判断 |

这个极简的类型设计是有意为之。早期版本有六种类型（`enhance`、`merge`、`correction`、`supersede`、`deprecate`、`contradiction`），但实践中发现：所有"对内容的改进"本质上都是 `update`，而 `merge` 和 `contradiction` 处理已经下沉到提交时的融合分析层（ConsolidationAdvisor）和 Agent 语义判断。两种类型 + 纯函数策略层（`EvolutionPolicy`）足以覆盖所有进化场景。

风险不再由提案类型硬编码，而是由 `EvolutionPolicy.assessRisk()` 动态评估：

```typescript
// lib/domain/evolution/EvolutionPolicy.ts
static assessRisk(action: EvolutionAction, confidence: number, source: ProposalSource): RiskTier {
  if (action === 'deprecate') { return 'high'; }
  if (action === 'update' && confidence >= 0.8) { return 'low'; }
  return 'medium';
}
```

风险等级决定了观察窗口的长度：

| 风险等级 | 观察窗口 | 典型场景 |
|:---|:---|:---|
| `low` | 24 小时 | 高置信度更新（confidence ≥ 0.8） |
| `medium` | 72 小时 | 中等置信度更新 |
| `high` | 7 天 | 所有废弃提案 |

`deprecate` 一律 7 天，因为一条知识可能只在每周一次的发版流程中被使用——7 天覆盖一个完整的开发周期。高置信度的 `update`（如 Agent 在读完代码后提出的精确修正）只需 24 小时观察有没有新增误报。

为什么不让 Agent 直接修改知识？根本原因是 SOUL 原则中的两条硬约束：**永不删除**（所有变更都是新增操作，旧版本保留在审计日志中）和**无 AI 不伪装**（AI 的判断必须标记为 AI 产出，不能假装是人工确认的）。进化提案机制天然满足这两条约束：旧内容不变、提案来源明确（`source: 'ide-agent' | 'relevance-audit' | 'decay-scan' | 'file-change'`）。

![进化提案机制](/images/ch07/02-evolution-proposal-flow.png)

## 架构与数据流

### 状态转换触发条件

六态状态机的每一次转换都有明确的触发条件和前置检查。`LifecycleStateMachine` 是状态转换的唯一权威——所有状态变更都必须通过它，绕过它直接修改数据库中的 lifecycle 字段是被禁止的。

**pending → staging**

新创建的知识条目初始状态为 `pending`。当 `ConfidenceRouter` 判断其置信度满足阈值时，自动推进到 `staging`。路由规则：

| 置信度 | 路由结果 | 暂存期 |
|:---|:---|:---|
| ≥ 0.90 | `auto_approve` → staging | 24 小时 |
| 0.85 - 0.89 | `auto_approve` → staging | 72 小时 |
| < 0.85 | pending（等待人工审阅） | — |

暂存期由 `StagingManager` 管理——它在启动时扫描所有 `staging` 状态的条目，将超过暂存期限且无负面反馈的自动晋升为 `active`。

**staging → active**

两条路径：

- **路径 A（自动）**：`StagingManager.checkAndPromote()` 检测暂存期满且无负面反馈（无用户打回、无验证错误），自动晋升。
- **路径 B（手动）**：用户在 Dashboard 上审阅后主动批准。

**active → evolving**

当 `ProposalExecutor` 开始执行一条 `update` 类型的提案时，目标 Recipe 自动进入 `evolving` 状态。进入 `evolving` 不影响消费——Recipe 仍然以全权重参与搜索和 Guard，只是系统记录了一个 `evolvingStartedAt` 时间戳用于超时监控。

**evolving → staging / active**

提案被接受（`ContentPatcher` 应用了内容补丁）→ 进入 `staging` 重新观察。提案被拒绝或无内容变更 → 回到 `active`。如果 `evolving` 状态超过 7 天无结论，`LifecycleStateMachine.checkTimeouts()` 自动回退到 `active`——这是一个安全网，防止提案被遗忘导致知识长期卡在中间态。

```typescript
// lib/service/evolution/LifecycleStateMachine.ts
const TIMEOUT_MS = {
  evolving: 7 * 24 * 60 * 60 * 1000,   // 7 天
  decaying: 30 * 24 * 60 * 60 * 1000,  // 30 天
  staging:  7 * 24 * 60 * 60 * 1000,   // 7 天（安全兜底，正常由 StagingManager 处理）
  pending:  30 * 24 * 60 * 60 * 1000,  // 30 天
};

const TIMEOUT_TARGET = {
  evolving: 'active',     // 回退到 active（内容不变）
  decaying: 'deprecated', // 长期衰退 → 废弃
  pending:  'deprecated', // 30 天未审核 → 废弃
};
```

**active → decaying**

这是最关键的自动转换——它由 `DecayDetector` 的评分驱动。当 `DecayDetector` 评估一条 `active` 状态的 Recipe 分数低于 60 分时，通过 `EvolutionGateway.submit({ action: 'deprecate' })` 发起进化决策。`EvolutionGateway` 根据置信度决定是创建提案（信号驱动评估，无固定过期时间）还是直接执行（高置信度 ≥ 0.8 立即废弃）。

**decaying → active（自动恢复）**

如果处于 `decaying` 状态的 Recipe 重新被搜索命中或被 Guard 使用（`searchHit` 或 `guardHit` 信号），`ProposalExecutor` 在评估废弃提案时发现衰退分数回升（当前分数比提案创建时高出 10 分以上），自动拒绝提案——Recipe 恢复到 `active`。此外，§9.1 保护机制会在源文件被直接修改（`direct`/`pattern` 级影响）时直接拒绝废弃提案，无需等待分数回升。这些自动恢复机制是信号驱动设计的典型体现——不需要人工干预，使用行为和编辑行为本身就是最好的信号。

**decaying → deprecated**

30 天的衰退观察期内没有恢复信号，`LifecycleStateMachine.checkTimeouts()` 自动将其推进到 `deprecated`。特殊情况：如果 `DecayDetector` 给出 `dead` 级别（0-19 分），`EvolutionGateway` 跳过观察直接执行废弃。

每一次状态转换都会被记录为不可变的 `TransitionEvent`：

```typescript
interface TransitionEvent {
  recipeId: string;
  from: string;
  to: string;
  reason: string;
  triggeredBy: string;   // 'system' | 'user' | 'decay-scan' | 'proposal-executor'
  timestamp: number;
}
```

这些事件构成了一条知识的完整"传记"——你可以在 Dashboard 中回溯任何一条 Recipe 的生命历程：它何时被创建、何时进入观察、何时正式发布、是否经历过进化提案、是否衰退过又恢复。

### SourceRef 可信链

上一章提到，KnowledgeEntry 的 `reasoning.sources` 字段保存了知识的来源文件路径——它是知识的"证据链"。但文件路径是脆弱的：文件会被重命名、移动、删除。如果证据链断裂了，知识的可信度就应该下降。

`SourceRefReconciler` 负责维护这个可信链的健康状态。它管理一张独立的 `recipe_source_refs` 表，每条记录有三种状态：

| 状态 | 含义 |
|:---|:---|
| `active` | 文件存在，路径有效 |
| `renamed` | 文件被 git rename，新路径已检测到 |
| `stale` | 文件不存在，无法自动修复 |

核心流程分三个阶段：

**阶段 1：reconcile() — 存在性验证**

遍历所有 Recipe 的 `reasoning.sources`，检查文件是否仍然存在于项目目录中。验证结果有 24 小时 TTL 缓存——同一天内不会重复检查同一个路径。如果发现 stale 引用，发射 `quality` 信号，信号权值与 stale 比例成正比。

**阶段 2：repairRenames() — git rename 追踪**

对于标记为 `stale` 的引用，尝试通过 `git log --diff-filter=R` 追踪文件的重命名历史。如果发现旧路径被 rename 到了新路径，将引用状态更新为 `renamed` 并记录 `new_path`。这个步骤使用 `execFile()` 的数组参数形式执行 git 命令，而非模板字符串拼接——防止路径中的特殊字符被用于命令注入。

**阶段 3：applyRepairs() — 写回修复**

将 `renamed` 状态的引用自动修复回 Recipe 的 `.md` 文件中。定位 `reasoning.sources` 部分，将旧路径替换为新路径，然后将引用状态更新为 `active`。

这三个阶段不是在一次调用中串行执行的。`reconcile()` 可能在每次 Guard 运行后触发，`repairRenames()` 在每次项目扫描时运行，`applyRepairs()` 需要在用户确认后执行。它们通过信号机制松散耦合。

SourceRef 的健康度直接影响衰退评分。`DecayDetector` 在计算 `authority` 维度时会查询 stale ratio：

```text
authority = baseAuthority × (1 - staleRatio × 0.3)
```

当所有 SourceRef 都失活时（`staleRatio = 1.0`），authority 维度被乘以 0.7 的惩罚因子。这个惩罚不会让一条高质量的知识立刻衰退，但会在边界情况下把它推入 `decaying` 状态——给用户一个机会去审视它是否还有价值。

## 核心实现

### RecipeProductionGateway — 统一生产管线

所有 Recipe 创建——不论来自 Agent Tool、MCP 外部调用、IDE Agent 还是批量导入——都通过 `RecipeProductionGateway` 的统一管线。它保证无论入口在哪，前置校验的顺序和严格度完全一致。

管线分为 7 个步骤，每个步骤有独立的中止和回退逻辑：

```yaml
Step 1: Schema Validation (UnifiedValidator)
    ↓ 不通过 → rejected[]
Step 2: Similarity Check (可选跳过)
    ↓ 相似度 ≥ 0.7 → duplicates[]
Step 3: Consolidation Scan (可选跳过)
    ↓ 建议 merge/reorganize → merged[] / blocked[]
Step 4: KnowledgeService.create()
    ↓ ConfidenceRouter → staging 或 pending
Step 5: Quality Scoring (best effort)
    ↓ 不阻塞创建流程
Step 6: Supersede Proposal (如果指定被替代的旧 Recipe)
Step 7: Audit 日志
```

```typescript
// lib/service/knowledge/RecipeProductionGateway.ts
type GatewaySource = 'agent-tool' | 'mcp-external' | 'ide-agent' | 'batch-import';

interface CreateRecipeResult {
  created: CreatedRecipeInfo[];    // ✅ 成功创建
  rejected: RejectedRecipeInfo[];  // ❌ 校验不通过
  merged: MergedRecipeInfo[];      // ⚠️ ConsolidationAdvisor 建议合并，已建提案
  blocked: BlockedRecipeInfo[];    // 🚫 被融合建议阻止
  duplicates: SimilarRecipeInfo[]; // 📍 相似度过高
  supersedeProposal: { proposalId: string } | null;
}
```

**Step 1 — Schema Validation**

`UnifiedValidator` 检查必填字段（title、trigger、description 等）的合法性，同时在批量提交中追踪已提交的标题和指纹集合（`existingTitles` / `existingFingerprints`），防止批量内重复。

**Step 2 — Similarity Check**

这是可插拔的快速去重层。只有调用方注入 `findSimilarRecipes()` 且没有设置 `skipSimilarityCheck` 时才执行：召回阈值固定用 `0.5`，判重阈值默认 `0.7`。命中的候选会进入 `duplicates[]`，并从后续创建列表中移除；这不是提示性 warning，而是阻断创建。

当前各入口的配置不同：

- 外部 MCP `alembic_submit_knowledge` 会设置 `skipSimilarityCheck: true`，主要依赖后续 `ConsolidationAdvisor` 做提交前融合。
- 内部 V2 `knowledge.submit` 当前设置 `skipSimilarityCheck: true` 且 `skipConsolidation: true`，但仍走 `RecipeProductionGateway` 的 schema validation、create 和 quality scoring。
- `RecipeProductionGateway` 本身保留了相似度层，供 batch/import 或未来开启该层的入口复用。

**Step 3 — Consolidation Scan**

`ConsolidationAdvisor.analyzeBatch()` 是外部 MCP 提交路径的关键防碎片化层。它先逐条分析候选与现有 Recipe 的关系，再检查同一批候选之间的内部重叠：批内相似度 `>= 0.65` 时，后面的候选会被当作较弱项移除并记入 `duplicates[]`。

对候选与既有 Recipe 的关系，Advisor 会给出 `create / merge / reorganize / insufficient` 四类建议。`merge` 会通过 `EvolutionGateway.submit({ action: 'update', source: 'consolidation' })` 为目标 Recipe 创建更新提案；`reorganize` 会对多个目标 Recipe 分别创建低置信度 update 提案；`insufficient` 如果能找到覆盖它的 Recipe，会转成“补充到已有 Recipe”的 update 提案，否则进入 `blocked[]`。Advisor 异常时才会降级为直接提交。

**Step 4 — Create**

通过 `KnowledgeService.create()` 写入数据库，`ConfidenceRouter` 根据置信度决定进入 `staging` 还是 `pending`。

**Step 5 — Quality Scoring**

创建后立即调用 `updateQuality()` 执行 5 维度质量评分。这是 best effort——评分失败不回滚创建。

**Step 6 — Supersede Proposal**

如果调用方指定了 `options.supersedes`（被替代的旧 Recipe ID），在新 Recipe 创建成功后自动创建 `deprecate` 类型的进化提案，关联新旧 Recipe。

这个设计的核心价值是**对象模型统一，但入口策略可分层**：内部 Agent 通过 V2 `knowledge.submit`，外部 IDE Agent 通过 MCP `alembic_submit_knowledge`，最终都进入 `RecipeProductionGateway`，但是否开启 similarity / consolidation 由入口显式决定。书里讨论“提交时融合”时，必须区分外部 MCP 的强融合路径和内部 v2 tool 的轻提交路径。

### LifecycleStateMachine — 唯一权威

`LifecycleStateMachine` 是所有状态转换的守门人。它不只是检查 `VALID_TRANSITIONS` 表——在每次转换的进入和退出时执行副作用：

```typescript
// lib/service/evolution/LifecycleStateMachine.ts（简化）
async transition(request: TransitionRequest): Promise<TransitionResult> {
  const { recipeId, targetState, trigger, evidence, proposalId } = request;

  // 1. 读取当前 lifecycle
  const entry = await this.#knowledgeRepo.findById(recipeId);
  const from = entry.lifecycle;

  // 2. 守卫检查：合法性（唯一权威）
  if (!isValidTransition(from, targetState)) {
    return { success: false, error: `Invalid transition: ${from} → ${targetState}` };
  }

  // 3. Exit Action — 离开旧状态
  this.#recordExitTimestamp(recipeId, from);

  // 4. Entry Action — 进入新状态
  this.#recordEntryTimestamp(recipeId, targetState);

  // 5. 持久化 lifecycle 字段
  await this.#knowledgeRepo.updateLifecycle(recipeId, targetState);

  // 6. 记录不可变 TransitionEvent（审计日志）
  await this.#eventRepo.insert({ recipeId, from, to: targetState, trigger, timestamp: Date.now() });

  // 7. 发射 lifecycle Signal（仅此处发射）
  this.#signalBus?.send('lifecycle', 'LifecycleStateMachine', 1.0, { target: recipeId });

  return { success: true, fromState: from, toState: targetState };
}
```

Entry/Exit Action 记录的时间戳被后续模块消费：例如 `stagingEnteredAt` 用于 StagingManager 计算暂存期是否满，`evolvingStartedAt` 用于检测进化提案是否超时。

`checkTimeouts()` 是状态机的另一个核心方法。它扫描所有处于中间态（`evolving`、`decaying`、`pending`、`staging`）的 Recipe，检查是否超过预设时间：

```typescript
async checkTimeouts(): Promise<TimeoutCheckResult> {
  const now = Date.now();
  const results = [];

  for (const [state, timeoutMs] of Object.entries(TIMEOUT_MS)) {
    const stuck = await this.#knowledgeRepo.findByLifecycleOlderThan(state, now - timeoutMs);
    for (const recipe of stuck) {
      const target = TIMEOUT_TARGET[state];
      await this.transition({
        recipeId: recipe.id,
        targetState: target,
        trigger: 'timeout-recovery',
      });
      results.push({ recipeId: recipe.id, from: state, to: target });
    }
  }

  return { transitioned: results };
}
```

此外还有一组 `STUCK_THRESHOLD_MS`（evolving 3 天、decaying 15 天、staging 3 天、pending 7 天）用于更早地发出"卡住"告警，提醒 Dashboard 展示黄色警告而非等到超时自动执行。

### DecayDetector：四维衰退评分

![DecayDetector 四维衰退评分](/images/ch07/03-decay-scoring-model.png)

`DecayDetector` 是衰退信号的核心引擎。它不是简单地检查"最后使用时间是否超过 N 天"——而是用四个维度综合评估一条知识的健康度：

```yaml
decayScore = freshness × 0.3 + usage × 0.3 + quality × 0.2 + authority × 0.2
```

**freshness（新鲜度 · 0.3 权重）**

基于最后一次被使用的时间距今。365 天无使用得 0 分，当天使用过得满分，中间线性插值（`1 - daysSinceHit / 365`）。这里的"使用"包括两种信号：`guardHit`（Guard 检查时命中该 Recipe 的规则）和 `searchHit`（搜索结果中返回了该 Recipe）。

**usage（使用率 · 0.3 权重）**

统计最近 90 天的命中次数（`hitsLast90d`），归一化为 0-1 分数：`min(1, hitsLast90d / 50)`——即 50 次以上命中得满分，0 次得 0 分。注意这里只看近期窗口而非全生命期累计：如果一条知识在最近 90 天完全没有被使用，usage 维度得分为零。这是一个刻意的设计选择——衰退检测关注的是"现在还有没有价值"，而非"历史上曾经有过多少价值"。

**quality（质量 · 0.2 权重）**

来自 QualityScorer v2 的综合评分。v2 采用五维度加权模型：结构完整性（completeness, 0.25）、内容深度（contentDepth, 0.30）、交付就绪度（deliveryReady, 0.20）、可操作性（actionability, 0.15）、溯源可信度（provenance, 0.10）。低质量的知识更容易被判定为衰退——这是一个有意义的设计选择：如果一条知识本身质量就不高，又长期无人使用，它几乎可以确定是过时的。

**authority（权威性 · 0.2 权重）**

基于 SourceRef 健康度。当引用文件大量失活时，authority 下降，推动衰退评分恶化。这是 SourceRefReconciler 和 DecayDetector 的连接点。

评分结果映射为五个级别：

| 分数 | 级别 | 系统行为 |
|:---|:---|:---|
| 80-100 | `healthy` | 无动作 |
| 60-79 | `watch` | Dashboard 显示黄色警告 |
| 40-59 | `decaying` | 触发 `active → decaying` 转换 |
| 20-39 | `severe` | 缩短 Grace Period 至 15 天 |
| 0-19 | `dead` | 跳过确认，直接 `deprecated` |

除了综合评分，`DecayDetector` 还检测六种具体的衰退策略：

```typescript
// 六种衰退策略（任一命中即产生衰退信号）
type DecayStrategy =
  | 'no_recent_usage'     // 90+ 天无使用
  | 'high_false_positive' // 误报率 >40%（至少 10 次触发）
  | 'symbol_drift'        // ReverseGuard 检测到 API 符号已删除
  | 'source_ref_stale'    // SourceRef 引用路径失活
  | 'superseded'          // 存在 deprecated_by 关系指向更新版本
  | 'contradiction';      // Agent 在 evolve 流程中做语义判断
```

`symbol_drift` 策略值得特别说明。当 ReverseGuard 执行反向验证时，它会检查 Recipe 的 `coreCode` 中引用的 API 符号是否仍然存在于项目代码中。如果 `coreCode` 中调用了 `NetworkManager.shared.request()`，但项目中 `NetworkManager` 类已经被彻底删除，`symbol_drift` 会被触发。这比简单的"无人使用"更精准——它直接检测知识内容的语义有效性。

`contradiction` 策略不再由专门的检测器自动运行——它在增量扫描的 evolve 阶段由 Agent 读取代码并做语义判断。这个设计选择体现了核心原则：矛盾检测需要深层语义理解，而这恰恰是 Agent 擅长但确定性代码逻辑做不好的事情。

### FileChangeHandler：文件变更驱动的实时进化

代码在持续变化，如果知识库不能感知这些变化，就会从资产变成负债。实时进化链路并不是让 VSCode Extension 直接调用知识服务，而是分成四层：

```text
VSCode FileChangeCollector
  → EventBuffer 合并/限流
  → POST /api/v1/file-changes
  → FileChangeDispatcher
  → FileChangeHandler
```

HTTP 路由只做领域无关的 schema 校验：事件类型必须是 `created | modified | renamed | deleted`，路径必须是字符串，`eventSource` 只能是 `ide-edit | git-head | git-worktree`。非法事件被过滤，整个批次没有有效事件时返回空 report。真正的知识判断都在 `FileChangeHandler`。

`FileChangeHandler` 处理四种文件变更事件，每种事件对应不同的确定性策略：

| 事件类型 | 处理策略 | 是否涉及 Agent |
|:---|:---|:---|
| `renamed` | 查 `recipe_source_refs`，自动替换旧路径为新路径，并重写 Recipe 文本字段和 `.md` 文件 | 否 — 纯代码逻辑 |
| `deleted` | 将该 sourceRef 标记为 `stale`；若 Recipe 没有其他 active ref，则 `Gateway.submit(deprecate, conf=0.9)` | 否 — 纯代码逻辑 |
| `modified` | 只处理 active Recipe；用 `git diff HEAD -U0 -- <path>` 做 diff-based 影响评估；`pattern` 级创建 update 提案，`reference` 级只发 signal | 否 — 纯代码分析 |
| `created` | 计入 skipped；新文件的知识空位留给 rescan / bootstrap 流程处理 | — |

其中 `renamed` 和 `deleted` 是确信路径——系统有足够信息做自动修复或自动弃用。`modified` 是最复杂的事件类型：它只说明“某个源码文件变了”，还需要判断这次 diff 是否真的动到了 Recipe 所描述的 API 或模式。

**rename：自动修复可信路径**

VSCode 内部重命名文件时，Extension 上报 `{ type: 'renamed', oldPath, path: newPath, eventSource: 'ide-edit' }`。后端先用旧路径查询 `recipe_source_refs`：

```typescript
const affected = sourceRefRepo.findBySourcePath(oldPath);
```

没有关联 Recipe 就跳过。有命中时，每条 Recipe 走三步修复：

1. `ContentPatcher.applyProposal()` 生成一次 `sourceRefs` 的 `replace-item` 修复，把旧路径替换成新路径
2. `recipeSourceRefRepository.replaceSourcePath(recipeId, oldPath, newPath, now)` 更新桥接表，状态恢复为 `active`
3. `rewriteRecipePaths()` 同步重写 `reasoning.sources`、`content.markdown`、`coreCode` 和磁盘上的 Recipe `.md` 文件

如果 patch 或重写失败，系统不会贸然弃用 Recipe，只会把旧 sourceRef upsert 为 `stale`，等待后续 reconcile/rescan 兜底。这体现了 rename 路径的判断原则：路径变化可以自动修，修不了也只是证据链变弱，不等价于知识失效。

**delete：区分“单源死亡”和“多源残缺”**

删除路径先被写入 `recipe_source_refs(status='stale')`。然后系统查询同一 Recipe 的所有 sourceRef，排除当前删除路径后，只保留仍然 `active` 的引用：

```typescript
const allRefs = sourceRefRepo.findByRecipeId(recipeId);
const activeRefs = allRefs.filter(
  r => r.sourcePath !== deletedPath && r.status === 'active'
);
```

如果 `activeRefs.length > 0`，说明这条 Recipe 还有其他代码证据，只记录 `skip` 明细并增加 skipped 计数；它会在后续质量评估中因为 stale ratio 上升而降权，但不会立即退役。

如果 `activeRefs.length === 0`，说明这条 Recipe 的来源证据全部断裂，`FileChangeHandler` 提交高置信 deprecate 决策：

```typescript
await gateway.submit({
  recipeId,
  action: 'deprecate',
  source: 'file-change',
  confidence: 0.9,
  evidence: [{ deletedPath, remainingActiveRefs: 0 }],
});
```

`EvolutionPolicy.shouldImmediateExecute()` 对 `deprecate + confidence >= 0.8 + source !== 'metabolism'` 返回 true，因此这类文件删除通常会直接进入 `LifecycleStateMachine.transition(→ deprecated)`。如果状态机或 Guard 拒绝，`EvolutionGateway` 会降级创建 Proposal，让人类或后续信号继续判断。

**v3 Diff-Based 影响分析**

当文件被修改时，`FileChangeHandler` 先通过 `SourceRefRepository.findBySourcePath(path)` 找到所有引用该文件的 Recipe，再过滤掉非 `active` 的条目。只有 active Recipe 才进入 **diff-based 内容影响评估**——分析「这次改了什么」（diff），而非「文件整体和 Recipe 有多像」。

核心流程分四步：

```typescript
// lib/service/evolution/ContentImpactAnalyzer.ts
export function assessFileImpact(
  projectRoot: string,
  relativePath: string,
  recipeTokens: RecipeTokens
): DiffImpactResult | null {
  // 1. git diff HEAD -U0 -- <file> 获取 staged + unstaged 行级变更
  const diffText = getFileDiff(projectRoot, relativePath);
  if (!diffText) { return null; }  // 无 git / untracked / 无变更 → 跳过

  // 2. 解析 diff hunks
  const hunks = parseDiffHunks(diffText);

  // 3. 从变更行提取代码标识符（diff tokens）
  const diffTokens = tokenizeDiffLines(hunks);

  // 4. 与 Recipe tokens 做加权交集
  return assessDiffImpact(diffTokens, recipeTokens);
}
```

Recipe tokens 由 `shared/recipe-tokens.ts` 从全字段提取——`coreCode`、`content.markdown` 中的代码块、`content.pattern`、`content.steps[].code`，覆盖知识实体的全部代码语义：

```typescript
// lib/shared/recipe-tokens.ts
export function extractRecipeTokens(entry: {
  coreCode?: string;
  content?: { markdown?: string; pattern?: string; steps?: Array<{ code?: string }> };
}): RecipeTokens { ... }
```

影响评分公式：`score = |T_R ∩ T_Δ| / |T_R|`，其中 `T_R` 是 Recipe 特征标识符集合，`T_Δ` 是 diff 变更行标识符集合。分级：

- `score ≥ 0.3` → `pattern`（diff 动到了 30%+ 的 Recipe 关键标识符）
- `score < 0.3` → `reference`（diff 影响较弱；即使 score=0，也因为存在 sourceRef 关联而保留低权重信号）
- 无法获取 diff → 跳过（不做降级）

实时 `modified` 分析当前只会返回 `pattern` 或 `reference`，这两类会发射 `source_modified` signal。`direct` 来自删除路径：文件被删除且 Recipe 没有其他 active sourceRef 时，report 中标记为 `impactLevel='direct'`，并走 deprecate 链路。三类影响在策略层的权重如下：

| impactLevel | 权重/强度 | 含义 |
|:---|:---|:---|
| `direct` | 0.8 | 文件删除且无其他 active sourceRef → 最高权重 |
| `pattern` | 0.6 | diff 动到了 30%+ 的 Recipe 关键标识符 → 高权重 |
| `reference` | 0.3 | diff 未达到 pattern 阈值，但文件仍是 Recipe 的来源引用 → 低权重 |

`pattern` 级别除了发射 signal，还会通过 `EvolutionGateway` 持久化为 update 提案——确保即使弹窗被用户忽略，后续增量扫描仍然能处理：

```typescript
// FileChangeHandler.ts — pattern 级别持久化
await this.#gateway.submit({
  recipeId: ref.recipeId,
  action: 'update',
  source: 'file-change',
  confidence: Math.min(0.5 + score, 0.9),
  description: reason,
  evidence: [{ modifiedPath, score, matchedTokens, detectedAt: Date.now() }],
});
```

对 `modified` 事件，只要 diff 能成功评估，`pattern` 和 `reference` 都会发射 `source_modified` quality signal（`ProposalExecutor` 消费）：

![v3 Diff-Based 文件变更影响分析](/images/ch07/04-diff-based-impact-analysis.png)

```typescript
signalBus.send('quality', 'FileChangeHandler', IMPACT_WEIGHTS[impactLevel], {
  target: recipeId,
  metadata: {
    reason: 'source_modified',
    modifiedPath,
    impactLevel,  // 当前 modified 路径为 'pattern' | 'reference'
  }
})
```

这些 signal 的主要消费方是 `ProposalExecutor`：在评估 observing Proposal 时，高影响 `source_modified` signal 会阻止 deprecate 提案执行。增量 rescan 当前不直接读取这条 SignalBus 事件，而是从 ProjectIntelligence 的 diff、SourceRef 桥接表和 lifecycle 重新计算受影响 Recipe。VSCode 弹窗也不订阅 SignalBus，它消费的是 `/file-changes` HTTP 响应里的 `ReactiveEvolutionReport`。

**VSCode 弹窗进化建议**

当文件变化导致 report 中出现 `impactLevel='direct'` 或 `impactLevel='pattern'`，并且这批事件来自 `ide-edit` 时，HTTP 响应将影响摘要返回给 VSCode 扩展，扩展展示三按钮弹窗：

```
┌───────────────────────────────────────────────────────────┐
│  ⚡ Alembic: 检测到 PaginationController 等受近期编辑     │
│     影响，建议进化评估。                                   │
│                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Review  │  │  Auto Check   │  │ Don't Show Again │   │
│  └──────────┘  └──────────────┘  └──────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

弹窗的防骚扰设计有六层过滤：

1. **G0 全局开关**：`alembic.enableReactivePopup` 设置 + session 级静默（点击 "Don't Show Again" 后本次 session 不再弹窗）
2. **C1 来源过滤**：仅 `ide-edit` 来源允许弹窗（git 批量操作不弹）
3. **C2 影响级别**：`direct`（文件删除）或 `pattern`（30%+ Recipe token 被 diff 修改）才弹窗，`reference` 只发 signal
4. **G1 全局冷却**：任意两次弹窗之间至少 2 分钟
5. **C3 递增退避**：每个 Recipe 独立退避——首次忽略后需等 1 天才可再弹，第 2 次需等 2 天……第 N 次需等 min(N, 7) 天
6. **折叠合并**：多条影响折叠为一条弹窗，最多预览 3 条标题

按钮行为：
- **Review** → 打开 IDE Chat，预填包含受影响 Recipe 的 evolve prompt；重置该 Recipe 的退避计数
- **Auto Check** → 开启终端执行 `asd evolve-check --recipes <ids>`；重置退避计数
- **Don't Show Again** → session 级静默，提示用户如需永久关闭可在设置中禁用 `alembic.enableReactivePopup`
- **关闭/忽略** → 该 Recipe 退避计数 +1，未处理的 Recipe 由增量扫描统一处理

**未处理弹窗如何进入增量扫描**

弹窗关闭并不会向后端提交“用户拒绝”决策。VSCode 扩展只在本地增加 `dismissCount`，用于后续退避；真正的系统证据在弹窗出现前已经由后端落地：

1. `FileChangeHandler` 对 `pattern` 级 modified 事件已经调用 `EvolutionGateway.submit({ action: 'update', source: 'file-change' })`，创建或升级 update Proposal。
2. 同一事件还会发射 `quality` signal，metadata 中带 `reason: 'source_modified'`、`modifiedPath`、`impactLevel`。
3. 如果用户没有处理，下一次 internal rescan 会从 `RecipeImpactPlanner.plan(_incrementalPlan?.diff)` 重新计算候选：deleted 文件变成 `source-deleted / source-deleted-partial`，modified 文件只有达到 `pattern` 级才进入 `source-modified-pattern`，stale SourceRef 则进入 `source-missing`。
4. `auditRecipesForRescan()` 优先使用这些 diff 候选，其次才看 SourceRef 健康度和 lifecycle 兜底；因此弹窗不是唯一入口，未处理事项会回到统一的 rescan 审计和 Evolution Agent 验证链路。

这条兜底链路解释了为什么弹窗可以“轻”：它只是把实时建议呈现给人，系统内部已经保留了足够的证据，后续 rescan 仍能以批处理方式继续推进。

### RecipeSimilarity：统一相似度算法

知识库需要在多个场景下比较两条 Recipe 的相似度——融合分析判断是否需要合并、冗余检测识别重复、批内互重叠阻止。为了避免不同模块各自实现导致同一对 Recipe 得到不同分数，`RecipeSimilarity` 提供统一的 5 维加权相似度：

```typescript
// lib/domain/evolution/RecipeSimilarity.ts
export const WEIGHTS = {
  title: 0.15,
  clause: 0.25,
  code: 0.15,
  content: 0.30,
  guard: 0.15,
} as const;

class RecipeSimilarity {
  static compute(a: RecipeLike, b: RecipeLike): number {
    const dims = computeDimensions(a, b);
    return (
      0.15 * dims.title +    // 标题关键词 Jaccard
      0.25 * dims.clause +   // do/dontClause 关键词 Jaccard
      0.15 * dims.code +     // coreCode 3-gram Jaccard
      0.30 * dims.content +  // coreCode + markdown code + pattern + steps 的标识符 token
      0.15 * dims.guard      // guardPattern 精确匹配
    );
  }
}
```

`ConsolidationAdvisor`、`RedundancyAnalyzer` 和 bootstrap session 级去重都复用这套语义。相似度阈值 `>= 0.65` 判定为高重叠，`0.40-0.65` 为中等重叠，需要进入字段级分析或 Agent 语义复核。

除了综合分数，`RecipeSimilarity.analyzeFields()` 还提供字段级分析（Layer 1.5），供融合决策使用：

- `triggerConflict` — trigger 是否语义冲突（同一命名空间下的不同 trigger）
- `doClauseSubset` — 候选的 doClause 是否是现有 Recipe 的子集
- `coreCodeOverlap` — 共享代码模式的比例
- `categoryMatch` — 是否在同一 category 下

### EvolutionGateway — 统一决策入口

`EvolutionGateway` 是所有进化决策的统一入口。无论来源是 Agent 工具、rescan evolution audit、FileChangeHandler 还是 DecayDetector，所有进化意图都通过 `submit()` 提交：

```typescript
// lib/service/evolution/EvolutionGateway.ts
type EvolutionAction = 'update' | 'deprecate' | 'valid';

interface EvolutionDecision {
  recipeId: string;
  action: EvolutionAction;
  confidence: number;         // 0-1
  source: ProposalSource;     // 'ide-agent' | 'decay-scan' | 'relevance-audit' | 'file-change' | ...
  description?: string;
  reason?: string;
  evidence?: Record<string, unknown>[];  // update 时附带 suggestedChanges 等信息
  replacedByRecipeId?: string;           // supersede 场景：被替代 Recipe 的 ID
}
```

`submit()` 的路由逻辑根据 action 类型分流：

```
EvolutionDecision 到达
  → 前置检查：Recipe 是否存在？不存在 → error
  → switch (action):
    'valid':
      更新 lastVerifiedAt 时间戳（无提案，不触发状态转换）
    
    'update':
      创建 update Proposal → EvolutionPolicy.resolveInitialStatus() 
        → confidence ≥ 0.7 → 直接 'observing'（自动开始信号驱动评估）
        → confidence < 0.7  → 'pending'（等待人工审阅）
      Dedup 拦截？→ #tryUpgradeExistingProposal()（见下文）
    
    'deprecate':
      EvolutionPolicy.shouldImmediateExecute(confidence ≥ 0.8)?
        → YES: 直接调用 LifecycleStateMachine.transition(→ deprecated)
               Guard 拒绝? → 降级为创建 Proposal
        → NO:  创建 deprecate Proposal（信号驱动评估，无固定过期时间）
```

`valid` action 是一个轻量操作——Agent 在增量扫描的 Phase A 中对健康的 Recipe 调用 `submit({ action: 'valid' })`，只刷新时间戳证明"我验证过了"，不创建任何提案。这是 Phase A 过滤效率的关键：80% 的健康 Recipe 走 `valid` 路径，只消耗一次时间戳写入。

高置信度废弃（`confidence ≥ 0.8`）的立即执行路径是一个重要的优化。当文件删除、外部 IDE Agent 或 rescan evolution audit 以高置信度确认某条 Recipe 已无代码依据时，没有必要先创建长期等待的提案——可以直接尝试废弃。但即使在这条快速路径上，废弃操作仍然必须通过 `LifecycleStateMachine` 的守卫检查；如果状态机拒绝这次转换，系统会自动降级为创建提案。

**Evidence 升级机制（Dedup 后追加证据）**

当 `ProposalRepository.create()` 因去重规则返回 `null` 时（已存在同类型 Proposal），Gateway 不会静默丢弃，而是尝试升级已有 Proposal 的 evidence：

```typescript
// EvolutionGateway.ts — #tryUpgradeExistingProposal()
// 典型场景：FileChangeHandler 先创建了仅含检测元数据的 update Proposal（无 suggestedChanges），
// 之后 Agent 增量扫描产出了带 suggestedChanges 的更丰富 evidence。
const newHasChanges = newEvidence.some(
  e => typeof e.suggestedChanges === 'string'
);
const existingHasChanges = match.evidence.some(
  e => typeof e.suggestedChanges === 'string'
);
if (newHasChanges && !existingHasChanges) {
  // 追加 Agent 的 evidence（保留原始检测记录）
  this.#proposalRepo.updateEvidence(match.id, [...match.evidence, ...newEvidence]);
  return { outcome: 'proposal-upgraded', proposalId: match.id };
}
```

这解决了一个实际问题：`FileChangeHandler` 在文件保存时立即创建 Proposal，但此时只有 diff 检测元数据（`score`、`matchedTokens`）；后续 Agent 增量扫描可能产出更丰富的证据（包含 `suggestedChanges` 内容补丁）。如果没有升级机制，Agent 的 `suggestedChanges` 会被去重规则丢弃，`ContentPatcher` 就无法执行实际的内容更新。

### ProposalExecutor — 信号驱动的提案评估

`ProposalExecutor` 是提案生命周期的执行引擎。它的核心设计是**信号驱动**——不再依赖定时轮询或到期时间，而是订阅 `SignalBus` 的信号，每当相关信号到达时对目标 Recipe 的待评估提案进行一次判定。

```typescript
// lib/service/evolution/ProposalExecutor.ts
const TRIGGER_SIGNAL_TYPES = new Set(['guard', 'search', 'decay', 'quality', 'usage', 'lifecycle']);

subscribeToSignals(signalBus: SignalBus): void {
  // 长期订阅，在 UiStartupTasks Stage 6 启动
  this.#unsubscribe = signalBus.subscribe(
    'guard|search|decay|quality|usage|lifecycle',  // regex pattern 过滤
    (signal: Signal) => {
      if (!signal.target) { return; }
      void this.#onSignal(signal);
    }
  );
}
```

当信号到达时的评估流程：

```
signal(type: 'guard' | 'search' | ..., target: recipeId)
  → 查找该 Recipe 的所有 'observing' 状态 Proposal
  → 收集 Recipe 当前度量（guardHits, searchHits, hitsLast30d, decayScore, ruleFPRate）
  → switch (proposal.type):
  
    'update':
      EvolutionPolicy.evaluateUpdate(metrics)
        → pass (FP率 < 0.4 且有使用记录)?
          ✓ LifecycleStateMachine: active → evolving
            ContentPatcher.applyProposal() → 应用内容补丁
            LifecycleStateMachine: evolving → staging（有补丁）或 active（无补丁）
            Proposal 标记 EXECUTED
          ✗ 静默等待下一个信号（不拒绝，不退避）
    
    'deprecate':
      §9.1 保护检查：signal.metadata.reason === 'source_modified'
        && (impactLevel === 'direct' || impactLevel === 'pattern')?
        → YES: Proposal 立即标记 REJECTED
          （源文件仍在被积极编辑/核心模式被修改 → Recipe 仍然相关）
        → NO: 继续正常评估
      EvolutionPolicy.evaluateDeprecate(currentDecay, snapshotDecay)
        → 'deprecated' (dead，score ≤ 19):  直接废弃
        → 'decaying' (severe，score ≤ 40):  active → decaying（15 天缩短 grace）
        → 'reject' (recovered，分数回升 > 10):  Proposal 标记 REJECTED
```

§9.1 保护机制是 `ProposalExecutor` 的关键增强：当 `FileChangeHandler` 发出的 `source_modified` signal 附带 `direct` 或 `pattern` 级影响时，说明该 Recipe 的源文件仍在被积极修改——此时废弃提案应该被拒绝，而非继续等待信号。这避免了"开发者正在重构代码 → 系统误判 Recipe 不再相关"的场景。

`EvolutionPolicy` 的评估函数是纯函数——不访问数据库，不产生副作用，只根据输入的度量做出判断：

```typescript
// lib/domain/evolution/EvolutionPolicy.ts
static evaluateUpdate(metrics: RecipeMetrics): UpdateVerdict {
  if (metrics.ruleFalsePositiveRate >= 0.4) {
    return { pass: false, reason: 'FP rate too high' };
  }
  if (metrics.guardHits === 0 && metrics.searchHits === 0) {
    return { pass: false, reason: 'No usage signals during observation' };
  }
  return { pass: true, reason: 'Metrics within acceptable range' };
}

static evaluateDeprecate(currentDecay: number, snapshotDecay: number): DeprecateVerdict {
  if (currentDecay > snapshotDecay + 10) {
    return { action: 'reject', reason: 'Decay score recovered' };
  }
  if (currentDecay <= 19) {
    return { action: 'deprecated', reason: 'Dead - no evidence remains' };
  }
  if (currentDecay <= 40) {
    return { action: 'decaying', reason: 'Severe decay, shortened grace' };
  }
  return { action: 'reject', reason: 'Decay slowed, not critical' };
}
```

`checkAndExecute()` 作为启动时的兜底机制——在 `UiStartupTasks` Stage 5 调用，清理过期 14 天的 `pending` 提案，并对所有 `observing` 提案做一次评估。主流程已由 `subscribeToSignals()` 接管，`checkAndExecute()` 只是防守性备份。

信号驱动设计相比时间驱动的优势：
- **响应更及时**：当 Guard 刚命中一条 Recipe，相关提案立即被评估，而非等到下次轮询
- **无空转消耗**：没有信号时不执行任何操作，不浪费 CPU
- **天然的信号聚合**：多个信号在短时间内到达，每个都触发独立评估，最终结果等价于"看到了所有信号"

## 增量扫描中的进化前置

增量扫描（rescan）是实时文件监听的批处理兜底。当用户没有处理 VSCode 弹窗，或者文件变化来自 Git / Working Tree 扫描而不会弹窗时，rescan 会重新构建项目结构，并把旧 Recipe 的真实性、SourceRef 健康度和维度 gap 放到同一张计划里处理。

### Internal Rescan：工程预筛 + Evolution Agent

内部路径的进化前置发生在维度填充之前：

```text
ProjectIntelligenceCapability.run()
  → RecipeImpactPlanner.plan(_incrementalPlan?.diff)
  → runEvolutionAudit(candidates, proposalSource='rescan-evolution')  // fire-and-forget
  → auditRecipesForRescan(candidatePlan)
  → buildKnowledgeRescanPlan(fileDiff?)
  → buildRescanPrescreen()
  → dispatchInternalDimensionExecution(existingRecipes, evolutionPrescreen)
```

`RecipeImpactPlanner` 使用的是 ProjectIntelligence 的 hash diff，而不是实时监听里的 `git diff HEAD`。它把变更文件映射成四类候选原因：

| 原因 | 触发条件 | 初始影响 |
|:---|:---|:---|
| `source-deleted` | 被删文件是某 Recipe 的最后 active SourceRef | `impactScore = 1.0` |
| `source-deleted-partial` | 被删文件仍有其他 active SourceRef 兜底 | `impactScore = 0.7` |
| `source-modified-pattern` | modified 文件的 diff 与 Recipe tokens 达到 pattern 级 | 使用 `assessImpactUnified()` 得分 |
| `source-missing` | SourceRef 桥接表已有 stale 记录 | `impactScore = 0.5` |

同一 Recipe 被多个文件影响时，planner 会按优先级合并：`source-deleted` 高于 partial，高于 modified-pattern，高于 missing；同时合并 affectedFiles 和 matchedTokens。这保证 Agent 看到的是“一个 Recipe 的综合影响证据”，而不是一堆碎片事件。

真正转交给内部 Agent 的是 `runEvolutionAudit()`。它启动 `evolution-audit` profile，把候选 Recipe、sourceRefs、impactEvidence 和项目概览交给 Evolution Agent。Agent 只能做三类事：`knowledge.manage(operation: "evolve")` 创建更新提案，`deprecate` 确认废弃，或 `skip_evolution` 说明仍有效/信息不足。这个调用是 fire-and-forget，不阻塞本次 rescan 的 HTTP 响应；后续提案会通过 `EvolutionGateway` 和 `ProposalExecutor` 继续走信号驱动评估。

### Coverage Classification：三层评分

`auditRecipesForRescan()` 当前不是一个独立的 `RelevanceAuditor` 类；实际实现是 `KnowledgeRescanPlanner` 中的覆盖分类函数。它按优先级使用三层数据：

1. **RecipeImpactPlanner 候选**：最精确。`source-deleted` 直接给 10 分，`source-deleted-partial` 给 30 分，`source-modified-pattern` 用 `60 - impactScore * 40` 计算，`source-missing` 给 50 分。
2. **SourceRef 桥接表健康度**：如果某 Recipe 的 SourceRef 全部 stale，给 15 分；部分 active 时按 active/total 比例落在 30-80 分之间。
3. **Lifecycle 兜底**：active/evolving 默认 90 分，staging 默认 70 分，decaying 默认 35 分；如果 sourceRefs 全部缺失则下调。

分数再交给 `EvolutionPolicy.classifyRelevance()`：

- `healthy`：`score >= 80`
- `watch`：`60 <= score < 80`
- `decay`：`40 <= score < 60`
- `severe`：`20 <= score < 40`
- `dead`：`score < 20`

`buildRescanPrescreen()` 用这个结果把 Recipe 分成两组：`healthy` 自动归入 autoResolved；`watch / decay / severe` 进入 needsVerification；`dead` 进入自动废弃计划。注意这里的“自动废弃计划”是 rescan evidence/prescreen 层的计划语义，真正状态变更仍要通过 Evolution Agent、`EvolutionGateway` 或生命周期执行链路完成，不能把它理解成 planner 直接改库。

### Phase B：带约束的 Gap-Fill

内部 rescan 会把 `existingRecipes` 和 `evolutionPrescreen` 传给维度填充。由于 prescreen 已完成，`bootstrapDimensionPipeline` 当前不会再为每个维度插入 `evolve → evolution_gate` stage，而是运行：

```text
analyze → quality_gate → produce → rejection_gate
```

“进化”已经被前面的 `runEvolutionAudit()` 接走；维度 pipeline 的职责变成补齐 gap。`BootstrapRescanState` 会把非 decaying 的旧 Recipe 写入去重集合，把 occupied triggers 注入 Producer prompt，并为每个维度计算 `gap = max(0, 5 - existingCount)`。Producer prompt 明确要求：

- 提交上限等于该维度的 gap。
- 禁止使用 `occupiedTriggers` 中已有 trigger。
- 已有知识标题不能重复。
- decaying Recipe 可以通过 `supersedes` 提交替代版本，但替代内容必须基于当前代码。

这就是“未处理弹窗统一交给增量扫描”的实际落点：实时监听负责捕获证据和提醒人，rescan 负责批量审计、把复杂判断交给 Agent，并把新增候选限制在明确的 gap 内。

## 候选提交与分层融合

当 Agent 产出新的候选 Recipe 并提交时，系统需要判断候选是否太碎、是否与现有知识库重叠、是否应该更新旧 Recipe 而不是新建。当前代码里要区分两类入口：

- **外部 IDE Agent / MCP**：`alembic_submit_knowledge` 走 `RecipeProductionGateway + ConsolidationAdvisor + EvolutionGateway`，是完整的提交前融合路径。
- **内部 V2 Agent tool**：`knowledge.submit` 目前调用同一个 Gateway，但显式跳过 similarity 和 consolidation，主要依赖 rescan prompt 的 `existingRecipes / occupiedTriggers / gap` 约束、Producer 的 rejection gate，以及后续提案/信号治理。

### Layer 0：字段与会话去重

所有入口都会先过 `UnifiedValidator`。它检查 title、trigger、description、content、reasoning 等结构字段，并在批量提交中记录已提交 title / fingerprint，阻止同批重复。冷启动和 rescan 的内部会话还可以注入 `BootstrapDedup`，用会话内缓存阻止跨维度重复提交。

### Layer 1：结构化快速过滤

这一层纯代码逻辑，无需 Agent 参与，但只有在调用方没有跳过 similarity check 且注入了 `findSimilarRecipes()` 时才运行：

1. `findSimilarRecipes(projectRoot, candidate, { threshold: 0.5, topK: 5 })` 召回相似 Recipe。
2. 任一相似项达到 `options.similarityThreshold ?? 0.7` 时，候选进入 `duplicates[]`。
3. 进入 `duplicates[]` 的候选不再进入 `submittableItems`，因此不会创建 Recipe。

外部 MCP 当前把这一层关掉，是因为它下一步会调用更强的 `ConsolidationAdvisor`。这不是“少做检查”，而是把判断集中到能处理 merge/reorganize/insufficient 的融合层。

### Layer 2：ConsolidationAdvisor

```typescript
// lib/service/evolution/ConsolidationAdvisor.ts
const MIN_SUBSTANCE_SCORE = 0.3;
const ENHANCE_THRESHOLD = 0.4;
const HIGH_OVERLAP_THRESHOLD = 0.65;

type ConsolidationAction =
  | 'create'
  | 'merge'
  | 'reorganize'
  | 'insufficient';
```

Advisor 的判断树是当前防碎片化的核心：

```text
候选实质性 score < 0.3
  → insufficient
  → 如果 coveredBy 存在: 创建 update 提案，建议补到已有 Recipe
  → 否则: blocked，交给 Agent/开发者补充信息或放弃

highOverlaps.length >= 2 (similarity >= 0.65)
  → reorganize
  → 对多个目标 Recipe 创建 update 提案，confidence = min(0.5, advice.confidence)

highOverlaps.length === 1
  → merge
  → 对目标 Recipe 创建 update 提案，候选本身不创建

0.40 <= similarity < 0.65
  → RecipeSimilarity.analyzeFields()
  → 如果没有 addedDimensions: merge
  → 如果字段分析不明确: create + pendingSemanticReview
  → 如果提供了明确新维度: create

无显著重叠
  → create
```

`analyzeBatch()` 还会检查批次内部的候选重叠。任意两条候选相似度 `>= 0.40` 会被记录为 `internalOverlaps`；Gateway 只在 `>= 0.65` 时移除后面的候选，把它加入 `duplicates[]`：

```typescript
// RecipeProductionGateway.ts — Step 3.1
if (overlap.similarity >= 0.65) {
  const weaker = overlap.indexB;
  removedByOverlap.add(weaker);
  result.duplicates.push({
    index: weakerEntry.index,
    title: weakerEntry.item.title || '(untitled)',
    similarTo: [{ title: strongerEntry.item.title, similarity: overlap.similarity }],
  });
}
```

### Layer 2.5：字段级分析与 pendingSemanticReview

当结构相似度在 0.40-0.65 的灰色地带时，系统进一步分析具体字段的重叠情况，而不是简单地用总分做二元判定：

- **triggerConflict** — trigger 是否在同一命名空间下冲突
- **doClauseSubset** — 候选的 doClause 是否是现有 Recipe 的子集（如果是，说明现有 Recipe 已覆盖）
- **coreCodeOverlap** — 共享代码模式的比例
- **categoryMatch** — 同 category 下的重叠更可能是真正的重复

字段级分析使得很多“总分模糊”的情况可以在不借助 Agent 的情况下做出判断。比如，两条 Recipe 总分 0.52，但 `doClauseSubset = true` 或 `coreCodeOverlap >= 0.6`，Advisor 可以直接选择 merge。

真正无法确定的情况，是候选提供了新维度，但字段信号又不够确定：

```typescript
const isFieldDefinitive =
  fields.triggerConflict || fields.doClauseSubset || fields.coreCodeOverlap >= 0.6;

if (!isFieldDefinitive) {
  return {
    action: 'create',
    confidence: 0.6,
    pendingSemanticReview: true,
    reason: '字段分析不明确，需要语义复核确认是否为独立知识',
  };
}
```

这种情况下 Gateway 会先允许候选创建，同时把条目加入 `pendingSemanticReview[]`。原因是工程逻辑已经无法可靠区分“独立知识”与“旧 Recipe 的补充维度”，而外部 IDE Agent 此刻拥有源码阅读上下文，适合做语义裁决。

```typescript
// alembic_submit_knowledge 响应（含尾部指令）
{
  data: {
    count: 1,
    ids: ['recipe-new'],
    pendingSemanticReview: [{
      index: 0,
      title: 'Candidate title',
      reason: '候选处于相似度模糊区间，字段分析不明确'
    }],
    nextAction: {
      tool: 'alembic_consolidate',
      args: {
        decisions: [{
          newRecipeId: '',
          action: 'keep',
          reasoning: '候选处于相似度模糊区间...'
        }]
      },
      required: false,
      reason: '建议阅读源代码后调用 alembic_consolidate 判断是否需要合并。'
    }
  }
}
```

`alembic_consolidate` 的处理逻辑很直接：`keep` 无操作；`merge` 先对 `mergeTargetId` 创建 update 提案，再对 `newRecipeId` 创建 deprecate 提案；`reject` 直接对 `newRecipeId` 创建 deprecate 提案。也就是说，MCP 的 `nextAction` 是一条“尾追溯”协议：服务端先记录可追踪的候选，再把无法确定的语义判断交回正在读代码的 Agent 完成。

内部 Agent 路径也有 `agent/domain/consolidation-gate.ts` 这组领域函数，定义了 `approve_create / merge_into_existing / reject_candidate` 三个工具和 Consolidation Gate prompt，用于在 Producer 之后进行语义融合判断。但从当前 `bootstrapDimensionPipeline` 的实装看，rescan 已经先做 `evolutionPrescreen`，维度填充阶段不会插入该 gate；内部路径主要靠 rescanContext 的 `existingRecipes / occupiedTriggers / gap` 约束避免重复，再由后续提案治理兜底。这个边界很重要：书里不能把尚未接入主 pipeline 的 gate 写成每次提交都会执行。

## 运行时行为

### 场景 1：新建候选的晋升之路

![新建候选的晋升之路](/images/ch07/06-scenario-promotion-path.png)

Agent 在项目冷启动时提取了一条关于 `CookieProviding` 的 Recipe，置信度 0.85。

1. **T+0**：Recipe 创建，状态 `pending`
2. **T+0（秒级）**：`ConfidenceRouter` 评估置信度 0.85，路由到 `auto_approve` → 进入 `staging`，暂存期 72 小时
3. **T+72h**：`StagingManager.checkAndPromote()` 检测到暂存期满且无负面反馈 → `staging → active`
4. **T+72h 后**：Recipe 以全权重参与搜索和 Guard 检查

### 场景 2：重构导致的自然衰退

![重构导致的自然衰退](/images/ch07/07-scenario-natural-decay.png)

团队决定弃用 `NetworkManager`，用原生 async/await 重写网络层。

1. **T+0**：`NetworkManager.swift` 被删除
2. **T+0**：`FileChangeHandler` 处理 `deleted` 事件，发现三条 Recipe 的所有 sourceRef 指向被删文件
3. **T+0**：对每条 Recipe 调用 `EvolutionGateway.submit({ action: 'deprecate', confidence: 0.9, source: 'file-change' })`
4. **T+0**：`EvolutionPolicy.shouldImmediateExecute(0.9)` → true，直接通过 `LifecycleStateMachine.transition(→ deprecated)` 执行
5. **T+N（下次扫描）**：`SourceRefReconciler.reconcile()` 补充发现其他间接引用了 `NetworkManager` 的 Recipe，标记为 `stale`
6. **T+N**：`auditRecipesForRescan()` 结合 SourceRef 健康度和 lifecycle 兜底分类，发现这些 Recipe 的 sourceRefs 严重缺失 → `decay` 或 `severe` 等级
7. **T+N**：Agent 验证确认 → `EvolutionGateway.submit({ action: 'deprecate' })` → 创建 Proposal（信号驱动评估）
8. **T+N+信号评估**：`ProposalExecutor` 在信号评估中确认 decay score 无回升 → `decaying → deprecated`

### 场景 3：Agent 驱动的知识更新

![Agent 驱动的知识更新](/images/ch07/08-scenario-agent-update.png)

Agent 在一次代码分析中发现某条 Recipe 的 `coreCode` 缺少了错误处理的示例。

1. **T+0**：Agent 通过 `alembic_evolve` MCP 工具调用 `EvolutionGateway.submit({ action: 'update', confidence: 0.8, evidence: [{ suggestedChanges: '...' }] })`
2. **T+0**：`EvolutionPolicy.resolveInitialStatus('update', 0.8)` → `'observing'`（≥ 0.7 自动进入观察）
3. **T+0**：Gateway 创建 signal-driven Proposal，`expiresAt` 写为 `0`；主路径不依赖固定观察时间到期
4. **T+后续信号**：Guard/search/usage/quality/lifecycle 任一相关 signal 到达 → `ProposalExecutor.#onSignal()` 触发评估
5. **T+后续信号**：`EvolutionPolicy.evaluateUpdate(metrics)` → FP 率正常、有使用记录 → pass
6. **T+后续信号**：`LifecycleStateMachine`: `active → evolving`，`ContentPatcher.applyProposal()` 消费 `suggestedChanges` 写入新的 coreCode，`evolving → staging`
7. **T+staging 到期**：`StagingManager` 暂存期满，无负面反馈 → `staging → active`

### 场景 4：提交时的重复拦截

![提交时的重复拦截](/images/ch07/09-scenario-duplicate-intercept.png)

外部 IDE Agent 在增量扫描中提取了一条新 Recipe。它与 Recipe A 中度相似，但又包含一些新维度，工程规则无法判断它应该独立存在还是合并回旧 Recipe。

1. **T+0**：候选通过 MCP `alembic_submit_knowledge` 提交
2. **T+0**：`ConsolidationAdvisor` 计算与 Recipe A 的相似度为 0.52，落入 `0.40-0.65` 模糊区间
3. **T+0**：`RecipeSimilarity.analyzeFields()` 发现 `triggerConflict=false`、`doClauseSubset=false`、`coreCodeOverlap=0.2`，字段信号不够确定
4. **T+0**：Advisor 返回 `action: 'create'` + `pendingSemanticReview: true`，Gateway 先创建候选并在响应中记录待复核项
5. **T+0**：MCP 响应中附带 `nextAction: { tool: 'alembic_consolidate' }`
6. **T+0**：外部 Agent 读取候选和 Recipe A 的代码上下文，调用 `alembic_consolidate` 决定 `keep / merge / reject`

### 场景 5：文件修改触发的实时进化审视

![文件修改触发的实时进化审视](/images/ch07/10-scenario-realtime-evolution.png)

开发者正在 VSCode 中重构 `PaginationController.swift`，改变了核心 API。

1. **T+0**：开发者保存文件，VSCode 扩展收集 `modified` 事件（`eventSource: 'ide-edit'`）
2. **T+3s**：事件缓冲区 flush，POST 到 `/api/v1/file-changes`
3. **T+3s**：HTTP 路由过滤事件 schema，`FileChangeDispatcher` 推断本批主要来源为 `ide-edit`，并分发给 `FileChangeHandler`
4. **T+3s**：`FileChangeHandler` 查找引用该文件的 active Recipe，发现两条：Recipe A 和 Recipe B
5. **T+3s**：`ContentImpactAnalyzer.assessFileImpact()` 对每条 Recipe 执行 diff-based 影响评估——获取 `git diff HEAD -U0 -- PaginationController.swift`，解析变更行 tokens，与 Recipe tokens（`coreCode` + `content.markdown` 代码块 + `content.pattern` + `steps[].code`）做加权交集。Recipe A 得分 0.45 → `impactLevel = pattern`；Recipe B 得分 0.08 → `impactLevel = reference`
6. **T+3s**：对 Recipe A 发射 `quality` signal（weight=0.6），对 Recipe B 发射 signal（weight=0.3）
7. **T+3s**：Recipe A 的 `pattern` 级影响触发 `EvolutionGateway.submit({ action: 'update', source: 'file-change' })`，持久化为 update 提案
8. **T+3s**：HTTP 响应返回影响摘要给 VSCode 扩展
9. **T+3s**：扩展检测到 `eventSource = 'ide-edit'` + `suggestReview = true` + 存在 `pattern` 级影响，再通过全局冷却和 per-Recipe 退避 → 展示弹窗："⚡ Alembic: 检测到 PaginationController 受近期编辑影响，建议进化评估。"
10. **T+选择**：开发者点击 "Review" → IDE Chat 打开，预填 prompt 包含受影响 Recipe 的标题和变更路径；退避计数重置
11. **T+下次 rescan**：如果用户没有处理弹窗，`RecipeImpactPlanner` 会从增量 diff + SourceRef 重新识别 Recipe A 的 `source-modified-pattern` 候选，`runEvolutionAudit()` 让内部 Agent 读新代码并提交 `evolve`。Gateway 发现已有 file-change Proposal 时会尝试 evidence 升级，追加带 `suggestedChanges` 的更丰富证据

这个场景展示了文件变更如何从 IDE 端事件一路触发到知识进化：HTTP report 负责实时弹窗，SignalBus 负责系统内部的提案评估，增量 rescan 负责把未处理或批量变化重新归并为可验证的 Evolution candidates。

## 全链路数据流

前面分散介绍了各个子系统。以下是完整的架构视角，展示从文件变更到知识进化的全链路：

![知识进化全链路数据流](/images/ch07/05-full-dataflow-pipeline.png)

整个流程分为四个层次：

- **触发层**：VSCode `FileChangeCollector` 将 IDE/Git/Working Tree 事件经 `EventBuffer` 合并后 POST 到 `/api/v1/file-changes`，再由 `FileChangeDispatcher` 分发给 `FileChangeHandler`
- **信号层**：`FileChangeHandler` 产出的 quality signal 被系统内部消费——Signal 沉淀、增量扫描前置、ProposalExecutor 信号评估；VSCode 弹窗消费的是 HTTP report，不直接订阅 SignalBus
- **决策层**：`RecipeImpactPlanner` 和 `auditRecipesForRescan()` 在 Phase A 中过滤候选 Recipe，`EvolutionGateway` 统一接收进化决策（含 evidence 升级），Phase B 新增候选经过 `RecipeProductionGateway` 与外部 MCP 融合层过滤
- **落地层**：最终产出三种结果——新 Recipe 通过 `ConfidenceRouter` 进入 staging/pending、merge/update 通过 `EvolutionGateway` 创建提案、灰色地带交由外部 Agent 通过 `alembic_consolidate` 决策

## 权衡与替代方案

### 为什么不用二态模型？

简单的 `active / archived` 二态模型面临三个无法回避的问题：

1. **缺少缓冲区**：新创建的知识直接进入 `active`，没有观察窗口让人或系统验证其质量。对于 AI 生成的知识，这是不可接受的风险。
2. **无法区分变化类型**：一条正在被修改的知识和一条正在衰退的知识，在二态模型下都是 `active`——但系统对它们应该有不同的处理策略。
3. **归档不可逆**：一旦标记为 `archived`，恢复成本很高，因为两个状态之间没有中间地带。六态模型中的 `decaying` 状态天然支持自动恢复。

### 为什么不让 Agent 直接修改？

最直接的方案确实是允许 Agent 在发现更好的模式时直接更新 Recipe 内容。但这引入了两个不对称风险：

- **修改正确的概率 << 幻觉错误的成本**：Agent 修改对了，知识库改善一点点；Agent 修改错了，可能导致后续所有基于此 Recipe 的代码检查和生成都出错。
- **静默漂移的可追溯性**：如果允许直接修改，要准确回答"这条知识为什么变成现在这样"需要完整的 diff 历史——而进化提案机制天然记录了每次变更的原因、来源和判据。

提案机制的代价是增加了中间步骤和延迟。一个 `update` 类型的改进需要至少 24 小时的观察期才能生效（低风险），废弃操作需要经历信号驱动的评估期（`decaying` 状态最长 30 天超时兜底）。在 Alembic 的设计判断中，**知识库的准确性比更新的及时性更重要**——一条过时但正确的知识，远好于一条新但错误的知识。

### staging 期的价值

有人可能质疑：既然已经有了 `pending`（待审核），为什么还需要 `staging`？它们的区别是什么？

`pending` 是"尚未被系统信任"——搜索不可见、Guard 不使用。`staging` 是"系统初步信任，但给用户一个观察窗口"——搜索可见（降权）、Guard 参与（降权），用户可以在 Dashboard 上看到这些"试用版"的知识条目。

这个设计的核心价值是**渐进式信任**。对于一个 AI 驱动的系统，让用户参与但不要求用户参与——高置信度的知识自动走完 `staging → active`，低置信度的停留在 `staging` 等待人工审阅。这比"全自动"或"全手动"都更符合实际的工作流。

## 小结

知识生命周期是 Alembic 中最能体现"信号驱动"设计哲学的子系统。六态状态机不是复杂性的来源，而是复杂性的管理工具——每个状态对应一种明确的知识状态语义，每次转换都有可追溯的触发条件和审计日志。

进化架构围绕三个核心组件展开：`EvolutionGateway` 作为统一入口接收所有进化决策，`ProposalExecutor` 通过信号驱动评估提案，`LifecycleStateMachine` 作为状态转换的唯一权威。所有评估判据集中在 `EvolutionPolicy` 纯函数中——不访问数据库、不产生副作用，使得进化决策可测试、可推理。

整个设计遵循一个核心原则：**确定性高的自动化，需要理解力的交给 Agent**。文件删除导致的废弃、暂存期满的自动晋升、证据分数低于阈值的衰退判定——这些是代码逻辑可以确定性处理的。矛盾检测、语义融合、灰色地带的知识评估——这些留给 Agent，因为它们需要真正的语义理解。

下一章将探讨质量评分体系——它是 ConfidenceRouter 和 DecayDetector 的数据来源，也是知识从候选到正式的关键判据。

::: tip 下一章
[质量评分与维度框架](./ch08-quality)
:::
