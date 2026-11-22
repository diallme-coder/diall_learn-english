// src/lib/levels/feedback.ts: parses the LLM's debate-feedback JSON.
//
// codeSwitchCards is NOT filled here: it is attached server-side by unit F,
// which runs unit C's code-switch detector over the raw userTurns. This
// parser always returns codeSwitchCards: [] so the result already satisfies
// the DebateFeedback shape; the caller overwrites that field afterwards.

import {
  FEEDBACK_TAGS,
  isOneOf,
  type DebateFeedback,
  type FeedbackTag,
  type RephraseFeedback,
  type Result,
} from '../types.ts';

const MAX_ITEMS = 8;
const MAX_STRING_CHARS = 400;

function invalid(): Result<DebateFeedback> {
  return { ok: false, error: { code: 'upstream_error', message: 'invalid feedback JSON' } };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1]!.trim() : trimmed;
}

// Anthropic's JSON-mode prefill is a leading '{' the model continues from;
// the chat adapter is supposed to restore it before this parser ever sees
// the text, but tolerate a raw completion that is still missing it.
function withLeadingBrace(text: string): string {
  return text.startsWith('{') ? text : `{${text}`;
}

function isShortString(v: unknown, max = MAX_STRING_CHARS): v is string {
  return typeof v === 'string' && v.length <= max;
}

function isShortStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => isShortString(s));
}

function parseRephraseFeedback(v: unknown): RephraseFeedback | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (!isShortString(o.original) || !isShortString(o.native) || !isShortString(o.explanationFr)) return null;
  if (!Array.isArray(o.tags)) return null;
  const tags: FeedbackTag[] = [];
  for (const t of o.tags) {
    if (typeof t !== 'string' || !isOneOf(FEEDBACK_TAGS, t)) return null;
    tags.push(t);
  }
  return { original: o.original, native: o.native, explanationFr: o.explanationFr, tags };
}

export function parseDebateFeedback(llmRawOutput: string): Result<DebateFeedback> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(withLeadingBrace(stripCodeFence(llmRawOutput)));
  } catch {
    return invalid();
  }
  if (typeof parsed !== 'object' || parsed === null) return invalid();
  const o = parsed as Record<string, unknown>;

  if (!Array.isArray(o.items) || o.items.length > MAX_ITEMS) return invalid();
  const items: RephraseFeedback[] = [];
  for (const raw of o.items) {
    const item = parseRephraseFeedback(raw);
    if (!item) return invalid();
    items.push(item);
  }

  if (!isShortStringArray(o.idiomsUsed)) return invalid();
  if (!isShortStringArray(o.idiomsToTry)) return invalid();
  if (!isShortString(o.summaryFr)) return invalid();

  return {
    ok: true,
    value: {
      items,
      idiomsUsed: o.idiomsUsed,
      idiomsToTry: o.idiomsToTry,
      summaryFr: o.summaryFr,
      codeSwitchCards: [],
    },
  };
}
