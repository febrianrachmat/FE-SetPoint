'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { homePathForUser, isRefereeOnly } from '@/features/auth/roles';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    if (isRefereeOnly(user)) {
      router.replace(homePathForUser(user));
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking session…
      </div>
    );
  }

  if (!isAuthenticated || isRefereeOnly(user)) {
    return null;
  }

  return <>{children}</>;
}
