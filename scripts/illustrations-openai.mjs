#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PROMPTS_DIR = path.join(ROOT, 'prompts');
const IMAGES_DIR = path.join(ROOT, 'docs/public/images');
const STYLE_SUFFIX = path.join(PROMPTS_DIR, 'style-prompt-suffix.md');
const STYLE_ANCHOR_PROMPT = path.join(PROMPTS_DIR, 'style-anchor.md');
const STYLE_ANCHOR_IMAGE = path.join(IMAGES_DIR, 'style-anchor.png');

const DEFAULT_REFERENCE_URL =
  'https://pbs.twimg.com/media/HHEwHdQbIAAcIPn?format=jpg&name=large';

const DEFAULTS = {
  model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5',
  size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
  quality: process.env.OPENAI_IMAGE_QUALITY || 'high',
  format: process.env.OPENAI_IMAGE_FORMAT || 'png',
  baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  resizeWidth: Number.parseInt(process.env.ILLUSTRATION_RESIZE_WIDTH || '1280', 10),
  referenceUrl: process.env.ALEMBIC_STYLE_REFERENCE_URL || DEFAULT_REFERENCE_URL,
  exportDir: process.env.ILLUSTRATION_PROMPT_EXPORT_DIR || 'tmp/illustration-prompts',
};

function usage() {
  return `Alembic Book 插图生成工具（OpenAI Images API）

用法:
  bash scripts/illustrations.sh [选项] [目标...]
  node scripts/illustrations-openai.mjs [选项] [目标...]

常用:
  bash scripts/illustrations.sh --anchor --force --dry-run 预览锚点图生成
  bash scripts/illustrations.sh --export-prompts ch15    导出给 ChatGPT Plus 使用的完整 prompt
  bash scripts/illustrations.sh --anchor --force         重新生成风格锚点图
  bash scripts/illustrations.sh                          生成所有缺失插图
  bash scripts/illustrations.sh ch06                     只处理 ch06
  bash scripts/illustrations.sh ch07/06                  处理 ch07 下 06- 开头的图
  bash scripts/illustrations.sh --list                   列出插图状态

选项:
  --anchor                只处理风格锚点图 docs/public/images/style-anchor.png
  --force, -f             覆盖已有图片；覆盖前会创建临时备份
  --dry-run, -n           预览模式，不调用 API，不写图片
  --list, -l              列出状态
  --export-prompts        导出完整 prompt，不调用 API，适合 ChatGPT Plus 手动生图
  --plus-prompts          --export-prompts 的别名
  --export-dir <dir>      prompt 导出目录，默认 ${DEFAULTS.exportDir}
  --no-resize             跳过生成后的宽度压缩
  --no-external-ref       生成锚点图时不读取外部标准图 URL
  --model <name>          覆盖模型，默认 ${DEFAULTS.model}
  --size <WxH>            覆盖尺寸，默认 ${DEFAULTS.size}
  --quality <value>       覆盖质量，默认 ${DEFAULTS.quality}
  --format <png>          输出格式，仓库图片路径固定为 .png
  --base-url <url>        覆盖 OpenAI API base URL
  --reference-url <url>   覆盖锚点图标准参考 URL
  --resize-width <px>     生成后压缩到指定宽度，默认 ${DEFAULTS.resizeWidth}
  --help, -h              显示帮助

环境变量:
  OPENAI_API_KEY              必填，实际生成时需要
  OPENAI_IMAGE_MODEL          可选，例如 gpt-image-2
  OPENAI_IMAGE_SIZE           可选，例如 1536x1024
  OPENAI_IMAGE_QUALITY        可选，例如 high
  OPENAI_IMAGE_FORMAT         可选，例如 png
  OPENAI_BASE_URL             可选，默认 https://api.openai.com/v1
  ALEMBIC_STYLE_REFERENCE_URL 可选，锚点图标准参考 URL
  ILLUSTRATION_PROMPT_EXPORT_DIR 可选，prompt 导出目录
`;
}

function parseArgs(argv) {
  const opts = {
    anchor: false,
    force: false,
    dryRun: false,
    list: false,
    exportPrompts: false,
    noResize: false,
    noExternalRef: false,
    model: DEFAULTS.model,
    size: DEFAULTS.size,
    quality: DEFAULTS.quality,
    format: DEFAULTS.format,
    baseUrl: DEFAULTS.baseUrl,
    resizeWidth: DEFAULTS.resizeWidth,
    referenceUrl: DEFAULTS.referenceUrl,
    exportDir: DEFAULTS.exportDir,
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
    } else if (arg === '--anchor') {
      opts.anchor = true;
    } else if (arg === '--force' || arg === '-f') {
      opts.force = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      opts.dryRun = true;
    } else if (arg === '--list' || arg === '-l') {
      opts.list = true;
    } else if (arg === '--export-prompts' || arg === '--plus-prompts') {
      opts.exportPrompts = true;
    } else if (arg === '--no-resize') {
      opts.noResize = true;
    } else if (arg === '--no-external-ref') {
      opts.noExternalRef = true;
    } else if (arg === '--model' || arg.startsWith('--model=')) {
      opts.model = readValue('--model');
    } else if (arg === '--size' || arg.startsWith('--size=')) {
      opts.size = readValue('--size');
    } else if (arg === '--quality' || arg.startsWith('--quality=')) {
      opts.quality = readValue('--quality');
    } else if (arg === '--format' || arg.startsWith('--format=')) {
      opts.format = readValue('--format');
    } else if (arg === '--base-url' || arg.startsWith('--base-url=')) {
      opts.baseUrl = readValue('--base-url');
    } else if (arg === '--reference-url' || arg.startsWith('--reference-url=')) {
      opts.referenceUrl = readValue('--reference-url');
    } else if (arg === '--export-dir' || arg.startsWith('--export-dir=')) {
      opts.exportDir = readValue('--export-dir');
    } else if (arg === '--resize-width' || arg.startsWith('--resize-width=')) {
      opts.resizeWidth = Number.parseInt(readValue('--resize-width'), 10);
    } else if (/^ch\d\d\/.+/.test(arg)) {
      opts.slugs.push(normalizeSlugTarget(arg));
    } else if (/^ch\d\d$/.test(arg)) {
      opts.chapters.push(arg);
    } else {
      throw new Error(`未知参数: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.resizeWidth) || opts.resizeWidth < 1) {
    throw new Error(`无效的 --resize-width: ${opts.resizeWidth}`);
  }
  opts.format = opts.format.toLowerCase();
  if (opts.format !== 'png') {
    throw new Error('当前仓库图片路径固定为 .png，--format 只能使用 png。');
  }

  opts.baseUrl = opts.baseUrl.replace(/\/$/, '');
  opts.exportDir = path.resolve(ROOT, opts.exportDir);
  return opts;
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
        type: 'illustration',
        label: `${chapter}/${slug}`,
        promptFile,
        outputFile: path.join(IMAGES_DIR, chapter, `${slug}.png`),
      };
    });
}

function anchorTask() {
  return {
    type: 'anchor',
    label: 'style-anchor',
    promptFile: STYLE_ANCHOR_PROMPT,
    outputFile: STYLE_ANCHOR_IMAGE,
  };
}

function exportFileForTask(task, opts) {
  if (task.type === 'anchor') {
    return path.join(opts.exportDir, 'style-anchor.md');
  }

  const chapter = path.basename(path.dirname(task.promptFile));
  const slug = path.basename(task.promptFile, '.md');
  return path.join(opts.exportDir, chapter, `${slug}.md`);
}

async function buildPrompt(task) {
  const suffix = await fs.readFile(STYLE_SUFFIX, 'utf8');
  const content = await fs.readFile(task.promptFile, 'utf8');

  if (task.type === 'anchor') {
    return [
      'Create an original standard style anchor image for AlembicBook.',
      'If a reference image is provided, use it only for visual grammar: whiteboard layout, handwritten technical diagram, colored routing/layer annotations. Do not copy its title, system names, labels, or structure.',
      'ANCHOR CONTENT BRIEF:',
      content,
      'GLOBAL STYLE CONSTRAINTS:',
      suffix,
    ].join('\n\n');
  }

  return [
    'Create an original AlembicBook chapter illustration.',
    'Use the provided style-anchor image only as a visual style reference. Preserve the same notebook family, but follow the chapter content brief below.',
    'CHAPTER CONTENT BRIEF:',
    content,
    'GLOBAL STYLE CONSTRAINTS:',
    suffix,
  ].join('\n\n');
}

async function buildManualPrompt(task, opts) {
  const fullPrompt = await buildPrompt(task);
  const reference = task.type === 'anchor'
    ? (opts.noExternalRef ? 'none' : opts.referenceUrl)
    : rel(STYLE_ANCHOR_IMAGE);

  const referenceNote = task.type === 'anchor'
    ? 'Use the reference image only as a style example. Do not copy its content.'
    : 'Attach the AlembicBook style anchor image as the style reference before generating.';

  return [
    `# AlembicBook Image Prompt: ${task.label}`,
    '',
    `Output target: ${rel(task.outputFile)}`,
    `Canvas: ${opts.size}, landscape`,
    `Reference: ${reference}`,
    '',
    'ChatGPT Plus workflow note:',
    referenceNote,
    'Generate one clean PNG-style image. Keep all visible labels in Chinese unless a technical identifier is required.',
    '',
    '---',
    '',
    fullPrompt,
    '',
  ].join('\n');
}

async function exportPrompts(tasks, opts) {
  console.log(`导出 prompt 到: ${rel(opts.exportDir)}`);
  console.log('');

  for (const task of tasks) {
    const outputFile = exportFileForTask(task, opts);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(outputFile, await buildManualPrompt(task, opts), 'utf8');
    console.log(`${task.label}: ${rel(outputFile)}`);
  }

  console.log('');
  console.log(`完成: ${tasks.length} 个 prompt`);
}

async function getReferences(task, opts) {
  if (task.type === 'anchor') {
    if (opts.noExternalRef || !opts.referenceUrl) return [];
    const ref = await downloadReference(opts.referenceUrl);
    return [ref];
  }

  if (!(await exists(STYLE_ANCHOR_IMAGE))) {
    throw new Error(`缺少锚点图: ${rel(STYLE_ANCHOR_IMAGE)}。请先运行 bash scripts/illustrations.sh --anchor --force`);
  }

  return [{ filePath: STYLE_ANCHOR_IMAGE, mime: 'image/png' }];
}

async function downloadReference(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`无法读取标准参考图 (${response.status}): ${url}`);
  }

  const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
  const ext = extensionForMime(contentType);
  const filePath = path.join(os.tmpdir(), `alembic-style-reference.${ext}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, bytes);
  return { filePath, mime: contentType };
}

function extensionForMime(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

async function generateImage({ prompt, references, outputFile, opts }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY。设置后再执行实际生成，或先使用 --dry-run 预览。');
  }

  if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') {
    throw new Error('当前 Node.js 版本缺少 fetch/FormData/Blob，请使用 Node.js 18+。');
  }

  const endpoint = references.length > 0 ? `${opts.baseUrl}/images/edits` : `${opts.baseUrl}/images/generations`;
  const form = new FormData();
  form.append('model', opts.model);
  form.append('prompt', prompt);
  form.append('size', opts.size);
  form.append('quality', opts.quality);
  form.append('output_format', opts.format);

  if (process.env.OPENAI_IMAGE_BACKGROUND) {
    form.append('background', process.env.OPENAI_IMAGE_BACKGROUND);
  }
  if (process.env.OPENAI_IMAGE_MODERATION) {
    form.append('moderation', process.env.OPENAI_IMAGE_MODERATION);
  }
  if (process.env.OPENAI_IMAGE_COMPRESSION) {
    form.append('output_compression', process.env.OPENAI_IMAGE_COMPRESSION);
  }

  for (const ref of references) {
    const bytes = await fs.readFile(ref.filePath);
    const blob = new Blob([bytes], { type: ref.mime });
    form.append('image', blob, path.basename(ref.filePath));
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Images API 请求失败 (${response.status}): ${summarizeApiError(body)}`);
  }

  const json = await response.json();
  const item = json?.data?.[0];
  if (item?.b64_json) {
    await fs.writeFile(outputFile, Buffer.from(item.b64_json, 'base64'));
    return;
  }

  if (item?.url) {
    const imageResponse = await fetch(item.url);
    if (!imageResponse.ok) {
      throw new Error(`无法下载 API 返回图片 (${imageResponse.status})`);
    }
    await fs.writeFile(outputFile, Buffer.from(await imageResponse.arrayBuffer()));
    return;
  }

  throw new Error(`API 响应中没有图片数据: ${JSON.stringify(json).slice(0, 500)}`);
}

function summarizeApiError(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.message || body.slice(0, 800);
  } catch {
    return body.slice(0, 800);
  }
}

async function resizeImage(filePath, opts) {
  if (opts.noResize) {
    console.log(`  size: ${await fileSize(filePath)} (skip resize)`);
    return;
  }

  if (process.platform !== 'darwin') {
    console.log('  resize: skipped (sips is macOS-only)');
    return;
  }

  try {
    const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', filePath]);
    const currentWidth = Number.parseInt(stdout.match(/pixelWidth:\s*(\d+)/)?.[1] || '', 10);
    if (!Number.isFinite(currentWidth)) {
      console.log('  resize: skipped (cannot read width)');
      return;
    }

    if (currentWidth <= opts.resizeWidth) {
      console.log(`  resize: skipped (${currentWidth}px <= ${opts.resizeWidth}px)`);
      return;
    }

    const before = (await fs.stat(filePath)).size;
    await execFileAsync('sips', ['--resampleWidth', String(opts.resizeWidth), filePath, '--out', filePath]);
    const after = (await fs.stat(filePath)).size;
    console.log(`  resize: ${currentWidth}px -> ${opts.resizeWidth}px, saved ${formatBytes(Math.max(before - after, 0))}`);
  } catch (error) {
    console.log(`  resize: skipped (${error.message})`);
  }
}

async function listStatus(tasks, opts) {
  console.log('Alembic Book 插图状态');
  console.log('');

  const anchorExists = await exists(STYLE_ANCHOR_IMAGE);
  console.log(`anchor: ${rel(STYLE_ANCHOR_IMAGE)} ${anchorExists ? `(${await fileSize(STYLE_ANCHOR_IMAGE)})` : '(missing)'}`);

  if (opts.anchor) return;

  console.log('');
  for (const task of tasks) {
    const outputExists = await exists(task.outputFile);
    console.log(`${outputExists ? 'ready ' : 'todo  '} ${rel(task.outputFile)}${outputExists ? ` (${await fileSize(task.outputFile)})` : ''}`);
  }

  const missing = (await Promise.all(tasks.map((task) => exists(task.outputFile)))).filter((value) => !value).length;
  console.log('');
  console.log(`total: ${tasks.length}, missing: ${missing}, generated: ${tasks.length - missing}`);
}

async function runTask(task, opts, index, total) {
  const outputExists = await exists(task.outputFile);
  if (outputExists && !opts.force) {
    console.log(`[${index}/${total}] skip ${task.label}: ${rel(task.outputFile)} already exists`);
    return 'skipped';
  }

  console.log(`[${index}/${total}] ${opts.force ? 'regenerate' : 'generate'} ${task.label}`);
  console.log(`  prompt: ${rel(task.promptFile)}`);
  console.log(`  output: ${rel(task.outputFile)}`);

  if (opts.dryRun) {
    const refs = task.type === 'anchor'
      ? (opts.noExternalRef ? [] : [{ filePath: opts.referenceUrl, mime: 'image/jpeg' }])
      : [{ filePath: STYLE_ANCHOR_IMAGE, mime: 'image/png' }];
    console.log(`  model: ${opts.model}, size: ${opts.size}, quality: ${opts.quality}, format: ${opts.format}`);
    console.log(`  endpoint: ${refs.length > 0 ? '/images/edits' : '/images/generations'}`);
    console.log(`  refs: ${refs.map((ref) => ref.filePath).join(', ') || 'none'}`);
    return 'dry-run';
  }

  await fs.mkdir(path.dirname(task.outputFile), { recursive: true });

  const backup = `${task.outputFile}.bak`;
  let hasBackup = false;
  if (opts.force && outputExists) {
    await fs.copyFile(task.outputFile, backup);
    hasBackup = true;
    console.log(`  backup: ${rel(backup)}`);
  }

  try {
    const prompt = await buildPrompt(task);
    const references = await getReferences(task, opts);
    await generateImage({ prompt, references, outputFile: task.outputFile, opts });
    await resizeImage(task.outputFile, opts);
    if (hasBackup) await fs.rm(backup, { force: true });
    console.log('  result: ok');
    return 'success';
  } catch (error) {
    if (hasBackup) {
      await fs.copyFile(backup, task.outputFile);
      await fs.rm(backup, { force: true });
      console.log('  restore: restored backup');
    }
    console.log(`  result: failed - ${error.message}`);
    return 'failed';
  }
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

  if (opts.anchor && !(await exists(STYLE_ANCHOR_PROMPT))) {
    throw new Error(`缺少锚点 prompt: ${rel(STYLE_ANCHOR_PROMPT)}`);
  }

  const imageTasks = await collectImageTasks(opts);
  const tasks = opts.anchor ? [anchorTask()] : imageTasks;

  if (!opts.anchor && tasks.length === 0) {
    console.log('没有找到匹配的 prompt 文件');
    return;
  }

  if (opts.list) {
    await listStatus(tasks, opts);
    return;
  }

  if (opts.exportPrompts) {
    await exportPrompts(tasks, opts);
    return;
  }

  const todo = [];
  for (const task of tasks) {
    if (opts.force || !(await exists(task.outputFile))) {
      todo.push(task);
    }
  }

  if (todo.length === 0) {
    console.log(`所有目标均已生成（共 ${tasks.length} 张），无需操作。使用 --force 可重新生成。`);
    return;
  }

  console.log('==========================================');
  console.log(`Alembic Book OpenAI 插图生成`);
  console.log(`待处理: ${todo.length} / ${tasks.length}`);
  console.log(`model: ${opts.model}, size: ${opts.size}, quality: ${opts.quality}`);
  console.log('==========================================');
  console.log('');

  let success = 0;
  let failed = 0;
  let skipped = 0;
  for (let i = 0; i < todo.length; i += 1) {
    const result = await runTask(todo[i], opts, i + 1, todo.length);
    console.log('');
    if (result === 'success' || result === 'dry-run') success += 1;
    if (result === 'failed') failed += 1;
    if (result === 'skipped') skipped += 1;
  }

  console.log('==========================================');
  console.log(opts.dryRun ? `预览完成: ${success} 张` : `完成: 成功 ${success}, 失败 ${failed}, 跳过 ${skipped}`);
  console.log('==========================================');

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
