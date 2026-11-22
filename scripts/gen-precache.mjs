#!/usr/bin/env node
// scripts/gen-precache.mjs: runs at `postbuild` (package.json). Reads the
// build manifests Next.js writes under .next/ and rewrites the PRECACHE
// array in public/sw.js between the /*PRECACHE_START*/ /*PRECACHE_END*/
// markers with the app-shell chunks for the shell pages, those pages
// themselves, the manifest and the icons.
//
// This environment cannot run `next build` (no network, plan §3), so the
// pure helpers below are exported and can be exercised against a fixture
// manifest; `main()` only runs when this file is executed directly, and
// falls back to the dev-default (pages-only) list when no build manifest
// exists yet.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEXT_DIR = `${ROOT}/.next`;
const SW_PATH = `${ROOT}/public/sw.js`;

// The app-shell routes kept available offline (plan §7, unit A step 4).
export const SHELL_PAGES = ['/', '/offline', '/drills', '/practice/shadowing', '/pronunciation'];

export const EXTRA_URLS = [
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
];

// URLs that redirect are never precached (the navigation fallback matches
// with `ignoreSearch` instead, so the canonical `/` still serves offline).
export const NEVER_PRECACHE = new Set(['/?source=pwa']);

/**
 * @param {Record<string, unknown> | null} buildManifest .next/build-manifest.json
 * @param {Record<string, unknown> | null} appBuildManifest .next/app-build-manifest.json
 * @param {readonly string[]} pages
 * @returns {string[]} `/_next/...` chunk URLs for the given pages
 */
export function collectChunksForPages(buildManifest, appBuildManifest, pages) {
  const chunks = new Set();

  const pagesMap = /** @type {Record<string, string[]> | undefined} */ (buildManifest?.pages);
  const appPagesMap = /** @type {Record<string, string[]> | undefined} */ (appBuildManifest?.pages);

  for (const page of pages) {
    for (const file of pagesMap?.[page] ?? []) chunks.add(`/_next/${file}`);

    // app-build-manifest.json keys pages by their route file, e.g. "/page"
    // for "/" and "/offline/page" for "/offline".
    const appKey = page === '/' ? '/page' : `${page}/page`;
    for (const file of appPagesMap?.[appKey] ?? []) chunks.add(`/_next/${file}`);
  }

  return [...chunks];
}

/**
 * @param {{ buildManifest: Record<string, unknown> | null; appBuildManifest: Record<string, unknown> | null; pages?: readonly string[]; extraUrls?: readonly string[] }} input
 * @returns {string[]}
 */
export function buildPrecacheList({
  buildManifest,
  appBuildManifest,
  pages = SHELL_PAGES,
  extraUrls = EXTRA_URLS,
}) {
  const chunks = collectChunksForPages(buildManifest, appBuildManifest, pages);
  const urls = new Set([...pages, ...chunks, ...extraUrls]);
  for (const forbidden of NEVER_PRECACHE) urls.delete(forbidden);
  return [...urls];
}

/**
 * @param {string} currentSource
 * @param {readonly string[]} precacheList
 * @returns {string}
 */
export function renderSwSource(currentSource, precacheList) {
  const start = '/*PRECACHE_START*/';
  const end = '/*PRECACHE_END*/';
  const startIdx = currentSource.indexOf(start);
  const endIdx = currentSource.indexOf(end);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error('gen-precache: PRECACHE markers not found in public/sw.js');
  }
  const before = currentSource.slice(0, startIdx + start.length);
  const after = currentSource.slice(endIdx);
  const arrayLiteral = JSON.stringify(precacheList);
  return `${before}\nconst PRECACHE = ${arrayLiteral};\n${after}`;
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const buildManifest = readJsonIfExists(`${NEXT_DIR}/build-manifest.json`);
  const appBuildManifest = readJsonIfExists(`${NEXT_DIR}/app-build-manifest.json`);

  let precacheList;
  if (!buildManifest && !appBuildManifest) {
    console.warn(
      '[gen-precache] no .next build manifest found (no `next build` here); ' +
        'writing the dev-default, pages-only precache list.',
    );
    precacheList = SHELL_PAGES;
  } else {
    precacheList = buildPrecacheList({ buildManifest, appBuildManifest });
  }

  const swSource = readFileSync(SW_PATH, 'utf8');
  writeFileSync(SW_PATH, renderSwSource(swSource, precacheList), 'utf8');
  console.log(`[gen-precache] wrote ${precacheList.length} precache URL(s) into public/sw.js`);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) main();
