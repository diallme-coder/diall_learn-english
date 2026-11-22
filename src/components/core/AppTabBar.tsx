'use client';

// src/components/core/AppTabBar.tsx: the 4-tab bottom bar (design 02 §3): Accueil/Pratiquer/
// Prononcer/Progrès. Settings is reached via the avatar on Home, not a 5th tab (Hick's law,
// thumb reach). Hidden entirely on (session) full-screen routes (that layout never renders it).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t, type UiLangMode } from '../../lib/ui/strings.ts';
import styles from './AppTabBar.module.css';

interface Tab {
  href: string;
  labelKey: 'navHome' | 'navPractice' | 'navPronounce' | 'navProgress';
  icon: string;
}

const TABS: readonly Tab[] = [
  { href: '/', labelKey: 'navHome', icon: 'M3 11l9-8 9 8M5 10v10h14V10' },
  { href: '/practice', labelKey: 'navPractice', icon: 'M12 3v18M3 12h18' },
  { href: '/pronunciation', labelKey: 'navPronounce', icon: 'M8 10a4 4 0 118 0v4a4 4 0 11-8 0z' },
  { href: '/progress', labelKey: 'navProgress', icon: 'M4 19V9m6 10V5m6 14v-7' },
];

export default function AppTabBar({ mode = 'fr' }: { mode?: UiLangMode }) {
  const pathname = usePathname();

  return (
    <nav className={styles.bar} aria-label={t('navHome', mode)}>
      {TABS.map((tab) => {
        const current = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={styles.tab}
            aria-current={current ? 'page' : undefined}
          >
            <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d={tab.icon} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{t(tab.labelKey, mode)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
