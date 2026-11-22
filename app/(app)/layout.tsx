import type { ReactNode } from 'react';
import { AppProviders } from '../../src/components/core/providers.tsx';
import AppTabBar from '../../src/components/core/AppTabBar.tsx';
import OfflineBanner from '../../src/components/core/OfflineBanner.tsx';

// app/(app)/layout.tsx: the tabbed shell (Accueil/Pratiquer/Prononcer/Progrès, design 02 §3).
// Settings is reached via the Home header avatar, not a 5th tab.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <OfflineBanner />
      <main className="page">{children}</main>
      <AppTabBar />
    </AppProviders>
  );
}
