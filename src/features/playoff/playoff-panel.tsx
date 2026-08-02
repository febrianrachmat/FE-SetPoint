'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  generatePlayoff,
  getBracket,
  getPlayoff,
  listBrackets,
  lockPlayoff,
  publishBracket,
  reviewBracket,
  unlockPlayoff,
  type BracketMatch,
} from '@/lib/api/playoff';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function sideName(match: BracketMatch, side: 'A' | 'B') {
  return (
    match.participations.find((p) => p.sideLabel === side)?.team.name ??
    `TBD (${side})`
  );
}

function positionLabel(position: string | null) {
  if (!position) return 'Match';
  if (position === 'F') return 'Final';
  if (position.startsWith('SF')) return `Semifinal ${position.slice(2)}`;
  if (position.startsWith('QF')) return `Quarterfinal ${position.slice(2)}`;
  return position;
}

export function PlayoffPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(
    null,
  );
  const [unlockReason, setUnlockReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const playoffQuery = useQuery({
    queryKey: ['playoff', tournamentId, categoryId],
    queryFn: () => getPlayoff(tournamentId, categoryId),
  });

  const bracketsQuery = useQuery({
    queryKey: ['playoff-brackets', tournamentId, categoryId],
    queryFn: () => listBrackets(tournamentId, categoryId),
  });

  const activeBracketId = useMemo(() => {
    if (selectedBracketId) return selectedBracketId;
    return bracketsQuery.data?.items[0]?.id ?? null;
  }, [selectedBracketId, bracketsQuery.data?.items]);

  const bracketQuery = useQuery({
    queryKey: ['playoff-bracket', tournamentId, categoryId, activeBracketId],
    queryFn: () => getBracket(tournamentId, categoryId, activeBracketId!),
    enabled: Boolean(activeBracketId),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['playoff', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['playoff-brackets', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['playoff-bracket', tournamentId, categoryId],
      }),
    ]);
  };

  const generateMutation = useMutation({
    mutationFn: () => generatePlayoff(tournamentId, categoryId),
    onSuccess: async (bracket) => {
      setActionError(null);
      setSelectedBracketId(bracket.id);
      await invalidate();
      toast.success(`Bracket v${bracket.versionNumber} generated`);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (outcome: 'approved' | 'rejected') =>
      reviewBracket(tournamentId, categoryId, activeBracketId!, { outcome }),
    onSuccess: async (_, outcome) => {
      setActionError(null);
      await invalidate();
      toast.success(
        outcome === 'approved' ? 'Bracket approved' : 'Bracket rejected',
      );
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishBracket(tournamentId, categoryId, activeBracketId!),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Bracket published as Official');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockPlayoff(tournamentId, categoryId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Playoff locked — Playoff Ready');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockPlayoff(tournamentId, categoryId, unlockReason),
    onSuccess: async () => {
      setActionError(null);
      setUnlockReason('');
      await invalidate();
      toast.success('Playoff unlocked');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  if (playoffQuery.isLoading || bracketsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading playoff…</p>;
  }

  if (playoffQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load playoff</AlertTitle>
        <AlertDescription>
          {getErrorMessage(playoffQuery.error)}
        </AlertDescription>
      </Alert>
    );
  }

  const playoff = playoffQuery.data;
  const brackets = bracketsQuery.data?.items ?? [];
  const bracket = bracketQuery.data;
  const locked = playoff?.lockState === 'locked';
  const published = playoff?.publishState === 'published';
  const canReview =
    Boolean(activeBracketId) &&
    !locked &&
    bracket?.versionStatus === 'candidate' &&
    (bracket.reviewOutcome == null || bracket.reviewOutcome === 'pending');
  const canPublish =
    Boolean(activeBracketId) &&
    !locked &&
    bracket?.reviewOutcome === 'approved' &&
    !bracket.officialFlag;
  const playoffReady = published && locked;
  const matches = bracket?.matches ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/manage/tournaments/${tournamentId}/categories/${categoryId}`}
              className="hover:underline"
            >
              Category
            </Link>
            {' / '}
            Playoff
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight">Playoff</h1>
          <p className="text-muted-foreground">
            Generate → Review → Publish → Lock (Playoff Ready)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {playoff ? playoff.publishState : 'unpublished'}
          </Badge>
          <Badge variant="secondary">
            {playoff ? playoff.lockState : 'unlocked'}
          </Badge>
          {playoffReady ? <Badge>Playoff Ready</Badge> : null}
        </div>
      </div>

      {playoffReady ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/manage/tournaments/${tournamentId}/categories/${categoryId}/champion`}
            >
              View Champion
            </Link>
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {actionError}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate</CardTitle>
              <CardDescription>
                Needs published/live tournament and enough qualified teams
                (2 groups × top 2 → SF + Final).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full"
                disabled={locked || generateMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  generateMutation.mutate();
                }}
              >
                {generateMutation.isPending
                  ? 'Generating…'
                  : 'Generate version'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versions</CardTitle>
              <CardDescription>
                {brackets.length === 0
                  ? 'No brackets yet'
                  : `${brackets.length} version(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {brackets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Generate the first candidate.
                </p>
              ) : (
                brackets.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedBracketId(item.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      item.id === activeBracketId
                        ? 'border-foreground/30 bg-muted/60'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <span>
                      Version {item.versionNumber}
                      {item.officialFlag ? ' · official' : ''}
                    </span>
                    <span className="text-muted-foreground">
                      {item.reviewOutcome ?? item.versionStatus}
                    </span>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canReview || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate('approved')}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!canReview || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate('rejected')}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  disabled={!canPublish || publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                >
                  Publish
                </Button>
                <Button
                  size="sm"
                  disabled={
                    !published || locked || lockMutation.isPending || !playoff
                  }
                  onClick={() => lockMutation.mutate()}
                >
                  Lock
                </Button>
              </div>
              {locked ? (
                <div className="space-y-2 pt-2">
                  <Label htmlFor="unlockReason">Unlock reason</Label>
                  <Input
                    id="unlockReason"
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                    placeholder="Required"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      unlockReason.trim().length < 3 ||
                      unlockMutation.isPending
                    }
                    onClick={() => unlockMutation.mutate()}
                  >
                    Unlock
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!activeBracketId ? (
            <Alert>
              <AlertTitle>No bracket selected</AlertTitle>
              <AlertDescription>
                Generate a bracket from qualified standings to preview SF and
                Final slots.
              </AlertDescription>
            </Alert>
          ) : bracketQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading bracket…</p>
          ) : bracketQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load bracket</AlertTitle>
              <AlertDescription>
                {getErrorMessage(bracketQuery.error)}
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>
                  Bracket · Version {bracket?.versionNumber}
                </CardTitle>
                <CardDescription>
                  {matches.length} materialized match(es)
                  {bracket?.officialFlag ? ' · official' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3" data-bracket-matches>
                {matches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No materialized matches on this version.
                  </p>
                ) : (
                  matches.map((match) => (
                    <article
                      key={match.id}
                      data-bracket-position={match.bracketPosition ?? ''}
                      data-match-id={match.id}
                      data-match-status={match.status}
                      className="rounded-lg border border-border p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {positionLabel(match.bracketPosition)}
                            {match.bracketPosition
                              ? ` · ${match.bracketPosition}`
                              : ''}
                          </p>
                          <h3 className="mt-1 font-heading text-lg tracking-tight">
                            {sideName(match, 'A')}
                            <span className="mx-2 text-muted-foreground">
                              vs
                            </span>
                            {sideName(match, 'B')}
                          </h3>
                        </div>
                        <Badge variant="secondary">{match.status}</Badge>
                      </div>
                      <div className="mt-3">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/manage/tournaments/${tournamentId}/categories/${categoryId}/matches/${match.id}`}
                          >
                            Open Match
                          </Link>
                        </Button>
                      </div>
                    </article>
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
