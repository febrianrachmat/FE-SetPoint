'use client';

import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/features/public/locale';

function LandingContent() {
  const { t } = useLocale();

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.35)_40%,transparent_70%)]"
      />
      <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:py-24">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {t('hero.eyebrow')}
        </p>
        <h1 className="mt-4 max-w-3xl font-heading text-5xl leading-[0.95] tracking-tight sm:text-7xl">
          Set Point
        </h1>
        <p className="mt-4 max-w-2xl font-heading text-2xl tracking-tight text-foreground/80 sm:text-3xl">
          {t('hero.title')}
        </p>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t('hero.subtitle')}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/tournaments">{t('hero.ctaTournaments')}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">{t('hero.ctaLogin')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <PublicShell>
      <LandingContent />
    </PublicShell>
  );
}
