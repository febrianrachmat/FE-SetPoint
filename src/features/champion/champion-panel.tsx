'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getChampion } from '@/lib/api/playoff';
import { getErrorMessage } from '@/lib/api/types';

export function ChampionPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const championQuery = useQuery({
    queryKey: ['champion', tournamentId, categoryId],
    queryFn: () => getChampion(tournamentId, categoryId),
  });

  if (championQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading champion…</p>;
  }

  if (championQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load champion</AlertTitle>
        <AlertDescription>
          {getErrorMessage(championQuery.error)}
        </AlertDescription>
      </Alert>
    );
  }

  const champion = championQuery.data;

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/manage/tournaments/${tournamentId}/categories/${categoryId}`}
            className="hover:underline"
          >
            Category
          </Link>
          {' / '}
          Champion
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">Champion</h1>
        <p className="text-muted-foreground">
          Declared automatically when the Final is verified.
        </p>
      </div>

      {!champion ? (
        <section
          data-champion-state="pending"
          className="rounded-lg border border-dashed border-border px-6 py-16 text-center"
        >
          <p className="font-heading text-2xl tracking-tight">Not declared yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Finish and verify the Final on the Playoff bracket first.
          </p>
          <Button asChild className="mt-6" variant="outline">
            <Link
              href={`/manage/tournaments/${tournamentId}/categories/${categoryId}/playoff`}
            >
              Open playoff
            </Link>
          </Button>
        </section>
      ) : (
        <section
          data-champion-state="declared"
          data-champion-team={champion.winningTeam.name}
          className="rounded-lg border border-border bg-card px-6 py-16 text-center"
        >
          <Badge className="mb-4">Declared</Badge>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Champion
          </p>
          <h2 className="mt-3 font-heading text-4xl tracking-tight sm:text-5xl">
            {champion.winningTeam.name}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground">
            Declared {new Date(champion.declaredAt).toLocaleString()}
          </p>
        </section>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void championQuery.refetch()}
          disabled={championQuery.isFetching}
        >
          Refresh
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/manage/tournaments/${tournamentId}/categories/${categoryId}/playoff`}
          >
            Back to playoff
          </Link>
        </Button>
      </div>
    </div>
  );
}
