import { api } from './client';

export type MatchStatus =
  | 'waiting'
  | 'warm_up'
  | 'live'
  | 'finished'
  | 'verified';

export type MatchParticipation = {
  id: string;
  sideLabel: string;
  teamId: string;
  team: { id: string; name: string };
};

export type MatchScoreState = {
  sets?: Array<{
    gamesA: number;
    gamesB: number;
    winnerSide?: string | null;
  }>;
  setsWon?: { A: number; B: number };
  phase?: string;
  winnerSide?: string | null;
};

export type MatchItem = {
  id: string;
  categoryId: string;
  groupId: string | null;
  courtId: string | null;
  scheduleVersionId: string | null;
  status: MatchStatus;
  scheduledStartAt: string | null;
  actualStartAt: string | null;
  scoreRepresentation: MatchScoreState | null;
  group: { id: string; name: string; label: string | null } | null;
  court: { id: string; name: string; label: string } | null;
  participations: MatchParticipation[];
  refereeAssignments: Array<{
    id: string;
    refereeId: string;
    assignedAt: string;
    assignmentStatus: string;
  }>;
};

export type MatchList = {
  items: MatchItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function base(tournamentId: string, categoryId: string) {
  return `/tournaments/${tournamentId}/categories/${categoryId}/matches`;
}

export function listMatches(
  tournamentId: string,
  categoryId: string,
  params?: { status?: MatchStatus; page?: number; pageSize?: number },
) {
  return api<MatchList>('get', base(tournamentId, categoryId), { params });
}

export function getMatch(
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  return api<MatchItem>(
    'get',
    `${base(tournamentId, categoryId)}/${matchId}`,
  );
}

export function warmUpMatch(
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  return api<MatchItem>(
    'post',
    `${base(tournamentId, categoryId)}/${matchId}/warm-up`,
  );
}

export function startMatch(
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  return api<MatchItem>(
    'post',
    `${base(tournamentId, categoryId)}/${matchId}/start`,
  );
}
