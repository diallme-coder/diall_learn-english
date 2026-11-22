#!/usr/bin/env node
// scripts/check-routes.mjs: asserts that every route in design 02 §4, plus
// /privacy, /sign-in and /offline, maps to an existing page.tsx/page.ts,
// and that the 5 API route files exist (plan §7, unit A, step 9).
//
// Route groups (a directory segment wrapped in parentheses, e.g. "(app)")
// do not appear in the URL, so page URLs are computed by walking app/ and
// dropping group segments, rather than string-matching literal paths.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PAGE_ROUTES = [
  '/',
  '/onboarding',
  '/sign-in',
  '/practice',
  '/practice/shadowing',
  '/practice/roleplay',
  '/practice/debate',
  '/drills',
  '/pronunciation',
  '/progress',
  '/settings',
  '/privacy',
  '/offline',
];

export const EXPECTED_API_ROUTES = ['transcribe', 'chat', 'tts', 'progress', 'privacy'];

function isRouteGroup(segment) {
  return /^\(.*\)$/.test(segment);
}

function isPageFile(name) {
  return name === 'page.tsx' || name === 'page.ts';
}

export function collectPageUrls(appDir) {
  const urls = [];
  function walk(dir, segments) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'api') continue; // API routes are checked separately
      if (entry.name.startsWith('_')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const nextSegments = isRouteGroup(entry.name) ? segments : [...segments, entry.name];
        walk(full, nextSegments);
      } else if (isPageFile(entry.name)) {
        urls.push(segments.length === 0 ? '/' : `/${segments.join('/')}`);
      }
    }
  }
  walk(appDir, []);
  return urls;
}

export function checkRoutes(rootDir) {
  const problems = [];
  const appDir = join(rootDir, 'app');
  const pageUrls = new Set(collectPageUrls(appDir));

  for (const route of EXPECTED_PAGE_ROUTES) {
    if (!pageUrls.has(route)) {
      problems.push(`missing page.tsx for route ${route}`);
    }
  }

  for (const name of EXPECTED_API_ROUTES) {
    const routeFile = join(appDir, 'api', name, 'route.ts');
    if (!existsSync(routeFile)) {
      problems.push(`missing app/api/${name}/route.ts`);
    }
  }

  return problems;
}

function main() {
  const rootDir = process.cwd();
  const problems = checkRoutes(rootDir);
  if (problems.length > 0) {
    for (const p of problems) console.error(`[check-routes] ${p}`);
    console.error(`\ncheck-routes: ${problems.length} problem(s) found.`);
    process.exitCode = 1;
  } else {
    console.log('check-routes: OK (every expected route and API route file exists).');
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
