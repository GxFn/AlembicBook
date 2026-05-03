Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow the repository style anchor and the global style suffix.

Visible title at top: "Tool System V2 与记忆"

Purpose:
Show the current Agent tool surface and how memory / cache sit behind it.

Main layout:
- Top: LLM sees only six tool names: code, terminal, knowledge, graph, memory, meta.
- Under each tool, show short action chips for the 19 actions.
- Center: ToolRouterV2 validates action/params, checks capabilities, controls concurrency, and limits output tokens.
- Bottom left: ToolContextFactory provides DeltaCache, SearchCache, SessionStore, sandbox executor.
- Bottom right: Memory actions save, recall, note_finding, get_previous_evidence support bootstrap evidence reuse.
- Side lane: non-Agent surfaces use LightweightRouter + adapters.

Must include these implementation facts:
- code: search, read, outline, structure, write.
- terminal: exec.
- knowledge: search, submit, detail, manage.
- graph: overview, query.
- memory: save, recall, note_finding, get_previous_evidence.
- meta: tools, plan, review.

Important visible labels:
- 6 工具
- 19 actions
- ToolRouterV2
- Capability check
- DeltaCache
- SearchCache
- Memory
- LightweightRouter

Legend / footer:
- LLM 选择少量语义工具, 具体操作放在 action 字段

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
