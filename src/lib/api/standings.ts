import { api } from './client';

export type StandingRow = {
  id: string;
  categoryId: string;
  groupId: string | null;
  teamId: string;
  rankPosition: number | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  tieBreakNotes: string | null;
  qualificationStatus: 'qualified' | 'not_qualified';
  publishState: string;
  lockState: string;
  lastRecalculatedAt: string | null;
  team: { id: string; name: string };
  group: { id: string; name: string; label: string | null } | null;
};

export type StandingList = {
  items: StandingRow[];
};

function base(tournamentId: string, categoryId: string) {
  return `/tournaments/${tournamentId}/categories/${categoryId}/standings`;
}

export function listStandings(
  tournamentId: string,
  categoryId: string,
  params?: { groupId?: string },
) {
  return api<StandingList>('get', base(tournamentId, categoryId), { params });
}

export function listQualifiedStandings(
  tournamentId: string,
  categoryId: string,
  params?: { groupId?: string },
) {
  return api<StandingList>('get', `${base(tournamentId, categoryId)}/qualified`, {
    params,
  });
}

export function recalculateStandings(
  tournamentId: string,
  categoryId: string,
  body?: { groupId?: string },
) {
  return api<StandingList>(
    'post',
    `${base(tournamentId, categoryId)}/recalculate`,
    { body: body ?? {} },
  );
}
