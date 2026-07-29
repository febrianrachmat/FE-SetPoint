'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { isAdminUser } from '@/features/auth/roles';
import {
  finishMatch,
  getMatch,
  scorePoint,
  startMatch,
  verifyMatch,
  warmUpMatch,
  type MatchItem,
  type MatchScoreState,
} from '@/lib/api/matches';
import { assignReferee } from '@/lib/api/referee';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function sideName(match: MatchItem, side: 'A' | 'B') {
  return (
    match.participations.find((p) => p.sideLabel === side)?.team.name ??
    `Side ${side}`
  );
}

function pointLabel(points: number) {
  return ['0', '15', '30', '40'][points] ?? String(points);
}

function gamesLine(score: MatchScoreState | null | undefined) {
  const current = score?.sets?.at(-1);
  if (!current) return '—';
  return `${current.gamesA} – ${current.gamesB}`;
}

function pointsLine(score: MatchScoreState | null | undefined) {
  const current = score?.sets?.at(-1);
  if (!current) return null;
  if (current.tieBreak) {
    return `TB ${current.tieBreak.pointsA} – ${current.tieBreak.pointsB}`;
  }
  if (current.game) {
    const adv = current.game.advantageSide
      ? ` · Adv ${current.game.advantageSide}`
      : '';
    return `${pointLabel(current.game.pointsA)} – ${pointLabel(current.game.pointsB)}${adv}`;
  }
  return null;
}

function statusLabel(status: string) {
  if (status === 'warm_up') return 'Warm-up';
  return status.replace('_', ' ');
}

const DEMO_REFEREE_EMAIL = 'referee@setpoint.local';

export function MatchScoringPanel({
  tournamentId,
  categoryId,
  matchId,
  backHref,
  backLabel = 'Match Monitor',
  allowVerify,
  allowAssign,
}: {
  tournamentId: string;
  categoryId: string;
  matchId: string;
  backHref?: string;
  backLabel?: string;
  allowVerify?: boolean;
  allowAssign?: boolean;
}) {
  const { user } = useAuth();
  const admin = isAdminUser(user);
  const canVerify = allowVerify ?? admin;
  const canAssign = allowAssign ?? admin;
  const monitorHref =
    backHref ??
    `/tournaments/${tournamentId}/categories/${categoryId}/matches`;

  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const matchQuery = useQuery({
    queryKey: ['match', tournamentId, categoryId, matchId],
    queryFn: () => getMatch(tournamentId, categoryId, matchId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'live' || status === 'warm_up' ? 3000 : false;
    },
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['match', tournamentId, categoryId, matchId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['matches', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({ queryKey: ['referee-assignments'] }),
    ]);
  };

  const runAction = useMutation({
    mutationFn: async (
      action:
        | { type: 'warm-up' }
        | { type: 'start' }
        | { type: 'point'; side: 'A' | 'B' }
        | { type: 'finish' }
        | { type: 'verify' },
    ) => {
      switch (action.type) {
        case 'warm-up':
          return warmUpMatch(tournamentId, categoryId, matchId);
        case 'start':
          return startMatch(tournamentId, categoryId, matchId);
        case 'point':
          return scorePoint(tournamentId, categoryId, matchId, action.side);
        case 'finish':
          return finishMatch(tournamentId, categoryId, matchId);
        case 'verify':
          return verifyMatch(tournamentId, categoryId, matchId);
      }
    },
    onSuccess: async (_data, action) => {
      setActionError(null);
      await invalidate();
      const messages: Record<string, string> = {
        'warm-up': 'Warm-up started',
        start: 'Match started',
        point: 'Point scored',
        finish: 'Match finished',
        verify: 'Match verified',
      };
      toast.success(messages[action.type] ?? 'Updated');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignReferee(tournamentId, categoryId, matchId, DEMO_REFEREE_EMAIL),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success(`Assigned ${DEMO_REFEREE_EMAIL}`);
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
  });

  if (matchQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading match…</p>;
  }

  if (matchQuery.isError || !matchQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Match not found</AlertTitle>
        <AlertDescription>{getErrorMessage(matchQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  const match = matchQuery.data;
  const score = match.scoreRepresentation;
  const completed = score?.phase === 'completed';
  const busy = runAction.isPending || assignMutation.isPending;
  const nameA = sideName(match, 'A');
  const nameB = sideName(match, 'B');
  const points = pointsLine(score);
  const assignedCount = match.refereeAssignments?.length ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={monitorHref} className="hover:underline">
            {backLabel}
          </Link>
          {' / '}
          Scoring
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight">Match Desk</h1>
          <Badge
            variant="secondary"
            className={cn(
              match.status === 'live' && 'text-emerald-700',
              match.status === 'warm_up' && 'text-amber-700',
              match.status === 'finished' && 'text-sky-700',
              match.status === 'verified' && 'text-sky-700',
            )}
          >
            {statusLabel(match.status)}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {match.court
            ? `${match.court.label} · ${match.court.name}`
            : 'No court'}
          {match.group ? ` · ${match.group.name}` : ''}
          {` · Referee ${assignedCount > 0 ? `${assignedCount} assigned` : 'unassigned'}`}
        </p>
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <section
        data-match-id={match.id}
        data-match-status={match.status}
        data-score-phase={score?.phase ?? 'none'}
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Side A
            </p>
            <p className="mt-1 font-heading text-xl tracking-tight">{nameA}</p>
          </div>
          <p className="font-heading text-4xl tabular-nums tracking-tight">
            {gamesLine(score)}
          </p>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Side B
            </p>
            <p className="mt-1 font-heading text-xl tracking-tight">{nameB}</p>
          </div>
        </div>

        {points ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Points: <span className="font-medium text-foreground">{points}</span>
          </p>
        ) : null}

        {completed && score?.winnerSide ? (
          <p className="mt-3 text-center text-sm font-medium">
            Winner: Side {score.winnerSide} (
            {score.winnerSide === 'A' ? nameA : nameB})
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {canAssign && assignedCount === 0 ? (
            <Button
              variant="outline"
              onClick={() => assignMutation.mutate()}
              disabled={busy}
            >
              Assign demo referee
            </Button>
          ) : null}

          {match.status === 'waiting' ? (
            <Button
              onClick={() => runAction.mutate({ type: 'warm-up' })}
              disabled={busy}
            >
              Warm-up
            </Button>
          ) : null}

          {match.status === 'warm_up' ? (
            <Button
              onClick={() => runAction.mutate({ type: 'start' })}
              disabled={busy}
            >
              Start
            </Button>
          ) : null}

          {match.status === 'live' && !completed ? (
            <>
              <Button
                size="lg"
                onClick={() => runAction.mutate({ type: 'point', side: 'A' })}
                disabled={busy}
              >
                +1 {nameA}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={() => runAction.mutate({ type: 'point', side: 'B' })}
                disabled={busy}
              >
                +1 {nameB}
              </Button>
            </>
          ) : null}

          {match.status === 'live' && completed ? (
            <Button
              onClick={() => runAction.mutate({ type: 'finish' })}
              disabled={busy}
            >
              Finish match
            </Button>
          ) : null}

          {match.status === 'finished' && canVerify ? (
            <Button
              onClick={() => runAction.mutate({ type: 'verify' })}
              disabled={busy}
            >
              Verify (Admin)
            </Button>
          ) : null}

          {match.status === 'finished' && !canVerify ? (
            <p className="text-sm text-muted-foreground">
              Waiting for Admin verify
            </p>
          ) : null}

          {match.status === 'verified' ? (
            <p className="text-sm text-muted-foreground">
              Result verified — standings will react on the backend.
            </p>
          ) : null}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Verify is Admin-only (MATCH-10). Referee may score and finish, not verify.
      </p>
    </div>
  );
}
