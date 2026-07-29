'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

export function RefereeShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8f0ea_0%,_#f4f6f5_45%,_#eef1ef_100%)]">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/referee" className="font-heading text-lg tracking-tight">
              Set Point
            </Link>
            <nav className="text-sm text-muted-foreground">
              <Link
                href="/referee"
                className={
                  pathname === '/referee'
                    ? 'text-foreground'
                    : 'hover:text-foreground'
                }
              >
                My matches
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.displayName ?? user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              <LogOut className="size-4" />
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
