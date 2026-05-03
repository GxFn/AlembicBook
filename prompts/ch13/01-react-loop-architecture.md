Create one 1536x1024 landscape whiteboard architecture diagram for AlembicBook.

This prompt is optimized for ChatGPT image generation:
- Draw one coherent technical whiteboard page, not a poster and not a UI mockup.
- Use large, readable handwritten Chinese labels. Keep each visible label short.
- Use technical identifiers only where they are real implementation names.
- Prefer boxes, arrows, numbered dots, database cylinders, document cards, dashed async flows, and a compact legend.
- Avoid dense paragraphs inside the image; summarize with short labels.
- Follow prompts/style-prompt-suffix.md as the canonical style; use docs/public/images/ch01/01-core-workflow.png as the target notebook-family example.

Visible title at top: "Agent Runtime 推理循环"

Purpose:
Show the latest Agent execution path from service input to tool observations.

Main layout:
- Top lane: AgentService.run validates input and compiles profile.
- Middle lane: AgentProfileCompiler → AgentRunCoordinator optional fanout → AgentRuntimeBuilder → AgentRuntime.
- Runtime lane: Strategy stages run ReAct steps and call V2ToolRouterAdapter.
- Tool lane: ToolRouterV2 executes code, terminal, knowledge, graph, memory, meta actions.
- Observation loop returns compressed tool results to the next reasoning step.

Must include these implementation facts:
- Built-in presets include chat, insight, evolution, lark, and remote-exec.
- bootstrap-session fanout coordination happens in AgentRunCoordinator.
- Agent tools are 6 names with action/params JSON.

Important visible labels:
- AgentService.run
- ProfileCompiler
- RunCoordinator
- RuntimeBuilder
- AgentRuntime
- Strategy
- V2ToolRouterAdapter
- Observation

Legend / footer:
- Profile 决定身份, Strategy 决定流程, Tool V2 决定动作面

Composition notes:
- Keep the title at the top, the main system flow in the middle, and a small legend or principle strip at the bottom.
- Use black arrows for normal flow, colored arrows for important routes, and dashed arrows for optional, async, or feedback paths.
- The final image should look like a polished page from the same hand-drawn systems notebook series.
