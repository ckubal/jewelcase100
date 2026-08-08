import type { Metadata } from 'next';
import { Silkscreen } from 'next/font/google';
import './globals.css';
import { CollageProvider } from '@/store/collageStore';

const silkscreen = Silkscreen({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-pixel' });

export const metadata: Metadata = {
  title: 'jewelcase 100 — rank the albums that raised you',
  icons: { icon: '/favicon.png', apple: '/favicon.png' },
  viewport: { width: 'device-width', initialScale: 1, maximumScale: 1 },
  description: 'before playlists, there were bedroom walls. build a ranked grid of the album covers that raised you.',
  openGraph: {
    title: 'jewelcase 100 — rank the albums that raised you',
    description: 'before playlists, there were bedroom walls. rank the albums that raised you and generate a poster.',
    url: 'https://jewelcase100.weirdlittleideas.com',
    siteName: 'jewelcase 100',
    images: [{ url: 'https://jewelcase100.weirdlittleideas.com/og-image.jpg', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'jewelcase 100 — rank the albums that raised you',
    description: 'before playlists, there were bedroom walls. rank the albums that raised you.',
    images: ['https://jewelcase100.weirdlittleideas.com/og-image.jpg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${silkscreen.variable}`}>
      <body className="min-h-full">
        <CollageProvider>{children}</CollageProvider>
      </body>
    </html>
  );
}
