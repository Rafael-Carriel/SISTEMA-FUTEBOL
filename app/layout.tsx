import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://fut-da-galera-irati.web.app'),
  title: 'Na Trave · O placar do seu fut',
  description:
    'Partidas, estatísticas, rankings e mensalidades do futebol da galera.',
  openGraph: {
    title: 'Na Trave · O placar do seu fut',
    description: 'Partidas, estatísticas, rankings e mensalidades do futebol da galera.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Na Trave — O placar do seu fut' }],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Na Trave · O placar do seu fut',
    description: 'Partidas, estatísticas, rankings e mensalidades do futebol da galera.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
