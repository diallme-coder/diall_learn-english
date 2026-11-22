// src/client/localStore.ts: IndexedDB-backed persistence over localStoreReducers.ts. The
// storage backend is injected so the core logic (load/save/dispatch) stays testable without a
// real IndexedDB.
import {
  EMPTY_LOCAL_STORE,
  reduceLocalStore,
  type LocalStoreAction,
  type LocalStoreState,
} from '../lib/ui/localStoreReducers.ts';

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

const STORAGE_KEY = 'pts:local-store';

export interface LocalStore {
  load(): Promise<LocalStoreState>;
  dispatch(action: LocalStoreAction): Promise<LocalStoreState>;
  getState(): LocalStoreState;
}

export function createLocalStore(storage: KeyValueStorage): LocalStore {
  let state: LocalStoreState = EMPTY_LOCAL_STORE;

  async function load(): Promise<LocalStoreState> {
    const raw = await storage.get(STORAGE_KEY);
    if (raw !== null) {
      try {
        state = JSON.parse(raw) as LocalStoreState;
      } catch {
        state = EMPTY_LOCAL_STORE;
      }
    }
    return state;
  }

  async function dispatch(action: LocalStoreAction): Promise<LocalStoreState> {
    state = reduceLocalStore(state, action);
    await storage.set(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  return { load, dispatch, getState: () => state };
}

/** Wraps a real IndexedDB object store as a `KeyValueStorage`, for use in the browser. */
export function createIndexedDbStorage(dbName: string, storeName: string): KeyValueStorage {
  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  return {
    async get(key) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
    },
    async set(key, value) {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).put(value, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };
}
