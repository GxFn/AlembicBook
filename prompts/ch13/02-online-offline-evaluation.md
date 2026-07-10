Title at top in concise Chinese: "在线质量门与离线评测".

Draw two clearly separate horizontal lanes that share evidence but never merge into one gate.

Top green lane "在线｜每次运行": "stage builders" → "deterministic quality gates" → decision fork "继续 / 停止 / 降级". Small labels: "结构", "证据", "输出质量".

Bottom purple lane "离线｜手工评测": "mining samples" → "judge" → "calibration" → "promotion decision". Show four concise thresholds: "样本 ≥ 30", "κ ≥ 0.6", "负样本 ≥ 5", "负召回 ≥ 0.6".

Add a red boundary note: "离线评测不是默认 CI" and a dashed empty future box: "critic｜尚未上线".

Do not imply the online gate uses an LLM judge. Do not show critic as active. Keep no more than 12 primary labels.
