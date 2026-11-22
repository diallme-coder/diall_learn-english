// src/lib/codeswitch/hallucinations.ts
//
// Denylist of known Whisper silence-hallucination strings: text Whisper
// emits for silent or near-silent audio instead of returning nothing.
// `isLikelyHallucination` is exact-or-contained after normalisation (case,
// accents, punctuation), since Whisper varies casing/punctuation across
// calls. index.ts re-exports this as `isHallucination` per the §6 contract.

const HALLUCINATION_DENYLIST: readonly string[] = [
  "sous-titres réalisés par la communauté d'amara.org",
  "merci d'avoir regardé",
  "sous-titrage st' 501",
  'thanks for watching',
  'subtitles by the amara.org community',
  'subscribe to my channel',
];

function foldForCompare(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ´`]/g, "'") // curly/backtick apostrophes -> '
    .replace(/[.,!?;:…]/g, '') // strip common punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

// A transcript of only repeated ellipsis-like punctuation (e.g. "...",
// ". . .") is also a known hallucination pattern for silent audio.
function isOnlyDots(s: string): boolean {
  const trimmed = s.trim().replace(/…/g, '...');
  if (trimmed.length === 0) return false;
  return /^[.\s]{2,}$/.test(trimmed);
}

export function isLikelyHallucination(text: string): boolean {
  if (isOnlyDots(text)) return true;
  const folded = foldForCompare(text);
  if (folded.length === 0) return false;
  for (const phrase of HALLUCINATION_DENYLIST) {
    const foldedPhrase = foldForCompare(phrase);
    if (folded === foldedPhrase || folded.includes(foldedPhrase)) return true;
  }
  return false;
}
