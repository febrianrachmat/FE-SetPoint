import { api } from './client';

export type RefereeAssignmentItem = {
  id: string;
  assignedAt: string;
  assignmentStatus: string;
  match: {
    id: string;
    status: string;
    bracketPosition: string | null;
    scheduledStartAt: string | null;
    tournamentId: string;
    tournamentName: string;
    tournamentStatus: string;
    categoryId: string;
    categoryName: string;
    court: { id: string; name: string; label: string } | null;
    participations: Array<{
      sideLabel: string;
      team: { id: string; name: string };
    }>;
  };
};

export function listMyRefereeAssignments() {
  return api<{ items: RefereeAssignmentItem[] }>('get', '/referee/assignments');
}

export function assignReferee(
  tournamentId: string,
  categoryId: string,
  matchId: string,
  email: string,
) {
  return api<{
    id: string;
    matchId: string;
    refereeId: string;
    assignedAt: string;
    assignmentStatus: string;
  }>(
    'post',
    `/tournaments/${tournamentId}/categories/${categoryId}/matches/${matchId}/referees`,
    { body: { email } },
  );
}
