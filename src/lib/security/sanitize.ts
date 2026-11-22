// src/lib/security/sanitize.ts
//
// Small helpers to clean learner text before it goes into a prompt or into
// stored text, and to flag obvious attempts to smuggle instructions into
// that text. This is BEST-EFFORT, not a full prompt-injection defense: a
// determined attacker can still phrase an override that these patterns
// miss. The real boundary is that prompts always treat learner text as
// data (wrapped and labelled as such) and are built from objects, never
// from the client's own unreviewed instructions — see src/lib/prompts.

const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore (all|any|the)?\s*(previous|above|prior)\s+instructions?/i,
  /disregard (all|any|the)?\s*(previous|above|prior)\s+instructions?/i,
  /forget (everything|all)\s+(you|above|prior)/i,
  /new instructions?\s*:/i,
  /system\s*:/i,
  /you are now\b/i,
  /\bact as\b.*\b(system|developer|admin)\b/i,
];

export function looksLikeInstructionOverride(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

export function stripControlChars(text: string): string {
  // Remove C0 control characters except the ones that matter for prose
  // (tab \t, newline \n, carriage return \r are kept out too, since prompt
  // text is sent as single-line-safe data).
  return text.replace(/[\u0000-\u001f\u007f]/g, '');
}

export function clamp(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** Best-effort: marks any recognised override attempt inline rather than silently dropping learner content. */
export function flagInjectionAttempts(text: string): string {
  let result = text;
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, (match) => `[flagged-text: ${match}]`);
  }
  return result;
}

/** Wraps learner text as data, neutralising any literal occurrence of the wrapper tag so it cannot forge a fake closing tag. */
export function wrapLearnerUtterance(text: string): string {
  const neutralized = text.replace(/<\/?learner_utterance>/gi, '');
  return `<learner_utterance>${neutralized}</learner_utterance>`;
}

/** NFC-normalises, strips control characters, clamps length, then flags override attempts. Used before any learner text reaches a prompt or stored field. */
export function sanitizeForPrompt(raw: string, maxChars: number): string {
  const normalized = raw.normalize('NFC');
  const stripped = stripControlChars(normalized);
  const clamped = clamp(stripped, maxChars);
  return flagInjectionAttempts(clamped);
}
