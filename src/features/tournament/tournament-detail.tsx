'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatusBadge } from '@/features/tournament/status-badge';
import { listCategories } from '@/lib/api/categories';
import { listCourts } from '@/lib/api/courts';
import { getErrorMessage } from '@/lib/api/types';
import {
  getTournament,
  moveTournamentToSetup,
  publishTournament,
} from '@/lib/api/tournaments';

export function TournamentDetail({ tournamentId }: { tournamentId: string }) {
  const queryClient = useQueryClient();

  const tournamentQuery = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', tournamentId],
    queryFn: () => listCategories(tournamentId),
    enabled: Boolean(tournamentQuery.data),
  });

  const courtsQuery = useQuery({
    queryKey: ['courts', tournamentId],
    queryFn: () => listCourts(tournamentId),
    enabled: Boolean(tournamentQuery.data),
  });

  const setupMutation = useMutation({
    mutationFn: () => moveTournamentToSetup(tournamentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament moved to Setup');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => publishTournament(tournamentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament published');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  if (tournamentQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading tournament…</p>;
  }

  if (tournamentQuery.isError || !tournamentQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Tournament not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(tournamentQuery.error, 'Could not load this tournament')}
        </AlertDescription>
      </Alert>
    );
  }

  const tournament = tournamentQuery.data;
  const categories = categoriesQuery.data?.items ?? [];
  const courts = courtsQuery.data?.items ?? [];
  const canPublish =
    tournament.status === 'setup' && categories.length >= 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <h1 className="font-heading text-3xl tracking-tight">{tournament.name}</h1>
            <StatusBadge status={tournament.status} />
          </div>
          <p className="text-muted-foreground">
            {tournament.description || 'No description'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tournament.status === 'draft' ? (
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? 'Moving…' : 'Move to Setup'}
            </Button>
          ) : null}
          {tournament.status === 'setup' ? (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={!canPublish || publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Publishing…' : 'Publish tournament'}
            </Button>
          ) : null}
          {tournament.status === 'published' ? (
            <p className="self-center text-sm text-muted-foreground">
              Go Live from Match Monitor after Schedule is Live Ready.
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Competition divisions in this event</CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/tournaments/${tournamentId}/categories/new`}>Add</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoriesQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(categoriesQuery.error)}
              </p>
            ) : null}
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">No categories yet.</p>
            ) : (
              categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/tournaments/${tournamentId}/categories/${category.id}`}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                >
                  <span>{category.name}</span>
                  <span className="text-muted-foreground">{category.format}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Courts</CardTitle>
              <CardDescription>
                {courtsQuery.data
                  ? `${courtsQuery.data.availableCount} available`
                  : 'Required before schedule generation'}
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href={`/tournaments/${tournamentId}/courts`}>Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {courtsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(courtsQuery.error)}
              </p>
            ) : null}
            {courts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courts yet.</p>
            ) : (
              courts.map((court) => (
                <div
                  key={court.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    {court.label} — {court.name}
                  </span>
                  <span className="text-muted-foreground">{court.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
