// src/lib/levels/scaffolding.ts: pure helpers mapping a CEFRLevel to its
// practice-mode config. No side effects; the UI reads this to decide what
// to render and in which language, it never computes it itself.

import { SHADOWING_PLAYBACK_RATE, type CEFRLevel, type PracticeMode, type WordScoreStatus } from '../types.ts';

/** Chrome language: A1-A2 French, B1-B2 bilingual, C1 English (01-brief-and-principles.md §4). */
export type ChromeLanguageMode = 'fr' | 'bi' | 'en';

export interface ShadowingScaffolding {
  normalRate: typeof SHADOWING_PLAYBACK_RATE;
  slowRate: 0.6;
  highlightStatuses: readonly WordScoreStatus[];
  translationAlwaysVisible: true;
}

export interface RoleplayScaffolding {
  hintTriadSize: 3;
  explanationOnTap: true;
  sideCardsLive: true;
}

export interface DebateScaffolding {
  liveSideCards: false; // Franglais still caught, shown only in post-call review
  idiomsEnabled: true;
}

export interface ScaffoldingConfig {
  level: CEFRLevel;
  mode: PracticeMode;
  chrome: ChromeLanguageMode;
  shadowing: ShadowingScaffolding | null;
  roleplay: RoleplayScaffolding | null;
  debate: DebateScaffolding | null;
}

export function defaultModeFor(level: CEFRLevel): PracticeMode {
  if (level === 'A1' || level === 'A2') return 'shadowing';
  if (level === 'B1' || level === 'B2') return 'roleplay';
  return 'debate';
}

function chromeFor(level: CEFRLevel): ChromeLanguageMode {
  if (level === 'A1' || level === 'A2') return 'fr';
  if (level === 'B1' || level === 'B2') return 'bi';
  return 'en';
}

export function scaffoldingFor(level: CEFRLevel): ScaffoldingConfig {
  const mode = defaultModeFor(level);
  const chrome = chromeFor(level);

  if (mode === 'shadowing') {
    return {
      level,
      mode,
      chrome,
      shadowing: {
        normalRate: SHADOWING_PLAYBACK_RATE,
        slowRate: 0.6,
        highlightStatuses: ['ok', 'warn', 'error', 'unsure'],
        translationAlwaysVisible: true,
      },
      roleplay: null,
      debate: null,
    };
  }
  if (mode === 'roleplay') {
    return {
      level,
      mode,
      chrome,
      shadowing: null,
      roleplay: { hintTriadSize: 3, explanationOnTap: true, sideCardsLive: true },
      debate: null,
    };
  }
  return {
    level,
    mode,
    chrome,
    shadowing: null,
    roleplay: null,
    debate: { liveSideCards: false, idiomsEnabled: true },
  };
}
