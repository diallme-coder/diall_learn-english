'use client';

// src/components/core/providers.tsx: the one place H2/H3 screens get their shared client
// singletons (auth, API, local store, outbox) from. Each route-group layout mounts its own
// <AppProviders> (we don't own the root app/layout.tsx), but every instance reads the same
// persisted storage (localStorage for auth/outbox, IndexedDB for the local store), so state
// survives navigation between route groups even though the React context tree itself does not.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createApiClient, type ApiClient } from '../../client/api.ts';
import { createAuthClient, type AuthClient, type AuthSession } from '../../client/auth.ts';
import { createIndexedDbStorage, createLocalStore, type LocalStore } from '../../client/localStore.ts';
import { drainOutbox, scheduleNextDrain } from '../../client/sync.ts';
import {
  emptyUserLocalState,
  GUEST_KEY,
  type LocalStoreAction,
  type LocalStoreState,
  type UserLocalState,
} from '../../lib/ui/localStoreReducers.ts';
import { addToOutbox, EMPTY_OUTBOX, type OutboxState } from '../../lib/ui/outbox.ts';
import type { ClientProgressEvent, ProfileSettings } from '../../lib/types.ts';

const DEFAULT_SETTINGS: ProfileSettings = {
  captionsOn: true,
  playbackRate: 0.85,
  textAnswerMode: false,
  sideCardAutoCollapse: true,
  silenceAnnouncementsWhileRecording: false,
};

const OUTBOX_STORAGE_KEY = 'pts:outbox';

/** Mirrors localStoreReducers.ts's own (private) `keyFor`/`bucketFor`: userId or the guest key. */
function bucketForUser(state: LocalStoreState, userId: string | null): UserLocalState {
  return state[userId ?? GUEST_KEY] ?? emptyUserLocalState();
}

function loadOutbox(): OutboxState {
  if (typeof window === 'undefined') return EMPTY_OUTBOX;
  try {
    const raw = window.localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw === null ? EMPTY_OUTBOX : (JSON.parse(raw) as OutboxState);
  } catch {
    return EMPTY_OUTBOX;
  }
}

function saveOutbox(state: OutboxState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(state));
}

interface AppShellValue {
  api: ApiClient;
  auth: AuthClient;
  session: AuthSession | null;
  userId: string | null;
  localState: LocalStoreState;
  bucket: UserLocalState;
  settings: ProfileSettings;
  dispatchLocal: (action: LocalStoreAction) => void;
  refreshSession: () => void;
  /** Queues a progress event through H1's outbox reducer and attempts an immediate drain. */
  enqueueEvent: (event: ClientProgressEvent) => void;
}

const AppShellContext = createContext<AppShellValue | null>(null);

/** Reads the two browser-exposed Supabase vars Next.js inlines at build time for client bundles. */
function readPublicEnv(): { url: string; apiKey: string } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    apiKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  };
}

export function AppProviders({ children }: { children: ReactNode }) {
  const auth = useMemo(() => {
    const { url, apiKey } = readPublicEnv();
    return createAuthClient({
      supabaseUrl: url,
      apiKey,
      storage: typeof window === 'undefined' ? undefined : window.localStorage,
    });
  }, []);

  const api = useMemo(() => createApiClient({ getAccessToken: () => auth.getAccessToken() }), [auth]);

  const localStoreRef = useMemo<LocalStore>(
    () => createLocalStore(createIndexedDbStorage('pts-local-store', 'kv')),
    [],
  );

  const [session, setSession] = useState<AuthSession | null>(null);
  const [localState, setLocalState] = useState<LocalStoreState>(localStoreRef.getState());
  const [outbox, setOutbox] = useState<OutboxState>(EMPTY_OUTBOX);
  const attemptRef = useRef(0);

  const refreshSession = useCallback(() => setSession(auth.getSession()), [auth]);

  const drain = useCallback(
    (state: OutboxState) => {
      void drainOutbox(state, { postProgress: api.postProgress, setTimeout }).then((next) => {
        setOutbox(next);
        saveOutbox(next);
        if (next.items.length > 0) {
          attemptRef.current += 1;
          scheduleNextDrain({ postProgress: api.postProgress, setTimeout }, attemptRef.current, () => drain(next));
        } else {
          attemptRef.current = 0;
        }
      });
    },
    [api],
  );

  useEffect(() => {
    refreshSession();
    void localStoreRef.load().then(setLocalState);
    const loaded = loadOutbox();
    setOutbox(loaded);
    if (loaded.items.length > 0) drain(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSession, localStoreRef]);

  const dispatchLocal = useCallback(
    (action: LocalStoreAction) => {
      void localStoreRef.dispatch(action).then(setLocalState);
    },
    [localStoreRef],
  );

  const enqueueEvent = useCallback(
    (event: ClientProgressEvent) => {
      const next = addToOutbox(outbox, event);
      setOutbox(next);
      saveOutbox(next);
      if (session) drain(next);
    },
    [outbox, session, drain],
  );

  const userId = session?.userId ?? null;
  const bucket = bucketForUser(localState, userId);
  const settings: ProfileSettings = { ...DEFAULT_SETTINGS, ...bucket.settings };

  const value: AppShellValue = {
    api,
    auth,
    session,
    userId,
    localState,
    bucket,
    settings,
    dispatchLocal,
    refreshSession,
    enqueueEvent,
  };

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell(): AppShellValue {
  const value = useContext(AppShellContext);
  if (value === null) throw new Error('useAppShell must be used within <AppProviders>');
  return value;
}
