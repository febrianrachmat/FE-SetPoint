import type { Metadata } from 'next';
import { Barlow_Condensed, IBM_Plex_Sans } from 'next/font/google';
import { Providers } from '@/components/providers';
import './globals.css';

const heading = Barlow_Condensed({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const sans = IBM_Plex_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Set Point — Organizer',
  description: 'Organizer dashboard for Set Point padel tournaments',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${heading.variable} ${sans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
