#!/usr/bin/env node
// scripts/gen-icons.mjs: renders simple placeholder PNG icons for
// public/manifest.webmanifest from inline SVG, using the globally installed
// `sharp` (there is no network here, so it cannot be an npm dependency of
// this project; it is resolved from the offline global location). If sharp
// cannot be loaded at all, this step is [MANUAL] (see docs/MANUAL_QA.md):
// the raw SVG sources are still written so the shapes can be inspected.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const BG = '#2454ff';
const FG = '#ffffff';

const OUT_DIR = fileURLToPath(new URL('../public/icons/', import.meta.url));

// name, size, contentScale (fraction of size occupied by the glyph),
// maskable icons keep the glyph well inside the safe zone so platform
// masks (circle, squircle, ...) never clip it.
const ICON_SPECS = [
  { name: 'icon-192', size: 192, contentScale: 0.86 },
  { name: 'icon-512', size: 512, contentScale: 0.86 },
  { name: 'icon-maskable-192', size: 192, contentScale: 0.6 },
  { name: 'icon-maskable-512', size: 512, contentScale: 0.6 },
];

function svgIcon(size, contentScale) {
  const c = size / 2;
  const r = (size * contentScale) / 2;
  const sw = Math.max(1, size * 0.035);
  // A simple mic glyph: a rounded capsule (mic head), a stand arc, a short
  // stem and a base line. Pure shapes, no text, so no font dependency.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  <rect x="${c - r * 0.28}" y="${c - r * 0.75}" width="${r * 0.56}" height="${r * 1.05}" rx="${r * 0.28}" fill="${FG}"/>
  <path d="M ${c - r * 0.55} ${c - r * 0.05} a ${r * 0.55} ${r * 0.55} 0 0 0 ${r * 1.1} 0" fill="none" stroke="${FG}" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${c}" y1="${c + r * 0.5}" x2="${c}" y2="${c + r * 0.78}" stroke="${FG}" stroke-width="${sw}" stroke-linecap="round"/>
  <line x1="${c - r * 0.32}" y1="${c + r * 0.78}" x2="${c + r * 0.32}" y2="${c + r * 0.78}" stroke="${FG}" stroke-width="${sw}" stroke-linecap="round"/>
</svg>`;
}

function loadSharp() {
  const candidates = [
    'sharp',
    '/opt/npm-tools/node_modules/sharp/dist/index.cjs',
    '/opt/npm-tools/node_modules/sharp',
  ];
  for (const id of candidates) {
    try {
      return require(id);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const sharp = loadSharp();

  if (!sharp) {
    console.warn(
      '[gen-icons] sharp is not available; writing SVG sources only. ' +
        'PNG generation is a [MANUAL] step (docs/MANUAL_QA.md).',
    );
  }

  for (const spec of ICON_SPECS) {
    const svg = svgIcon(spec.size, spec.contentScale);
    writeFileSync(new URL(`${spec.name}.svg`, `file://${OUT_DIR}`), svg, 'utf8');
    if (sharp) {
      const png = await sharp(Buffer.from(svg)).resize(spec.size, spec.size).png().toBuffer();
      writeFileSync(new URL(`${spec.name}.png`, `file://${OUT_DIR}`), png);
      console.log(`[gen-icons] wrote ${spec.name}.png (${spec.size}x${spec.size})`);
    }
  }
}

main().catch((err) => {
  console.error('[gen-icons] failed:', err);
  process.exitCode = 1;
});
