'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/features/tournament/status-badge';
import {
  listMatches,
  startMatch,
  verifyMatch,
  warmUpMatch,
  type MatchItem,
  type MatchStatus,
} from '@/lib/api/matches';
import { getSchedule } from '@/lib/api/schedule';
import { getErrorMessage, isApiError } from '@/lib/api/types';
import {
  getTournament,
  goLiveTournament,
} from '@/lib/api/tournaments';
import { cn } from '@/lib/utils';

const STATUS_FILTERS: Array<{ value: '' | MatchStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'warm_up', label: 'Warm-up' },
  { value: 'live', label: 'Live' },
  { value: 'finished', label: 'Finished' },
  { value: 'verified', label: 'Verified' },
];

function sideName(match: MatchItem, side: 'A' | 'B') {
  return (
    match.participations.find((p) => p.sideLabel === side)?.team.name ??
    `Side ${side}`
  );
}

function scoreLabel(match: MatchItem) {
  const score = match.scoreRepresentation;
  if (!score) return null;
  const current = score.sets?.at(-1);
  if (current) return `${current.gamesA} – ${current.gamesB}`;
  if (score.setsWon) return `${score.setsWon.A} – ${score.setsWon.B}`;
  return null;
}

function statusTone(status: MatchStatus) {
  switch (status) {
    case 'waiting':
      return 'text-muted-foreground';
    case 'warm_up':
      return 'text-amber-700 dark:text-amber-400';
    case 'live':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'finished':
    case 'verified':
      return 'text-sky-700 dark:text-sky-400';
    default:
      return '';
  }
}

function statusLabel(status: MatchStatus) {
  switch (status) {
    case 'warm_up':
      return 'Warm-up';
    case 'waiting':
      return 'Waiting';
    case 'live':
      return 'Live';
    case 'finished':
      return 'Finished';
    case 'verified':
      return 'Verified';
    default:
      return status;
  }
}

function MatchCard({
  match,
  tournamentId,
  categoryId,
  busy,
  onWarmUp,
  onStart,
  onVerify,
}: {
  match: MatchItem;
  tournamentId: string;
  categoryId: string;
  busy: boolean;
  onWarmUp: () => void;
  onStart: () => void;
  onVerify: () => void;
}) {
  const score = scoreLabel(match);
  const referees = match.refereeAssignments;
  const deskHref = `/tournaments/${tournamentId}/categories/${categoryId}/matches/${match.id}`;

  return (
    <article
      data-match-id={match.id}
      data-match-status={match.status}
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {match.court
              ? `${match.court.label} · ${match.court.name}`
              : 'No court'}
          </p>
          <h3 className="mt-1 font-heading text-lg leading-tight tracking-tight">
            {sideName(match, 'A')}
            <span className="mx-2 text-muted-foreground">vs</span>
            {sideName(match, 'B')}
          </h3>
          {match.group ? (
            <p className="mt-1 text-sm text-muted-foreground">{match.group.name}</p>
          ) : null}
        </div>
        <Badge variant="secondary" className={cn(statusTone(match.status))}>
          {statusLabel(match.status)}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Score</dt>
          <dd className="font-medium tabular-nums">{score ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Referee</dt>
          <dd>
            {referees.length === 0
              ? 'Unassigned'
              : `${referees.length} assigned`}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {match.status === 'waiting' ? (
          <Button size="sm" onClick={onWarmUp} disabled={busy}>
            Warm-up
          </Button>
        ) : null}
        {match.status === 'warm_up' ? (
          <Button size="sm" onClick={onStart} disabled={busy}>
            Start
          </Button>
        ) : null}
        {match.status === 'live' ||
        match.status === 'finished' ||
        match.status === 'verified' ? (
          <Button asChild size="sm" variant={match.status === 'live' ? 'default' : 'outline'}>
            <Link href={deskHref}>Open Match</Link>
          </Button>
        ) : null}
        {match.status === 'finished' ? (
          <Button size="sm" onClick={onVerify} disabled={busy}>
            Verify
          </Button>
        ) : null}
        {match.status === 'waiting' || match.status === 'warm_up' ? (
          <Button asChild size="sm" variant="outline">
            <Link href={deskHref}>Open desk</Link>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function MatchMonitor({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'' | MatchStatus>('');
  const [courtFilter, setCourtFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  const tournamentQuery = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
  });

  const scheduleQuery = useQuery({
    queryKey: ['schedule', tournamentId, categoryId],
    queryFn: () => getSchedule(tournamentId, categoryId),
  });

  const matchesQuery = useQuery({
    queryKey: ['matches', tournamentId, categoryId, statusFilter || 'all'],
    queryFn: () =>
      listMatches(tournamentId, categoryId, {
        status: statusFilter || undefined,
        pageSize: 200,
      }),
    enabled:
      Boolean(scheduleQuery.data) &&
      scheduleQuery.data?.publishState === 'published' &&
      scheduleQuery.data?.lockState === 'locked',
    retry: false,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }),
      queryClient.invalidateQueries({
        queryKey: ['matches', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule', tournamentId, categoryId],
      }),
    ]);
  };

  const goLiveMutation = useMutation({
    mutationFn: () => goLiveTournament(tournamentId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Tournament is Live');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const warmUpMutation = useMutation({
    mutationFn: (matchId: string) =>
      warmUpMatch(tournamentId, categoryId, matchId),
    onMutate: (matchId) => setBusyMatchId(matchId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Match warm-up started');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
    onSettled: () => setBusyMatchId(null),
  });

  const startMutation = useMutation({
    mutationFn: (matchId: string) =>
      startMatch(tournamentId, categoryId, matchId),
    onMutate: (matchId) => setBusyMatchId(matchId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Match started');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
    onSettled: () => setBusyMatchId(null),
  });

  const verifyMutation = useMutation({
    mutationFn: (matchId: string) =>
      verifyMatch(tournamentId, categoryId, matchId),
    onMutate: (matchId) => setBusyMatchId(matchId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Match verified');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
    onSettled: () => setBusyMatchId(null),
  });

  const tournament = tournamentQuery.data;
  const schedule = scheduleQuery.data;
  const liveReady =
    schedule?.publishState === 'published' && schedule?.lockState === 'locked';
  const canGoLive = tournament?.status === 'published' && liveReady;

  const courts = useMemo(() => {
    const map = new Map<string, string>();
    for (const match of matchesQuery.data?.items ?? []) {
      if (match.court) {
        map.set(match.court.id, `${match.court.label} · ${match.court.name}`);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [matchesQuery.data?.items]);

  const matches = useMemo(() => {
    const items = matchesQuery.data?.items ?? [];
    if (!courtFilter) return items;
    return items.filter((m) => m.court?.id === courtFilter);
  }, [matchesQuery.data?.items, courtFilter]);

  if (tournamentQuery.isLoading || scheduleQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading match monitor…</p>;
  }

  if (tournamentQuery.isError || !tournament) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Tournament not found</AlertTitle>
        <AlertDescription>
          {getErrorMessage(tournamentQuery.error)}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/tournaments/${tournamentId}`} className="hover:underline">
            Tournament
          </Link>
          {' / '}
          <Link
            href={`/tournaments/${tournamentId}/categories/${categoryId}`}
            className="hover:underline"
          >
            Category
          </Link>
          {' / '}
          Match Monitor
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight">Match Monitor</h1>
          <StatusBadge status={tournament.status} />
          {liveReady ? <Badge>Live Ready</Badge> : null}
          {tournament.status === 'live' ? <Badge>Live Ops</Badge> : null}
        </div>
        <p className="mt-1 text-muted-foreground">
          Go Live, warm-up/start matches, then open the match desk to score.
        </p>
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {!liveReady ? (
        <Alert>
          <AlertTitle>Not Live Ready</AlertTitle>
          <AlertDescription>
            Publish and lock the category Schedule first, then return here to Go
            Live.
            {' '}
            <Link
              href={`/tournaments/${tournamentId}/categories/${categoryId}/schedule`}
              className="underline"
            >
              Open schedule
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {liveReady &&
        tournament.status !== 'live' &&
        tournament.status !== 'finished' &&
        tournament.status !== 'archived' ? (
          <Button
            onClick={() => goLiveMutation.mutate()}
            disabled={!canGoLive || goLiveMutation.isPending}
          >
            {goLiveMutation.isPending ? 'Going live…' : 'Go Live'}
          </Button>
        ) : null}
        {tournament.status === 'setup' && liveReady ? (
          <p className="text-sm text-muted-foreground">
            Publish the tournament first, then Go Live unlocks.
          </p>
        ) : null}
        {tournament.status === 'live' ? (
          <p className="text-sm text-muted-foreground">
            Tournament is live — warm-up and start matches below.
          </p>
        ) : null}
      </div>

      {liveReady ? (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="match-status-filter">Status</Label>
              <select
                id="match-status-filter"
                className="flex h-9 min-w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as '' | MatchStatus)
                }
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-court-filter">Court</Label>
              <select
                id="match-court-filter"
                className="flex h-9 min-w-44 rounded-md border border-input bg-transparent px-3 text-sm"
                value={courtFilter}
                onChange={(e) => setCourtFilter(e.target.value)}
              >
                <option value="">All courts</option>
                {courts.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void matchesQuery.refetch()}
                disabled={matchesQuery.isFetching}
              >
                Refresh
              </Button>
            </div>
          </div>

          {matchesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading matches…</p>
          ) : null}

          {matchesQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load matches</AlertTitle>
              <AlertDescription>
                {isApiError(matchesQuery.error)
                  ? matchesQuery.error.message
                  : getErrorMessage(matchesQuery.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {!matchesQuery.isLoading && !matchesQuery.isError && matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No matches match the current filters.
            </p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                tournamentId={tournamentId}
                categoryId={categoryId}
                busy={busyMatchId === match.id}
                onWarmUp={() => warmUpMutation.mutate(match.id)}
                onStart={() => startMutation.mutate(match.id)}
                onVerify={() => verifyMutation.mutate(match.id)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
