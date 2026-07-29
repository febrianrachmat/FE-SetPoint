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
  generateDrawing,
  getDrawing,
  getDrawingVersion,
  listDrawingVersions,
  lockDrawing,
  publishDrawingVersion,
  reviewDrawingVersion,
  unlockDrawing,
  type PlacementMode,
} from '@/lib/api/drawing';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

export function DrawingPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [placementMode, setPlacementMode] = useState<PlacementMode>('random');
  const [drawingSeed, setDrawingSeed] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const drawingQuery = useQuery({
    queryKey: ['drawing', tournamentId, categoryId],
    queryFn: () => getDrawing(tournamentId, categoryId),
  });

  const versionsQuery = useQuery({
    queryKey: ['drawing-versions', tournamentId, categoryId],
    queryFn: () => listDrawingVersions(tournamentId, categoryId),
  });

  const activeVersionId = useMemo(() => {
    if (selectedVersionId) return selectedVersionId;
    const items = versionsQuery.data?.items ?? [];
    return items[0]?.id ?? null;
  }, [selectedVersionId, versionsQuery.data?.items]);

  const versionQuery = useQuery({
    queryKey: ['drawing-version', tournamentId, categoryId, activeVersionId],
    queryFn: () =>
      getDrawingVersion(tournamentId, categoryId, activeVersionId!),
    enabled: Boolean(activeVersionId),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['drawing', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['drawing-versions', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['drawing-version', tournamentId, categoryId],
      }),
    ]);
  };

  const generateMutation = useMutation({
    mutationFn: () =>
      generateDrawing(tournamentId, categoryId, {
        placementMode,
        drawingSeed: drawingSeed.trim() || undefined,
      }),
    onSuccess: async (version) => {
      setActionError(null);
      setSelectedVersionId(version.id);
      await invalidate();
      toast.success(`Drawing v${version.versionNumber} generated`);
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const reviewMutation = useMutation({
    mutationFn: (outcome: 'approved' | 'rejected') =>
      reviewDrawingVersion(tournamentId, categoryId, activeVersionId!, {
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
      publishDrawingVersion(tournamentId, categoryId, activeVersionId!),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Drawing published as Official');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const lockMutation = useMutation({
    mutationFn: () => lockDrawing(tournamentId, categoryId),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Drawing locked — Schedule Ready');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const unlockMutation = useMutation({
    mutationFn: () => unlockDrawing(tournamentId, categoryId, unlockReason),
    onSuccess: async () => {
      setActionError(null);
      setUnlockReason('');
      await invalidate();
      toast.success('Drawing unlocked');
    },
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  if (drawingQuery.isLoading || versionsQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading drawing…</p>;
  }

  if (drawingQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load drawing</AlertTitle>
        <AlertDescription>{getErrorMessage(drawingQuery.error)}</AlertDescription>
      </Alert>
    );
  }

  const drawing = drawingQuery.data;
  const versions = versionsQuery.data?.items ?? [];
  const version = versionQuery.data;
  const locked = drawing?.lockState === 'locked';
  const published = drawing?.publishState === 'published';
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
  const scheduleReady = published && locked;

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
            Drawing
          </p>
          <h1 className="mt-1 font-heading text-3xl tracking-tight">Drawing</h1>
          <p className="text-muted-foreground">
            Generate → Review → Publish → Lock (Schedule Ready)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {drawing ? drawing.publishState : 'unpublished'}
          </Badge>
          <Badge variant="secondary">
            {drawing ? drawing.lockState : 'unlocked'}
          </Badge>
          {scheduleReady ? <Badge>Schedule Ready</Badge> : null}
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
                Tournament must be Setup or Published. Needs enough eligible teams
                for the category partition.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="placementMode">Placement mode</Label>
                <select
                  id="placementMode"
                  className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={placementMode}
                  onChange={(event) =>
                    setPlacementMode(event.target.value as PlacementMode)
                  }
                  disabled={locked}
                >
                  <option value="random">random</option>
                  <option value="seeded">seeded</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="drawingSeed">Seed (optional)</Label>
                <Input
                  id="drawingSeed"
                  value={drawingSeed}
                  onChange={(event) => setDrawingSeed(event.target.value)}
                  placeholder="auto-generated if empty"
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
                  Generate the first candidate.
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
                {version.placementMode} · seed {version.drawingSeed.slice(0, 12)}
                … · {version.engineVersion}
                {version.reviewOutcome
                  ? ` · review ${version.reviewOutcome}`
                  : ''}
              </CardDescription>
            ) : (
              <CardDescription>
                Generate a candidate to inspect groups and members.
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
              <div className="grid gap-4 md:grid-cols-2">
                {version.groups.map((group) => (
                  <div key={group.id} className="rounded-lg border p-3">
                    <p className="mb-2 font-medium">
                      {group.name}
                      {group.label ? ` (${group.label})` : ''}
                    </p>
                    <ul className="space-y-1 text-sm">
                      {group.members.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <span>
                            {member.placementOrder}. {member.team.name}
                          </span>
                          <span className="text-muted-foreground">
                            {member.team.seedRank != null
                              ? `seed ${member.team.seedRank}`
                              : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
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
