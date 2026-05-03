#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PROMPTS_DIR = path.join(ROOT, 'prompts');
const IMAGES_DIR = path.join(ROOT, 'docs/public/images');
const STYLE_SUFFIX = path.join(PROMPTS_DIR, 'style-prompt-suffix.md');

const DEFAULTS = {
  size: process.env.ILLUSTRATION_CANVAS_SIZE || '1536x1024',
  exportDir: process.env.ILLUSTRATION_PROMPT_EXPORT_DIR || 'tmp/illustration-prompts',
  candidateDir: process.env.ILLUSTRATION_CANDIDATE_DIR || 'tmp/illustration-candidates',
};

function usage() {
  return `Alembic Book 插图工作流（Codex / ChatGPT Plus）

用法:
  bash scripts/illustrations.sh [选项] [目标...]
  node scripts/illustrations-codex.mjs [选项] [目标...]

常用:
  bash scripts/illustrations.sh --list                   列出插图状态
  bash scripts/illustrations.sh --export-prompts ch15    导出给 Codex 生图的完整 prompt
  bash scripts/illustrations.sh --force ch07/06          为已有图片准备重生成 prompt
  bash scripts/illustrations.sh ch06                     为缺失的 ch06 插图准备 prompt
  bash scripts/illustrations.sh ch07/06                  为 ch07 下 06- 开头的图准备 prompt
  bash scripts/illustrations.sh --dry-run --force ch07/06 预览两轮生图计划

选项:
  --force, -f             包含已存在图片；用于准备替换重生成 prompt
  --dry-run, -n           预览模式，不写 prompt 文件
  --list, -l              列出状态
  --export-prompts        导出完整 prompt；适合 Codex / ChatGPT Plus 生图
  --plus-prompts          --export-prompts 的别名
  --export-dir <dir>      prompt 导出目录，默认 ${DEFAULTS.exportDir}
  --candidate-dir <dir>   v1/v2 候选图建议目录，默认 ${DEFAULTS.candidateDir}
  --size <WxH>            画布尺寸，默认 ${DEFAULTS.size}
  --help, -h              显示帮助

环境变量:
  ILLUSTRATION_CANVAS_SIZE       可选，例如 1536x1024
  ILLUSTRATION_PROMPT_EXPORT_DIR 可选，prompt 导出目录
  ILLUSTRATION_CANDIDATE_DIR     可选，v1/v2 候选图建议目录

说明:
  当前流程不使用 API key，不调用 OpenAI Images API，也不读取 style-anchor.png。
  必须先生成 v1，再根据 v1 调整生成 v2，最后挑选最佳版本替换目标 PNG。
`;
}

function parseArgs(argv) {
  const opts = {
    force: false,
    dryRun: false,
    list: false,
    exportPrompts: false,
    size: DEFAULTS.size,
    exportDir: DEFAULTS.exportDir,
    candidateDir: DEFAULTS.candidateDir,
    chapters: [],
    slugs: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = (name) => {
      const valueFromEquals = arg.startsWith(`${name}=`) ? arg.slice(name.length + 1) : null;
      if (valueFromEquals !== null) return valueFromEquals;
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`缺少参数值: ${name}`);
      }
      i += 1;
      return value;
    };

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--force' || arg === '-f') {
      opts.force = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--list' || arg === '-l') {
      opts.list = true;
    } else if (arg === '--export-prompts' || arg === '--plus-prompts') {
      opts.exportPrompts = true;
    } else if (arg === '--size' || arg.startsWith('--size=')) {
      opts.size = readValue('--size');
    } else if (arg === '--export-dir' || arg.startsWith('--export-dir=')) {
      opts.exportDir = readValue('--export-dir');
    } else if (arg === '--candidate-dir' || arg.startsWith('--candidate-dir=')) {
      opts.candidateDir = readValue('--candidate-dir');
    } else if (isDeprecatedApiOption(arg)) {
      throw new Error(`${arg.split('=')[0]} 已废弃：当前流程使用 Codex / ChatGPT Plus 两轮生图，不使用 API key 或 API 参数。`);
    } else if (/^ch\d\d\/.+/.test(arg)) {
      opts.slugs.push(normalizeSlugTarget(arg));
    } else if (/^ch\d\d$/.test(arg)) {
      opts.chapters.push(arg);
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  if (!/^\d+x\d+$/.test(opts.size)) {
    throw new Error(`无效的 --size: ${opts.size}`);
  }

  opts.exportDir = path.resolve(ROOT, opts.exportDir);
  opts.candidateDir = path.resolve(ROOT, opts.candidateDir);
  return opts;
}

function isDeprecatedApiOption(arg) {
  return [
    '--anchor',
    '--no-external-ref',
    '--reference-url',
    '--model',
    '--quality',
    '--format',
    '--base-url',
    '--resize-width',
    '--no-resize',
  ].some((option) => arg === option || arg.startsWith(`${option}=`));
}

function normalizeSlugTarget(input) {
  return input
    .replace(/^prompts\//, '')
    .replace(/^docs\/public\/images\//, '')
    .replace(/\.md$/, '')
    .replace(/\.(png|jpg|jpeg|webp)$/i, '');
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileSize(filePath) {
  const stat = await fs.stat(filePath);
  return formatBytes(stat.size);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

async function collectPromptFiles() {
  const chapters = (await fs.readdir(PROMPTS_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^ch\d\d$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const files = [];
  for (const chapter of chapters) {
    const chapterDir = path.join(PROMPTS_DIR, chapter);
    const entries = await fs.readdir(chapterDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(path.join(chapterDir, entry.name));
      }
    }
  }

  return files.sort();
}

function matchesTargets(promptFile, opts) {
  const chapter = path.basename(path.dirname(promptFile));
  const slug = path.basename(promptFile, '.md');
  const full = `${chapter}/${slug}`;

  const hasTargets = opts.chapters.length > 0 || opts.slugs.length > 0;
  if (!hasTargets) return true;

  if (opts.chapters.includes(chapter)) return true;
  return opts.slugs.some((target) => full === target || full.startsWith(target));
}

async function collectImageTasks(opts) {
  const promptFiles = await collectPromptFiles();
  return promptFiles
    .filter((promptFile) => matchesTargets(promptFile, opts))
    .map((promptFile) => {
      const chapter = path.basename(path.dirname(promptFile));
      const slug = path.basename(promptFile, '.md');
      return {
        label: `${chapter}/${slug}`,
        promptFile,
        outputFile: path.join(IMAGES_DIR, chapter, `${slug}.png`),
      };
    });
}

function exportFileForTask(task, opts) {
  const chapter = path.basename(path.dirname(task.promptFile));
  const slug = path.basename(task.promptFile, '.md');
  return path.join(opts.exportDir, chapter, `${slug}.md`);
}

function candidateFilesForTask(task, opts) {
  const chapter = path.basename(path.dirname(task.promptFile));
  const slug = path.basename(task.promptFile, '.md');
  const base = path.join(opts.candidateDir, chapter, slug);
  return {
    v1: `${base}.v1.png`,
    v2: `${base}.v2.png`,
  };
}

async function buildPrompt(task, opts) {
  const suffix = await fs.readFile(STYLE_SUFFIX, 'utf8');
  const content = await fs.readFile(task.promptFile, 'utf8');

  return [
    'Create an original AlembicBook chapter illustration with the current Codex / ChatGPT Plus image generation capability.',
    'Do not use API keys, OpenAI Images API calls, external reference images, or style-anchor.png.',
    `Canvas: ${opts.size}, landscape. Output should be suitable for a PNG replacement in the book.`,
    'Use prompts/style-prompt-suffix.md as the canonical visual standard. Match the existing AlembicBook notebook family; docs/public/images/ch01/01-core-workflow.png is the current target example.',
    'CHAPTER CONTENT BRIEF:',
    content,
    'GLOBAL STYLE CONSTRAINTS:',
    suffix,
  ].join('\n\n');
}

async function buildManualPrompt(task, opts) {
  const fullPrompt = await buildPrompt(task, opts);
  const candidates = candidateFilesForTask(task, opts);

  return [
    `# AlembicBook Codex Image Prompt: ${task.label}`,
    '',
    `Final replacement target: ${rel(task.outputFile)}`,
    `Candidate v1 target: ${rel(candidates.v1)}`,
    `Candidate v2 target: ${rel(candidates.v2)}`,
    `Canvas: ${opts.size}, landscape`,
    'Reference image: none',
    `Style source: ${rel(STYLE_SUFFIX)}`,
    'Target family example: docs/public/images/ch01/01-core-workflow.png',
    '',
    'Mandatory Codex / ChatGPT Plus workflow:',
    '1. Generate v1 directly from the initial prompt below.',
    '2. Inspect v1 for readable Chinese text, notebook-family style, balanced composition, accurate implementation labels, and color discipline.',
    '3. Write a short v2 adjustment note that fixes the weakest points in v1 while preserving its successful structure.',
    '4. Generate v2 from the initial prompt plus that adjustment note.',
    '5. Compare v1 and v2, choose the better image, then replace the final target PNG with the selected version.',
    '',
    'Initial generation prompt:',
    '',
    '---',
    '',
    fullPrompt,
    '',
    '---',
    '',
    'Second-pass adjustment template:',
    '',
    'Generate v2 of the same AlembicBook illustration. Preserve the successful layout from v1, but improve: [composition / label clarity / factual labels / color balance / visual hierarchy]. Keep all visible text concise Chinese and keep the same technical notebook family as docs/public/images/ch01/01-core-workflow.png.',
    '',
  ].join('\n');
}

async function exportPrompt(task, opts) {
  const outputFile = exportFileForTask(task, opts);
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, await buildManualPrompt(task, opts), 'utf8');
  return outputFile;
}

async function listStatus(tasks) {
  console.log('Alembic Book 插图状态');
  console.log('');

  for (const task of tasks) {
    const outputExists = await exists(task.outputFile);
    console.log(`${outputExists ? 'ready ' : 'todo  '} ${rel(task.outputFile)}${outputExists ? ` (${await fileSize(task.outputFile)})` : ''}`);
  }

  const missing = (await Promise.all(tasks.map((task) => exists(task.outputFile)))).filter((value) => !value).length;
  console.log('');
  console.log(`total: ${tasks.length}, missing: ${missing}, generated: ${tasks.length - missing}`);
}

async function processTask(task, opts, index, total) {
  const outputExists = await exists(task.outputFile);
  if (!opts.exportPrompts && outputExists && !opts.force) {
    console.log(`[${index}/${total}] skip ${task.label}: ${rel(task.outputFile)} already exists`);
    return 'skipped';
  }

  const candidates = candidateFilesForTask(task, opts);
  console.log(`[${index}/${total}] prepare ${task.label}`);
  console.log(`  prompt: ${rel(task.promptFile)}`);
  console.log(`  final: ${rel(task.outputFile)}`);
  console.log(`  v1: ${rel(candidates.v1)}`);
  console.log(`  v2: ${rel(candidates.v2)}`);
  console.log(`  engine: Codex / ChatGPT Plus (no API key)`);

  if (opts.dryRun) {
    console.log(`  export: ${rel(exportFileForTask(task, opts))}`);
    console.log('  action: dry-run only');
    return 'dry-run';
  }

  const outputFile = await exportPrompt(task, opts);
  console.log(`  export: ${rel(outputFile)}`);
  console.log('  action: generate v1, adjust, generate v2, select best, replace final PNG');
  return 'exported';
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(usage());
    return;
  }

  if (!(await exists(STYLE_SUFFIX))) {
    throw new Error(`缺少风格文件: ${rel(STYLE_SUFFIX)}`);
  }

  const tasks = await collectImageTasks(opts);

  if (tasks.length === 0) {
    console.log('没有找到匹配的 prompt 文件');
    return;
  }

  if (opts.list) {
    await listStatus(tasks);
    return;
  }

  let exported = 0;
  let skipped = 0;
  let dryRun = 0;

  console.log('==========================================');
  console.log('Alembic Book Codex 插图 prompt 工作流');
  console.log(`目标: ${tasks.length}`);
  console.log(`canvas: ${opts.size}`);
  console.log(`prompt export: ${rel(opts.exportDir)}`);
  console.log(`candidates: ${rel(opts.candidateDir)}`);
  console.log('==========================================');
  console.log('');

  for (let i = 0; i < tasks.length; i += 1) {
    const result = await processTask(tasks[i], opts, i + 1, tasks.length);
    console.log('');
    if (result === 'exported') exported += 1;
    if (result === 'skipped') skipped += 1;
    if (result === 'dry-run') dryRun += 1;
  }

  console.log('==========================================');
  console.log(opts.dryRun ? `预览完成: ${dryRun} 个 prompt` : `完成: 导出 ${exported}, 跳过 ${skipped}`);
  console.log('==========================================');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
