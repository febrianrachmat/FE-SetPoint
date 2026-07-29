'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listMyRefereeAssignments } from '@/lib/api/referee';
import { getErrorMessage } from '@/lib/api/types';

function sideName(
  participations: Array<{ sideLabel: string; team: { name: string } }>,
  side: 'A' | 'B',
) {
  return (
    participations.find((p) => p.sideLabel === side)?.team.name ?? `Side ${side}`
  );
}

export function RefereeHome() {
  const assignmentsQuery = useQuery({
    queryKey: ['referee-assignments'],
    queryFn: () => listMyRefereeAssignments(),
  });

  if (assignmentsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading assignments…</p>;
  }

  if (assignmentsQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load assignments</AlertTitle>
        <AlertDescription>
          {getErrorMessage(assignmentsQuery.error)}
        </AlertDescription>
      </Alert>
    );
  }

  const items = assignmentsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl tracking-tight">My matches</h1>
        <p className="text-muted-foreground">
          Assigned matches only. Verify stays with Tournament Admin.
        </p>
      </div>

      {items.length === 0 ? (
        <Alert>
          <AlertTitle>No assignments</AlertTitle>
          <AlertDescription>
            Ask an organizer to assign you to a match from the Match Desk.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3" data-referee-assignments>
          {items.map((row) => {
            const match = row.match;
            const deskHref = `/referee/matches/${match.tournamentId}/${match.categoryId}/${match.id}`;
            return (
              <article
                key={row.id}
                data-assignment-match={match.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {match.tournamentName} · {match.categoryName}
                      {match.court
                        ? ` · ${match.court.label}`
                        : ''}
                    </p>
                    <h2 className="mt-1 font-heading text-lg tracking-tight">
                      {sideName(match.participations, 'A')}
                      <span className="mx-2 text-muted-foreground">vs</span>
                      {sideName(match.participations, 'B')}
                    </h2>
                  </div>
                  <Badge variant="secondary">{match.status}</Badge>
                </div>
                <div className="mt-4">
                  <Button asChild size="sm">
                    <Link href={deskHref}>Open desk</Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
