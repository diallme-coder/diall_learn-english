// src/components/core/localFlags.ts: tiny browser-only flags/fields that don't fit the typed
// per-user local-store buckets (localStoreReducers.ts, owned by H1 — its UserLocalState only
// carries settings/ignoredTerms/srsCards/debateReviews, not level/ageBand/consent). For a
// signed-in learner, level/ageBand/consent live on the server (Profile, via /api/progress and
// /api/privacy); these are only the GUEST-path fallbacks plus the one-device "has onboarding
// ever finished" flag, read directly from localStorage.
import type { AgeBand, CEFRLevel } from '../../lib/types.ts';

export const ONBOARDED_KEY = 'pts:onboarded';
const GUEST_LEVEL_KEY = 'pts:guest-level';
const GUEST_AGE_BAND_KEY = 'pts:guest-age-band';

export function isOnboarded(): boolean {
  if (typeof window === 'undefined') return true; // never redirect during SSR
  return window.localStorage.getItem(ONBOARDED_KEY) === '1';
}

export function markOnboarded(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ONBOARDED_KEY, '1');
}

export function getGuestLevel(): CEFRLevel | null {
  if (typeof window === 'undefined') return null;
  return (window.localStorage.getItem(GUEST_LEVEL_KEY) as CEFRLevel | null) ?? null;
}

export function setGuestLevel(level: CEFRLevel): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_LEVEL_KEY, level);
}

export function getGuestAgeBand(): AgeBand | null {
  if (typeof window === 'undefined') return null;
  return (window.localStorage.getItem(GUEST_AGE_BAND_KEY) as AgeBand | null) ?? null;
}

export function setGuestAgeBand(ageBand: AgeBand): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GUEST_AGE_BAND_KEY, ageBand);
}
