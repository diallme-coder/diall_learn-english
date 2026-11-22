// src/lib/pronunciation/index.ts
//
// Public module API (plan §6). Internals of this directory are free to
// change; other units must only import from here.

export { TRAPS, getTrap } from './traps.ts';
export { trapsInWord } from './lexicon.ts';
export { tokenizeWithOffsets } from './tokenize.ts';
export { isSensitiveWord } from './sensitive.ts';
export { scorePronunciation } from './scorer.ts';
export { tipFor } from './tips.ts';
export { MOUTH_DIAGRAMS } from './diagrams.ts';
