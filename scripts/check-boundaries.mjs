#!/usr/bin/env node
// scripts/check-boundaries.mjs: static, dependency-free boundary checker
// (plan §7, unit A, step 8). No npm dependencies: plain Node fs/path only,
// so it runs offline with no node_modules.
//
// `runChecks(rootDir)` is the pure entry point tested by
// check-boundaries.test.ts against synthetic fixture trees; `main()` below
// just calls it against the real repo and prints file:line violations.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORED_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'build', '.turbo']);

// ───────── generic helpers ─────────

function walk(dir, exts, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, exts, acc);
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

function safeRead(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function relPath(rootDir, file) {
  return relative(rootDir, file).split('\\').join('/');
}

function isUnderDir(file, rootDir, sub) {
  const rel = relPath(rootDir, file);
  return rel === sub || rel.startsWith(`${sub}/`);
}

function lineAt(source, index) {
  if (index < 0) return 1;
  return source.slice(0, index).split('\n').length;
}

function violation(rule, file, line, message) {
  return { rule, file, line, message };
}

// Blanks out comments and string/template literal *contents* while keeping
// every character position and newline, so regex-based structural checks
// don't fire inside comments or strings, and reported line numbers still
// match the original source.
function stripCommentsAndStrings(source) {
  let result = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === '/' && c2 === '/') {
      while (i < n && source[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && c2 === '*') {
      result += '  ';
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        result += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += '  ';
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      result += quote;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          result += '  ';
          i += 2;
          continue;
        }
        result += source[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += quote;
        i++;
      }
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

// Extracts module specifiers from static import/export-from, dynamic
// import(), and require() calls. Runs against the comment/string-stripped
// source is wrong here (the specifiers themselves are string literals), so
// this runs against the raw source.
function extractImportSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+[^'";]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bexport\s+[^'";]*?\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source))) specifiers.add(m[1]);
  }
  return [...specifiers];
}

function lineOfSpec(source, spec) {
  return lineAt(source, source.indexOf(spec));
}

function resolveFileCandidate(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')];
  for (const c of candidates) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  // The target may not exist yet (another unit's planned file); keep an
  // extension-normalised path so path-shape rules can still match it.
  return /\.tsx?$/.test(base) ? base : `${base}.ts`;
}

function resolveSpecifier(fromFile, specifier, rootDir) {
  if (specifier.startsWith('.')) {
    return resolveFileCandidate(resolve(dirname(fromFile), specifier));
  }
  if (specifier.startsWith('@/')) {
    return resolveFileCandidate(resolve(rootDir, specifier.slice(2)));
  }
  return null; // bare specifier (npm package or node:*): not a repo file
}

function hasUseClientDirective(source) {
  return /^\s*['"]use client['"]/.test(source);
}

function isClientRoot(file, rootDir, source) {
  const rel = relPath(rootDir, file);
  if (rel.startsWith('src/client/') || rel.startsWith('src/components/')) return true;
  return source !== null && hasUseClientDirective(source);
}

function findProcessEnvReads(source) {
  const stripped = stripCommentsAndStrings(source);
  const results = [];
  const re = /\bprocess\.env\.([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(stripped))) results.push({ name: m[1], line: lineAt(source, m.index) });
  return results;
}

function bfsReachable(startFile, rootDir) {
  const visited = new Set([startFile]);
  const queue = [startFile];
  const result = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current !== startFile) result.add(current);
    if (!existsSync(current) || !statSync(current).isFile()) continue;
    const source = safeRead(current);
    if (source === null) continue;
    for (const spec of extractImportSpecifiers(source)) {
      const resolved = resolveSpecifier(current, spec, rootDir);
      if (resolved && !visited.has(resolved)) {
        visited.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return result;
}

// ───────── rule 1 + 1b: client/server boundary ─────────

function checkClientBoundary(files, rootDir) {
  const violations = [];
  for (const file of files) {
    const source = safeRead(file);
    if (source === null) continue;
    if (!isClientRoot(file, rootDir, source)) continue;

    for (const spec of extractImportSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec, rootDir);
      if (resolved && isUnderDir(resolved, rootDir, 'src/server')) {
        violations.push(violation('1', file, lineOfSpec(source, spec), `client file imports src/server: ${spec}`));
      }
    }

    for (const { name, line } of findProcessEnvReads(source)) {
      if (name !== 'NODE_ENV' && !name.startsWith('NEXT_PUBLIC_')) {
        violations.push(
          violation('1', file, line, `client file reads non-public env var process.env.${name}`),
        );
      }
    }

    for (const target of bfsReachable(file, rootDir)) {
      if (isUnderDir(target, rootDir, 'src/server') || isUnderDir(target, rootDir, 'src/lib/prompts')) {
        violations.push(violation('1b', file, 1, `transitively reaches ${relPath(rootDir, target)}`));
      }
    }
  }
  return violations;
}

// ───────── rule 2: NEXT_PUBLIC_* naming ─────────

function checkPublicEnvNaming(files, rootDir) {
  const violations = [];
  const forbidden = ['SECRET', 'SERVICE', 'OPENAI', 'ANTHROPIC'];
  for (const file of files) {
    const source = safeRead(file);
    if (source === null) continue;
    const re = /NEXT_PUBLIC_[A-Z0-9_]*/g;
    let m;
    while ((m = re.exec(source))) {
      const name = m[0];
      if (forbidden.some((bad) => name.includes(bad))) {
        violations.push(violation('2', file, lineAt(source, m.index), `forbidden NEXT_PUBLIC_ name: ${name}`));
      }
    }
  }
  return violations;
}

// ───────── rule 3 / 3b / 3c: src/lib purity ─────────

function findEnumOrNamespace(source) {
  const stripped = stripCommentsAndStrings(source);
  const results = [];
  const re = /\b(enum|namespace)\s+[A-Za-z_$]/g;
  let m;
  while ((m = re.exec(stripped))) results.push({ keyword: m[1], index: m.index });
  return results;
}

function findParameterProperties(source) {
  const stripped = stripCommentsAndStrings(source);
  const results = [];
  const re = /constructor\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(stripped))) {
    if (/\b(public|private|protected|readonly)\s+\w/.test(m[1])) results.push(m.index);
  }
  return results;
}

function findForbiddenNodeGlobals(source) {
  const stripped = stripCommentsAndStrings(source);
  const results = [];
  const patterns = [
    { re: /\bprocess\./g, label: 'process.' },
    { re: /\bBuffer\b/g, label: 'Buffer' },
    { re: /\brequire\(/g, label: 'require(' },
    { re: /\b__dirname\b/g, label: '__dirname' },
  ];
  for (const { re, label } of patterns) {
    let m;
    while ((m = re.exec(stripped))) results.push({ label, index: m.index });
  }
  return results;
}

function checkLibPurity(files, rootDir) {
  const violations = [];
  const libFiles = files.filter((f) => relPath(rootDir, f).startsWith('src/lib/'));

  for (const file of libFiles) {
    const rel = relPath(rootDir, file);
    const isTest = rel.endsWith('.test.ts') || rel.endsWith('.test.tsx');
    const source = safeRead(file);
    if (source === null) continue;

    for (const spec of extractImportSpecifiers(source)) {
      const isRelative = spec.startsWith('.') || spec.startsWith('/');
      const isNodeBuiltin = spec.startsWith('node:');
      if (isRelative) {
        if (!/\.tsx?$/.test(spec)) {
          violations.push(violation('3', file, lineOfSpec(source, spec), `relative import must end in .ts: ${spec}`));
        }
      } else if (isNodeBuiltin) {
        if (!isTest) {
          violations.push(violation('3', file, lineOfSpec(source, spec), `non-test src/lib imports a node: builtin: ${spec}`));
        }
      } else {
        violations.push(violation('3', file, lineOfSpec(source, spec), `bare specifier not allowed in src/lib: ${spec}`));
      }
    }

    for (const { keyword, index } of findEnumOrNamespace(source)) {
      violations.push(violation('3', file, lineAt(source, index), `erasable-syntax violation: ${keyword}`));
    }
    for (const index of findParameterProperties(source)) {
      violations.push(violation('3', file, lineAt(source, index), 'parameter property is not erasable syntax'));
    }

    if (!isTest) {
      for (const { label, index } of findForbiddenNodeGlobals(source)) {
        violations.push(violation('3c', file, lineAt(source, index), `forbidden in non-test src/lib: ${label}`));
      }
    }

    for (const spec of extractImportSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec, rootDir);
      if (
        resolved &&
        ['src/server', 'src/client', 'src/components', 'app'].some((d) => isUnderDir(resolved, rootDir, d))
      ) {
        violations.push(violation('3b', file, lineOfSpec(source, spec), `src/lib import resolves into forbidden dir: ${spec}`));
      }
    }
  }
  return violations;
}

// ───────── rule 4: no dangerouslySetInnerHTML ─────────

function checkNoDangerousHtml(files, rootDir) {
  const violations = [];
  for (const file of files) {
    const source = safeRead(file);
    if (source === null) continue;
    const idx = source.indexOf('dangerouslySetInnerHTML');
    if (idx !== -1) violations.push(violation('4', file, lineAt(source, idx), 'dangerouslySetInnerHTML is forbidden'));
  }
  return violations;
}

// ───────── rule 5: app/api/**/route.ts shape ─────────

function checkApiRoutes(rootDir) {
  const violations = [];
  const apiDir = join(rootDir, 'app', 'api');
  const routeFiles = walk(apiDir, ['.ts']).filter((f) => f.endsWith('route.ts'));
  for (const file of routeFiles) {
    const source = safeRead(file);
    if (source === null) continue;
    if (!/export\s+const\s+runtime\s*=\s*['"]nodejs['"]/.test(source)) {
      violations.push(violation('5', file, 1, "missing literal export const runtime = 'nodejs'"));
    }
    if (!/export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/.test(source)) {
      violations.push(violation('5', file, 1, "missing literal export const dynamic = 'force-dynamic'"));
    }
    const specs = extractImportSpecifiers(source);
    if (!specs.some((s) => /(^|\/)src\/server\/handlers\//.test(s) || /^\.+\/.*handlers\//.test(s))) {
      violations.push(violation('5', file, 1, 'route.ts must import from src/server/handlers/'));
    }
  }
  return violations;
}

// ───────── rule 6: sw.js api/RSC branches call fetch( directly ─────────

function checkSwDirectFetch(rootDir) {
  const violations = [];
  const swPath = join(rootDir, 'public', 'sw.js');
  const source = safeRead(swPath);
  if (source === null) return violations;

  const apiBranch = source.match(/isApiRequest\([^)]*\)\)\s*{([^]*?)\n {2}}/);
  const rscBranch = source.match(/isRscRequest\([^)]*\)\)\s*{([^]*?)\n {2}}/);

  if (!apiBranch || !/\bfetch\(/.test(apiBranch[1])) {
    violations.push(violation('6', swPath, 1, 'the /api/ branch must call fetch( directly'));
  }
  if (!rscBranch || !/\bfetch\(/.test(rscBranch[1])) {
    violations.push(violation('6', swPath, 1, 'the RSC branch must call fetch( directly'));
  }
  return violations;
}

// ───────── rule 7: forbidden SDK packages ─────────

const FORBIDDEN_PACKAGES = ['@supabase/supabase-js', 'openai', '@anthropic-ai/sdk'];

function checkForbiddenPackages(files, rootDir) {
  const violations = [];
  for (const file of files) {
    const source = safeRead(file);
    if (source === null) continue;
    for (const spec of extractImportSpecifiers(source)) {
      if (FORBIDDEN_PACKAGES.includes(spec)) {
        violations.push(violation('7', file, lineOfSpec(source, spec), `forbidden package import: ${spec}`));
      }
    }
  }
  const pkgPath = join(rootDir, 'package.json');
  const pkgSource = safeRead(pkgPath);
  if (pkgSource !== null) {
    try {
      const pkg = JSON.parse(pkgSource);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const name of Object.keys(deps)) {
        if (FORBIDDEN_PACKAGES.includes(name)) {
          violations.push(violation('7', pkgPath, 1, `forbidden package dependency: ${name}`));
        }
      }
    } catch {
      // not our concern here; package.json JSON-validity is unit 0's.
    }
  }
  return violations;
}

// ───────── rule 8: hex colours only outside *.module.css / style={{...}} ─────────

function findInlineStyleBlocks(source) {
  const results = [];
  const re = /style=\{\{/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 2;
    let i = m.index + m[0].length;
    const start = i;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    results.push({ block: source.slice(start, i), index: start });
  }
  return results;
}

function checkHexColours(files, rootDir) {
  const violations = [];
  const hexRe = () => /#[0-9a-fA-F]{3,8}\b/g;
  for (const file of files) {
    const rel = relPath(rootDir, file);
    const source = safeRead(file);
    if (source === null) continue;

    if (rel.endsWith('.module.css')) {
      let m;
      const re = hexRe();
      while ((m = re.exec(source))) {
        violations.push(violation('8', file, lineAt(source, m.index), `hex colour in *.module.css: ${m[0]}`));
      }
      continue;
    }

    if (rel.endsWith('.tsx') || rel.endsWith('.ts')) {
      for (const { block, index } of findInlineStyleBlocks(source)) {
        let m;
        const re = hexRe();
        while ((m = re.exec(block))) {
          violations.push(
            violation('8', file, lineAt(source, index + m.index), `hex colour in style={{...}}: ${m[0]}`),
          );
        }
      }
    }
  }
  return violations;
}

// ───────── rule 9: MicButton.tsx has no aria-pressed ─────────

function checkMicButtonNoAriaPressed(rootDir) {
  const violations = [];
  const file = join(rootDir, 'src', 'components', 'core', 'MicButton.tsx');
  const source = safeRead(file);
  if (source === null) return violations;
  const idx = source.indexOf('aria-pressed');
  if (idx !== -1) violations.push(violation('9', file, lineAt(source, idx), 'MicButton.tsx must not use aria-pressed'));
  return violations;
}

// ───────── rule 10: no raw diacritic JSX text (copy must be data) ─────────

const FR_DIACRITICS_RE = /[àâäéèêëïîôöùûüçœÀÂÄÉÈÊËÏÎÔÖÙÛÜÇŒ]/;

function checkNoRawDiacriticJsxText(files, rootDir) {
  const violations = [];
  for (const file of files) {
    const rel = relPath(rootDir, file);
    if (!(rel.startsWith('app/') || rel.startsWith('src/components/'))) continue;
    if (!rel.endsWith('.tsx') || rel.endsWith('.test.tsx')) continue;
    const source = safeRead(file);
    if (source === null) continue;

    const re = />([^<>{}]+)</g;
    let m;
    while ((m = re.exec(source))) {
      const text = m[1];
      if (!text.trim()) continue;
      if (FR_DIACRITICS_RE.test(text)) {
        violations.push(
          violation('10', file, lineAt(source, m.index + 1), `literal JSX text with French diacritics: ${text.trim()}`),
        );
      }
    }
  }
  return violations;
}

// ───────── orchestrator ─────────

export function runChecks(rootDir) {
  const tsFiles = walk(rootDir, ['.ts', '.tsx']);
  const cssFiles = walk(rootDir, ['.css']);
  const envExample = join(rootDir, '.env.example');

  // scripts/** (this checker's own tooling, including its test fixtures)
  // is exempt from the generic content rules below: check-boundaries.test.ts
  // necessarily contains "bad-looking" example strings (a forbidden
  // NEXT_PUBLIC_ name, dangerouslySetInnerHTML, an `openai` import) as
  // fixture *data* to feed into those same rules, which would otherwise
  // make the checker flag itself. Rules 1/1b/3/3b/3c/5/6 are unaffected:
  // each is already scoped to src/client, src/components, src/lib,
  // app/api or public/sw.js, none of which overlap scripts/.
  const appSourceFiles = tsFiles.filter((f) => !relPath(rootDir, f).startsWith('scripts/'));

  return [
    ...checkClientBoundary(tsFiles, rootDir),
    ...checkPublicEnvNaming(existsSync(envExample) ? [...appSourceFiles, envExample] : appSourceFiles, rootDir),
    ...checkLibPurity(tsFiles, rootDir),
    ...checkNoDangerousHtml(appSourceFiles, rootDir),
    ...checkApiRoutes(rootDir),
    ...checkSwDirectFetch(rootDir),
    ...checkForbiddenPackages(appSourceFiles, rootDir),
    ...checkHexColours([...appSourceFiles, ...cssFiles], rootDir),
    ...checkMicButtonNoAriaPressed(rootDir),
    ...checkNoRawDiacriticJsxText(tsFiles, rootDir),
  ];
}

function main() {
  const rootDir = process.cwd();
  const violations = runChecks(rootDir);
  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`${relPath(rootDir, v.file)}:${v.line}  [rule ${v.rule}] ${v.message}`);
    }
    console.error(`\ncheck-boundaries: ${violations.length} violation(s) found.`);
    process.exitCode = 1;
  } else {
    console.log('check-boundaries: OK (no violations found).');
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
