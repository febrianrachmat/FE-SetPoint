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
import { listCourts } from '@/lib/api/courts';
import {
  generateSchedule,
  getSchedule,
  getScheduleVersion,
  listScheduleVersions,
  lockSchedule,
  publishScheduleVersion,
  reviewScheduleVersion,
  unlockSchedule,
  updateScheduleEntry,
  type ScheduleEntry,
  type ScheduleStrategy,
} from '@/lib/api/schedule';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

const selectClassName = cn(
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
);

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function toTimeInputValue(date = new Date()) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function toDateTimeLocalValue(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${toDateInputValue(date)}T${toTimeInputValue(date)}`;
}

function combineLocalDateAndTime(date: string, time: string) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

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

function ScheduleEntryRow({
  entry,
  editable,
  busy,
  onSave,
}: {
  entry: ScheduleEntry;
  editable: boolean;
  busy: boolean;
  onSave: (input: {
    scheduledStartAt: string;
    scheduledEndAt?: string;
  }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [startLocal, setStartLocal] = useState(
    toDateTimeLocalValue(entry.scheduledStartAt),
  );
  const [endLocal, setEndLocal] = useState(
    entry.scheduledEndAt ? toDateTimeLocalValue(entry.scheduledEndAt) : '',
  );
  const [saving, setSaving] = useState(false);

  const openEditor = () => {
    setStartLocal(toDateTimeLocalValue(entry.scheduledStartAt));
    setEndLocal(
      entry.scheduledEndAt ? toDateTimeLocalValue(entry.scheduledEndAt) : '',
    );
    setEditing(true);
  };

  const save = async () => {
    const scheduledStartAt = localDateTimeToIso(startLocal);
    if (!scheduledStartAt) {
      toast.error('Start date/time is invalid');
      return;
    }
    const scheduledEndAt = endLocal ? localDateTimeToIso(endLocal) : undefined;
    if (endLocal && !scheduledEndAt) {
      toast.error('End date/time is invalid');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        scheduledStartAt,
        ...(scheduledEndAt ? { scheduledEndAt } : {}),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">
            #{entry.sequenceOrder} · {matchLabel(entry)}
          </p>
          {!editing ? (
            <button
              type="button"
              disabled={!editable || busy}
              onClick={openEditor}
              className={cn(
                'mt-0.5 text-left text-muted-foreground transition-colors',
                editable && !busy
                  ? 'underline decoration-dotted underline-offset-2 hover:text-foreground'
                  : 'cursor-default',
              )}
              title={editable ? 'Edit schedule' : undefined}
            >
              {formatWhen(entry.scheduledStartAt)}
              {entry.scheduledEndAt
                ? ` → ${formatWhen(entry.scheduledEndAt)}`
                : ''}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {entry.court
              ? `${entry.court.label} — ${entry.court.name}`
              : 'No court'}
          </span>
          {editable && !editing ? (
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={openEditor}
            >
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor={`start-${entry.id}`}>Start</Label>
            <Input
              id={`start-${entry.id}`}
              type="datetime-local"
              value={startLocal}
              onChange={(event) => setStartLocal(event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`end-${entry.id}`}>End</Label>
            <Input
              id={`end-${entry.id}`}
              type="datetime-local"
              value={endLocal}
              onChange={(event) => setEndLocal(event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="flex items-end">
            <Button size="sm" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SchedulePanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const now = useMemo(() => new Date(), []);
  const [matchDurationMinutes, setMatchDurationMinutes] = useState('90');
  const [restBufferMinutes, setRestBufferMinutes] = useState('0');
  const [strategy, setStrategy] = useState<ScheduleStrategy>('group_block');
  const [selectedCourtIds, setSelectedCourtIds] = useState<string[] | null>(
    null,
  );
  const [startDate, setStartDate] = useState(toDateInputValue(now));
  const [firstMatchStartTime, setFirstMatchStartTime] = useState(
    toTimeInputValue(now),
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const scheduleQuery = useQuery({
    queryKey: ['schedule', tournamentId, categoryId],
    queryFn: () => getSchedule(tournamentId, categoryId),
  });

  const courtsQuery = useQuery({
    queryKey: ['courts', tournamentId],
    queryFn: () => listCourts(tournamentId),
  });

  const availableCourts = useMemo(
    () =>
      (courtsQuery.data?.items ?? []).filter(
        (court) => court.status === 'available',
      ),
    [courtsQuery.data?.items],
  );

  const effectiveCourtIds = useMemo(() => {
    if (selectedCourtIds) return selectedCourtIds;
    return availableCourts.map((court) => court.id);
  }, [availableCourts, selectedCourtIds]);

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
      const buffer = Number(restBufferMinutes);
      const startAt = combineLocalDateAndTime(startDate, firstMatchStartTime);
      if (!startAt) {
        throw new Error('Start date and first match start time are required');
      }
      if (effectiveCourtIds.length < 1) {
        throw new Error('Select at least one available court for this category');
      }
      return generateSchedule(tournamentId, categoryId, {
        startAt,
        matchDurationMinutes:
          Number.isFinite(minutes) && minutes >= 15 ? minutes : 90,
        restBufferMinutes:
          Number.isFinite(buffer) && buffer >= 0 ? buffer : 0,
        strategy,
        courtIds: effectiveCourtIds,
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

  const rescheduleMutation = useMutation({
    mutationFn: (input: {
      entryId: string;
      scheduledStartAt: string;
      scheduledEndAt?: string;
    }) =>
      updateScheduleEntry(
        tournamentId,
        categoryId,
        activeVersionId!,
        input.entryId,
        {
          scheduledStartAt: input.scheduledStartAt,
          scheduledEndAt: input.scheduledEndAt,
        },
      ),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Match schedule updated');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
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
  const canEditEntries =
    Boolean(activeVersionId) &&
    !locked &&
    version != null &&
    version.versionStatus !== 'historical';
  const busy =
    generateMutation.isPending ||
    reviewMutation.isPending ||
    publishMutation.isPending ||
    lockMutation.isPending ||
    unlockMutation.isPending ||
    rescheduleMutation.isPending;

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
                Group-block keeps one group on one court until finished. Pick a
                court pool to batch this category beside others.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="strategy">Strategy</Label>
                <select
                  id="strategy"
                  className={selectClassName}
                  value={strategy}
                  disabled={locked}
                  onChange={(event) =>
                    setStrategy(event.target.value as ScheduleStrategy)
                  }
                >
                  <option value="group_block">
                    Group-block (1 court finishes 1 group)
                  </option>
                  <option value="round_wave">
                    Round-wave (all groups advance together)
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={locked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstMatchStartTime">First match start time</Label>
                <Input
                  id="firstMatchStartTime"
                  type="time"
                  value={firstMatchStartTime}
                  onChange={(event) => setFirstMatchStartTime(event.target.value)}
                  disabled={locked}
                />
              </div>
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
              <div className="space-y-2">
                <Label htmlFor="restBufferMinutes">Rest buffer (min)</Label>
                <Input
                  id="restBufferMinutes"
                  type="number"
                  min={0}
                  max={120}
                  value={restBufferMinutes}
                  onChange={(event) => setRestBufferMinutes(event.target.value)}
                  disabled={locked}
                />
                <p className="text-xs text-muted-foreground">
                  Gap after each match before the same court continues.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Court pool</Label>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    disabled={locked || availableCourts.length === 0}
                    onClick={() =>
                      setSelectedCourtIds(availableCourts.map((court) => court.id))
                    }
                  >
                    Select all
                  </button>
                </div>
                {courtsQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Loading courts…</p>
                ) : availableCourts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No available courts. Add courts first.
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border px-2 py-2">
                    {availableCourts.map((court) => {
                      const checked = effectiveCourtIds.includes(court.id);
                      return (
                        <label
                          key={court.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="size-3.5 accent-foreground"
                            checked={checked}
                            disabled={locked}
                            onChange={() => {
                              const current = effectiveCourtIds;
                              const next = checked
                                ? current.filter((id) => id !== court.id)
                                : [...current, court.id];
                              setSelectedCourtIds(next);
                            }}
                          />
                          <span>
                            {court.label} — {court.name}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Tip: 4 groups → pick 4 courts. With 8 courts, run 2 categories
                  in parallel on separate pools.
                </p>
              </div>
              <Button
                className="w-full"
                disabled={
                  locked ||
                  generateMutation.isPending ||
                  effectiveCourtIds.length < 1
                }
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
                {canEditEntries
                  ? ' · click a time or Edit to reschedule'
                  : locked
                    ? ' · unlock to edit times'
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
                  <ScheduleEntryRow
                    key={entry.id}
                    entry={entry}
                    editable={canEditEntries}
                    busy={busy}
                    onSave={async (input) => {
                      await rescheduleMutation.mutateAsync({
                        entryId: entry.id,
                        ...input,
                      });
                    }}
                  />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
