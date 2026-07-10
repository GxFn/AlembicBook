Title at top in concise Chinese: "Plan、Cold Start 与 Rescan".

Start with three input cards: "Cold Start｜空知识层", "Rescan｜已有 Recipe + 漂移", and "ProjectContext".

Create two distinct execution lanes after a shared plan gate:
- Host lane in purple: "plan draft" → "plan confirm" → "bootstrap / rescan" → "Mission Briefing" → "宿主 Agent" → "submit knowledge".
- Resident lane in amber: "daemon Job" → "@alembic/agent" → "Candidate".

Both lanes converge into the public review path: "Candidate + SourceRef" → "人工审阅" → "Recipe" → "Search / Prime / Guard". Add a feedback arrow: "漂移" → "降权标记" → "Rescan".

Make draft → confirm visually unmistakable as an execution gate. Mission Briefing must appear before host execution, never after Recipe. Do not merge the host Agent with the resident provider job. No tiny dimension lists or invented output counts.
