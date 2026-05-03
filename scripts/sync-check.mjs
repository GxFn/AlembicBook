#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const map = JSON.parse(await readFile(path.join(repoRoot, 'docs/sync/alembic-code-map.json'), 'utf8'));
const facts = JSON.parse(await readFile(path.join(repoRoot, 'docs/_generated/alembic-facts.json'), 'utf8'));
const alembicRoot = path.resolve(repoRoot, map.alembicRoot ?? '../Alembic');

function git(args) {
  return execFileSync('git', ['-C', alembicRoot, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

async function hashFile(relPath) {
  const abs = path.join(alembicRoot, relPath);
  if (!existsSync(abs)) {
    return null;
  }
  const text = await readFile(abs, 'utf8');
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

const errors = [];
const currentCommit = git(['rev-parse', 'HEAD']);
if (currentCommit !== facts.alembicCommit) {
  errors.push(`Alembic HEAD changed: generated=${facts.alembicCommit}, current=${currentCommit}`);
}

const dirty = git(['status', '--short']);
if (dirty !== facts.alembicDirty) {
  errors.push('Alembic dirty status changed since facts were generated');
}

const anchors = [...new Set(map.chapters.flatMap((chapter) => chapter.anchors ?? []))];
for (const rel of anchors) {
  const generated = facts.fileFacts[rel];
  if (!generated?.exists) {
    errors.push(`Generated facts recorded missing anchor: ${rel}`);
    continue;
  }
  const currentHash = await hashFile(rel);
  if (!currentHash) {
    errors.push(`Current Alembic anchor is missing: ${rel}`);
  } else if (currentHash !== generated.sha256) {
    errors.push(`Alembic anchor changed: ${rel} generated=${generated.sha256}, current=${currentHash}`);
  }
}

if (errors.length) {
  for (const error of errors) {
    console.error(`[sync:check] ${error}`);
  }
  process.exit(1);
}

console.log(`[sync:check] ok: ${anchors.length} anchors match Alembic ${currentCommit}`);
