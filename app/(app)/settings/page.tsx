'use client';

// app/(app)/settings/page.tsx: preferences (design 03's settings notes, plan H2). Every
// ProfileSettings toggle is wired to localStoreReducers + the outbox's `settings_updated`
// event, so a signed-in change also reaches the server, not just this device.
import { useRouter } from 'next/navigation';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { PLAYBACK_RATES, type PlaybackRate, type ProfileSettings } from '../../../src/lib/types.ts';
import { t } from '../../../src/lib/ui/strings.ts';

export default function SettingsPage() {
  const router = useRouter();
  const { settings, dispatchLocal, enqueueEvent, userId, session, auth } = useAppShell();

  function update(partial: Partial<ProfileSettings>) {
    dispatchLocal({ type: 'settings_updated', userId, settings: partial });
    if (session) enqueueEvent({ type: 'settings_updated', eventId: `settings-${Date.now()}`, settings: partial });
  }

  function handleSignOut() {
    auth.signOut();
    router.push('/sign-in');
  }

  return (
    <div>
      <h1>{t('settingsTitle', 'fr')}</h1>

      <section>
        <h2>{t('settingsPlaybackRateLabel', 'fr')}</h2>
        <div className="chip-row">
          {PLAYBACK_RATES.map((rate: PlaybackRate) => (
            <button
              key={rate}
              type="button"
              className="chip"
              aria-pressed={settings.playbackRate === rate}
              onClick={() => update({ playbackRate: rate })}
            >
              {rate === 1 ? t('settingsSpeed1', 'fr') : rate === 0.85 ? t('settingsSpeed085', 'fr') : t('settingsSpeed06', 'fr')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <label>
          <input type="checkbox" checked={settings.captionsOn} onChange={(e) => update({ captionsOn: e.target.checked })} />{' '}
          {t('settingsCaptions', 'fr')}
        </label>
      </section>

      <section>
        <label>
          <input
            type="checkbox"
            checked={settings.textAnswerMode}
            onChange={(e) => update({ textAnswerMode: e.target.checked })}
          />{' '}
          {t('settingsTextAnswerMode', 'fr')}
        </label>
      </section>

      <section>
        <label>
          <input
            type="checkbox"
            checked={settings.sideCardAutoCollapse}
            onChange={(e) => update({ sideCardAutoCollapse: e.target.checked })}
          />{' '}
          {t('settingsSideCardTimeout', 'fr')}
        </label>
      </section>

      <section>
        <label>
          <input
            type="checkbox"
            checked={settings.silenceAnnouncementsWhileRecording}
            onChange={(e) => update({ silenceAnnouncementsWhileRecording: e.target.checked })}
          />{' '}
          {t('settingsSilenceAnnouncements', 'fr')}
        </label>
      </section>

      {session ? (
        <button type="button" className="btn btn--secondary" onClick={handleSignOut}>
          {t('settingsSignOut', 'fr')}
        </button>
      ) : null}
    </div>
  );
}
