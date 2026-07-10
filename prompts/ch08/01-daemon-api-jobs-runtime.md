Title at top in concise Chinese: "resident service 与任务证据链".

Place a central startup spine: "daemon-server" → "AppRuntime / DI" → "HTTP /api/v1". Around it place concise cards for "路由族 25", "契约路由 31", "ProjectScope", "file-changes", "Panorama 3", "Jobs", "Dashboard", and "Plugin｜选择性 resident".

Across the lower half draw one clear asynchronous evidence chain in amber: "JobStore" → "process events" → "display snapshot" → "artifacts" → "Dashboard". Use only these small endpoint callouts where useful: "/file-changes", "/panorama", "/panorama/health", "/panorama/gaps", "/jobs/{id}/events", "/jobs/{id}/display-snapshot".

Add a small decision fork from "completed_with_errors": "有成功产物 → completed" and "无成功证据 → failed".

Use blue for HTTP/read paths and amber for jobs/evidence. Do not invent `/hooks/file-change`, `/events/stream`, top-level `/artifacts`, scope.json, events.log, or storage layouts. Keep labels large and avoid endpoint tables.
