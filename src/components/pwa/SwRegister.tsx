'use client';

import { useEffect } from 'react';

// Registers the service worker in production only, and dispatches
// 'pts:sw-update' on the window when a new worker is waiting to activate
// (OfflineBanner, owned by H2, listens for it).
//
// process.env.NODE_ENV is the one process.env read this file makes; Next.js
// inlines it at build time for client bundles (it is not a runtime secret),
// so check-boundaries treats it as an exception to the "no process.env in
// client code" rule.
export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    function notifyUpdate() {
      window.dispatchEvent(new CustomEvent('pts:sw-update'));
    }

    async function register() {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;

        if (registration.waiting) notifyUpdate();

        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && registration.waiting) {
              notifyUpdate();
            }
          });
        });
      } catch {
        // Registration failures are non-fatal: the app still works online.
      }
    }

    void register();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
