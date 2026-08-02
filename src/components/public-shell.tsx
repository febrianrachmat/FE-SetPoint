'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { LocaleProvider, useLocale } from '@/features/public/locale';
import { cn } from '@/lib/utils';

function PublicHeaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, toggleLocale, locale } = useLocale();
  const filter = searchParams.get('filter');
  const onTournaments = pathname.startsWith('/tournaments');

  return (
    <header className="border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-heading text-xl tracking-tight">
            Set Point
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            <Link
              href="/tournaments"
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                onTournaments && filter !== 'live'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('nav.tournaments')}
            </Link>
            <Link
              href="/tournaments?filter=live"
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                onTournaments && filter === 'live'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t('nav.live')}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLocale}>
            {locale === 'en' ? 'ID' : 'EN'}
          </Button>
          <Button asChild size="sm">
            <Link href="/login">{t('nav.organizerLogin')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

function PublicHeader() {
  return (
    <Suspense
      fallback={
        <header className="border-b border-border/70 bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center px-4">
            <span className="font-heading text-xl tracking-tight">Set Point</span>
          </div>
        </header>
      }
    >
      <PublicHeaderInner />
    </Suspense>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#dfece3_0%,_#f3f6f4_42%,_#e9eeeb_100%)]">
        <PublicHeader />
        <main>{children}</main>
      </div>
    </LocaleProvider>
  );
}
