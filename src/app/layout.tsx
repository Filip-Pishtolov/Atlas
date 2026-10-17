import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Atlas — Small-group journeys, properly guided',
    template: '%s | Atlas',
  },
  description:
    'Atlas is a small-group tour operator running guided journeys across the Mediterranean, the Balkans and North Africa. Fixed departures, real itineraries, local guides.',
  openGraph: {
    title: 'Atlas — Small-group journeys, properly guided',
    description:
      'Guided small-group journeys across the Mediterranean, the Balkans and North Africa.',
    type: 'website',
    siteName: 'Atlas',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
