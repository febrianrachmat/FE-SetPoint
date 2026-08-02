'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PublicShell } from '@/components/public-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/features/public/locale';
import { getPublicTournament } from '@/lib/api/public-tournaments';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export function PublicTournamentHub({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { t, locale } = useLocale();
  const query = useQuery({
    queryKey: ['public-tournament', tournamentId],
    queryFn: () => getPublicTournament(tournamentId),
  });

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/tournaments" className="hover:underline">
              {t('hub.back')}
            </Link>
          </p>

          {query.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : null}

          {query.isError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Tournament not found</AlertTitle>
              <AlertDescription>
                {getErrorMessage(query.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {query.data ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-4xl tracking-tight">
                  {query.data.name}
                </h1>
                <Badge
                  variant="secondary"
                  className={cn(
                    query.data.status === 'live' && 'text-emerald-700',
                  )}
                >
                  {query.data.status === 'live'
                    ? locale === 'id'
                      ? 'Langsung'
                      : 'Live'
                    : query.data.status === 'published'
                      ? locale === 'id'
                        ? 'Mendatang'
                        : 'Upcoming'
                      : query.data.status}
                </Badge>
              </div>
              {query.data.description ? (
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {query.data.description}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {query.data ? (
          <section className="rounded-xl border border-border bg-card/80 p-6">
            <h2 className="font-heading text-2xl tracking-tight">
              {t('hub.placeholderTitle')}
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t('hub.placeholderBody')}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {t('hub.sectionsHint')}
            </p>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
