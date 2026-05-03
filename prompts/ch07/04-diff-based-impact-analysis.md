Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Diff-Based 文件影响分析"

Purpose:
Show how changed lines can become recipe impact signals without replacing the full rescan logic.

Main layout:
- Left: git diff -U0 produces changed hunks and tokens.
- Center: ContentImpactAnalyzer compares changed tokens with Recipe coreCode and markdown code blocks.
- Right: three impact levels: direct, pattern, reference.
- Bottom: quality signal feeds ProposalExecutor, Rescan planning, and IDE notification.

Important visible labels:
- git diff
- tokens
- ContentImpactAnalyzer
- direct 0.8
- pattern 0.6
- reference 0.3
- quality signal

Legend / footer:
- 文件变化是强信号, 不是唯一决策源

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
