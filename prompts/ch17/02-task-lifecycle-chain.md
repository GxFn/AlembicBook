Title at top in bold Chinese: "Task 意图生命周期链"

A vertical flow diagram showing the complete task lifecycle: Prime → Create → (behavior tracking) → Close → Guard. Five major stages connected by arrows flowing top-to-bottom, with side annotations.

STAGE 1 — "① Prime — 意图识别" (top, pale blue background rounded rectangle):
Left side: A stick-figure user icon with speech bubble "帮我实现缓存中间件"
Arrow labeled "userQuery + activeFile" pointing into a box containing two sub-components stacked vertically:

Sub-component A: "IntentExtractor" box with subtitle "纯函数 · 零副作用"
  Inside, 4 small output arrows pointing right, each labeled:
    "Q1: 原始查询 + 跨语言同义词"
    "Q2: 技术术语提取"
    "Q3: 文件上下文推断"
    "Q4: 同义词焦点（长查询）"
  Below: small labels "scenario: generate | lint | search | learning"

Arrow down labeled "queries[] + language + module + scenario" to:

Sub-component B: "PrimeSearchPipeline" box with subtitle "多查询并行搜索"
  Inside, 3 parallel horizontal arrows labeled "auto 模式", "semantic 模式", "keyword 模式"
  Converging into: "Weighted RRF 融合" small box
  Then: "三层质量过滤" small box with annotations: "绝对阈值 0.3 → 相对比值 15% → 间隙截断 25%"

Output arrow down labeled "relatedKnowledge (≤5) + guardRules (≤3) + _taskRules"

STAGE 2 — "② Create — 任务锚点" (small pale yellow rounded rectangle):
Simple box: "生成 taskId: asd-{timestamp}-{counter}"
Below: "绑定到 IntentState · 纯内存 · Zero DB"
Short arrow down.

STAGE 3 — "③ 行为自动采集" (middle zone, pale pink background, wider than other stages):
Title: "_trackSession() 透明采集"
A horizontal timeline bar with 4 small icons evenly spaced along it:
  Icon 1: magnifying glass labeled "搜索查询 → searchQueries[]"
  Icon 2: wrench labeled "工具调用 → toolCalls[]"
  Icon 3: document labeled "文件引用 → mentionedFiles[]"
  Icon 4: compass with exclamation mark labeled "漂移检测 → driftEvents[]"
Below the timeline: small text "Agent 编码过程中自动采集，无需额外上报"
Arrow down.

STAGE 4 — "④ Close — 意图链持久化" (pale blue rounded rectangle):
A box containing:
  Left side: "IntentChainRecord" document icon with small labels stacked:
    "primeQuery · primeRecipeIds"
    "toolCalls · searchQueries"
    "decisions · driftScore"
    "duration · outcome"
  Arrow right labeled "SignalBus.send('intent')" to:
  Right side: A file icon labeled ".autosnippet/signals/intent.jsonl"

Below the box, a prominent arrow down with bold label "nextAction: { tool: autosnippet_guard, required: true }"

STAGE 5 — "⑤ Guard Review — 质量门禁" (bottom, pale yellow background rounded rectangle):
Left side: "git diff" small icon with arrow labeled "staged + unstaged + untracked" pointing to:
Center: "GuardCheckEngine 逐文件审计" box
Right side: Arrow to a results box containing:
  "violations[] + inline Recipe 修复指南"
  Small text: "doClause + coreCode → Agent 直接修复"

Below: A circular arrow (loop) labeled "fix → review → fix (最多 5 轮)" with endpoint labeled "✅ passed"

Right margin annotations (outside main flow, connected by dashed lines):

Annotation at Stage 1: "反向驱动: _taskRules 注入行为指令"
Annotation at Stage 3: "漂移信号 → 代谢引擎 → 知识有效性评估"
Annotation at Stage 4-5: "协议强制: close 返回值驱动 Agent 调用 guard"
