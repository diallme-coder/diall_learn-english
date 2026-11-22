// src/server/adapters/memoryTtsCache.ts
//
// Implements `TtsCache` as a simple in-memory Map, keyed by whatever key
// the caller passes (handlers/tts.ts builds it as `catalog:id`). This is a
// process-lifetime cache with no eviction: fine for the fixed, small TTS
// catalog this app serves, but a real deployment with multiple server
// instances or restarts should replace this with a CDN/blob store behind
// the same `TtsCache` interface — the cache would otherwise sit cold again
// on every cold start / instance, and is never shared across instances.

import type { TtsCache } from '../../lib/types.ts';

export function createMemoryTtsCache(): TtsCache {
  const store = new Map<string, Uint8Array>();
  return {
    async get(key: string): Promise<Uint8Array | null> {
      return store.get(key) ?? null;
    },
    async set(key: string, bytes: Uint8Array): Promise<void> {
      store.set(key, bytes);
    },
  };
}
