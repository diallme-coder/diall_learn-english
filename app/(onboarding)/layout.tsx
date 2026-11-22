import type { ReactNode } from 'react';
import { AppProviders } from '../../src/components/core/providers.tsx';

// app/(onboarding)/layout.tsx: first-run shell — no tab bar, no offline banner chrome
// (design 03 §2): just the step content, full width.
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <main className="page">{children}</main>
    </AppProviders>
  );
}
