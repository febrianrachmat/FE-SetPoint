import { api } from './client';
import type { Paginated } from './tournaments';

export type Category = {
  id: string;
  tournamentId: string;
  name: string;
  format: string;
  visibility: string;
  configuration: Record<string, unknown> | null;
  createdAt: string;
};

export function listCategories(tournamentId: string) {
  return api<Paginated<Category>>(
    'get',
    `/tournaments/${tournamentId}/categories`,
  );
}

export function getCategory(tournamentId: string, categoryId: string) {
  return api<Category>(
    'get',
    `/tournaments/${tournamentId}/categories/${categoryId}`,
  );
}

export function createCategory(
  tournamentId: string,
  body: {
    name: string;
    format: string;
    configuration?: Record<string, unknown>;
  },
) {
  return api<Category>('post', `/tournaments/${tournamentId}/categories`, {
    body,
  });
}
