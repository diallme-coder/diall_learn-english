// src/components/conversation/ScenarioPicker.tsx: `?scenario=` chooser (design 02/03, plan §7
// unit H3). Scenario copy (titleEn/titleFr) is content data from src/lib/levels, not chrome, so
// it is rendered directly — never through STRINGS — with matching `lang` attributes (design 05
// §3 line 38).
'use client';

import type { Scenario } from '../../lib/types.ts';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './ScenarioPicker.module.css';

export interface ScenarioPickerProps {
  scenarios: readonly Scenario[];
  chrome: UiLangMode;
  onPick(id: Scenario['id']): void;
}

export default function ScenarioPicker({ scenarios, chrome, onPick }: ScenarioPickerProps) {
  return (
    <div className="page">
      <h1>{t('navPractice', chrome)}</h1>
      <ul className={styles.list}>
        {scenarios.map((scenario) => (
          <li key={scenario.id}>
            <button type="button" className={`btn btn--secondary ${styles.option}`} onClick={() => onPick(scenario.id)}>
              <span>
                <span lang="en">{scenario.titleEn}</span>
                <br />
                <span className={styles.titleFr} lang="fr">
                  {scenario.titleFr}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
