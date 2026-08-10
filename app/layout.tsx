import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';

import { ServiceWorker } from '@/components/pwa/ServiceWorker';

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

const DESCRIPTION =
  'Monopoly Deal en ligne, 2 à 5 joueurs : collectionne trois lots complets, vole des propriétés, réclame tes loyers.';

export const metadata: Metadata = {
  title: 'Monopoly Deal',
  description: DESCRIPTION,
  applicationName: 'Monopoly Deal',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  // iOS ignore le manifeste : c'est cette balise qui retire la barre de Safari
  // quand le jeu est lancé depuis l'écran d'accueil.
  appleWebApp: {
    capable: true,
    title: 'Monopoly Deal',
    statusBarStyle: 'black-translucent',
  },
  // Next n'émet plus que le nom standardisé `mobile-web-app-capable` ; les iOS
  // antérieurs à 17 ne connaissent que celui d'Apple, et sans lui le jeu
  // rouvre dans Safari avec sa barre d'adresse.
  other: { 'apple-mobile-web-app-capable': 'yes' },
  openGraph: {
    title: 'Monopoly Deal',
    description: DESCRIPTION,
    images: ['/og.png'],
    type: 'website',
  },
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
      <body className="font-sans">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
