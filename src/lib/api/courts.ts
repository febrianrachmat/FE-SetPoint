import { api } from './client';

export type CourtStatus = 'available' | 'unavailable' | 'maintenance';

export type Court = {
  id: string;
  tournamentId: string;
  name: string;
  label: string;
  status: CourtStatus;
  displayOrder: number;
  availabilityNotes: string | null;
};

export type CourtList = {
  items: Court[];
  availableCount: number;
};

export function listCourts(tournamentId: string) {
  return api<CourtList>('get', `/tournaments/${tournamentId}/courts`);
}

export function createCourt(
  tournamentId: string,
  body: {
    name: string;
    label: string;
    availabilityNotes?: string;
  },
) {
  return api<Court>('post', `/tournaments/${tournamentId}/courts`, { body });
}
