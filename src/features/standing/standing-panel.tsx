'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  listQualifiedStandings,
  listStandings,
  recalculateStandings,
  type StandingRow,
} from '@/lib/api/standings';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

function groupRows(items: StandingRow[]) {
  const map = new Map<string, { label: string; rows: StandingRow[] }>();
  for (const row of items) {
    const key = row.groupId ?? 'ungrouped';
    const label = row.group?.name ?? 'Ungrouped';
    const bucket = map.get(key) ?? { label, rows: [] };
    bucket.rows.push(row);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([id, value]) => ({
    id,
    label: value.label,
    rows: value.rows.sort(
      (a, b) =>
        (a.rankPosition ?? 999) - (b.rankPosition ?? 999) ||
        b.points - a.points,
    ),
  }));
}

function StandingTable({
  rows,
  highlightQualified,
}: {
  rows: StandingRow[];
  highlightQualified?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">MP</th>
            <th className="px-3 py-2 font-medium">W</th>
            <th className="px-3 py-2 font-medium">L</th>
            <th className="px-3 py-2 font-medium">Pts</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const qualified = row.qualificationStatus === 'qualified';
            return (
              <tr
                key={row.id}
                data-standing-team={row.team.name}
                data-qualification={row.qualificationStatus}
                className={cn(
                  'border-b last:border-0',
                  highlightQualified && qualified && 'bg-emerald-50/60',
                )}
              >
                <td className="px-3 py-2 tabular-nums">{row.rankPosition ?? '—'}</td>
                <td className="px-3 py-2 font-medium">{row.team.name}</td>
                <td className="px-3 py-2 tabular-nums">{row.matchesPlayed}</td>
                <td className="px-3 py-2 tabular-nums">{row.wins}</td>
                <td className="px-3 py-2 tabular-nums">{row.losses}</td>
                <td className="px-3 py-2 tabular-nums font-medium">{row.points}</td>
                <td className="px-3 py-2">
                  {qualified ? (
                    <Badge>Qualified</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StandingPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const queryClient = useQueryClient();
  const [groupFilter, setGroupFilter] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const standingsQuery = useQuery({
    queryKey: ['standings', tournamentId, categoryId, groupFilter || 'all'],
    queryFn: () =>
      listStandings(tournamentId, categoryId, {
        groupId: groupFilter || undefined,
      }),
  });

  const qualifiedQuery = useQuery({
    queryKey: ['standings-qualified', tournamentId, categoryId, groupFilter || 'all'],
    queryFn: () =>
      listQualifiedStandings(tournamentId, categoryId, {
        groupId: groupFilter || undefined,
      }),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['standings', tournamentId, categoryId],
      }),
      queryClient.invalidateQueries({
        queryKey: ['standings-qualified', tournamentId, categoryId],
      }),
    ]);
  };

  const recalcMutation = useMutation({
    mutationFn: () =>
      recalculateStandings(tournamentId, categoryId, {
        groupId: groupFilter || undefined,
      }),
    onSuccess: async () => {
      setActionError(null);
      await invalidate();
      toast.success('Standings recalculated');
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setActionError(message);
      toast.error(message);
    },
  });

  const items = standingsQuery.data?.items ?? [];
  const qualified = qualifiedQuery.data?.items ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of standingsQuery.data?.items ?? []) {
      if (row.groupId && row.group) {
        map.set(row.groupId, row.group.name);
      }
    }
    // When filtered, still keep current selection option
    if (groupFilter && !map.has(groupFilter)) {
      const row = items.find((r) => r.groupId === groupFilter);
      if (row?.group) map.set(groupFilter, row.group.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [standingsQuery.data?.items, groupFilter, items]);

  // Load unfiltered once for group dropdown when filter active and empty
  const allStandingsQuery = useQuery({
    queryKey: ['standings', tournamentId, categoryId, 'all'],
    queryFn: () => listStandings(tournamentId, categoryId),
    enabled: Boolean(groupFilter) && groups.length === 0,
  });

  const groupOptions = useMemo(() => {
    if (groups.length > 0) return groups;
    const map = new Map<string, string>();
    for (const row of allStandingsQuery.data?.items ?? []) {
      if (row.groupId && row.group) map.set(row.groupId, row.group.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [groups, allStandingsQuery.data?.items]);

  const grouped = useMemo(() => groupRows(items), [items]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/manage/tournaments/${tournamentId}`} className="hover:underline">
            Tournament
          </Link>
          {' / '}
          <Link
            href={`/manage/tournaments/${tournamentId}/categories/${categoryId}`}
            className="hover:underline"
          >
            Category
          </Link>
          {' / '}
          Standings
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl tracking-tight">Standings</h1>
          {qualified.length > 0 ? (
            <Badge data-qualified-count={qualified.length}>
              {qualified.length} qualified
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-muted-foreground">
          Group tables update when matches are verified. Recalculate if you need a
          manual refresh.
        </p>
      </div>

      {actionError ? (
        <Alert variant="destructive">
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="standing-group-filter">Group</Label>
          <select
            id="standing-group-filter"
            className="flex h-9 min-w-44 rounded-md border border-input bg-transparent px-3 text-sm"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
          >
            <option value="">All groups</option>
            {groupOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
        >
          {recalcMutation.isPending ? 'Recalculating…' : 'Recalculate'}
        </Button>
        <Button
          variant="outline"
          onClick={() => void invalidate()}
          disabled={standingsQuery.isFetching}
        >
          Refresh
        </Button>
      </div>

      {standingsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading standings…</p>
      ) : null}

      {standingsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load standings</AlertTitle>
          <AlertDescription>
            {getErrorMessage(standingsQuery.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {!standingsQuery.isLoading && !standingsQuery.isError && items.length === 0 ? (
        <Alert>
          <AlertTitle>No standing rows yet</AlertTitle>
          <AlertDescription>
            Verify at least one group match, or run Recalculate after Official
            Locked Drawing exists.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-8" data-standing-groups>
        {grouped.map((group) => (
          <section key={group.id} data-standing-group={group.label}>
            <h2 className="mb-3 font-heading text-xl tracking-tight">
              {group.label}
            </h2>
            <StandingTable rows={group.rows} highlightQualified />
          </section>
        ))}
      </div>

      {qualified.length > 0 ? (
        <section data-qualified-section>
          <h2 className="mb-3 font-heading text-xl tracking-tight">
            Playoff intake
          </h2>
          <ul className="space-y-2">
            {qualified.map((row) => (
              <li
                key={row.id}
                data-qualified-team={row.team.name}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  {row.group?.name ? `${row.group.name} · ` : ''}
                  {row.team.name}
                </span>
                <span className="text-muted-foreground">
                  Rank {row.rankPosition ?? '—'} · {row.points} pts
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
