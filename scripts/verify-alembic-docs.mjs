#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_REPO = 'https://github.com/GxFn/Alembic.git';
const DOC_PREFIXES = [
  'docs/part1/',
  'docs/part2/',
  'docs/part3/',
  'docs/part4/',
  'docs/part5/',
  'docs/part6/',
  'docs/part7/',
  'docs/appendix/',
  'docs/index.md',
  'docs/visual-tour.md',
];

const ALEMBIC_PREFIXES = [
  'bin/',
  'config/',
  'dashboard/',
  'lib/',
  'resources/',
  'skills/',
  'templates/',
  'test/',
  'README.md',
  'README_CN.md',
  'SOUL.md',
  'package.json',
];

const repoRoot = process.cwd();
let args = {};
let docsRoot = '';
let tempRoot = '';
let alembicRoot = '';
let usedClone = false;

try {
  args = parseArgs(process.argv.slice(2));
  docsRoot = path.resolve(repoRoot, args.docs ?? 'docs');

  if (args.local) {
    alembicRoot = path.resolve(repoRoot, args.local);
    if (!existsSync(alembicRoot)) {
      fail(`local Alembic path does not exist: ${alembicRoot}`);
    }
  } else {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), 'alembic-doc-verify-'));
    alembicRoot = path.join(tempRoot, 'Alembic');
    usedClone = true;
    cloneRepo(args.repo ?? DEFAULT_REPO, args.ref, alembicRoot);
  }

  const commit = git(alembicRoot, ['rev-parse', 'HEAD']);
  const dirty = git(alembicRoot, ['status', '--short']);
  const codeFacts = await collectCodeFacts(alembicRoot);
  const chapters = await collectChapterFiles(docsRoot, args.chapter);
  const report = [];

  for (const chapterAbs of chapters) {
    const chapterRel = slash(path.relative(repoRoot, chapterAbs));
    const chapter = await verifyChapter(chapterAbs, chapterRel, alembicRoot);
    report.push(chapter);
  }

  const summary = summarize(report);
  const payload = {
    alembic: {
      source: args.local ? slash(path.relative(repoRoot, alembicRoot)) : (args.repo ?? DEFAULT_REPO),
      commit,
      dirty: dirty.length > 0,
      usedClone,
    },
    codeFacts,
    docsRoot: slash(path.relative(repoRoot, docsRoot)) || '.',
    summary,
    chapters: report,
  };

  printReport(payload);

  if (args.json) {
    await writeFile(path.resolve(repoRoot, args.json), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`\nJSON report written: ${args.json}`);
  }

  if (summary.missing > 0 || summary.outOfRange > 0 || summary.bodyChaptersWithoutAnchors > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = error?.exitCode ?? 2;
} finally {
  if (tempRoot && !args.keep) {
    await rm(tempRoot, { recursive: true, force: true });
  } else if (tempRoot) {
    console.log(`\nKept temp clone: ${tempRoot}`);
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--repo':
        out.repo = requireValue(argv, ++i, arg);
        break;
      case '--ref':
        out.ref = requireValue(argv, ++i, arg);
        break;
      case '--local':
        out.local = requireValue(argv, ++i, arg);
        break;
      case '--docs':
        out.docs = requireValue(argv, ++i, arg);
        break;
      case '--chapter':
        out.chapter = requireValue(argv, ++i, arg);
        break;
      case '--json':
        out.json = requireValue(argv, ++i, arg);
        break;
      case '--keep':
        out.keep = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }
  return out;
}

function requireValue(argv, index, flag) {
  if (!argv[index] || argv[index].startsWith('--')) {
    fail(`${flag} requires a value`);
  }
  return argv[index];
}

function printHelp() {
  console.log(`Usage:
  npm run verify:alembic
  node scripts/verify-alembic-docs.mjs [options]

Options:
  --repo <url>       Alembic remote repo. Default: ${DEFAULT_REPO}
  --ref <ref>        Git ref to verify after clone, such as main or a commit SHA.
  --local <path>     Use an existing local Alembic checkout instead of cloning.
  --docs <path>      Docs directory. Default: docs
  --chapter <path>   Verify a single chapter, for example docs/part3/ch07-lifecycle.md.
  --json <path>      Write a machine-readable report.
  --keep             Keep the temporary clone for inspection.
`);
}

function cloneRepo(repo, ref, dest) {
  run('git', ['clone', '--depth=1', repo, dest], process.cwd());
  if (ref) {
    run('git', ['fetch', '--depth=1', 'origin', ref], dest);
    run('git', ['checkout', 'FETCH_HEAD'], dest);
  }
}

function git(cwd, argsForGit) {
  return run('git', argsForGit, cwd).trim();
}

async function collectCodeFacts(sourceRoot) {
  const facts = {};
  facts.mcpTools = await collectMcpToolFacts(sourceRoot);
  facts.v2Tools = await collectV2ToolFacts(sourceRoot);
  facts.grammars = await collectGrammarFacts(sourceRoot);
  facts.dimensions = await collectDimensionFacts(sourceRoot);
  facts.relations = await collectRelationFacts(sourceRoot);
  facts.enhancementPacks = await collectEnhancementFacts(sourceRoot);
  facts.serviceDomains = await collectServiceDomainFacts(sourceRoot);
  facts.importAliases = await collectImportAliasFacts(sourceRoot);
  facts.database = await collectDatabaseFacts(sourceRoot);
  facts.serviceMap = await collectServiceMapFacts(sourceRoot);
  facts.indexing = await collectIndexingFacts(sourceRoot);
  return facts;
}

async function collectMcpToolFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/external/mcp/tools.ts');
  const text = await readTextIfExists(file);
  const matches = [...text.matchAll(/name:\s*'([^']+)'\s*,\n\s*tier:\s*'([^']+)'/g)].filter((m) =>
    m[1].startsWith('alembic_')
  );
  const names = matches.map((m) => m[1]);
  return {
    count: names.length,
    agent: matches.filter((m) => m[2] === 'agent').length,
    admin: matches.filter((m) => m[2] === 'admin').length,
    names,
  };
}

async function collectV2ToolFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/tools/v2/registry.ts');
  const text = await readTextIfExists(file);
  const toolNames = [
    ...new Set([...text.matchAll(/const\s+[A-Z_]+_SPEC:[\s\S]*?name:\s*'([^']+)'/g)].map((m) => m[1])),
  ];
  const actionNames = [...text.matchAll(/^    ([a-z_]+):\s*\{/gm)].map((m) => m[1]);
  return {
    toolCount: toolNames.length,
    actionCount: actionNames.length,
    tools: toolNames,
    actions: actionNames,
  };
}

async function collectGrammarFacts(sourceRoot) {
  const dir = path.join(sourceRoot, 'resources/grammars');
  const files = existsSync(dir)
    ? (await readdir(dir)).filter((name) => name.endsWith('.wasm')).sort()
    : [];
  return { count: files.length, files };
}

async function collectDimensionFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/domain/dimension/DimensionRegistry.ts');
  const text = await readTextIfExists(file);
  const dimensions = [...text.matchAll(/const\s+\w+:\s*UnifiedDimension\s*=\s*\{([\s\S]*?)\n\};/g)]
    .map((match) => {
      const body = match[1];
      const id = body.match(/id:\s*'([^']+)'/)?.[1];
      const layer = body.match(/layer:\s*'([^']+)'/)?.[1];
      return id && layer ? { id, layer } : null;
    })
    .filter(Boolean);
  const ids = [...new Set(dimensions.map((dimension) => dimension.id))];
  const layers = {
    universal: dimensions.filter((dimension) => dimension.layer === 'universal').length,
    language: dimensions.filter((dimension) => dimension.layer === 'language').length,
    framework: dimensions.filter((dimension) => dimension.layer === 'framework').length,
  };
  return { count: ids.length, layers, ids };
}

async function collectRelationFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/domain/knowledge/values/Relations.ts');
  const text = await readTextIfExists(file);
  const arrayMatch = text.match(/RELATION_BUCKETS\s*=\s*\[([\s\S]*?)\];/);
  const buckets = arrayMatch ? [...arrayMatch[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
  return { count: buckets.length, buckets };
}

async function collectEnhancementFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/core/enhancement/index.ts');
  const text = await readTextIfExists(file);
  const packs = [...text.matchAll(/import\('\.\/([^']+)\.js'\)/g)].map((m) => m[1]).sort();
  return { count: packs.length, packs };
}

async function collectServiceDomainFacts(sourceRoot) {
  const dir = path.join(sourceRoot, 'lib/service');
  const domains = [];
  if (existsSync(dir)) {
    for (const entry of await readdir(dir)) {
      const st = await stat(path.join(dir, entry));
      if (st.isDirectory()) {
        domains.push(entry);
      }
    }
  }
  domains.sort();
  return { count: domains.length, domains };
}

async function collectImportAliasFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'package.json');
  const text = await readTextIfExists(file);
  const pkg = text ? JSON.parse(text) : {};
  const aliases = Object.keys(pkg.imports ?? {}).sort();
  return { count: aliases.length, aliases };
}

async function collectDatabaseFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/infrastructure/database/drizzle/schema.ts');
  const text = await readTextIfExists(file);
  const tables = [...text.matchAll(/export const\s+(\w+)\s*=\s*sqliteTable\(\s*['"]([^'"]+)['"]/g)]
    .map((m) => ({ exportName: m[1], tableName: m[2] }))
    .sort((a, b) => a.tableName.localeCompare(b.tableName));
  const internal = tables.filter((table) => table.tableName === 'schema_migrations');
  return {
    count: tables.length,
    runtimeCount: tables.length - internal.length,
    internalCount: internal.length,
    tables,
  };
}

async function collectServiceMapFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/injection/ServiceMap.ts');
  const text = await readTextIfExists(file);
  const body = text.match(/export interface ServiceMap\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  const keys = [...body.matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*):/gm)].map((m) => m[1]);
  const registeredKeys = await collectDiRegistrationKeys(sourceRoot);
  const keySet = new Set(keys);
  const registeredSet = new Set(registeredKeys);
  return {
    count: keys.length,
    publicCount: keys.filter((key) => !key.startsWith('_')).length,
    internalCount: keys.filter((key) => key.startsWith('_')).length,
    registeredCount: registeredKeys.length,
    registeredNotTyped: registeredKeys.filter((key) => !keySet.has(key)),
    typedPublicNotRegistered: keys.filter((key) => !key.startsWith('_') && !registeredSet.has(key)),
    keys,
    registeredKeys,
  };
}

async function collectDiRegistrationKeys(sourceRoot) {
  const dir = path.join(sourceRoot, 'lib/injection');
  if (!existsSync(dir)) {
    return [];
  }
  const files = [];
  await walkTs(dir, async (abs) => files.push(abs));
  const keys = new Set();
  for (const file of files) {
    const text = await readTextIfExists(file);
    for (const match of text.matchAll(/(?:\b\w+|this)\.(?:singleton|register)\(\s*['"]([^'"]+)['"]/g)) {
      keys.add(match[1]);
    }
  }
  return [...keys].sort();
}

async function collectIndexingFacts(sourceRoot) {
  const file = path.join(sourceRoot, 'lib/infrastructure/vector/IndexingPipeline.ts');
  const text = await readTextIfExists(file);
  const extBlock = text.match(/SCANNABLE_EXTENSIONS\s*=\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? '';
  const extensions = [...extBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  const scanDirsBlock = text.match(/this\.\#scanDirs\s*=\s*options\.scanDirs\s*\|\|\s*\[([\s\S]*?)\];/)?.[1] ?? '';
  const scanDirs = [...scanDirsBlock.matchAll(/'([^']+)'|`([^`]+)`/g)]
    .map((m) => m[1] ?? m[2])
    .sort();
  return { extensionCount: extensions.length, extensions, scanDirs };
}

async function readTextIfExists(file) {
  if (!existsSync(file)) {
    return '';
  }
  return readFile(file, 'utf8');
}

function run(cmd, cmdArgs, cwd) {
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const details = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    fail(`${cmd} ${cmdArgs.join(' ')} failed${details ? `\n${details}` : ''}`);
  }
  return result.stdout;
}

async function collectChapterFiles(root, chapterArg) {
  if (chapterArg) {
    const abs = path.resolve(repoRoot, chapterArg);
    if (!existsSync(abs)) {
      fail(`chapter does not exist: ${chapterArg}`);
    }
    return [abs];
  }

  const files = [];
  await walk(root, async (abs) => {
    const rel = slash(path.relative(repoRoot, abs));
      if (DOC_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix))) {
        files.push(abs);
      }
  });
  return files.sort();
}

async function walk(absDir, onFile) {
  for (const entry of await readdir(absDir)) {
    const abs = path.join(absDir, entry);
    const st = await stat(abs);
    if (st.isDirectory()) {
      if (['.vitepress', '_generated', 'public', 'sync'].includes(entry)) {
        continue;
      }
      await walk(abs, onFile);
    } else if (entry.endsWith('.md')) {
      await onFile(abs);
    }
  }
}

async function walkTs(absDir, onFile) {
  for (const entry of await readdir(absDir)) {
    const abs = path.join(absDir, entry);
    const st = await stat(abs);
    if (st.isDirectory()) {
      await walkTs(abs, onFile);
    } else if (entry.endsWith('.ts')) {
      await onFile(abs);
    }
  }
}

async function verifyChapter(chapterAbs, chapterRel, sourceRoot) {
  const text = await readFile(chapterAbs, 'utf8');
  const lines = text.split(/\r?\n/);
  const headings = collectHeadings(lines);
  const anchors = extractAnchors(text, lines, headings);
  const checks = [];

  for (const anchor of anchors) {
    const resolved = await resolveAnchor(sourceRoot, anchor.path);
    const exists = resolved.exists;
    let lineCount = 0;
    let outOfRange = false;
    if (exists) {
      if (anchor.targetLine) {
        if (resolved.kind !== 'file') {
          checks.push({ ...anchor, status: 'line-target-not-file', resolvedPath: resolved.path });
          continue;
        }
        lineCount = (await readFile(path.join(sourceRoot, resolved.path), 'utf8')).split(/\r?\n/).length;
        outOfRange = anchor.targetLine > lineCount;
      }
    }
    checks.push({
      ...anchor,
      status: !exists ? 'missing' : outOfRange ? 'line-out-of-range' : statusForResolved(resolved),
      resolvedPath: resolved.path !== anchor.path ? resolved.path : undefined,
      lineCount: lineCount || undefined,
    });
  }

  return {
    chapter: chapterRel,
    title: headings[0]?.title ?? chapterRel,
    bodyChapter: isBodyChapter(chapterRel),
    anchorCount: checks.length,
    ok: checks.filter((item) => item.status.startsWith('ok')).length,
    missing: checks.filter((item) => item.status === 'missing' || item.status === 'line-target-not-file').length,
    outOfRange: checks.filter((item) => item.status === 'line-out-of-range').length,
    sectionCoverage: summarizeSectionCoverage(headings, checks),
    checks,
  };
}

function collectHeadings(lines) {
  const headings = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (match) {
      headings.push({ line: i + 1, level: match[1].length, title: match[2] });
    }
  }
  return headings;
}

function extractAnchors(text, lines, headings) {
  const anchors = new Map();
  const candidates = [];
  const inlineCode = /`([^`\n]+)`/g;
  for (const match of text.matchAll(inlineCode)) {
    const raw = match[1].trim();
    candidates.push({ raw, index: match.index ?? 0 });
  }

  const pathLike =
    /\b((?:bin|config|dashboard|lib|resources|skills|templates|test)\/[A-Za-z0-9_./@+*{}-]+(?:\.[A-Za-z0-9]+)?\/?(?::\d+)?|README(?:_CN)?\.md|SOUL\.md|package\.json)(?:#L(\d+))?/g;
  for (const match of text.matchAll(pathLike)) {
    if (text[(match.index ?? 0) - 1] === '/') {
      continue;
    }
    candidates.push({ raw: match[0], index: match.index ?? 0 });
  }

  for (const candidate of candidates) {
    const normalized = normalizeAnchor(candidate.raw);
    if (!normalized || !ALEMBIC_PREFIXES.some((prefix) => normalized.path === prefix || normalized.path.startsWith(prefix))) {
      continue;
    }
    const line = lineAtOffset(lines, candidate.index);
    const heading = nearestHeading(headings, line);
    const key = `${normalized.path}:${normalized.targetLine ?? ''}:${line}`;
    anchors.set(key, {
      ...normalized,
      docLine: line,
      section: heading?.title ?? '',
      sectionLine: heading?.line ?? 1,
    });
  }

  return [...anchors.values()].sort((a, b) => a.docLine - b.docLine || a.path.localeCompare(b.path));
}

async function resolveAnchor(sourceRoot, relPath) {
  const exact = path.join(sourceRoot, relPath);
  if (existsSync(exact)) {
    const st = await stat(exact);
    return { exists: true, path: relPath, kind: st.isDirectory() ? 'directory' : 'file' };
  }

  if (relPath.includes('*')) {
    const matched = await globExists(sourceRoot, relPath);
    return matched
      ? { exists: true, path: relPath, kind: 'glob' }
      : { exists: false, path: relPath, kind: 'missing' };
  }

  if (relPath.endsWith('.js')) {
    const tsPath = relPath.slice(0, -3) + '.ts';
    if (existsSync(path.join(sourceRoot, tsPath))) {
      return { exists: true, path: tsPath, kind: 'file', mappedFrom: relPath };
    }
    const tsxPath = relPath.slice(0, -3) + '.tsx';
    if (existsSync(path.join(sourceRoot, tsxPath))) {
      return { exists: true, path: tsxPath, kind: 'file', mappedFrom: relPath };
    }
  }

  if (!relPath.endsWith('/') && !path.extname(relPath)) {
    for (const ext of ['.ts', '.tsx', '.js', '.mjs', '.json']) {
      const candidate = `${relPath}${ext}`;
      if (existsSync(path.join(sourceRoot, candidate))) {
        return { exists: true, path: candidate, kind: 'file', mappedFrom: relPath };
      }
    }
  }

  return { exists: false, path: relPath, kind: 'missing' };
}

async function globExists(sourceRoot, relPattern) {
  const parts = slash(relPattern).split('/');
  async function step(absDir, index) {
    if (index >= parts.length) {
      return existsSync(absDir);
    }
    const part = parts[index];
    if (part.includes('*')) {
      const re = new RegExp(`^${part.split('*').map(escapeRegExp).join('.*')}$`);
      if (!existsSync(absDir)) {
        return false;
      }
      for (const entry of await readdir(absDir)) {
        if (re.test(entry) && (await step(path.join(absDir, entry), index + 1))) {
          return true;
        }
      }
      return false;
    }
    return step(path.join(absDir, part), index + 1);
  }
  return step(sourceRoot, 0);
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function statusForResolved(resolved) {
  if (resolved.mappedFrom) {
    return 'ok-js-to-ts';
  }
  if (resolved.kind === 'directory') {
    return 'ok-dir';
  }
  if (resolved.kind === 'glob') {
    return 'ok-glob';
  }
  return 'ok';
}

function normalizeAnchor(raw) {
  let value = raw.trim();
  if (value.includes('{') || value.includes('}')) {
    return null;
  }
  value = value.replace(/^\/\/\s*/, '');
  value = value.replace(/^['"]|['"]$/g, '');
  value = value.replace(/[),.;，。；：:]+$/u, (suffix) => {
    const lineMatch = suffix.match(/^:(\d+)$/);
    return lineMatch ? suffix : '';
  });
  value = value.replace(/^\.\//, '');

  const hashLine = value.match(/^(.*)#L(\d+)$/);
  if (hashLine) {
    return { path: slash(hashLine[1]), targetLine: Number(hashLine[2]) };
  }

  const colonLine = value.match(/^(.+\.[A-Za-z0-9]+):(\d+)$/);
  if (colonLine) {
    return { path: slash(colonLine[1]), targetLine: Number(colonLine[2]) };
  }

  if (!value.includes('/') && !['README.md', 'README_CN.md', 'SOUL.md', 'package.json'].includes(value)) {
    return null;
  }
  return { path: slash(value) };
}

function lineAtOffset(lines, offset) {
  let cursor = 0;
  for (let i = 0; i < lines.length; i += 1) {
    cursor += lines[i].length + 1;
    if (cursor > offset) {
      return i + 1;
    }
  }
  return lines.length;
}

function nearestHeading(headings, line) {
  let current = null;
  for (const heading of headings) {
    if (heading.line > line) {
      break;
    }
    current = heading;
  }
  return current;
}

function summarizeSectionCoverage(headings, checks) {
  const h2s = headings.filter((heading) => heading.level === 2);
  return h2s.map((heading, index) => {
    const nextLine = h2s[index + 1]?.line ?? Number.POSITIVE_INFINITY;
    const anchors = checks.filter((check) => check.docLine >= heading.line && check.docLine < nextLine);
    return { title: heading.title, line: heading.line, anchors: anchors.length };
  });
}

function isBodyChapter(chapterRel) {
  return /^docs\/part\d+\/ch\d[^/]*\.md$/.test(chapterRel);
}

function summarize(report) {
  return report.reduce(
    (acc, chapter) => {
      acc.chapters += 1;
      acc.anchors += chapter.anchorCount;
      acc.ok += chapter.ok;
      acc.missing += chapter.missing;
      acc.outOfRange += chapter.outOfRange;
      if (chapter.anchorCount === 0) {
        acc.chaptersWithoutAnchors += 1;
      }
      if (chapter.bodyChapter) {
        acc.bodyChapters += 1;
        if (chapter.anchorCount === 0) {
          acc.bodyChaptersWithoutAnchors += 1;
        }
      }
      return acc;
    },
    {
      chapters: 0,
      anchors: 0,
      ok: 0,
      missing: 0,
      outOfRange: 0,
      chaptersWithoutAnchors: 0,
      bodyChapters: 0,
      bodyChaptersWithoutAnchors: 0,
    }
  );
}

function printReport(payload) {
  const { alembic, codeFacts, summary, chapters } = payload;
  console.log(`Alembic source: ${alembic.source}`);
  console.log(`Alembic commit: ${alembic.commit}${alembic.dirty ? ' (dirty)' : ''}`);
  if (codeFacts) {
    console.log(
      `Code facts: ${codeFacts.grammars.count} WASM grammars, ` +
        `${codeFacts.v2Tools.toolCount} V2 tools/${codeFacts.v2Tools.actionCount} actions, ` +
        `${codeFacts.mcpTools.count} MCP tools (${codeFacts.mcpTools.agent} agent + ${codeFacts.mcpTools.admin} admin), ` +
        `${codeFacts.dimensions.count} dimensions, ${codeFacts.relations.count} relation buckets`
    );
    console.log(
      `Code facts: ${codeFacts.serviceDomains.count} service domains, ` +
        `${codeFacts.enhancementPacks.count} enhancement packs, ${codeFacts.importAliases.count} import aliases`
    );
    console.log(
      `Code facts: ${codeFacts.database.count} database tables ` +
        `(${codeFacts.database.runtimeCount} runtime + ${codeFacts.database.internalCount} internal), ` +
        `${codeFacts.serviceMap.registeredCount} DI registrations ` +
        `(${codeFacts.serviceMap.publicCount} typed public + ` +
        `${codeFacts.serviceMap.registeredNotTyped.length} untyped registered), ` +
        `${codeFacts.indexing.extensionCount} indexable extensions`
    );
  }
  console.log(
    `Docs checked: ${summary.chapters} chapters, ${summary.anchors} anchors, ${summary.ok} ok, ${summary.missing} missing, ${summary.outOfRange} line out of range`
  );
  if (summary.bodyChaptersWithoutAnchors > 0) {
    console.log(
      `Evidence check: ${summary.bodyChaptersWithoutAnchors}/${summary.bodyChapters} body chapters have zero Alembic source anchors`
    );
  } else {
    console.log(`Evidence check: ${summary.bodyChapters}/${summary.bodyChapters} body chapters have Alembic source anchors`);
  }

  for (const chapter of chapters) {
    const evidenceFail = chapter.bodyChapter && chapter.anchorCount === 0;
    const mark = chapter.missing || chapter.outOfRange || evidenceFail ? 'FAIL' : 'OK';
    console.log(`\n[${mark}] ${chapter.chapter}`);
    console.log(`  anchors: ${chapter.anchorCount}, ok: ${chapter.ok}, missing: ${chapter.missing}, line-out-of-range: ${chapter.outOfRange}`);
    if (evidenceFail) {
      console.log('  evidence: body chapter has no Alembic source anchors');
    }
    for (const check of chapter.checks) {
      const status = check.status.startsWith('ok') ? check.status : `!! ${check.status}`;
      const target = check.targetLine ? `${check.path}:${check.targetLine}` : check.path;
      const mapped = check.resolvedPath ? ` => ${check.resolvedPath}` : '';
      console.log(`  ${status} ${chapter.chapter}:${check.docLine} (${check.section}) -> ${target}${mapped}`);
    }
  }
}

function slash(value) {
  return value.split(path.sep).join('/');
}

function fail(message) {
  const error = new Error(`[verify:alembic] ${message}`);
  error.exitCode = 2;
  throw error;
}
