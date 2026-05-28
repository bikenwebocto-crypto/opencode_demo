import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/lib/providers/query-provider';
import { cn } from '@/utils/cn';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = { 
  title: {
    template: '%s | Perks Platform',
    default: 'Perks Platform - Employee Benefits Dashboard',
  },
  description: 'Enterprise employee perks and benefits management platform',
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, 'font-sans antialiased')}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
