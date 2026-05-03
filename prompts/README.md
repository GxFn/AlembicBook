# 插图生成操作手册

## 工具链

- 生图执行者: 当前 Codex / ChatGPT Plus 账号能力
- 脚本职责: 列出插图状态、导出完整 prompt 包、标明 v1/v2 候选路径和最终替换路径
- Runtime: Node.js 18+
- 主脚本: `scripts/illustrations-codex.mjs`
- 兼容入口: `scripts/illustrations.sh`

当前流程不使用 API key，不调用 OpenAI Images API，不读取外部参考图，也不使用 `style-anchor.png`。生成必须由 Codex 先出第一版，再根据第一版调整生成第二版，最后挑选最佳版本替换书内 PNG。

## 目录结构

```text
alembic-book/
├── prompts/
│   ├── style-prompt-suffix.md       # 全局风格约束（每次生成都会附加）
│   └── ch06/
│       ├── 01-v3-field-overview.md
│       ├── 02-inheritance-vs-unified.md
│       └── 03-candidate-to-recipe.md
├── tmp/
│   ├── illustration-prompts/         # 脚本导出的完整 prompt 包
│   └── illustration-candidates/      # 建议保存 v1/v2 候选图
└── docs/public/images/
    ├── ch01/
    │   └── 01-core-workflow.png      # 当前期望成图系列示例
    ├── ch06/
    └── ...
```

## 视觉标准

当前全书插图以 `prompts/style-prompt-suffix.md` 为准。`docs/public/images/ch01/01-core-workflow.png` 是当前期望输出的系列示例，用来判断生成结果是否像同一本技术笔记。

核心风格是“手写系统设计白板图”:

- 横版白板画布，默认 `1536x1024`
- 白色或近白纸面背景，黑色手绘线条
- 红、蓝、绿、橙、紫五组颜色只做路径、层级、标签和浅填充
- 中文手写标签必须清晰可读
- 常用元素: 圆角矩形、数据库圆柱、文档卡、编号圆点、虚线框、细箭头、底部 legend
- 禁止 3D、照片感、渐变、阴影、装饰边框、表情符号

## 生成流程

### Step 1: 编写章节 prompt

每张图创建一个 prompt 文件到 `prompts/chXX/`。章节 prompt 只写内容结构，不写重复风格约束；脚本会自动拼接全局 `style-prompt-suffix.md`。

示例:

```text
Title at top in bold Chinese: "KnowledgeEntry V3 字段全景"

A large rounded rectangle divided into 6 horizontal layers:
Layer 1 "核心身份": 4 boxes — id, title(≤20字), description(≤80字), trigger(@前缀).
Layer 2 "内容体": content.markdown(≥200字符) + coreCode(3-8行)
...
```

### Step 2: 准备 Codex prompt 包

```bash
# 查看所有插图状态
bash scripts/illustrations.sh --list

# 为缺失插图导出 prompt 包
bash scripts/illustrations.sh

# 为某章导出 prompt 包
bash scripts/illustrations.sh --export-prompts ch06

# 为已有图片准备替换重生成 prompt
bash scripts/illustrations.sh --force ch07/06

# 只预览两轮生图计划
bash scripts/illustrations.sh --dry-run --force ch07/06
```

也可以使用 npm 脚本:

```bash
npm run illustrations -- --force ch15
npm run illustrations:prompts -- ch15
```

导出文件默认位于 `tmp/illustration-prompts/`。每个 prompt 包都会写清楚:

- 最终替换目标: `docs/public/images/chXX/NN-slug.png`
- 第一版候选图: `tmp/illustration-candidates/chXX/NN-slug.v1.png`
- 第二版候选图: `tmp/illustration-candidates/chXX/NN-slug.v2.png`
- 使用的全局风格: `prompts/style-prompt-suffix.md`
- 当前系列示例: `docs/public/images/ch01/01-core-workflow.png`

### Step 3: Codex 两轮生图

必须执行两轮，不允许一次生成后直接替换:

1. 使用导出的 initial prompt 生成 v1。
2. 检查 v1 的中文可读性、构图、事实标签、颜色纪律、是否像 `01-core-workflow.png` 系列。
3. 写一段 v2 adjustment note，只修正 v1 最弱的点，保留成功结构。
4. 用 initial prompt + adjustment note 生成 v2。
5. 比较 v1 和 v2，挑选最佳版本替换最终 PNG。

### Step 4: 替换与检查

替换后检查 Markdown 引用、图片尺寸和站点构建。章节图片文件名必须和 prompt 文件名保持一致，例如:

```text
prompts/ch07/06-scenario-promotion-path.md
docs/public/images/ch07/06-scenario-promotion-path.png
```

## 参数速查

| 参数 / 环境变量 | 默认值 | 说明 |
|---|---:|---|
| `ILLUSTRATION_CANVAS_SIZE` / `--size` | `1536x1024` | 横版白板尺寸 |
| `ILLUSTRATION_PROMPT_EXPORT_DIR` / `--export-dir` | `tmp/illustration-prompts` | prompt 导出目录 |
| `ILLUSTRATION_CANDIDATE_DIR` / `--candidate-dir` | `tmp/illustration-candidates` | v1/v2 候选图建议目录 |

## 质检清单

每张图生成后检查:

| 检查项 | 合格 | 不合格时 |
|---|---|---|
| 构图 | 横版系统设计图，标题、主体、legend 清楚 | v2 adjustment 中明确修正 |
| 风格 | 白板手绘，线条轻微不规则 | 强化 suffix 或重生成 v2 |
| 文字 | 中文清晰、少错字 | 减少文字量后重生成 v2 |
| 颜色 | 只使用红/蓝/绿/橙/紫点缀 | v2 中约束颜色用途 |
| 信息密度 | 密但有秩序，箭头少交叉 | 调整布局描述 |
| 统一性 | 和 `ch01/01-core-workflow.png` 像同一本技术笔记 | 重新生成 v2 |

## 命名规范

- prompt 文件: `prompts/chXX/NN-slug.md`
- 最终图片: `docs/public/images/chXX/NN-slug.png`
- v1 候选: `tmp/illustration-candidates/chXX/NN-slug.v1.png`
- v2 候选: `tmp/illustration-candidates/chXX/NN-slug.v2.png`
- 全局风格约束: `prompts/style-prompt-suffix.md`
- 当前系列示例: `docs/public/images/ch01/01-core-workflow.png`

## 注意事项

1. 风格调整优先改 `style-prompt-suffix.md`，内容调整才改章节 prompt。
2. 所有章节图都通过文字 prompt 直接生成，不附加 `style-anchor.png` 或外部参考图。
3. 替换已有图片前，必须保留 v1/v2 两个候选版本的判断过程。
4. `prompts/style-anchor.md` 和 `docs/public/images/style-anchor.png` 是旧流程遗留文件，不参与当前生成流程。
