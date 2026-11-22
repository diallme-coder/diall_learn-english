#!/usr/bin/env node
// scripts/check-docs.mjs: every var name in .env.example must appear in
// README.md (plan §7 unit A step 9; plan §9). README.md is written by unit
// I, late in the build, so this script skips gracefully (clear message,
// exit 0) when README.md does not exist yet rather than crashing.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseEnvVarNames(envExampleSource) {
  const names = [];
  for (const rawLine of envExampleSource.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m) names.push(m[1]);
  }
  return names;
}

/**
 * @returns {{ status: 'no-readme' } | { status: 'ok' } | { status: 'missing'; missing: string[] }}
 */
export function checkDocs(rootDir) {
  const envExamplePath = join(rootDir, '.env.example');
  const readmePath = join(rootDir, 'README.md');

  if (!existsSync(envExamplePath)) {
    // Nothing to check yet; unit 0/A hasn't landed .env.example.
    return { status: 'ok' };
  }
  if (!existsSync(readmePath)) {
    return { status: 'no-readme' };
  }

  const names = parseEnvVarNames(readFileSync(envExamplePath, 'utf8'));
  const readme = readFileSync(readmePath, 'utf8');
  const missing = names.filter((name) => !readme.includes(name));

  return missing.length > 0 ? { status: 'missing', missing } : { status: 'ok' };
}

function main() {
  const rootDir = process.cwd();
  const result = checkDocs(rootDir);
  if (result.status === 'no-readme') {
    console.log(
      '[check-docs] README.md does not exist yet (written by unit I); skipping the .env.example cross-check.',
    );
    return;
  }
  if (result.status === 'missing') {
    for (const name of result.missing) {
      console.error(`[check-docs] ${name} is in .env.example but not documented in README.md`);
    }
    console.error(`\ncheck-docs: ${result.missing.length} undocumented env var(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('check-docs: OK (every .env.example var is documented in README.md, or nothing to check yet).');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
