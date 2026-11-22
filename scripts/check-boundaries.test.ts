// scripts/check-boundaries.test.ts: one violating fixture and one clean
// fixture per check-boundaries.mjs rule, each built in a fresh temp
// directory (never inside this repo, so the live `check-boundaries.mjs`
// run is unaffected). node:* imports are fine here: this is a *.test.ts
// file (plan §7 rule 3 is explicit about that).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runChecks } from './check-boundaries.mjs';

function withFixture(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'pts-boundaries-'));
  try {
    for (const [relPath, content] of Object.entries(files)) {
      const full = join(root, relPath);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content, 'utf8');
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function rulesIn(root: string): Set<string> {
  return new Set(runChecks(root).map((v) => v.rule));
}

// ───────── rule 1: client file imports src/server / reads non-public env ─────────

test('rule 1 (violating): client component imports src/server and reads a secret env var', () => {
  withFixture(
    {
      'src/components/Bad.tsx': `'use client';\nimport { x } from '../server/thing.ts';\nexport default function Bad() { return process.env.OPENAI_API_KEY ? x : null; }\n`,
      'src/server/thing.ts': `export const x = 1;\n`,
    },
    (root) => assert.ok(rulesIn(root).has('1')),
  );
});

test('rule 1 (clean): client component only reads NEXT_PUBLIC_ env vars', () => {
  withFixture(
    {
      'src/components/Good.tsx': `'use client';\nexport default function Good() { return process.env.NEXT_PUBLIC_FOO ? 1 : null; }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('1')),
  );
});

// ───────── rule 1b: transitive closure through a 2-hop import ─────────

test('rule 1b (violating): client component reaches src/server through a helper (2 hops)', () => {
  withFixture(
    {
      'src/components/Bad.tsx': `'use client';\nimport { helper } from './helper.ts';\nexport default function Bad() { return helper(); }\n`,
      'src/components/helper.ts': `import { serverThing } from '../server/thing.ts';\nexport function helper() { return serverThing; }\n`,
      'src/server/thing.ts': `export const serverThing = 1;\n`,
    },
    (root) => assert.ok(rulesIn(root).has('1b')),
  );
});

test('rule 1b (clean): client component reaches only other client-safe modules', () => {
  withFixture(
    {
      'src/components/Good.tsx': `'use client';\nimport { helper } from './helper.ts';\nexport default function Good() { return helper(); }\n`,
      'src/components/helper.ts': `export function helper() { return 1; }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('1b')),
  );
});

// ───────── rule 2: NEXT_PUBLIC_* naming ─────────

test('rule 2 (violating): a NEXT_PUBLIC_ name contains a forbidden word', () => {
  withFixture(
    { 'src/app-config.ts': `export const NEXT_PUBLIC_OPENAI_KEY = 'x';\n` },
    (root) => assert.ok(rulesIn(root).has('2')),
  );
});

test('rule 2 (clean): NEXT_PUBLIC_ names contain no forbidden word', () => {
  withFixture(
    { 'src/app-config.ts': `export const NEXT_PUBLIC_SUPABASE_URL = 'x';\n` },
    (root) => assert.ok(!rulesIn(root).has('2')),
  );
});

// ───────── rule 3: src/lib bare specifiers / node: / erasable syntax ─────────

test('rule 3 (violating): non-test src/lib imports node: and uses enum + parameter property', () => {
  withFixture(
    {
      'src/lib/foo.ts': `import fs from 'node:fs';\nenum Foo { A, B }\nexport class C { constructor(private x: number) {} }\nexport const y = fs;\n`,
    },
    (root) => assert.ok(rulesIn(root).has('3')),
  );
});

test('rule 3 (clean): non-test src/lib has only relative .ts imports and erasable syntax', () => {
  withFixture(
    {
      'src/lib/foo.ts': `import { bar } from './bar.ts';\nexport const y = bar;\n`,
      'src/lib/bar.ts': `export const bar = 1;\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('3')),
  );
});

test('rule 3 (clean): a *.test.ts file may import node: builtins', () => {
  withFixture(
    { 'src/lib/foo.test.ts': `import { test } from 'node:test';\ntest('x', () => {});\n` },
    (root) => assert.ok(!rulesIn(root).has('3')),
  );
});

// ───────── rule 3b: src/lib import must not resolve into server/client/components/app ─────────

test('rule 3b (violating): src/lib imports a path resolving into src/server', () => {
  withFixture(
    {
      'src/lib/foo.ts': `import { bar } from '../server/bar.ts';\nexport const y = bar;\n`,
      'src/server/bar.ts': `export const bar = 1;\n`,
    },
    (root) => assert.ok(rulesIn(root).has('3b')),
  );
});

test('rule 3b (clean): src/lib only imports other src/lib modules', () => {
  withFixture(
    {
      'src/lib/foo.ts': `import { other } from './other.ts';\nexport const y = other;\n`,
      'src/lib/other.ts': `export const other = 1;\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('3b')),
  );
});

// ───────── rule 3c: non-test src/lib has no process./Buffer/require(/__dirname ─────────

test('rule 3c (violating): non-test src/lib reads process.env', () => {
  withFixture(
    { 'src/lib/foo.ts': `export const y = process.env.FOO;\n` },
    (root) => assert.ok(rulesIn(root).has('3c')),
  );
});

test('rule 3c (clean): non-test src/lib has no Node globals', () => {
  withFixture({ 'src/lib/foo.ts': `export const y = 1;\n` }, (root) => assert.ok(!rulesIn(root).has('3c')));
});

// ───────── rule 4: no dangerouslySetInnerHTML ─────────

test('rule 4 (violating): a component uses dangerouslySetInnerHTML', () => {
  withFixture(
    {
      'src/components/Bad.tsx': `export default function Bad() { return React.createElement('div', { dangerouslySetInnerHTML: { __html: 'x' } }); }\n`,
    },
    (root) => assert.ok(rulesIn(root).has('4')),
  );
});

test('rule 4 (clean): a component renders without dangerouslySetInnerHTML', () => {
  withFixture(
    { 'src/components/Good.tsx': `export default function Good() { return null; }\n` },
    (root) => assert.ok(!rulesIn(root).has('4')),
  );
});

// ───────── rule 5: app/api/**/route.ts shape ─────────

test('rule 5 (violating): route.ts is missing the literal runtime/dynamic exports and handler import', () => {
  withFixture(
    { 'app/api/chat/route.ts': `export async function GET() { return new Response('ok'); }\n` },
    (root) => assert.ok(rulesIn(root).has('5')),
  );
});

test('rule 5 (clean): route.ts has literal runtime/dynamic exports and imports a handler', () => {
  withFixture(
    {
      'app/api/chat/route.ts':
        `import { handleChat } from '../../../src/server/handlers/chat.ts';\n` +
        `export const runtime = 'nodejs';\n` +
        `export const dynamic = 'force-dynamic';\n` +
        `export async function GET(req: Request) { return handleChat(req); }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('5')),
  );
});

// ───────── rule 6: sw.js api/RSC branches call fetch( directly ─────────

const SW_INDIRECT = `
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isApiRequest(url)) {
    event.respondWith(viaWrapper(event.request));
    return;
  }
  if (isRscRequest(event.request, url)) {
    event.respondWith(viaWrapper(event.request));
    return;
  }
});
function isApiRequest(url) { return true; }
function isRscRequest(request, url) { return true; }
function viaWrapper(request) { return fetch(request); }
`;

const SW_DIRECT = `
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (isApiRequest(url)) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (isRscRequest(event.request, url)) {
    event.respondWith(fetch(event.request));
    return;
  }
});
function isApiRequest(url) { return true; }
function isRscRequest(request, url) { return true; }
`;

test('rule 6 (violating): api/RSC branches respond through a wrapper, not fetch( directly', () => {
  withFixture({ 'public/sw.js': SW_INDIRECT }, (root) => assert.ok(rulesIn(root).has('6')));
});

test('rule 6 (clean): api/RSC branches call fetch( directly', () => {
  withFixture({ 'public/sw.js': SW_DIRECT }, (root) => assert.ok(!rulesIn(root).has('6')));
});

// ───────── rule 7: forbidden SDK packages ─────────

test('rule 7 (violating): a file imports the openai package', () => {
  withFixture(
    { 'src/server/adapters/x.ts': `import OpenAI from 'openai';\nexport const x = OpenAI;\n` },
    (root) => assert.ok(rulesIn(root).has('7')),
  );
});

test('rule 7 (clean): no file imports a forbidden SDK package', () => {
  withFixture({ 'src/server/adapters/x.ts': `export const x = 1;\n` }, (root) => assert.ok(!rulesIn(root).has('7')));
});

// ───────── rule 8: hex colours only outside *.module.css / style={{...}} ─────────

test('rule 8 (violating): hex colour in *.module.css and in an inline style', () => {
  withFixture(
    {
      'src/components/Foo.module.css': `.foo { color: #ff0000; }\n`,
      'src/components/Bar.tsx': `export default function Bar() { return React.createElement('div', { style: { color: '#fff' } }); }\n`,
    },
    (root) => assert.ok(rulesIn(root).has('8')),
  );
});

test('rule 8 (clean): colours come from CSS variables, not hex literals', () => {
  withFixture(
    {
      'src/components/Foo.module.css': `.foo { color: var(--color-fg); }\n`,
      'src/components/Bar.tsx': `export default function Bar() { return React.createElement('div', { style: { color: 'var(--color-fg)' } }); }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('8')),
  );
});

// ───────── rule 9: MicButton.tsx has no aria-pressed ─────────

test('rule 9 (violating): MicButton.tsx uses aria-pressed', () => {
  withFixture(
    {
      'src/components/core/MicButton.tsx': `export default function MicButton() { return React.createElement('button', { 'aria-pressed': 'true' }); }\n`,
    },
    (root) => assert.ok(rulesIn(root).has('9')),
  );
});

test('rule 9 (clean): MicButton.tsx exposes state via aria-label instead', () => {
  withFixture(
    {
      'src/components/core/MicButton.tsx': `export default function MicButton() { return React.createElement('button', { 'aria-label': 'Appuie pour parler' }); }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('9')),
  );
});

// ───────── rule 10: no raw diacritic JSX text (copy must be data) ─────────

test('rule 10 (violating): literal JSX text node contains French diacritics', () => {
  withFixture(
    { 'src/components/Foo.tsx': `export default function Foo() { return <p>Bonjour à tous</p>; }\n` },
    (root) => assert.ok(rulesIn(root).has('10')),
  );
});

test('rule 10 (clean): French copy is rendered from a data constant via an expression', () => {
  withFixture(
    {
      'src/components/Foo.tsx': `const LABEL = 'Bonjour à tous';\nexport default function Foo() { return <p>{LABEL}</p>; }\n`,
    },
    (root) => assert.ok(!rulesIn(root).has('10')),
  );
});
