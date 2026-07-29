'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getCategory } from '@/lib/api/categories';
import { listTeams } from '@/lib/api/teams';
import { getErrorMessage } from '@/lib/api/types';

export function CategoryDetail({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const categoryQuery = useQuery({
    queryKey: ['category', tournamentId, categoryId],
    queryFn: () => getCategory(tournamentId, categoryId),
  });

  const teamsQuery = useQuery({
    queryKey: ['teams', tournamentId, categoryId],
    queryFn: () => listTeams(tournamentId, categoryId),
  });

  if (categoryQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading category…</p>;
  }

  if (categoryQuery.isError || !categoryQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Category not found</AlertTitle>
        <AlertDescription>{getErrorMessage(categoryQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  const category = categoryQuery.data;
  const mode =
    (category.configuration?.competitionMode as string | undefined) ?? 'unknown';
  const teams = teamsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/tournaments/${tournamentId}`} className="hover:underline">
            Tournament
          </Link>
          {' / '}
          Category
        </p>
        <h1 className="mt-1 font-heading text-3xl tracking-tight">{category.name}</h1>
        <p className="text-muted-foreground">
          {category.format} · {mode}
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Teams</CardTitle>
            <CardDescription>Register teams for this category</CardDescription>
          </div>
          <Button asChild size="sm">
            <Link
              href={`/tournaments/${tournamentId}/categories/${categoryId}/teams`}
            >
              Manage teams
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {teamsQuery.isError ? (
            <p className="text-sm text-destructive">
              {getErrorMessage(teamsQuery.error)}
            </p>
          ) : null}
          {teams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams registered yet.</p>
          ) : (
            teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>{team.name}</span>
                <span className="text-muted-foreground">{team.eligibilityStatus}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {mode === 'knockout_only' ? (
        <Alert>
          <AlertTitle>Cup category</AlertTitle>
          <AlertDescription>
            Drawing and Schedule are not used for knockout_only — generate Playoff
            directly when that screen exists.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Drawing</CardTitle>
                <CardDescription>
                  Partition eligible teams into groups, then publish and lock
                </CardDescription>
              </div>
              <Button asChild size="sm">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/drawing`}
                >
                  Open drawing
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Need enough eligible teams for the category partition (e.g. 2 groups
                × 4 teams = 8) before generate succeeds.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Assign courts and times after Drawing is Schedule Ready
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/schedule`}
                >
                  Open schedule
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Requires Drawing published ∧ locked and at least one available
                court.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Match Monitor</CardTitle>
                <CardDescription>
                  Go Live after Schedule is Live Ready, then warm-up and start
                  matches
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/matches`}
                >
                  Open monitor
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Publish the tournament first. Open Match desk to score, finish,
                and Admin-verify.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Standings</CardTitle>
                <CardDescription>
                  Group tables and qualified intake after matches are verified
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/standings`}
                >
                  Open standings
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Auto-updates on verify; Recalculate available for manual refresh.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Playoff</CardTitle>
                <CardDescription>
                  Generate bracket from qualified teams, then publish and lock
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/playoff`}
                >
                  Open playoff
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Requires enough qualified standings (e.g. 2 groups × top 2).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Champion</CardTitle>
                <CardDescription>
                  Shown after the Final match is verified
                </CardDescription>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/tournaments/${tournamentId}/categories/${categoryId}/champion`}
                >
                  Open champion
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Backend declares the winner when Final verification advances the
                bracket.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
