'use client';

import { useCallback, useEffect, useState } from 'react';
import { detectInstallContext } from '../../lib/pwa/installPrompt.ts';
import type { InstallContext } from '../../lib/pwa/installPrompt.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Copy lives in local consts rendered through JSX expressions (never as a
// literal JSX text node) so it is unambiguous that it is data, not markup;
// see check-boundaries rule 10.
const PROMPTABLE_COPY = {
  title: "Installer l'application",
  body: 'Ajoute Parle-to-Speak à ton écran d’accueil pour y accéder en un geste.',
  action: 'Installer',
};
const IOS_MANUAL_COPY = {
  title: "Ajoute l'app à ton écran d'accueil",
  body: 'Appuie sur Partager, puis « Sur l’écran d’accueil ».',
};
const CLOSE_LABEL = 'Fermer';

export default function InstallPrompt() {
  const [context, setContext] = useState<InstallContext>('unsupported');
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome|android/i.test(ua);
    const standaloneNav = navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      standaloneNav.standalone === true;

    const recompute = (canPrompt: boolean) =>
      setContext(detectInstallContext({ isStandalone, isIos, isSafari, canPrompt }));

    recompute(false);

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
      recompute(true);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  const handleInstall = useCallback(() => {
    if (!deferredEvent) return;
    void deferredEvent.prompt().then(() => setDeferredEvent(null));
  }, [deferredEvent]);

  if (dismissed || context === 'installed' || context === 'unsupported') return null;

  const copy = context === 'promptable' ? PROMPTABLE_COPY : IOS_MANUAL_COPY;

  return (
    <div role="region" aria-label={copy.title} data-install-context={context}>
      <p>{copy.title}</p>
      <p>{copy.body}</p>
      {context === 'promptable' ? (
        <button type="button" onClick={handleInstall}>
          {PROMPTABLE_COPY.action}
        </button>
      ) : null}
      <button type="button" onClick={() => setDismissed(true)}>
        {CLOSE_LABEL}
      </button>
    </div>
  );
}
