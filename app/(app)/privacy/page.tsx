'use client';

// app/(app)/privacy/page.tsx: the honest processor disclosure, retention facts, data export and
// account deletion (design 03, plan H2 review guardrail). NEVER claims audio/transcripts are
// "never shared/stored" by OpenAI/Anthropic — the opposite is stated plainly.
import { useState } from 'react';
import { useAppShell } from '../../../src/components/core/providers.tsx';
import { t } from '../../../src/lib/ui/strings.ts';

export default function PrivacyPage() {
  const { api, session } = useAppShell();
  const [confirmText, setConfirmText] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'done' | 'error'>('idle');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'done' | 'error'>('idle');

  async function handleExport() {
    const result = await api.getPrivacyExport();
    if (!result.ok) {
      setExportStatus('error');
      return;
    }
    const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'parle-to-speak-export.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setExportStatus('done');
  }

  async function handleDelete() {
    if (confirmText !== 'SUPPRIMER') return;
    const result = await api.postPrivacy({ action: 'delete_account', confirm: 'SUPPRIMER' });
    setDeleteStatus(result.ok ? 'done' : 'error');
  }

  return (
    <div>
      <h1>{t('privacyTitle', 'fr')}</h1>
      <p>{t('privacyDisclosure', 'fr')}</p>
      <p>{t('privacyProcessorDisclosure', 'fr')}</p>
      <p>{t('privacyRetentionFacts', 'fr')}</p>

      {!session ? (
        <p className="status-line">{t('privacySignInRequired', 'fr')}</p>
      ) : (
        <>
          <section>
            <h2>{t('privacyExport', 'fr')}</h2>
            <p>{t('privacyExportDescription', 'fr')}</p>
            <button type="button" className="btn" onClick={() => void handleExport()}>
              {t('privacyExport', 'fr')}
            </button>
            {exportStatus === 'done' ? <p role="status">{t('privacyExportDone', 'fr')}</p> : null}
            {exportStatus === 'error' ? <p className="banner" data-kind="error">{t('serverError', 'fr')}</p> : null}
          </section>

          <section>
            <h2>{t('privacyDelete', 'fr')}</h2>
            <p className="banner" data-kind="error">{t('privacyDeleteWarning', 'fr')}</p>
            <label htmlFor="delete-confirm">{t('privacyDeleteConfirm', 'fr')}</label>
            <input id="delete-confirm" type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            <button type="button" className="btn btn--secondary" disabled={confirmText !== 'SUPPRIMER'} onClick={() => void handleDelete()}>
              {t('privacyDeleteSubmit', 'fr')}
            </button>
            {deleteStatus === 'done' ? <p role="status">{t('privacyDeleteDone', 'fr')}</p> : null}
            {deleteStatus === 'error' ? <p className="banner" data-kind="error">{t('serverError', 'fr')}</p> : null}
          </section>
        </>
      )}
    </div>
  );
}
