import { api } from './client';
import type { Paginated, Tournament, TournamentStatus } from './tournaments';

export type PublicTournamentFilter = 'all' | 'live' | 'upcoming';

export function listPublicTournaments(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
  status?: Extract<TournamentStatus, 'published' | 'live'>;
}) {
  return api<Paginated<Tournament>>('get', '/public/tournaments', { params });
}

export function getPublicTournament(id: string) {
  return api<Tournament>('get', `/public/tournaments/${id}`);
}
