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
  engineVersion?: string;
  configSnapshot?: {
    templateId: string;
    gamesTo: number;
    mustWinBy: number;
    deuceMode: string;
  };
  sets?: Array<{
    gamesA: number;
    gamesB: number;
    tieBreak: { pointsA: number; pointsB: number } | null;
    game: {
      pointsA: number;
      pointsB: number;
      advantageSide: string | null;
    } | null;
    winnerSide?: string | null;
    isMatchTieBreak?: boolean;
  }>;
  setsWon?: { A: number; B: number };
  phase?: 'in_progress' | 'completed';
  winnerSide?: 'A' | 'B' | null;
  serverSide?: 'A' | 'B' | null;
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

export function scorePoint(
  tournamentId: string,
  categoryId: string,
  matchId: string,
  side: 'A' | 'B',
) {
  return api<MatchItem>(
    'post',
    `${base(tournamentId, categoryId)}/${matchId}/score/point`,
    { body: { side } },
  );
}

export function finishMatch(
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  return api<MatchItem>(
    'post',
    `${base(tournamentId, categoryId)}/${matchId}/finish`,
  );
}

export function verifyMatch(
  tournamentId: string,
  categoryId: string,
  matchId: string,
) {
  return api<MatchItem>(
    'post',
    `${base(tournamentId, categoryId)}/${matchId}/verify`,
  );
}
