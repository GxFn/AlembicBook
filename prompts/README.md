# 插图生成操作手册

## 工具链

- 自动生图引擎: OpenAI Images API
- 无 API 模式: 导出完整 prompt，交给 ChatGPT Plus 生图
- 默认模型: `gpt-image-1.5`
- Runtime: Node.js 18+
- 主脚本: `scripts/illustrations-openai.mjs`
- 兼容入口: `scripts/illustrations.sh`

ChatGPT Plus 和 OpenAI API 是分开的。只有 Plus 订阅时，脚本不能直接调用 ChatGPT 里的生图能力；此时使用 `--export-prompts` 导出完整 prompt。

API 自动生成前需要设置:

```bash
export OPENAI_API_KEY="..."
```

如账号已开通更新模型，可覆盖:

```bash
export OPENAI_IMAGE_MODEL="gpt-image-2"
```

## 目录结构

```text
alembic-book/
├── prompts/
│   ├── style-anchor.md              # 风格锚点图的内容 prompt
│   ├── style-prompt-suffix.md       # 全局风格约束（每次生成都会附加）
│   └── ch06/
│       ├── 01-v3-field-overview.md
│       ├── 02-inheritance-vs-unified.md
│       └── 03-candidate-to-recipe.md
└── docs/public/images/
    ├── style-anchor.png             # 全书风格锚点图（先生成并确认）
    ├── ch01/
    ├── ch06/
    └── ...
```

## 新视觉标准

新的全书插图风格是“手写系统设计白板图”:

- 横版白板画布，默认 `1536x1024`
- 白色或近白纸面背景，黑色手绘线条
- 红、蓝、绿、橙、紫五组颜色只做路径、层级、标签和浅填充
- 中文手写标签必须清晰可读
- 常用元素: 圆角矩形、数据库圆柱、文档卡、编号圆点、虚线框、细箭头、底部 legend
- 禁止 3D、照片感、渐变、阴影、装饰边框、表情符号

外部标准图只用于提炼视觉语法，不复制标题、内容或具体结构。真正的书内统一锚点是 `docs/public/images/style-anchor.png`。

## 生成流程

### Step 0A: ChatGPT Plus 导出 prompt

只有 ChatGPT Plus、没有 API key 时，先导出完整 prompt:

```bash
bash scripts/illustrations.sh --export-prompts --anchor
bash scripts/illustrations.sh --export-prompts ch15
```

导出目录默认是 `tmp/illustration-prompts/`，其中每个文件都包含目标图片路径、参考图说明和完整生图 prompt。

### Step 0B: API 生成风格锚点图

有 API key 时，锚点图由 `prompts/style-anchor.md` 决定内容，由 `prompts/style-prompt-suffix.md` 决定风格。默认会读取标准参考图 URL 作为风格参考。

```bash
bash scripts/illustrations.sh --anchor --force --dry-run
bash scripts/illustrations.sh --anchor --force
```

如果只想根据文字 prompt 生成锚点，不读取外部参考图:

```bash
bash scripts/illustrations.sh --anchor --force --no-external-ref
```

锚点图满意后再生成章节插图。章节图只引用这张锚点图，避免连续引用导致风格漂移。

### Step 1: 编写章节 prompt

每张图创建一个 prompt 文件到 `prompts/chXX/`。章节 prompt 只写内容结构，不写风格约束。

示例:

```text
Title at top in bold Chinese: "KnowledgeEntry V3 字段全景"

A large rounded rectangle divided into 6 horizontal layers:
Layer 1 "核心身份": 4 boxes — id, title(≤20字), description(≤80字), trigger(@前缀).
Layer 2 "内容体": content.markdown(≥200字符) + coreCode(3-8行)
...
```

### Step 2: 生成图片

```bash
# 生成所有缺失插图
bash scripts/illustrations.sh

# 只生成某章
bash scripts/illustrations.sh ch06

# 单图或前缀匹配
bash scripts/illustrations.sh ch07/06

# 强制重新生成
bash scripts/illustrations.sh --force ch07/06

# 只预览，不调用 API
bash scripts/illustrations.sh --dry-run ch07/06

# 查看状态
bash scripts/illustrations.sh --list
```

也可以使用 npm 脚本:

```bash
npm run illustrations -- --dry-run ch15
npm run illustrations:anchor -- --force --dry-run
npm run illustrations:prompts -- ch15
```

## 参数速查

| 参数 / 环境变量 | 默认值 | 说明 |
|---|---:|---|
| `OPENAI_IMAGE_MODEL` / `--model` | `gpt-image-1.5` | OpenAI 图片模型 |
| `OPENAI_IMAGE_SIZE` / `--size` | `1536x1024` | 横版白板尺寸 |
| `OPENAI_IMAGE_QUALITY` / `--quality` | `high` | 输出质量 |
| `OPENAI_IMAGE_FORMAT` / `--format` | `png` | 输出格式；仓库固定使用 PNG |
| `ILLUSTRATION_RESIZE_WIDTH` / `--resize-width` | `1280` | 生成后压缩宽度 |
| `ALEMBIC_STYLE_REFERENCE_URL` / `--reference-url` | 标准图 URL | 仅锚点图使用 |
| `ILLUSTRATION_PROMPT_EXPORT_DIR` / `--export-dir` | `tmp/illustration-prompts` | Plus prompt 导出目录 |

## 质检清单

每张图生成后检查:

| 检查项 | 合格 | 不合格时 |
|---|---|---|
| 构图 | 横版系统设计图，标题、主体、legend 清楚 | 调整 prompt 后重生成 |
| 风格 | 白板手绘，线条轻微不规则 | 加强 suffix 或重生成 |
| 文字 | 中文清晰、少错字 | 重生成或减少文字量 |
| 颜色 | 只使用红/蓝/绿/橙/紫点缀 | 重生成 |
| 信息密度 | 密但有秩序，箭头少交叉 | 调整布局描述 |
| 统一性 | 和 `style-anchor.png` 像同一本技术笔记 | 重新生成 |

## 命名规范

- prompt 文件: `prompts/chXX/NN-slug.md`
- 图片文件: `docs/public/images/chXX/NN-slug.png`
- 锚点 prompt: `prompts/style-anchor.md`
- 锚点图片: `docs/public/images/style-anchor.png`

## 注意事项

1. 先确定锚点图，再批量生成章节图。
2. 所有章节图只引用 `style-anchor.png`，不要链式引用上一张章节图。
3. 风格调整优先改 `style-prompt-suffix.md`，内容调整才改章节 prompt。
4. 默认不会覆盖已有图片；需要覆盖时显式加 `--force`。
5. 本脚本会在强制覆盖前创建临时备份，失败时自动恢复。
