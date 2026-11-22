import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import SwRegister from '../src/components/pwa/SwRegister';
import '../src/styles/tokens.css';
import '../src/styles/globals.css';

export const metadata: Metadata = {
  title: 'Parle-to-Speak',
  description:
    'Un entraîneur vocal pour parler anglais, pensé pour les francophones.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Parle-to-Speak',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#2454ff',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
