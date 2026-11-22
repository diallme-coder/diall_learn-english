// src/lib/ui/localStoreReducers.ts: pure reducers for client-side state keyed BY USER ID.
// A guest's local data (ignored terms, SRS cards, debate reviews, settings) must never silently
// belong to whichever user signs in next, so state is namespaced as `state[userId ?? GUEST_KEY]`,
// and `migrateGuestData` — the only way guest data ever becomes a user's — is called ONLY from an
// explicit confirmation action (e.g. a "keep my progress?" dialog on sign-in). It is never called
// automatically on sign-in.
import type { DebateFeedback, ProfileSettings, SrsCard } from '../types.ts';

export const GUEST_KEY = 'guest';

export interface UserLocalState {
  settings: Partial<ProfileSettings>;
  ignoredTerms: readonly string[];
  srsCards: readonly SrsCard[];
  debateReviews: Readonly<Record<string, DebateFeedback>>;
}

export type LocalStoreState = Readonly<Record<string, UserLocalState>>;

export const EMPTY_LOCAL_STORE: LocalStoreState = {};

export function emptyUserLocalState(): UserLocalState {
  return { settings: {}, ignoredTerms: [], srsCards: [], debateReviews: {} };
}

function keyFor(userId: string | null): string {
  return userId ?? GUEST_KEY;
}

function bucketFor(state: LocalStoreState, userId: string | null): UserLocalState {
  return state[keyFor(userId)] ?? emptyUserLocalState();
}

export type LocalStoreAction =
  | { type: 'settings_updated'; userId: string | null; settings: Partial<ProfileSettings> }
  | { type: 'term_ignored'; userId: string | null; term: string }
  | { type: 'srs_card_upserted'; userId: string | null; card: SrsCard }
  | { type: 'debate_review_saved'; userId: string | null; reviewId: string; feedback: DebateFeedback };

/** Pure reducer: applies one action to the bucket for its own `userId` (or the guest bucket). */
export function reduceLocalStore(state: LocalStoreState, action: LocalStoreAction): LocalStoreState {
  const key = keyFor(action.userId);
  const bucket = bucketFor(state, action.userId);
  const nextBucket = applyToBucket(bucket, action);
  return { ...state, [key]: nextBucket };
}

function applyToBucket(bucket: UserLocalState, action: LocalStoreAction): UserLocalState {
  switch (action.type) {
    case 'settings_updated':
      return { ...bucket, settings: { ...bucket.settings, ...action.settings } };
    case 'term_ignored':
      return bucket.ignoredTerms.includes(action.term)
        ? bucket
        : { ...bucket, ignoredTerms: [...bucket.ignoredTerms, action.term] };
    case 'srs_card_upserted':
      return {
        ...bucket,
        srsCards: [...bucket.srsCards.filter((c) => c.itemId !== action.card.itemId), action.card],
      };
    case 'debate_review_saved':
      return { ...bucket, debateReviews: { ...bucket.debateReviews, [action.reviewId]: action.feedback } };
    default:
      return bucket;
  }
}

/**
 * Moves the guest bucket's data into `toUserId`'s bucket, merging with whatever that user already
 * has (user data wins on conflicts) and clearing the guest bucket. ONLY ever call this from an
 * explicit user-confirmed action — never automatically, e.g. on every sign-in.
 */
export function migrateGuestData(state: LocalStoreState, toUserId: string): LocalStoreState {
  const guest = state[GUEST_KEY];
  if (guest === undefined) return state;
  const existing = state[toUserId] ?? emptyUserLocalState();
  const merged: UserLocalState = {
    settings: { ...guest.settings, ...existing.settings },
    ignoredTerms: Array.from(new Set([...guest.ignoredTerms, ...existing.ignoredTerms])),
    srsCards: [
      ...guest.srsCards.filter((g) => !existing.srsCards.some((e) => e.itemId === g.itemId)),
      ...existing.srsCards,
    ],
    debateReviews: { ...guest.debateReviews, ...existing.debateReviews },
  };
  const { [GUEST_KEY]: _removed, ...rest } = state;
  return { ...rest, [toUserId]: merged };
}
