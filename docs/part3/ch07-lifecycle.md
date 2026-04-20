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

对每个候选调用 `findSimilarRecipes()`，阈值 0.5 召回候选、0.7 判定重复。重复项记入 `duplicates[]` 但不阻塞（信息性警告）。`batch-import` 来源可通过 `skipSimilarityCheck` 跳过此步骤。

**Step 3 — Consolidation Scan**

`ConsolidationAdvisor.analyze()` 对通过相似度检查的候选做融合分析——如果发现某个候选与已有 Recipe 高度重叠，建议 merge、reorganize 或 supersede。建议被转换为 Evolution Proposal 写入 `evolution_proposals` 表，候选本身不创建。ConsolidationAdvisor 失败时静默降级——直接进入 Step 4。

**Step 4 — Create**

通过 `KnowledgeService.create()` 写入数据库，`ConfidenceRouter` 根据置信度决定进入 `staging` 还是 `pending`。

**Step 5 — Quality Scoring**

创建后立即调用 `updateQuality()` 执行 5 维度质量评分。这是 best effort——评分失败不回滚创建。

**Step 6 — Supersede Proposal**

如果调用方指定了 `options.supersedes`（被替代的旧 Recipe ID），在新 Recipe 创建成功后自动创建 `deprecate` 类型的进化提案，关联新旧 Recipe。

这个设计的核心价值是**入口统一**——Agent 通过 `submit_knowledge` 工具调用和用户通过 MCP `asd_submit_knowledge` 走完全相同的校验管线。没有"捷径"可以绕过 Schema Validation 或 Similarity Check 直接创建 Recipe。

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

代码在持续变化，如果知识库不能感知这些变化，就会从资产变成负债。`FileChangeHandler` 是连接 IDE 文件事件和知识进化的桥梁——它处理四种文件变更事件，每种有不同的策略：

| 事件类型 | 处理策略 | 是否涉及 Agent |
|:---|:---|:---|
| `renamed` | ContentPatcher 自动修复路径，更新 sourceRefs/reasoning/markdown | 否 — 纯代码逻辑 |
| `deleted` | 全部 sourceRef 失效时 → Gateway.submit(deprecate, conf=0.9) | 否 — 纯代码逻辑 |
| `modified` | diff-based 影响评估 + quality signal + pattern 级持久化提案 | 否 — 纯代码分析 |
| `created` | 跳过（新文件不影响已有 Recipe） | — |

其中 `renamed` 和 `deleted` 是确信路径——系统有足够信息做出自动决策。`modified` 是最复杂的事件类型，需要分析改动文件对每条关联 Recipe 的影响程度。

**v3 Diff-Based 影响分析**

当文件被修改时，`FileChangeHandler` 通过 `SourceRefRepository.findBySourcePath(path)` 找到所有引用该文件的 Recipe，然后用 **diff-based 内容影响评估**计算影响级别——分析「这次改了什么」（diff），而非「文件整体和 Recipe 有多像」。

核心流程分四步：

```typescript
// lib/service/evolution/ContentImpactAnalyzer.ts
export function assessFileImpact(
  projectRoot: string,
  relativePath: string,
  recipeTokens: RecipeTokens
): DiffImpactResult | null {
  // 1. git diff -U0 获取文件行级变更
  const diffText = getFileDiff(projectRoot, relativePath);
  if (!diffText) { return null; }  // 无 git / untracked → 跳过

  // 2. 解析 diff hunks
  const hunks = parseDiffHunks(diffText);

  // 3. 从变更行提取代码标识符（diff tokens）
  const diffTokens = tokenizeDiffLines(hunks);

  // 4. 与 Recipe tokens 做加权交集
  return assessDiffImpact(diffTokens, recipeTokens);
}
```

Recipe tokens 从全字段提取——`coreCode`、`content.markdown` 中的代码块、`content.pattern`、`content.steps[].code`，覆盖知识实体的全部代码语义：

```typescript
// lib/service/evolution/ContentImpactAnalyzer.ts
export function extractRecipeTokens(entry: {
  coreCode?: string;
  content?: { markdown?: string; pattern?: string; steps?: Array<{ code?: string }> };
}): RecipeTokens { ... }
```

影响评分公式：`score = |T_R ∩ T_Δ| / |T_R|`，其中 `T_R` 是 Recipe 特征标识符集合，`T_Δ` 是 diff 变更行标识符集合。分级：

- `score ≥ 0.3` → `pattern`（diff 动到了 30%+ 的 Recipe 关键标识符）
- `score > 0` → `reference`（diff 动到了少量 Recipe 标识符）
- 无法获取 diff → 跳过（不做降级）

三个影响级别对应不同的 signal 权重：

| impactLevel | signal weight | 含义 |
|:---|:---|:---|
| `direct` | 0.8 | 文件删除且无其他引用 → 最高权重 |
| `pattern` | 0.6 | diff 动到了 30%+ 的 Recipe 关键标识符 → 高权重 |
| `reference` | 0.3 | diff 有少量 Recipe 标识符命中 → 低权重 |

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

所有级别都发射 quality signal（`ProposalExecutor` 消费）：

![v3 Diff-Based 文件变更影响分析](/images/ch07/04-diff-based-impact-analysis.png)

```typescript
signalBus.send('quality', 'FileChangeHandler', IMPACT_WEIGHTS[impactLevel], {
  target: recipeId,
  metadata: {
    reason: 'source_modified',
    modifiedPath,
    impactLevel,  // 'direct' | 'pattern' | 'reference'
  }
})
```

这些 signal 有三个消费方：`ProposalExecutor` 在评估提案时将其作为证据（§9.1：`direct`/`pattern` signal 阻止 deprecate 提案执行）、增量扫描的进化前置用它过滤需要 Agent 验证的 Recipe、VSCode 扩展根据影响摘要展示弹窗引导开发者审视。

**VSCode 弹窗进化建议**

当文件修改导致 `impactLevel` 为 `'direct'` 或 `'pattern'` 时，HTTP 响应将影响摘要返回给 VSCode 扩展，扩展展示三按钮弹窗：

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

### RecipeSimilarity：统一相似度算法

知识库需要在多个场景下比较两条 Recipe 的相似度——融合分析判断是否需要合并、冗余检测识别重复、批内互重叠阻止。为了避免不同模块各自实现导致同一对 Recipe 得到不同分数，`RecipeSimilarity` 提供统一的 4 维加权 Jaccard 相似度：

```typescript
// lib/domain/evolution/RecipeSimilarity.ts
export const WEIGHTS = { title: 0.2, clause: 0.3, code: 0.3, guard: 0.2 } as const;

class RecipeSimilarity {
  static compute(a: RecipeLike, b: RecipeLike): number {
    const d1 = titleJaccard(a.title, b.title);        // 标题词集交并比
    const d2 = clauseJaccard(a, b);                    // do/dontClause 词集交并比
    const d3 = codeSimilarity(a.coreCode, b.coreCode); // 3-gram Jaccard
    const d4 = guardMatch(a, b);                       // trigger/guard 精确匹配
    return 0.2 * d1 + 0.3 * d2 + 0.3 * d3 + 0.2 * d4;
  }
}
```

`ConsolidationAdvisor` 和 `RedundancyAnalyzer` 都调用此共享实现，确保相似度判断的一致性。相似度阈值 ≥ 0.65 判定为高冗余，0.40-0.65 为中等重叠需要进一步分析。

除了综合分数，`RecipeSimilarity.analyzeFields()` 还提供字段级分析（Layer 1.5），供融合决策使用：

- `triggerConflict` — trigger 是否语义冲突（同一命名空间下的不同 trigger）
- `doClauseSubset` — 候选的 doClause 是否是现有 Recipe 的子集
- `coreCodeOverlap` — 共享代码模式的比例
- `categoryMatch` — 是否在同一 category 下

### EvolutionGateway — 统一决策入口

`EvolutionGateway` 是所有进化决策的统一入口。无论来源是 Agent 工具、RelevanceAuditor、FileChangeHandler 还是 DecayDetector，所有进化意图都通过 `submit()` 提交：

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

高置信度废弃（`confidence ≥ 0.8`）的立即执行路径是一个重要的优化。当 `RelevanceAuditor` 判定某条 Recipe 为 `dead`（所有证据消失，分数 < 20，置信度 0.95），没有必要等观察期——直接废弃。但即使在这条快速路径上，废弃操作仍然必须通过 `LifecycleStateMachine` 的守卫检查——如果 Guard 拒绝了这次转换（比如该 Recipe 处于不允许直接废弃的状态），系统会自动降级为创建提案。

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

增量扫描（rescan）是知识进化的主战场。当项目代码发生变化后，系统需要判断哪些现有 Recipe 需要更新、废弃或合并，同时补齐新增的知识空位。传统的做法是让 Agent 逐条审视维度内所有 Recipe，包括那些完全健康的——这带来了大量无效的 token 消耗。

### 两阶段分离：Phase A + Phase B

新设计将增量扫描拆为两个阶段：

```
Phase A: 进化前置（维度循环前执行）
  ├── 输入: RelevanceAuditor 审计结果 + 文件修改影响 signal
  ├── 过滤: 只对 decay/severe/impacted 的 Recipe 做进化判断
  ├── 执行: Agent 验证（内部 Agent 或外部 Agent）
  ├── 输出: 进化决策已确定（skip/propose/deprecate），gap 位明确
  └── 效果: 腾出的 gap 位 = 需要新增的位数

Phase B: 纯新增（维度 pipeline，简化版）
  ├── 输入: 明确的 gap 数量
  ├── 不再有 Evolve Stage
  ├── 只有: Analyze → QualityGate → Produce → RejectionGate
  └── 效果: 每个维度的 pipeline 更简单、更快
```

Phase A 的核心思想是**只让 Agent 处理有问题的 Recipe**。具体的过滤策略：

| 条件 | 来源 | 处理方式 |
|:---|:---|:---|
| `verdict = healthy` 且无修改 signal | RelevanceAuditor | 自动 skip（刷新 lastVerifiedAt） |
| `verdict = dead`（score < 20） | RelevanceAuditor | 已被直接 deprecated |
| `verdict = decay`（score 40-59） | RelevanceAuditor | Agent 读代码验证 |
| `verdict = severe`（score 20-39） | RelevanceAuditor | Agent 读代码确认 |
| `verdict = watch` + 近期有 `source_modified` signal | 交叉信号 | Agent 验证是否仍然准确 |
| 近期有 `source_modified`（impactLevel=direct） | 文件变更 signal | Agent 读代码验证变化 |

预期收益是显著的：如果 80% 的 Recipe 健康且无修改，Agent 只需验证剩余的 20%，token 消耗大幅降低。

### RelevanceAuditor：四维证据评分

`RelevanceAuditor` 在 Phase A 中提供每条 Recipe 的健康评估。它通过四个维度的证据加权计算相关性分数：

```typescript
// lib/service/evolution/RelevanceAuditor.ts
const DEFAULT_WEIGHTS: EvidenceWeights = {
  triggerStillMatches: 0.2,  // trigger 关键词仍在代码中出现
  symbolsAlive: 0.3,         // coreCode 中的符号仍在项目中存活
  depsIntact: 0.15,          // 依赖文件仍存在
  codeFilesExist: 0.35,      // sourceRefs 引用的文件仍存在
};
```

加权分数映射到决策等级（来自 `EvolutionPolicy.classifyRelevance()`）：

- **healthy**（≥ 80）：Recipe 仍然有效，自动 skip
- **watch**（60-79，需结合修改 signal 判断）：有轻微退化迹象
- **decay**（40-59，置信度 0.4）：明显退化，需要 Agent 验证
- **severe**（20-39，置信度 0.6）：严重退化，Agent 确认后决定废弃或更新
- **dead**（< 20，置信度 0.95）：所有证据消失，直接 deprecated

不同 category 的 Recipe 有不同的权重配置——`architecture` 和 `conventions` 类的知识对 `symbolsAlive` 的依赖更低（架构规范不一定在代码中有具体符号），所以系统维护了 `CATEGORY_WEIGHT_OVERRIDES` 来调整各类知识的评估策略。

## 候选提交与分层融合

当 Agent（无论内部还是外部）产出新的候选 Recipe 并提交时，系统需要判断候选与现有知识库是否重叠。这个判断分三层，由浅入深：

### Layer 1：结构化快速过滤

纯代码逻辑，无需 Agent 参与：

1. **Fingerprint 精确去重** — 对 title/trigger/coreCode 做 hash 比对，完全重复的直接拒绝
2. **批内互重叠阻止** — 同一批提交的多条候选之间，如果 `RecipeSimilarity.compute() ≥ 0.65`，保留更强的一条，移除较弱的
3. **统一相似度筛查** — 候选与现有 Recipe 的 4 维加权 Jaccard 相似度，≥ 0.65 的直接标记为重复

```typescript
// RecipeProductionGateway — 批内互重叠阻止
for (const overlap of batchResult.internalOverlaps) {
  if (overlap.similarity >= 0.65) {
    const weaker = pickWeaker(overlap.candidateA, overlap.candidateB);
    submittableItems.delete(weaker);
    result.duplicates.push({
      item: weaker,
      similarTo: [{ title: stronger.title, similarity: overlap.similarity }],
      reason: 'batch-internal-overlap',
    });
  }
}
```

### Layer 1.5：字段级分析

当结构相似度在 0.40-0.65 的灰色地带时，系统进一步分析具体字段的重叠情况，而不是简单地用总分做二元判定：

- **triggerConflict** — trigger 是否在同一命名空间下冲突
- **doClauseSubset** — 候选的 doClause 是否是现有 Recipe 的子集（如果是，说明现有 Recipe 已覆盖）
- **coreCodeOverlap** — 共享代码模式的比例
- **categoryMatch** — 同 category 下的重叠更可能是真正的重复

字段级分析使得很多"总分模糊"的情况可以在不借助 Agent 的情况下做出判断。比如，两条 Recipe 总分 0.52，但 `doClauseSubset = true` + `categoryMatch = true` → 高概率是重复的。

### Layer 2：语义融合分析

当 Layer 1.5 仍然无法确定时，需要 Agent 的语义理解能力介入。这里有两条路径，取决于调用方：

**内部 Agent 路径**（增量扫描 pipeline 内）：在 Produce Stage 之后增加 ConsolidationGate，Agent 读取候选和相关现有 Recipe，做语义比对并输出 `create / merge / reject` 决策。

**外部 Agent 路径**（MCP 调用 `asd_submit_knowledge`）：服务端完成 Layer 1 + 1.5 后，将无法确定的候选标记为 `pendingSemanticReview`，通过 MCP 响应中的 `nextAction` 尾部指令引导外部 Agent 调用 `asd_consolidate` 工具完成语义融合。

```typescript
// asd_submit_knowledge 响应（含尾部指令）
{
  data: {
    created: [{ id: 'r1', title: 'Recipe A' }, ...],
    pendingSemanticReview: [{
      newRecipeId: 'r2',
      overlaps: [{
        existingId: 'existing-42',
        similarity: 0.52,
        fieldAnalysis: { doClauseSubset: true, categoryMatch: true },
        hint: 'doClause 可能是现有 Recipe 的子集',
      }]
    }]
  },
  nextAction: {
    tool: 'asd_consolidate',
    args: { reviewItems: [...] },
    required: false,
    reason: '发现疑似重叠，建议阅读代码后判断是否需要合并',
  }
}
```

外部 Agent 路径的设计理由：外部 Agent（如 Copilot/Cursor）**已经在运行**，具备完整的代码阅读和项目上下文理解能力，比服务端内部启动 Agent Runtime 更高效。服务端保持轻量，复杂的语义分析由调用方完成。

## 运行时行为

### 场景 1：新建候选的晋升之路

Agent 在项目冷启动时提取了一条关于 `CookieProviding` 的 Recipe，置信度 0.85。

1. **T+0**：Recipe 创建，状态 `pending`
2. **T+0（秒级）**：`ConfidenceRouter` 评估置信度 0.85，路由到 `auto_approve` → 进入 `staging`，暂存期 72 小时
3. **T+72h**：`StagingManager.checkAndPromote()` 检测到暂存期满且无负面反馈 → `staging → active`
4. **T+72h 后**：Recipe 以全权重参与搜索和 Guard 检查

### 场景 2：重构导致的自然衰退

团队决定弃用 `NetworkManager`，用原生 async/await 重写网络层。

1. **T+0**：`NetworkManager.swift` 被删除
2. **T+0**：`FileChangeHandler` 处理 `deleted` 事件，发现三条 Recipe 的所有 sourceRef 指向被删文件
3. **T+0**：对每条 Recipe 调用 `EvolutionGateway.submit({ action: 'deprecate', confidence: 0.9, source: 'file-change' })`
4. **T+0**：`EvolutionPolicy.shouldImmediateExecute(0.9)` → true，直接通过 `LifecycleStateMachine.transition(→ deprecated)` 执行
5. **T+N（下次扫描）**：`SourceRefReconciler.reconcile()` 补充发现其他间接引用了 `NetworkManager` 的 Recipe，标记为 `stale`
6. **T+N**：`RelevanceAuditor` 在 Phase A 审计中发现这些 Recipe 的 `codeFilesExist` 和 `symbolsAlive` 严重下降 → `decay` 或 `severe` 等级
7. **T+N**：Agent 验证确认 → `EvolutionGateway.submit({ action: 'deprecate' })` → 创建 Proposal（信号驱动评估）
8. **T+N+信号评估**：`ProposalExecutor` 在信号评估中确认 decay score 无回升 → `decaying → deprecated`

### 场景 3：Agent 驱动的知识更新

Agent 在一次代码分析中发现某条 Recipe 的 `coreCode` 缺少了错误处理的示例。

1. **T+0**：Agent 通过 `asd_evolve` MCP 工具调用 `EvolutionGateway.submit({ action: 'update', confidence: 0.8, evidence: [{ suggestedChanges: '...' }] })`
2. **T+0**：`EvolutionPolicy.resolveInitialStatus('update', 0.8)` → `'observing'`（≥ 0.7 自动进入观察）
3. **T+0**：`EvolutionPolicy.assessRisk('update', 0.8)` → `'low'`（观察窗口 24h）
4. **T+数小时**：Guard 检查命中该 Recipe，发射 `guard` signal → `ProposalExecutor.#onSignal()` 触发评估
5. **T+数小时**：`EvolutionPolicy.evaluateUpdate(metrics)` → FP 率正常、有使用记录 → pass
6. **T+数小时**：`LifecycleStateMachine`: `active → evolving`，`ContentPatcher.applyProposal()` 写入新的 coreCode，`evolving → staging`
7. **T+72h**：`StagingManager` 暂存期满，无负面反馈 → `staging → active`

### 场景 4：提交时的重复拦截

Agent 在增量扫描中提取了一条新 Recipe，但与已有的 Recipe A 高度相似。

1. **T+0**：候选通过 `RecipeProductionGateway` 提交
2. **T+0**：Layer 1 — `RecipeSimilarity.compute()` 得分 0.52（灰色地带，不足以判定重复）
3. **T+0**：Layer 1.5 — `RecipeSimilarity.analyzeFields()` 发现 `doClauseSubset = true` + `categoryMatch = true`
4. **T+0**：`ConsolidationAdvisor.analyze()` → action: `'insufficient'`，标记为 `pendingSemanticReview`
5. **T+0**：MCP 响应中附带 `nextAction: { tool: 'asd_consolidate' }`
6. **T+0**：外部 Agent 读取候选和 Recipe A 的代码上下文，判断候选确实是子集 → `reject`

### 场景 5：文件修改触发的实时进化审视

开发者正在 VSCode 中重构 `PaginationController.swift`，改变了核心 API。

1. **T+0**：开发者保存文件，VSCode 扩展收集 `modified` 事件（`eventSource: 'ide-edit'`）
2. **T+2s**：事件缓冲区 flush，POST 到 `/api/v1/file-changes`
3. **T+2s**：`FileChangeHandler` 查找引用该文件的 Recipe，发现两条：Recipe A（sourceRef 直接引用）和 Recipe B（仅在 reasoning.sources 中引用）
4. **T+2s**：`ContentImpactAnalyzer.assessFileImpact()` 对每条 Recipe 执行 diff-based 影响评估——获取 `git diff -U0`，解析变更行 tokens，与 Recipe tokens（`coreCode` + `content.markdown` 代码块）做加权交集。Recipe A 得分 0.45 → `impactLevel = pattern`；Recipe B 得分 0.08 → `impactLevel = reference`
5. **T+2s**：对 Recipe A 发射 `quality` signal（weight=0.6），对 Recipe B 发射 signal（weight=0.3）
6. **T+2s**：Recipe A 的 `pattern` 级影响触发 `EvolutionGateway.submit({ action: 'update', source: 'file-change' })`，持久化为 update 提案
7. **T+2s**：HTTP 响应返回影响摘要给 VSCode 扩展
8. **T+2s**：扩展检测到 `eventSource = 'ide-edit'` + 存在 `pattern` 级影响 → 展示弹窗："⚡ Alembic: 检测到 PaginationController 受近期编辑影响，建议进化评估。"
9. **T+选择**：开发者点击 "Review" → IDE Chat 打开，预填 prompt 包含受影响 Recipe 的标题和变更路径；退避计数重置
10. **T+下次 rescan**：Phase A 中，这两条 Recipe 因为有近期 `source_modified` signal 被选入 Agent 验证队列，Agent 读取新代码后决定 Recipe A 需要更新 → `propose_evolution`（Gateway 发现已有 Proposal → evidence 升级，追加 suggestedChanges）

这个场景展示了文件变更如何从 IDE 端事件一路触发到知识进化——signal 既是实时弹窗的触发器，也是下次增量扫描中进化前置的输入。

## 全链路数据流

前面分散介绍了各个子系统。以下是完整的架构视角，展示从文件变更到知识进化的全链路：

![知识进化全链路数据流](/images/ch07/05-full-dataflow-pipeline.png)

整个流程分为四个层次：

- **触发层**：IDE 文件事件通过 HTTP 到达 `FileChangeHandler`，按事件类型分流——rename/delete 走确信路径，modified 走 diff-based 影响分析
- **信号层**：`FileChangeHandler` 产出的 quality signal 被四个消费方并行接收——Signal 沉淀、增量扫描前置、ProposalExecutor 信号评估、VSCode 弹窗
- **决策层**：`RelevanceAuditor` 在 Phase A 中过滤候选 Recipe，`EvolutionGateway` 统一接收进化决策（含 evidence 升级），Phase B 新增候选经过 `RecipeProductionGateway` 三层过滤
- **落地层**：最终产出三种结果——新 Recipe 通过 `ConfidenceRouter` 进入 staging/pending、merge/update 通过 `EvolutionGateway` 创建提案、灰色地带交由外部 Agent 通过 `asd_consolidate` 决策

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
