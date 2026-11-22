// src/components/conversation/TopicPicker.tsx: debate `?topic=` chooser (plan §7 unit H3). C1
// chrome is English-only (scaffoldingFor('C1').chrome === 'en'), so only `motionEn` is shown —
// `motionFr` exists in the data for scenarios that reuse it at other levels, not for this screen.
'use client';

import type { DebateTopic } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './ScenarioPicker.module.css';

export interface TopicPickerProps {
  topics: readonly DebateTopic[];
  chrome: UiLangMode;
  onPick(id: string): void;
}

export default function TopicPicker({ topics, chrome, onPick }: TopicPickerProps) {
  return (
    <div className="page">
      <h1>{t('navPractice', chrome)}</h1>
      <ul className={styles.list}>
        {topics.map((topic) => (
          <li key={topic.id}>
            <button type="button" className={`btn btn--secondary ${styles.option}`} onClick={() => onPick(topic.id)}>
              <span lang="en">{topic.motionEn}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
