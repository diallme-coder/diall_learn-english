import type { ReactNode } from 'react';
import { AppProviders } from '../../src/components/core/providers.tsx';
import OfflineBanner from '../../src/components/core/OfflineBanner.tsx';

// app/(session)/layout.tsx: full-screen session shell (design 02 §3) — tab bar hidden, a
// single persistent exit ("Terminer") lives inside each session page itself, not here.
export default function SessionLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <OfflineBanner />
      <main className="page">{children}</main>
    </AppProviders>
  );
}
