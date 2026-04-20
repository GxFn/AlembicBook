Title at top in bold Chinese: "v3 Diff-Based 文件变更影响分析"

A vertical pipeline diagram showing how a file modification event flows through the diff-based impact analysis system, ending with three output branches. Clean layout with generous spacing between stages.

Style: Same hand-drawn illustration style as other ch07 diagrams. Warm white background, rounded rectangles with soft pastel fills, hand-drawn arrows, small icons for visual cues. Minimal text per box — use short labels, not full sentences.

TOP — Input trigger:

A rounded rectangle, pale gray (#E5E7EB) fill, with a small file-edit icon:
Bold text: "文件保存事件"
Below in smaller text: "modified event → FileChangeHandler"

Arrow pointing down ↓

STAGE 1 — Source Reference Lookup:

Rounded rectangle, pale blue (#DBEAFE) fill, with a small magnifying glass icon:
Bold text: "SourceRefRepository"
Below: "findBySourcePath(path)"

Arrow pointing down ↓

STAGE 2 — two boxes side by side connected by a "+" symbol, both feeding into Stage 3:

Left box — Rounded rectangle, pale yellow (#FEF3C7) fill, with a small git-branch icon:
Bold text: "Diff Tokens T_Δ"
Below line 1: "getFileDiff() → git diff"
Below line 2: "parseDiffHunks()"
Below line 3: "tokenizeDiffLines()"

Right box — Rounded rectangle, pale green (#D1FAE5) fill, with a small book icon:
Bold text: "Recipe Tokens T_R"
Below line 1: "extractRecipeTokens()"
Below line 2: "coreCode + markdown"
Below line 3: "pattern + steps"

Both boxes have arrows pointing down into Stage 3 ↓

STAGE 3 — Impact Scoring (center, slightly larger box):

Rounded rectangle, pale purple (#EDE9FE) fill, with a small calculator icon:
Bold text: "assessDiffImpact()"
Below: formula "score = |T_R ∩ T_Δ| / |T_R|"

THREE output arrows fanning down from this box, each with a threshold label on the arrow:

OUTPUT 1 (left arrow, label on arrow "score ≥ 0.3"):
Rounded rectangle, soft orange (#FED7AA) fill:
Bold text: "pattern"
Below: "weight 0.6"
Below: small additional box with arrow: "→ Gateway.submit(update)"

OUTPUT 2 (center arrow, label on arrow "0 < score < 0.3"):
Rounded rectangle, pale blue (#BFDBFE) fill:
Bold text: "reference"
Below: "weight 0.3"

OUTPUT 3 (right arrow, label on arrow "score = 0"):
Rounded rectangle, pale gray (#F3F4F6) fill:
Bold text: "跳过"

BOTTOM — All three output paths converge with dashed arrows into a shared result box:

Rounded rectangle, pale green (#D1FAE5) fill, with a small broadcast/signal icon:
Bold text: "SignalBus.send('quality')"
Below line 1: "→ ProposalExecutor (§9.1 保护)"
Below line 2: "→ VSCode 弹窗 (direct / pattern)"
