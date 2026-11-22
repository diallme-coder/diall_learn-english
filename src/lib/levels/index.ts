// src/lib/levels/index.ts: public API of src/lib/levels (unit E).

export { levelIndex, isAtLeast, compareLevels, nextLevel, prevLevel } from './cefr.ts';
export { PLACEMENT_QUESTIONS } from './placementQuestions.ts';
export { PLACEMENT_TRANSITIONS, scorePlacement, selfSelectPlacement } from './placement.ts';
export { SCENARIOS, getScenario, hintsFor, getHint } from './scenarios.ts';
export { SHADOWING_ITEMS, shadowingFor } from './shadowing.ts';
export { IDIOMS } from './idioms.ts';
export { DEBATE_TOPICS, getTopic } from './debate.ts';
export { parseDebateFeedback } from './feedback.ts';
export {
  defaultModeFor,
  scaffoldingFor,
  type ChromeLanguageMode,
  type ShadowingScaffolding,
  type RoleplayScaffolding,
  type DebateScaffolding,
  type ScaffoldingConfig,
} from './scaffolding.ts';
