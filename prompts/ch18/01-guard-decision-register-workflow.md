Title at top in concise Chinese: "Guard、Code Guard 与决策信号".

Draw a scoped Guard workflow from left to right:
"显式 files / inline code / workRef" → "规则装载" → "正则" → "code-level" → "AST" → "跨文件" → "violations + uncertainty".

Above rule loading show three sources: "DB Recipe", "内置规则", "Enhancement Pack". Add a small amber rule: "decaying error → warning".

Below the engine draw two consumers: "HTTP / Dashboard" and "alembic_code_guard". On the far right show "signals / audit / reports" as observe-only outputs.

Add a red retired-route note: "decision-register 写入入口已退休". Emphasize "范围明确", "证据可追", "人工复核".

Do not draw Decision Register as an input, output, durable write path, or reviewer action. Do not portray Guard as free-form architecture opinion.
