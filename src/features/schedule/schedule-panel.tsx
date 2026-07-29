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
  generateSchedule,
  getSchedule,
  getScheduleVersion,
  listScheduleVersions,
  lockSchedule,
  publishScheduleVersion,
  reviewScheduleVersion,
  unlockSchedule,
} from '@/lib/api/schedule';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function formatWhen(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function matchLabel(entry: {
  match: {
    group: { name: string } | null;
    participations: Array<{ sideLabel: string; team: { name: string } }>;
  };
}) {
  const sides = entry.match.participations
    .map((p) => `${p.sideLabel}: ${p.team.name}`)
    .join(' vs ');
  const group = entry.match.group?.name;
  return group ? `${group} · ${sides}` : sides;
}

export function SchedulePanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [matchDurationMinutes, setMatchDurationMinutes] = useState('90');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ['schedule', tournamentId, categoryId],
    queryFn: () => getSchedule(tournamentId, categoryId),
  });

  const versionsQuery = useQuery({
    queryKey: ['schedule-versions', tournamentId, categoryId],
    queryFn: () => listScheduleVersions(tournamentId, categoryId),
  });

  const activeVersionId = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    return versionsQuery.data?.items[0]?.id ?? null;
  }, [selectedVersionId, versionsQuery.data?.items]);

  const versionQuery = useQuery({
    queryKey: ['schedule-version', tournamentId, categoryId, activeVersionId],
    queryFn: () =>
      getScheduleVersion(tournamentId, categoryId, activeVersionId!),
    enabled: Boolean(activeVersionId),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['schedule', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule-versions', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['schedule-version', tournamentId, categoryId],
      }),
    ]);
  };

  const generateMutation = useMutation({
    mutationFn: () => {
      const minutes = Number(matchDurationMinutes);
      return generateSchedule(tournamentId, categoryId, {
        matchDurationMinutes:
          Number.isFinite(minutes) && minutes >= 15 ? minutes : 90,
      });
    },
    onSuccess: async (version) => {
      setActionError(null);
      setSelectedVersionId(version.id);
      await invalidate();
      toast.success(`Schedule v${version.versionNumber} generated`);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (outcome: 'approved' | 'rejected') =>
      reviewScheduleVersion(tournamentId, categoryId, activeVersionId!, {
        outcome,
      }),
    onSuccess: async (_, outcome) => {
      setActionError(null);
      await invalidate();
      toast.success(outcome === 'approved' ? 'Version approved' : 'Version rejected');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const publishMutation = useMutation({
    mutationFn: () =>
      publishScheduleVersion(tournamentId, categoryId, activeVersionId!),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Schedule published as Official');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockSchedule(tournamentId, categoryId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Schedule locked — Live Ready');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockSchedule(tournamentId, categoryId, unlockReason),
    onSuccess: async () => {
      setActionError(null);
      setUnlockReason('');
      await invalidate();
      toast.success('Schedule unlocked');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  if (scheduleQuery.isLoading || versionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading schedule…</p>;
  }

  if (scheduleQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load schedule</AlertTitle>
        <AlertDescription>{getErrorMessage(scheduleQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  const schedule = scheduleQuery.data;
  const versions = versionsQuery.data?.items ?? [];
  const version = versionQuery.data;
  const locked = schedule?.lockState === 'locked';
  const published = schedule?.publishState === 'published';
  const canReview =
    Boolean(activeVersionId) &&
    !locked &&
    version?.versionStatus === 'candidate' &&
    (version.reviewOutcome == null || version.reviewOutcome === 'pending');
  const canPublish =
    Boolean(activeVersionId) &&
    !locked &&
    version?.reviewOutcome === 'approved' &&
    !version.officialFlag;
  const liveReady = published && locked;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/tournaments/${tournamentId}/categories/${categoryId}`}
              className="hover:underline"
            >
              Category
            </Link>
            {' / '}
            Schedule
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">
            Requires Drawing Published ∧ Locked. Then Generate → Review → Publish
            → Lock (Live Ready).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {schedule ? schedule.publishState : 'unpublished'}
          </Badge>
          <Badge variant="secondary">
            {schedule ? schedule.lockState : 'unlocked'}
          </Badge>
          {liveReady ? <Badge>Live Ready</Badge> : null}
        </div>
      </div>

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
                Needs Schedule Ready Drawing and at least one available court.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="matchDurationMinutes">Match duration (min)</Label>
                <Input
                  id="matchDurationMinutes"
                  type="number"
                  min={15}
                  max={300}
                  value={matchDurationMinutes}
                  onChange={(event) => setMatchDurationMinutes(event.target.value)}
                  disabled={locked}
                />
              </div>
              <Button
                className="w-full"
                disabled={locked || generateMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  generateMutation.mutate();
                }}
              >
                {generateMutation.isPending ? 'Generating…' : 'Generate version'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Versions</CardTitle>
              <CardDescription>
                {versions.length === 0
                  ? 'No versions yet'
                  : `${versions.length} version(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Generate after Drawing is locked.
                </p>
              ) : (
                versions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedVersionId(item.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                      item.id === activeVersionId
                        ? 'border-foreground/30 bg-muted/60'
                        : 'hover:bg-muted/40',
                    )}
                  >
                    <span>
                      v{item.versionNumber}
                      {item.officialFlag ? ' · official' : ''}
                      {item._count
                        ? ` · ${item._count.matches} matches`
                        : ''}
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
                  disabled={!published || locked || lockMutation.isPending}
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
                    onChange={(event) => setUnlockReason(event.target.value)}
                    placeholder="Mandatory reason (3+ chars)"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      unlockReason.trim().length < 3 || unlockMutation.isPending
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

        <Card>
          <CardHeader>
            <CardTitle>
              {version
                ? `Version ${version.versionNumber}`
                : 'No version selected'}
            </CardTitle>
            {version ? (
              <CardDescription>
                {version.entries.length} entries
                {version.conflictStatus
                  ? ` · conflict ${version.conflictStatus}`
                  : ''}
                {version.reviewOutcome
                  ? ` · review ${version.reviewOutcome}`
                  : ''}
              </CardDescription>
            ) : (
              <CardDescription>
                Generated slots with court assignments appear here.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {versionQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading version…</p>
            ) : null}
            {versionQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorMessage(versionQuery.error)}
              </p>
            ) : null}
            {version ? (
              <div className="space-y-2">
                {version.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        #{entry.sequenceOrder} · {matchLabel(entry)}
                      </p>
                      <p className="text-muted-foreground">
                        {formatWhen(entry.scheduledStartAt)}
                        {entry.scheduledEndAt
                          ? ` → ${formatWhen(entry.scheduledEndAt)}`
                          : ''}
                      </p>
                    </div>
                    <span className="text-muted-foreground">
                      {entry.court
                        ? `${entry.court.label} — ${entry.court.name}`
                        : 'No court'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
