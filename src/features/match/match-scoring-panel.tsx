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
  adjustScoreGame,
  adjustScoreSet,
  finishMatch,
  getMatch,
  removeScorePoint,
  scorePoint,
  setScoreServer,
  startMatch,
  undoScore,
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

function sidePoints(
  score: MatchScoreState | null | undefined,
  side: 'A' | 'B',
): string {
  const current = score?.sets?.at(-1);
  if (!current) return '—';
  if (current.tieBreak) {
    return String(
      side === 'A' ? current.tieBreak.pointsA : current.tieBreak.pointsB,
    );
  }
  if (current.game) {
    const points = side === 'A' ? current.game.pointsA : current.game.pointsB;
    const opponent =
      side === 'A' ? current.game.pointsB : current.game.pointsA;
    if (
      current.game.advantageSide &&
      points >= 3 &&
      opponent >= 3
    ) {
      return current.game.advantageSide === side ? 'AD' : '40';
    }
    return pointLabel(points);
  }
  return '—';
}

function sideGames(
  score: MatchScoreState | null | undefined,
  side: 'A' | 'B',
) {
  const current = score?.sets?.at(-1);
  if (!current) return 0;
  return side === 'A' ? current.gamesA : current.gamesB;
}

function sideSets(
  score: MatchScoreState | null | undefined,
  side: 'A' | 'B',
) {
  return score?.setsWon?.[side] ?? 0;
}

function statusLabel(status: string) {
  if (status === 'warm_up') return 'Warm-up';
  return status.replace('_', ' ');
}

const DEMO_REFEREE_EMAIL = 'referee@setpoint.local';

type ScoreAction =
  | { type: 'warm-up' }
  | { type: 'start' }
  | { type: 'point'; side: 'A' | 'B' }
  | { type: 'point-remove'; side: 'A' | 'B' }
  | { type: 'game'; side: 'A' | 'B'; delta: 1 | -1 }
  | { type: 'set'; side: 'A' | 'B'; delta: 1 | -1 }
  | { type: 'server'; side: 'A' | 'B' }
  | { type: 'undo' }
  | { type: 'finish' }
  | { type: 'verify' };

function SideControls({
  side,
  name,
  serving,
  sets,
  games,
  points,
  disabled,
  onAction,
}: {
  side: 'A' | 'B';
  name: string;
  serving: boolean;
  sets: number;
  games: number;
  points: string;
  disabled: boolean;
  onAction: (action: ScoreAction) => void;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col rounded-xl border p-4 transition-colors',
        serving
          ? 'border-foreground/25 bg-foreground/[0.03]'
          : 'border-border bg-background',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Side {side}
          </p>
          <p className="mt-1 truncate font-heading text-lg tracking-tight">
            {name}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ type: 'server', side })}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors',
            serving
              ? 'bg-foreground text-background'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
          title="Set service"
        >
          {serving ? 'Serving' : 'Serve'}
        </button>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Sets
          </p>
          <p className="font-heading text-3xl tabular-nums tracking-tight">
            {sets}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Games
          </p>
          <p className="font-heading text-3xl tabular-nums tracking-tight">
            {games}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Points
          </p>
          <p className="font-heading text-3xl tabular-nums tracking-tight">
            {points}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => onAction({ type: 'point-remove', side })}
          >
            − Point
          </Button>
          <Button
            disabled={disabled}
            onClick={() => onAction({ type: 'point', side })}
          >
            + Point
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => onAction({ type: 'game', side, delta: -1 })}
          >
            − Game
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAction({ type: 'game', side, delta: 1 })}
          >
            + Game
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => onAction({ type: 'set', side, delta: -1 })}
          >
            − Set
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => onAction({ type: 'set', side, delta: 1 })}
          >
            + Set
          </Button>
        </div>
      </div>
    </div>
  );
}

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
    `/manage/tournaments/${tournamentId}/categories/${categoryId}/matches`;

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
    mutationFn: async (action: ScoreAction) => {
      switch (action.type) {
        case 'warm-up':
          return warmUpMatch(tournamentId, categoryId, matchId);
        case 'start':
          return startMatch(tournamentId, categoryId, matchId);
        case 'point':
          return scorePoint(tournamentId, categoryId, matchId, action.side);
        case 'point-remove':
          return removeScorePoint(
            tournamentId,
            categoryId,
            matchId,
            action.side,
          );
        case 'game':
          return adjustScoreGame(
            tournamentId,
            categoryId,
            matchId,
            action.side,
            action.delta,
          );
        case 'set':
          return adjustScoreSet(
            tournamentId,
            categoryId,
            matchId,
            action.side,
            action.delta,
          );
        case 'server':
          return setScoreServer(
            tournamentId,
            categoryId,
            matchId,
            action.side,
          );
        case 'undo':
          return undoScore(tournamentId, categoryId, matchId);
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
        'point-remove': 'Point removed',
        game: 'Game updated',
        set: 'Set updated',
        server: 'Service updated',
        undo: 'Last action undone',
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
  const assignedCount = match.refereeAssignments?.length ?? 0;
  const serverSide = score?.serverSide ?? 'A';
  const canUndo = (score?.undoStack?.length ?? 0) > 0;
  const inTieBreak = Boolean(score?.sets?.at(-1)?.tieBreak);
  const liveScoring = match.status === 'live' && !completed;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
        className="rounded-xl border border-border bg-card p-5 sm:p-6"
      >
        {liveScoring ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {inTieBreak ? 'Tie-break in progress' : 'Current game'}
                {score?.sets?.length
                  ? ` · Set ${score.sets.length}`
                  : ''}
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !canUndo}
                onClick={() => runAction.mutate({ type: 'undo' })}
              >
                Undo last
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SideControls
                side="A"
                name={nameA}
                serving={serverSide === 'A'}
                sets={sideSets(score, 'A')}
                games={sideGames(score, 'A')}
                points={sidePoints(score, 'A')}
                disabled={busy}
                onAction={(action) => runAction.mutate(action)}
              />
              <SideControls
                side="B"
                name={nameB}
                serving={serverSide === 'B'}
                sets={sideSets(score, 'B')}
                games={sideGames(score, 'B')}
                points={sidePoints(score, 'B')}
                disabled={busy}
                onAction={(action) => runAction.mutate(action)}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Side A
              </p>
              <p className="mt-1 font-heading text-xl tracking-tight">{nameA}</p>
            </div>
            <div>
              <p className="font-heading text-4xl tabular-nums tracking-tight">
                {sideSets(score, 'A')} – {sideSets(score, 'B')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Games {sideGames(score, 'A')} – {sideGames(score, 'B')}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Side B
              </p>
              <p className="mt-1 font-heading text-xl tracking-tight">{nameB}</p>
            </div>
          </div>
        )}

        {completed && score?.winnerSide ? (
          <p className="mt-5 text-center text-sm font-medium">
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
        Use − Point / Undo for mis-taps. Service badge marks the serving side.
        Verify is Admin-only (MATCH-10).
      </p>
    </div>
  );
}
