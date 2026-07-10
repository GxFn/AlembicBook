Title at top in concise Chinese: "AlembicBook 证据维护闭环".

Left side: draw an evidence ladder from lower to higher authority: "旧书 / 截图" → "ledger / README" → "源码 / 调用方" → "测试 / 运行证据". Make the top two levels visually dominant.

Center: draw a maintenance loop: "定位变化" → "核验实现" → "更新章节" → decision diamond "图义变化？". The yes branch goes to "更新 prompt + PNG"; the no branch skips image generation. Both rejoin at "验证".

Inside the validation card use five concise checks: "source anchors", "fact assertions", "verify:alembic", "VitePress build", "视觉复核 / diff". End at "可交付 Book", then loop future drift back to "核验实现".

Add one principle box: "Book 是派生文档｜产品事实以代码与运行证据为准".

Do not connect image generation directly to Published. Do not say every update must regenerate images. Do not present ledger as higher authority than current source or runtime evidence.
