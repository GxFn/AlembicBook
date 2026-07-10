Title at top in concise Chinese: "当前术语关系图".

Draw four clusters with sparse, accurate relations.

1. "身份与存储": Project → projectRoot｜代码事实; Project → dataRoot｜知识写入; ProjectScope → Folder.
2. "结构与知识": ProjectContext → Graph; ProjectContext + RecipeContext → Recipe Map; Candidate → 人工审阅 → Recipe; Recipe → SourceRef; SourceRef → active / stale / renamed / drifted.
3. "执行与宿主": Host Agent → Plugin MCP; AgentRuntime → LLMGateway / ToolRouter; keep Host Agent and AgentRuntime separate.
4. "用户投影": Dashboard → /api/v1; Panorama → overview / health / gaps; Guard and Search consume governed knowledge.

Use one dashed freshness loop from drifted → Rescan / Evolution → lifecycle review. Add a small note: "Wiki / Project Skill = 投影，不是 Recipe 本体".

Do not include Decision Register, automatic promotion, or direct Dashboard-to-Core arrows. Keep all labels concise and avoid explanatory paragraphs.
