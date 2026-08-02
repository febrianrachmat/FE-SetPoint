import { api } from './client';
import type { Category } from './categories';
import type { DrawingVersionDetail } from './drawing';
import type { MatchItem, MatchList, MatchStatus } from './matches';
import type { BracketDetail } from './playoff';
import type { ScheduleVersionDetail } from './schedule';
import type { StandingList } from './standings';
import type { Paginated, Tournament, TournamentStatus } from './tournaments';

export type PublicTournamentFilter = 'all' | 'live' | 'upcoming';

export type PublicCategory = Category & {
  competitionMode?: 'group_then_knockout' | 'knockout_only' | string;
};

export type PublicReadyEnvelope<T> = {
  ready: boolean;
  reason?: string;
} & T;

function hubBase(tournamentId: string) {
  return `/public/tournaments/${tournamentId}/categories`;
}

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

export function listPublicCategories(tournamentId: string) {
  return api<Paginated<PublicCategory>>(
    'get',
    hubBase(tournamentId),
    { params: { pageSize: 100 } },
  );
}

export function listPublicMatches(
  tournamentId: string,
  categoryId: string,
  params?: { status?: MatchStatus; page?: number; pageSize?: number },
) {
  return api<
    PublicReadyEnvelope<{
      items: MatchItem[];
      pagination: MatchList['pagination'];
    }>
  >('get', `${hubBase(tournamentId)}/${categoryId}/matches`, { params });
}

export function getPublicSchedule(tournamentId: string, categoryId: string) {
  return api<
    PublicReadyEnvelope<{ version: ScheduleVersionDetail | null }>
  >('get', `${hubBase(tournamentId)}/${categoryId}/schedule`);
}

export function getPublicDrawing(tournamentId: string, categoryId: string) {
  return api<PublicReadyEnvelope<{ version: DrawingVersionDetail | null }>>(
    'get',
    `${hubBase(tournamentId)}/${categoryId}/drawing`,
  );
}

export function listPublicStandings(
  tournamentId: string,
  categoryId: string,
) {
  return api<PublicReadyEnvelope<StandingList>>(
    'get',
    `${hubBase(tournamentId)}/${categoryId}/standings`,
  );
}

export function getPublicPlayoff(tournamentId: string, categoryId: string) {
  return api<PublicReadyEnvelope<{ bracket: BracketDetail | null }>>(
    'get',
    `${hubBase(tournamentId)}/${categoryId}/playoff`,
  );
}
