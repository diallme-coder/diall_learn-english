// src/lib/codeswitch/index.ts
//
// Public API for Unit C (see docs/PLAN.md §6). Internals of this directory
// are free; only these exports are a contract other units may rely on.

export { FR_LEXICON } from './lexicon.ts';
export { EN_FALSE_FRIENDS } from './enFalseFriends.ts';
export { UNTRANSLATABLE } from './untranslatable.ts';
export { detectFrench, analyzeCodeSwitch } from './detector.ts';
export { buildSideCards } from './sidecards.ts';
export { isLikelyHallucination as isHallucination } from './hallucinations.ts';
