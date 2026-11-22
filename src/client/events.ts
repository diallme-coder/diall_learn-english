// src/client/events.ts: tiny typed event-name/payload contract shared across client modules
// (and with unit A's service-worker registration code). Exporting the event name as a const
// here, rather than each side hardcoding the string, is how A and H2/H3 agree on it.

/** Fired on `window` when the service worker has a new version waiting to activate. */
export const SW_UPDATE_EVENT = 'pts:sw-update' as const;

export interface SwUpdateEventDetail {
  // The waiting SW's registration is looked up by the listener itself; no payload is required
  // beyond "an update is available", so this stays empty but typed for future fields.
}

export type SwUpdateCustomEvent = CustomEvent<SwUpdateEventDetail>;

/** A minimal, dependency-free typed pub/sub for in-process client events. */
export interface EventBus<Events extends Record<string, unknown>> {
  on<K extends keyof Events>(type: K, listener: (payload: Events[K]) => void): () => void;
  emit<K extends keyof Events>(type: K, payload: Events[K]): void;
}

export function createEventBus<Events extends Record<string, unknown>>(): EventBus<Events> {
  const listeners = new Map<keyof Events, Set<(payload: unknown) => void>>();

  return {
    on(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener as (payload: unknown) => void);
      listeners.set(type, set);
      return () => set.delete(listener as (payload: unknown) => void);
    },
    emit(type, payload) {
      const set = listeners.get(type);
      if (set === undefined) return;
      for (const listener of set) listener(payload);
    },
  };
}
