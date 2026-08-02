'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicShell } from '@/components/public-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/features/public/locale';
import {
  listPublicTournaments,
  type PublicTournamentFilter,
} from '@/lib/api/public-tournaments';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function statusLabel(status: string, locale: 'en' | 'id') {
  if (status === 'live') return locale === 'id' ? 'Langsung' : 'Live';
  if (status === 'published') return locale === 'id' ? 'Mendatang' : 'Upcoming';
  return status;
}

function PublicTournamentListInner() {
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const filter = (searchParams.get('filter') ?? 'all') as PublicTournamentFilter;

  const statusParam =
    filter === 'live' ? ('live' as const) : filter === 'upcoming' ? ('published' as const) : undefined;

  const query = useQuery({
    queryKey: ['public-tournaments', filter],
    queryFn: () =>
      listPublicTournaments({
        pageSize: 50,
        ...(statusParam ? { status: statusParam } : {}),
      }),
  });

  const items = query.data?.items ?? [];
  const filters = useMemo(
    () =>
      [
        { id: 'all' as const, href: '/tournaments', label: t('list.filterAll') },
        {
          id: 'live' as const,
          href: '/tournaments?filter=live',
          label: t('list.filterLive'),
        },
        {
          id: 'upcoming' as const,
          href: '/tournaments?filter=upcoming',
          label: t('list.filterUpcoming'),
        },
      ] as const,
    [t],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="max-w-2xl">
        <h1 className="font-heading text-4xl tracking-tight">{t('list.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('list.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm transition-colors',
              filter === item.id
                ? 'border-foreground/30 bg-foreground text-background'
                : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {query.isError ? (
        <p className="text-sm text-destructive">{getErrorMessage(query.error)}</p>
      ) : null}

      {!query.isLoading && !query.isError && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
      ) : null}

      <div className="grid gap-3">
        {items.map((tournament) => (
          <Link
            key={tournament.id}
            href={`/tournaments/${tournament.id}`}
            className="group rounded-xl border border-border bg-card/80 px-4 py-4 transition-colors hover:border-foreground/25"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading text-2xl tracking-tight group-hover:underline">
                    {tournament.name}
                  </h2>
                  <Badge
                    variant="secondary"
                    className={cn(
                      tournament.status === 'live' && 'text-emerald-700',
                    )}
                  >
                    {statusLabel(tournament.status, locale)}
                  </Badge>
                </div>
                {tournament.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {tournament.description}
                  </p>
                ) : null}
              </div>
              <Button variant="outline" size="sm" tabIndex={-1}>
                {t('list.open')}
              </Button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function PublicTournamentListPage() {
  return (
    <PublicShell>
      <PublicTournamentListInner />
    </PublicShell>
  );
}
