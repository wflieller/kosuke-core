'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import Navbar from '@/components/ui/navbar';
import { useUser } from '@/lib/auth';

type User = {
  id: number;
  name?: string;
  email: string;
  imageUrl?: string;
} | null;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { userPromise } = useUser();
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    userPromise.then(userData => {
      if (userData) {
        setUser({
          id: userData.id,
          name: userData.name || undefined,
          email: userData.email,
          imageUrl: userData.imageUrl || undefined,
        });
      }
    });
  }, [userPromise]);

  // Don't render the navbar on project detail pages
  const isProjectDetailPage = pathname.match(/\/projects\/\d+$/);

  return (
    <>
      {!isProjectDetailPage && <Navbar user={user} variant="standard" />}
      <div
        className={`${isProjectDetailPage ? 'p-0 w-full max-w-none' : 'container mx-auto py-6 px-4'}`}
      >
        {children}
      </div>
    </>
  );
}
