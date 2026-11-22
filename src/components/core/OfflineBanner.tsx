'use client';

// src/components/core/OfflineBanner.tsx: the shared offline/update banner (design 03 §0
// "offline" state + plan's SW_UPDATE_EVENT wiring). Listens to the browser's online/offline
// events and to unit A's 'pts:sw-update' CustomEvent (re-exported, typed, from
// src/client/events.ts) for a waiting service worker.
import { useEffect, useState } from 'react';
import { SW_UPDATE_EVENT } from '../../client/events.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';

function reloadForUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.getRegistration().then((registration) => {
    const waiting = registration?.waiting;
    if (!waiting) return;
    waiting.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
  });
}

export default function OfflineBanner({ mode = 'fr' }: { mode?: UiLangMode }) {
  const [offline, setOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(SW_UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(SW_UPDATE_EVENT, onUpdate);
    };
  }, []);

  if (!offline && !updateReady) return null;

  return (
    <div className="banner" role="status" data-kind={offline ? 'offline' : 'update'}>
      <p>{offline ? t('stateOffline', mode) : t('updateAvailable', mode)}</p>
      {updateReady ? (
        <button type="button" className="btn btn--ghost" onClick={reloadForUpdate}>
          {t('updateReload', mode)}
        </button>
      ) : null}
    </div>
  );
}
