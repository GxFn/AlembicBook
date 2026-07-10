Title at top in concise Chinese: "SourceRef 新鲜度闭环".

Draw three horizontal swimlanes.

1. Blue detection lane "检测": "reasoning.sources" → "SourceRef bridge" → "Reconciler" → four distinct status cards: "active", "stale", "renamed", "drifted". Under drifted add a dashed observe-only fork: "line-shift / content-change".
2. Purple consumption lane "消费": "Search 降权 + 标记" → "Plugin 保留状态" → "使用现场复核". Add a small amber note: "decaying Guard｜error 降为 warning".
3. Green governance lane "治理": "Rescan / Evolution" → "ProposalGateway" → "人工审阅" → "LifecycleStateMachine".

Connect drifted to consumption and governance with arrows. Add a red boundary note: "分类是 observe-only｜不自动修 range｜不自动 deprecated".

Do not draw Candidate → Recipe promotion. Do not merge stale and drifted. Do not imply automatic deletion or automatic lifecycle transition. Keep the four statuses visually distinct.
