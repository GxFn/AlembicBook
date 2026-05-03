#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const mapPath = path.join(repoRoot, 'docs/sync/alembic-code-map.json');
const generatedDir = path.join(repoRoot, 'docs/_generated');
const factsPath = path.join(generatedDir, 'alembic-facts.json');
const factsMdPath = path.join(generatedDir, 'alembic-facts.md');
const refPath = path.join(repoRoot, 'docs/sync/alembic-ref.json');

const map = JSON.parse(await readFile(mapPath, 'utf8'));
const alembicRoot = path.resolve(repoRoot, map.alembicRoot ?? '../Alembic');

function git(args) {
  return execFileSync('git', ['-C', alembicRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function safeRead(relPath) {
  const abs = path.join(alembicRoot, relPath);
  if (!existsSync(abs)) {
    return null;
  }
  return readFile(abs, 'utf8');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matches(text, regex) {
  return [...text.matchAll(regex)].map((m) => m[1]);
}

function extractSymbols(text) {
  const exported = [
    ...matches(text, /export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g),
    ...matches(text, /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g),
    ...matches(text, /export\s+const\s+([A-Za-z_$][\w$]*)/g),
    ...matches(text, /export\s+(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/g),
  ];
  const declaredClasses = matches(text, /\bclass\s+([A-Za-z_$][\w$]*)/g);
  const declaredFunctions = matches(text, /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g);
  const methods = matches(
    text,
    /^\s*(?:async\s+)?(?:#)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{]+)?\{/gm
  ).filter((name) => !['if', 'for', 'while', 'switch', 'catch', 'function'].includes(name));
  const constants = matches(text, /\bconst\s+([A-Z][A-Z0-9_]{2,})\s*=/g);

  return {
    exported: unique(exported).slice(0, 16),
    classes: unique(declaredClasses).slice(0, 12),
    functions: unique(declaredFunctions).slice(0, 12),
    methods: unique(methods).slice(0, 18),
    constants: unique(constants).slice(0, 12),
  };
}

async function summarizeFile(relPath) {
  const text = await safeRead(relPath);
  if (text === null) {
    return { relPath, exists: false };
  }
  return {
    relPath,
    exists: true,
    lineCount: text.split(/\r?\n/).length,
    sha256: createHash('sha256').update(text).digest('hex').slice(0, 16),
    symbols: extractSymbols(text),
    mentions: unique(matches(text, /\b(alembic_[a-z_]+)\b/g)).slice(0, 24),
  };
}

async function listFiles(dirRel, predicate = () => true) {
  const dir = path.join(alembicRoot, dirRel);
  if (!existsSync(dir)) {
    return [];
  }
  const out = [];
  async function walk(abs) {
    for (const name of await readdir(abs)) {
      const child = path.join(abs, name);
      const st = await stat(child);
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === 'out') {
          continue;
        }
        await walk(child);
      } else {
        const rel = path.relative(alembicRoot, child);
        if (predicate(rel)) {
          out.push(rel);
        }
      }
    }
  }
  await walk(dir);
  return out.sort();
}

async function extractMcpFacts() {
  const toolsText = (await safeRead('lib/external/mcp/tools.ts')) ?? '';
  const schemasText = (await safeRead('lib/shared/schemas/mcp-tools.ts')) ?? '';
  const mcpServerText = (await safeRead('lib/external/mcp/McpServer.ts')) ?? '';

  const declaredTools = unique(matches(toolsText, /name:\s*['`](alembic_[a-z_]+)['`]/g));
  const schemaExports = unique(matches(schemasText, /export\s+const\s+([A-Za-z0-9_]+Input)\b/g));
  const registeredHandlers = unique([
    ...matches(mcpServerText, /['`](alembic_[a-z_]+)['`]/g),
    ...matches(mcpServerText, /^\s*(alembic_[a-z_]+):\s*\(/gm),
  ]);
  const gatewayEntries = [];
  for (const tool of declaredTools) {
    const block = extractGatewayBlock(toolsText, tool);
    if (!block) {
      continue;
    }
    const actions = unique(matches(block, /action:\s*['`]([^'`]+)['`]/g));
    const resources = unique(matches(block, /resource:\s*['`]([^'`]+)['`]/g));
    if (actions.length || resources.length || block.includes('resolver:')) {
      gatewayEntries.push({
        tool,
        action: actions.join(', '),
        resource: resources.join(', '),
        resolver: block.includes('resolver:'),
      });
    }
  }

  return {
    declaredTools,
    registeredHandlers,
    gatewayEntries,
    schemaExports,
  };
}

function extractGatewayBlock(text, tool) {
  const needle = `${tool}:`;
  const start = text.indexOf(needle);
  if (start < 0) {
    return '';
  }
  const braceStart = text.indexOf('{', start);
  if (braceStart < 0) {
    return '';
  }
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(braceStart, i + 1);
      }
    }
  }
  return '';
}

async function extractCliFacts() {
  const cliText = (await safeRead('bin/cli.ts')) ?? '';
  return unique(matches(cliText, /\.command\(\s*['`]([^'`]+)['`]/g)).map((cmd) => ({
    signature: cmd,
    command: cmd.split(/\s+/)[0],
  }));
}

async function extractLifecycleFacts() {
  const lifecycleText = (await safeRead('lib/domain/knowledge/Lifecycle.ts')) ?? '';
  const statePairs = [...lifecycleText.matchAll(/([A-Z_]+):\s*['`]([^'`]+)['`]/g)].map((m) => ({
    name: m[1],
    value: m[2],
  }));
  const transitionBlock =
    lifecycleText.match(/const VALID_TRANSITIONS:[\s\S]*?\};/)?.[0] ?? '';
  const transitions = [...transitionBlock.matchAll(/\[Lifecycle\.([A-Z_]+)\]:\s*\[([^\]]*)\]/g)].map(
    (m) => ({
      from: m[1],
      to: unique(matches(m[2], /Lifecycle\.([A-Z_]+)/g)),
    })
  );
  return { states: statePairs, transitions };
}

async function extractInterfaceFacts() {
  const routeFiles = await listFiles('lib/http/routes', (rel) => rel.endsWith('.ts'));
  const dashboardViews = await listFiles('dashboard/src/components/Views', (rel) => rel.endsWith('.tsx'));
  const vscodeFiles = await listFiles('resources/vscode-ext/src', (rel) => rel.endsWith('.ts'));
  const collectorText = (await safeRead('resources/vscode-ext/src/FileChangeCollector.ts')) ?? '';
  const fileChangeSignals = unique([
    ...matches(collectorText, /\b(onDid[A-Za-z]+)\b/g),
    ...matches(collectorText, /\b(Git HEAD Diff|Working Tree Diff)\b/g),
  ]);
  return {
    routeFiles,
    dashboardViews,
    vscodeFiles,
    fileChangeSignals,
  };
}

async function extractAgentFacts() {
  return {
    profileDefinitions: await listFiles('lib/agent/profiles/definitions', (rel) => rel.endsWith('.ts')),
    v2Capabilities: await listFiles('lib/tools/v2/capabilities', (rel) => rel.endsWith('.ts')),
    v2Handlers: await listFiles('lib/tools/v2/handlers', (rel) => rel.endsWith('.ts')),
    workflowFiles: await listFiles('lib/workflows', (rel) => rel.endsWith('.ts')),
  };
}

const allAnchors = unique(map.chapters.flatMap((chapter) => chapter.anchors ?? []));
const fileFacts = {};
for (const relPath of allAnchors) {
  fileFacts[relPath] = await summarizeFile(relPath);
}

const facts = {
  generatedAt: new Date().toISOString(),
  alembicRoot: path.relative(repoRoot, alembicRoot),
  alembicCommit: git(['rev-parse', 'HEAD']),
  alembicDirty: git(['status', '--short']),
  mapVersion: map.version,
  chapters: map.chapters.map((chapter) => ({
    path: chapter.path,
    title: chapter.title,
    anchorCount: (chapter.anchors ?? []).length,
    missingAnchors: (chapter.anchors ?? []).filter((rel) => !fileFacts[rel]?.exists),
  })),
  fileFacts,
  mcp: await extractMcpFacts(),
  cli: await extractCliFacts(),
  lifecycle: await extractLifecycleFacts(),
  interfaces: await extractInterfaceFacts(),
  agent: await extractAgentFacts(),
};

const missing = Object.values(fileFacts).filter((file) => !file.exists);
await mkdir(generatedDir, { recursive: true });
await mkdir(path.dirname(refPath), { recursive: true });
await writeFile(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
await writeFile(refPath, `${JSON.stringify({
  alembicCommit: facts.alembicCommit,
  alembicDirty: facts.alembicDirty,
  generatedAt: facts.generatedAt,
  mapVersion: facts.mapVersion,
  anchorCount: allAnchors.length,
  missingAnchorCount: missing.length,
}, null, 2)}\n`);

const lines = [];
lines.push('# Alembic Code Facts');
lines.push('');
lines.push('> This file is generated by `npm run sync:facts`; do not edit it by hand.');
lines.push('');
lines.push(`- Alembic commit: \`${facts.alembicCommit}\``);
lines.push(`- Alembic dirty status: ${facts.alembicDirty ? '`dirty`' : '`clean`'}`);
lines.push(`- Code anchors: ${allAnchors.length}`);
lines.push(`- Missing anchors: ${missing.length}`);
lines.push(`- MCP tools: ${facts.mcp.declaredTools.length}`);
lines.push(`- CLI commands: ${facts.cli.length}`);
lines.push(`- HTTP route files: ${facts.interfaces.routeFiles.length}`);
lines.push('');
lines.push('## MCP Tools');
lines.push('');
for (const tool of facts.mcp.declaredTools) {
  const gate = facts.mcp.gatewayEntries.find((entry) => entry.tool === tool);
  lines.push(`- \`${tool}\`${gate ? ` → ${gate.action} / ${gate.resource}` : ''}`);
}
lines.push('');
lines.push('## Chapters');
lines.push('');
for (const chapter of facts.chapters) {
  lines.push(`- \`${chapter.path}\`: ${chapter.anchorCount} anchors${chapter.missingAnchors.length ? `, missing ${chapter.missingAnchors.join(', ')}` : ''}`);
}
await writeFile(factsMdPath, `${lines.join('\n')}\n`);

if (missing.length > 0) {
  console.warn(`[sync:facts] ${missing.length} missing anchors`);
}
console.log(`[sync:facts] Alembic ${facts.alembicCommit}, ${allAnchors.length} anchors, ${facts.mcp.declaredTools.length} MCP tools`);
