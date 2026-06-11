Title at top in concise Chinese: "daemon / API / jobs 运行结构".

Draw daemon as a hub. Around it place HTTP routes, JobStore, project-scope routes, file-change routes, Dashboard socket/events, and background jobs. Show jobs emitting events and artifacts that Dashboard can read.

Use blue for API/read paths and amber for async job paths.
