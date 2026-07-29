import { api } from './client';

export type TournamentStatus =
  | 'draft'
  | 'setup'
  | 'published'
  | 'live'
  | 'finished'
  | 'archived';

export type Tournament = {
  id: string;
  name: string;
  description: string | null;
  status: TournamentStatus;
  visibility: string;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function listTournaments(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  return api<Paginated<Tournament>>('get', '/tournaments', { params });
}

export function getTournament(id: string) {
  return api<Tournament>('get', `/tournaments/${id}`);
}

export function createTournament(body: {
  name: string;
  description?: string;
}) {
  return api<Tournament>('post', '/tournaments', { body });
}

export function moveTournamentToSetup(id: string) {
  return api<Tournament>('post', `/tournaments/${id}/setup`);
}
