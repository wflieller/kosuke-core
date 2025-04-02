'use client';

import { use } from 'react';

import Navbar from '@/components/ui/navbar';
import { useUser } from '@/lib/auth';

type SharedLayoutProps = {
  children: React.ReactNode;
  showNavbar?: boolean;
  variant?: 'standard' | 'project';
  projectProps?: {
    projectName: string;
    currentView: 'preview' | 'code';
    onViewChange: (view: 'preview' | 'code') => void;
    onRefresh?: () => void;
  };
};

export default function SharedLayout({
  children,
  showNavbar = true,
  variant = 'standard',
  projectProps,
}: SharedLayoutProps) {
  const { userPromise } = useUser();
  const user = use(userPromise);

  // Transform user to match the expected type in Navbar
  const transformedUser = user
    ? {
        id: user.id,
        name: user.name || undefined,
        email: user.email,
        image: undefined, // Add image property if available in your user object
      }
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {showNavbar && (
        <Navbar user={transformedUser} variant={variant} projectProps={projectProps} />
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}
