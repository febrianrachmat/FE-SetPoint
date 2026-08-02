'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PublicShell } from '@/components/public-shell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useLocale } from '@/features/public/locale';
import type { MatchItem } from '@/lib/api/matches';
import type { StandingRow } from '@/lib/api/standings';
import {
  getPublicDrawing,
  getPublicPlayoff,
  getPublicSchedule,
  getPublicTournament,
  listPublicCategories,
  listPublicMatches,
  listPublicStandings,
  type PublicCategory,
} from '@/lib/api/public-tournaments';
import { getErrorMessage } from '@/lib/api/types';
import { cn } from '@/lib/utils';

type HubTab = 'live' | 'schedule' | 'drawing' | 'standings' | 'playoff';

function sideName(match: MatchItem, side: 'A' | 'B') {
  return (
    match.participations.find((p) => p.sideLabel === side)?.team.name ??
    `Side ${side}`
  );
}

function scoreLabel(match: MatchItem) {
  const score = match.scoreRepresentation;
  if (!score) return '—';
  if (score.setsWon) return `${score.setsWon.A} – ${score.setsWon.B}`;
  const current = score.sets?.at(-1);
  if (current) return `${current.gamesA} – ${current.gamesB}`;
  return '—';
}

function formatWhen(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function groupStandings(items: StandingRow[]) {
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

function competitionModeOf(category: PublicCategory | undefined) {
  if (!category) return 'group_then_knockout';
  if (category.competitionMode) return category.competitionMode;
  const raw = category.configuration?.competitionMode;
  return typeof raw === 'string' ? raw : 'group_then_knockout';
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

export function PublicTournamentHub({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { t, locale } = useLocale();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [tab, setTab] = useState<HubTab>('live');

  const tournamentQuery = useQuery({
    queryKey: ['public-tournament', tournamentId],
    queryFn: () => getPublicTournament(tournamentId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['public-categories', tournamentId],
    queryFn: () => listPublicCategories(tournamentId),
    enabled: Boolean(tournamentQuery.data),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const activeCategoryId = categoryId ?? categories[0]?.id ?? null;
  const activeCategory = categories.find((item) => item.id === activeCategoryId);
  const mode = competitionModeOf(activeCategory);
  const isKnockoutOnly = mode === 'knockout_only';

  const tabs = useMemo(() => {
    const all: Array<{ id: HubTab; label: string; hidden?: boolean }> = [
      { id: 'live', label: t('hub.tab.live') },
      { id: 'schedule', label: t('hub.tab.schedule'), hidden: isKnockoutOnly },
      { id: 'drawing', label: t('hub.tab.drawing'), hidden: isKnockoutOnly },
      { id: 'standings', label: t('hub.tab.standings'), hidden: isKnockoutOnly },
      { id: 'playoff', label: t('hub.tab.playoff') },
    ];
    return all.filter((item) => !item.hidden);
  }, [isKnockoutOnly, t]);

  const effectiveTab =
    tabs.some((item) => item.id === tab) ? tab : (tabs[0]?.id ?? 'live');

  const liveQuery = useQuery({
    queryKey: ['public-matches', tournamentId, activeCategoryId, 'live'],
    queryFn: () =>
      listPublicMatches(tournamentId, activeCategoryId!, {
        status: 'live',
        pageSize: 100,
      }),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'live',
    refetchInterval:
      tournamentQuery.data?.status === 'live' && effectiveTab === 'live'
        ? 5000
        : false,
  });

  const allMatchesQuery = useQuery({
    queryKey: ['public-matches', tournamentId, activeCategoryId, 'all'],
    queryFn: () =>
      listPublicMatches(tournamentId, activeCategoryId!, { pageSize: 100 }),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'live',
    refetchInterval:
      tournamentQuery.data?.status === 'live' && effectiveTab === 'live'
        ? 5000
        : false,
  });

  const scheduleQuery = useQuery({
    queryKey: ['public-schedule', tournamentId, activeCategoryId],
    queryFn: () => getPublicSchedule(tournamentId, activeCategoryId!),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'schedule',
  });

  const drawingQuery = useQuery({
    queryKey: ['public-drawing', tournamentId, activeCategoryId],
    queryFn: () => getPublicDrawing(tournamentId, activeCategoryId!),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'drawing',
  });

  const standingsQuery = useQuery({
    queryKey: ['public-standings', tournamentId, activeCategoryId],
    queryFn: () => listPublicStandings(tournamentId, activeCategoryId!),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'standings',
  });

  const playoffQuery = useQuery({
    queryKey: ['public-playoff', tournamentId, activeCategoryId],
    queryFn: () => getPublicPlayoff(tournamentId, activeCategoryId!),
    enabled: Boolean(activeCategoryId) && effectiveTab === 'playoff',
  });

  const liveMatches = liveQuery.data?.items ?? [];
  const otherMatches = (allMatchesQuery.data?.items ?? []).filter(
    (match) => match.status !== 'live',
  );

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/tournaments" className="hover:underline">
              {t('hub.back')}
            </Link>
          </p>

          {tournamentQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : null}

          {tournamentQuery.isError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTitle>Tournament not found</AlertTitle>
              <AlertDescription>
                {getErrorMessage(tournamentQuery.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {tournamentQuery.data ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-4xl tracking-tight">
                  {tournamentQuery.data.name}
                </h1>
                <Badge
                  variant="secondary"
                  className={cn(
                    tournamentQuery.data.status === 'live' && 'text-emerald-700',
                  )}
                >
                  {tournamentQuery.data.status === 'live'
                    ? locale === 'id'
                      ? 'Langsung'
                      : 'Live'
                    : tournamentQuery.data.status === 'published'
                      ? locale === 'id'
                        ? 'Mendatang'
                        : 'Upcoming'
                      : tournamentQuery.data.status}
                </Badge>
              </div>
              {tournamentQuery.data.description ? (
                <p className="mt-2 max-w-2xl text-muted-foreground">
                  {tournamentQuery.data.description}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {tournamentQuery.data ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground" htmlFor="hub-category">
                {t('hub.category')}
              </label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('hub.noCategories')}
                </p>
              ) : (
                <select
                  id="hub-category"
                  className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={activeCategoryId ?? ''}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    setTab('live');
                  }}
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {activeCategoryId ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-sm transition-colors',
                        effectiveTab === item.id
                          ? 'border-foreground/30 bg-foreground text-background'
                          : 'border-border bg-background/70 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {effectiveTab === 'live' ? (
                  <div className="space-y-4">
                    {liveQuery.data && !liveQuery.data.ready ? (
                      <EmptyState
                        message={liveQuery.data.reason ?? t('hub.notReady')}
                      />
                    ) : null}
                    {liveQuery.isLoading || allMatchesQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : null}
                    {liveMatches.length > 0 ? (
                      <div className="space-y-2">
                        <h2 className="font-heading text-xl tracking-tight">
                          {t('hub.tab.live')}
                        </h2>
                        {liveMatches.map((match) => (
                          <div
                            key={match.id}
                            className="rounded-xl border border-border bg-card/80 px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  {sideName(match, 'A')} vs {sideName(match, 'B')}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {match.group?.name ?? 'Match'}
                                  {match.court
                                    ? ` · ${match.court.label}`
                                    : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-heading text-2xl tabular-nums tracking-tight">
                                  {scoreLabel(match)}
                                </p>
                                <Badge
                                  variant="secondary"
                                  className="text-emerald-700"
                                >
                                  Live
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {otherMatches.length > 0 ? (
                      <div className="space-y-2">
                        <h2 className="font-heading text-xl tracking-tight">
                          {locale === 'id' ? 'Jadwal / hasil' : 'Upcoming / results'}
                        </h2>
                        {otherMatches.slice(0, 20).map((match) => (
                          <div
                            key={match.id}
                            className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-medium">
                                  {sideName(match, 'A')} vs {sideName(match, 'B')}
                                </p>
                                <p className="text-muted-foreground">
                                  {match.group?.name ?? 'Match'}
                                  {match.court
                                    ? ` · ${match.court.label}`
                                    : ''}
                                  {match.scheduledStartAt
                                    ? ` · ${formatWhen(match.scheduledStartAt)}`
                                    : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-heading text-lg tabular-nums">
                                  {scoreLabel(match)}
                                </p>
                                <p className="text-muted-foreground">{match.status}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {liveQuery.data?.ready &&
                    liveMatches.length === 0 &&
                    otherMatches.length === 0 ? (
                      <EmptyState message={t('hub.empty')} />
                    ) : null}
                  </div>
                ) : null}

                {effectiveTab === 'schedule' ? (
                  <div className="space-y-3">
                    {scheduleQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : null}
                    {scheduleQuery.data && !scheduleQuery.data.ready ? (
                      <EmptyState
                        message={scheduleQuery.data.reason ?? t('hub.notReady')}
                      />
                    ) : null}
                    {scheduleQuery.data?.version?.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm"
                      >
                        <p className="font-medium">
                          #{entry.sequenceOrder}
                          {entry.match.group
                            ? ` · ${entry.match.group.name}`
                            : ''}
                          {' · '}
                          {entry.match.participations
                            .map((p) => `${p.sideLabel}: ${p.team.name}`)
                            .join(' vs ')}
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {formatWhen(entry.scheduledStartAt)}
                          {entry.scheduledEndAt
                            ? ` → ${formatWhen(entry.scheduledEndAt)}`
                            : ''}
                          {entry.court
                            ? ` · ${entry.court.label} — ${entry.court.name}`
                            : ''}
                        </p>
                      </div>
                    ))}
                    {scheduleQuery.data?.ready &&
                    (scheduleQuery.data.version?.entries.length ?? 0) === 0 ? (
                      <EmptyState message={t('hub.empty')} />
                    ) : null}
                  </div>
                ) : null}

                {effectiveTab === 'drawing' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {drawingQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : null}
                    {drawingQuery.data && !drawingQuery.data.ready ? (
                      <div className="sm:col-span-2">
                        <EmptyState
                          message={drawingQuery.data.reason ?? t('hub.notReady')}
                        />
                      </div>
                    ) : null}
                    {drawingQuery.data?.version?.groups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-xl border border-border bg-card/80 p-4"
                      >
                        <h3 className="font-heading text-xl tracking-tight">
                          {group.name}
                        </h3>
                        <ul className="mt-3 space-y-1 text-sm">
                          {group.members.map((member) => (
                            <li key={member.id}>
                              {member.placementOrder}. {member.team.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {drawingQuery.data?.ready &&
                    (drawingQuery.data.version?.groups.length ?? 0) === 0 ? (
                      <div className="sm:col-span-2">
                        <EmptyState message={t('hub.empty')} />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {effectiveTab === 'standings' ? (
                  <div className="space-y-4">
                    {standingsQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : null}
                    {standingsQuery.data && !standingsQuery.data.ready ? (
                      <EmptyState
                        message={standingsQuery.data.reason ?? t('hub.notReady')}
                      />
                    ) : null}
                    {standingsQuery.data?.ready
                      ? groupStandings(standingsQuery.data.items).map((group) => (
                          <div key={group.id} className="space-y-2">
                            <h3 className="font-heading text-xl tracking-tight">
                              {group.label}
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-border bg-card/80">
                              <table className="w-full min-w-[28rem] text-left text-sm">
                                <thead className="border-b bg-muted/40 text-muted-foreground">
                                  <tr>
                                    <th className="px-3 py-2 font-medium">#</th>
                                    <th className="px-3 py-2 font-medium">Team</th>
                                    <th className="px-3 py-2 font-medium">MP</th>
                                    <th className="px-3 py-2 font-medium">W</th>
                                    <th className="px-3 py-2 font-medium">L</th>
                                    <th className="px-3 py-2 font-medium">Pts</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.rows.map((row) => (
                                    <tr
                                      key={row.id}
                                      className={cn(
                                        'border-b last:border-0',
                                        row.qualificationStatus === 'qualified' &&
                                          'bg-emerald-50/60',
                                      )}
                                    >
                                      <td className="px-3 py-2 tabular-nums">
                                        {row.rankPosition ?? '—'}
                                      </td>
                                      <td className="px-3 py-2 font-medium">
                                        {row.team.name}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {row.matchesPlayed}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {row.wins}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums">
                                        {row.losses}
                                      </td>
                                      <td className="px-3 py-2 tabular-nums font-medium">
                                        {row.points}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      : null}
                    {standingsQuery.data?.ready &&
                    standingsQuery.data.items.length === 0 ? (
                      <EmptyState message={t('hub.empty')} />
                    ) : null}
                  </div>
                ) : null}

                {effectiveTab === 'playoff' ? (
                  <div className="space-y-3">
                    {playoffQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : null}
                    {playoffQuery.data && !playoffQuery.data.ready ? (
                      <EmptyState
                        message={playoffQuery.data.reason ?? t('hub.notReady')}
                      />
                    ) : null}
                    {playoffQuery.data?.bracket?.matches.map((match) => (
                      <div
                        key={match.id}
                        className="rounded-xl border border-border bg-card/80 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {match.bracketPosition ?? 'Match'}
                            </p>
                            <p className="text-muted-foreground">
                              {match.participations
                                .map((p) => `${p.sideLabel}: ${p.team.name}`)
                                .join(' vs ') || 'TBD'}
                            </p>
                          </div>
                          <p className="text-muted-foreground">{match.status}</p>
                        </div>
                      </div>
                    ))}
                    {playoffQuery.data?.ready &&
                    (playoffQuery.data.bracket?.matches.length ?? 0) === 0 ? (
                      <EmptyState message={t('hub.empty')} />
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
