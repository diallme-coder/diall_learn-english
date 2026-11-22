// src/lib/codeswitch/detector.ts
//
// Detects French spans inside an (otherwise English) ASR utterance and
// aggregates the result into a CodeSwitchAnalysis. Never relies on comma
// punctuation (Whisper output is often comma-free), and all span offsets
// refer to the ORIGINAL, un-normalized input string (see normalize.ts).

import type { CodeSwitchAnalysis, DetectedSpan, DetectionReason } from '../types.ts';
import { FR_LEXICON } from './lexicon.ts';
import { ENGLISH_GENRE_PRECEDERS, isHomograph, isLoanword } from './allowlist.ts';
import { containsUntranslatable } from './untranslatable.ts';
import { mapRangeToOriginal, normalizeWithMap, type NormalizedText } from './normalize.ts';
import { buildSideCards, lookupLexiconEntry } from './sidecards.ts';

// ───────── small text helpers (operate on the already-normalized string) ─────────

function isLetterLike(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[a-zà-ÿ']/i.test(ch);
}

const ACCENT_RE = /[àâäéèêëîïôöùûüçœ]/;
function hasAccent(text: string): boolean {
  return ACCENT_RE.test(text);
}

function hasFrenchMorphology(text: string): boolean {
  if (/^(l'|d'|j'|qu')[a-zà-ÿ]{2,}$/.test(text)) return true;
  if (/(ement|eux|euse|oire)$/.test(text)) return true;
  return false;
}

function findBoundaryMatches(haystack: string, needle: string): number[] {
  const starts: number[] = [];
  if (needle.length === 0) return starts;
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    const before = idx > 0 ? haystack[idx - 1] : undefined;
    const after = idx + needle.length < haystack.length ? haystack[idx + needle.length] : undefined;
    if (!isLetterLike(before) && !isLetterLike(after)) starts.push(idx);
    from = idx + 1;
  }
  return starts;
}

interface WordToken { text: string; start: number; end: number }

const WORD_TOKEN_RE = /[a-zà-ÿ]+(?:['-][a-zà-ÿ]+)*/g;
function tokenizeWords(norm: string): WordToken[] {
  const toks: WordToken[] = [];
  for (const m of norm.matchAll(WORD_TOKEN_RE)) {
    toks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

function previousWord(norm: string, pos: number): string | null {
  let i = pos - 1;
  while (i >= 0 && !isLetterLike(norm[i])) i--;
  if (i < 0) return null;
  const end = i + 1;
  while (i >= 0 && isLetterLike(norm[i]) && norm[i] !== ' ') i--;
  return norm.slice(i + 1, end);
}

function isEnglishGenreUse(norm: string, start: number): boolean {
  const prev = previousWord(norm, start);
  if (!prev) return false;
  return ENGLISH_GENRE_PRECEDERS.includes(prev);
}

function isOnlyGapChars(s: string): boolean {
  return s.length > 0 && s.length <= 2 && !/[a-zà-ÿ]/.test(s);
}

interface Candidate { start: number; end: number; confidence: number; reason: DetectionReason }

function isAdjacentToCandidate(norm: string, candidates: readonly Candidate[], start: number, end: number): boolean {
  for (const c of candidates) {
    if (c.end <= start && isOnlyGapChars(norm.slice(c.end, start))) return true;
    if (c.start >= end && isOnlyGapChars(norm.slice(end, c.start))) return true;
  }
  return false;
}

function isProperNounCandidate(original: string, map: NormalizedText, tok: WordToken): boolean {
  const orig = mapRangeToOriginal(map, tok.start, tok.end);
  const ch = original[orig.start] ?? '';
  const isCapital = ch.length > 0 && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  if (!isCapital) return false;
  // Sentence-initial capitalisation (position 0) is normal French/English
  // writing, not a proper noun; only a capitalised MID-sentence token (per
  // allowlist.ts's rule (c)) is treated as a likely proper noun.
  return orig.start > 0;
}

// Lexicon entries normalized once at module load, longest form first so
// phrase matches are tried before any word that is merely a substring of one.
const NORMALIZED_ENTRIES = FR_LEXICON
  .map((entry) => ({ entry, norm: normalizeWithMap(entry.fr).normalized }))
  .filter((e) => e.norm.length > 0)
  .sort((a, b) => b.norm.length - a.norm.length);

/**
 * Finds French spans in `utterance`. Offsets in the returned spans are into
 * the ORIGINAL string (see normalize.ts). `opts.ignoredTerms` (the user's
 * "Ce n'est pas du français" list) suppresses matching terms.
 */
export function detectFrench(
  utterance: string,
  opts?: { ignoredTerms?: readonly string[] },
): DetectedSpan[] {
  const map = normalizeWithMap(utterance);
  const norm = map.normalized;
  const consumed = new Array<boolean>(norm.length).fill(false);
  const markConsumed = (s: number, e: number) => { for (let i = s; i < e; i++) consumed[i] = true; };
  const isFree = (s: number, e: number) => {
    for (let i = s; i < e; i++) if (consumed[i]) return false;
    return true;
  };

  const candidates: Candidate[] = [];

  // Pass 1: definite lexicon/phrase matches (homographs are handled in pass 2).
  for (const { entry, norm: needle } of NORMALIZED_ENTRIES) {
    if (isHomograph(needle)) continue;
    const isGenreFiller = needle === 'genre';
    for (const start of findBoundaryMatches(norm, needle)) {
      const end = start + needle.length;
      if (!isFree(start, end)) continue;
      if (isGenreFiller && isEnglishGenreUse(norm, start)) continue; // ordinary English noun, not French
      const reason: DetectionReason = entry.kind === 'phrase' ? 'phrase' : 'lexicon';
      const confidence = entry.kind === 'phrase' ? 0.95 : 0.85;
      candidates.push({ start, end, confidence, reason });
      markConsumed(start, end);
    }
  }

  // Pass 2: English homographs, re-admitted only next to an already-confirmed span.
  for (const { norm: needle } of NORMALIZED_ENTRIES) {
    if (!isHomograph(needle)) continue;
    for (const start of findBoundaryMatches(norm, needle)) {
      const end = start + needle.length;
      if (!isFree(start, end)) continue;
      if (isAdjacentToCandidate(norm, candidates, start, end)) {
        candidates.push({ start, end, confidence: 0.85, reason: 'lexicon' });
        markConsumed(start, end);
      }
    }
  }

  // Pass 3: diacritic / morphology guesses over whatever free word tokens remain.
  for (const tok of tokenizeWords(norm)) {
    if (!isFree(tok.start, tok.end)) continue;
    if (isLoanword(tok.text)) continue;
    if (isProperNounCandidate(utterance, map, tok)) continue;
    if (hasAccent(tok.text)) {
      candidates.push({ start: tok.start, end: tok.end, confidence: 0.75, reason: 'diacritic' });
      markConsumed(tok.start, tok.end);
      continue;
    }
    if (hasFrenchMorphology(tok.text)) {
      candidates.push({ start: tok.start, end: tok.end, confidence: 0.6, reason: 'morphology' });
      markConsumed(tok.start, tok.end);
    }
  }

  candidates.sort((a, b) => a.start - b.start);

  const ignored = new Set((opts?.ignoredTerms ?? []).map((t) => normalizeWithMap(t).normalized));

  const spans: DetectedSpan[] = [];
  for (const c of candidates) {
    const orig = mapRangeToOriginal(map, c.start, c.end);
    const text = utterance.slice(orig.start, orig.end);
    const normText = normalizeWithMap(text).normalized;
    if (ignored.has(normText)) continue;
    spans.push({ start: orig.start, end: orig.end, text, confidence: c.confidence, reason: c.reason });
  }
  return spans;
}

interface OriginalToken { start: number; end: number }
function tokenizeOriginalWords(original: string): OriginalToken[] {
  const toks: OriginalToken[] = [];
  for (const m of original.matchAll(/\S+/g)) {
    toks.push({ start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

function computeRatios(original: string, spans: readonly DetectedSpan[]) {
  const words = tokenizeOriginalWords(original);
  if (words.length === 0) return { frenchRatio: 0, isMostlyEnglish: true, allFrench: false };
  let frenchCount = 0;
  for (const w of words) {
    if (spans.some((s) => s.start <= w.start && w.end <= s.end)) frenchCount++;
  }
  const frenchRatio = frenchCount / words.length;
  return { frenchRatio, isMostlyEnglish: frenchRatio < 0.5, allFrench: frenchRatio === 1 };
}

/**
 * Full analysis: spans, side cards, French/English ratio and whether the
 * utterance needs a clarifying question instead of a confident card.
 */
export function analyzeCodeSwitch(
  utterance: string,
  opts?: { ignoredTerms?: readonly string[] },
): CodeSwitchAnalysis {
  const spans = detectFrench(utterance, opts);
  const cards = buildSideCards(utterance, spans);
  const { frenchRatio, isMostlyEnglish, allFrench } = computeRatios(utterance, spans);
  const lowConfidenceOrUnmatched = spans.some((s) => s.confidence < 0.7 || !lookupLexiconEntry(s.text));
  const untranslatablePresent = containsUntranslatable(normalizeWithMap(utterance).normalized);
  const needsClarification = lowConfidenceOrUnmatched || untranslatablePresent;
  return { utterance, spans, cards, frenchRatio, isMostlyEnglish, allFrench, needsClarification };
}
