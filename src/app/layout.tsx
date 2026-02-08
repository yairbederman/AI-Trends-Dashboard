import type { Metadata, Viewport } from 'next';
import { Outfit, JetBrains_Mono } from 'next/font/google';
import { SettingsProvider } from '@/lib/contexts/SettingsContext';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AI trends / Beedo Studio',
    template: '%s | AI trends / Beedo Studio',
  },
  description: 'Track the latest trends in artificial intelligence from 30+ sources including OpenAI, Google AI, Anthropic, and more. Real-time aggregation of AI news, research, and community discussions.',
  keywords: [
    'AI',
    'artificial intelligence',
    'machine learning',
    'deep learning',
    'AI trends',
    'AI news',
    'LLM',
    'GPT',
    'Claude',
    'OpenAI',
    'Google AI',
    'Anthropic',
    'Hugging Face',
  ],
  authors: [{ name: 'Beedo Studio' }],
  creator: 'Beedo Studio',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'AI trends / Beedo Studio',
    description: 'Track the latest trends in artificial intelligence from 30+ sources',
    siteName: 'AI trends / Beedo Studio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI trends / Beedo Studio',
    description: 'Track the latest trends in artificial intelligence from 30+ sources',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0f' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${outfit.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
