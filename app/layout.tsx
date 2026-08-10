import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';

import './globals.css';

/**
 * Une seule famille, très typée, du 400 au 800 : la hiérarchie vient de la
 * graisse et du crénage, pas d'un empilement de polices.
 */
const display = Outfit({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Monopoly Deal',
  description:
    'Monopoly Deal en ligne, 2 à 5 joueurs : collectionne trois lots complets, vole des propriétés, réclame tes loyers.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ED1B24',
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={display.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
