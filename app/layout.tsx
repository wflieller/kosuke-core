import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ReactNode } from 'react';

import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/error-boundary';
import { UserProvider } from '@/lib/auth';
import { getUser } from '@/lib/db/queries';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kosuke',
  description:
    'Build your next web project with AI. Describe what you want to build, and our AI will help you create it.',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  maximumScale: 1,
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  const userFromDb = await getUser();
  const userPromise = Promise.resolve(userFromDb);

  return (
    <html lang="en" className={`dark ${inter.className}`} style={{ colorScheme: 'dark' }}>
      <body className="min-h-[100dvh] bg-background text-foreground overflow-x-hidden">
        <Providers>
          <UserProvider userPromise={userPromise}>
            <div className="flex flex-col min-h-[100dvh]">
              <ErrorBoundary>
                <main className="flex-1">{children}</main>
              </ErrorBoundary>
            </div>
          </UserProvider>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
