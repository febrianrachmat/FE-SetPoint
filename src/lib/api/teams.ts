import { api } from './client';
import type { Paginated } from './tournaments';

export type Team = {
  id: string;
  categoryId: string;
  name: string;
  status: string;
  seedRank: number | null;
  eligibilityStatus: string;
  createdAt: string;
};

export function listTeams(tournamentId: string, categoryId: string) {
  return api<Paginated<Team>>(
    'get',
    `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
  );
}

export function createTeam(
  tournamentId: string,
  categoryId: string,
  body: {
    name: string;
    players?: Array<{ displayName: string }>;
  },
) {
  return api<Team>(
    'post',
    `/tournaments/${tournamentId}/categories/${categoryId}/teams`,
    { body },
  );
}
