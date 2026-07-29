import { api } from './client';
import { isApiError } from './types';

export type PlayoffHeader = {
  id: string;
  categoryId: string;
  publishState: string;
  reviewStatus: string;
  lockState: string;
  currentOfficialBracketId: string | null;
  qualificationBasis?: string | null;
  currentOfficialBracket?: {
    id: string;
    versionNumber: number;
    versionStatus: string;
    publishState: string;
  } | null;
  publishedAt?: string | null;
  lockedAt?: string | null;
};

export type BracketSummary = {
  id: string;
  versionNumber: number;
  versionStatus: string;
  officialFlag: boolean;
  reviewOutcome: string | null;
  publishState: string;
  lockState: string;
  generationSource: string;
  createdAt: string;
};

export type BracketMatch = {
  id: string;
  status: string;
  bracketPosition: string | null;
  participations: Array<{
    sideLabel: string;
    team: { id: string; name: string };
  }>;
};

export type BracketDetail = BracketSummary & {
  playoff: { id: string; categoryId: string };
  structureRepresentation?: unknown;
  matches: BracketMatch[];
  publishedAt?: string | null;
};

export type BracketList = {
  items: BracketSummary[];
  currentOfficialBracketId: string | null;
  publishState?: string;
  reviewStatus?: string;
  lockState?: string;
  qualificationBasis?: string | null;
};

function base(tournamentId: string, categoryId: string) {
  return `/tournaments/${tournamentId}/categories/${categoryId}/playoff`;
}

export async function getPlayoff(tournamentId: string, categoryId: string) {
  try {
    return await api<PlayoffHeader>('get', base(tournamentId, categoryId));
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export function listBrackets(tournamentId: string, categoryId: string) {
  return api<BracketList>('get', `${base(tournamentId, categoryId)}/brackets`);
}

export function getBracket(
  tournamentId: string,
  categoryId: string,
  bracketId: string,
) {
  return api<BracketDetail>(
    'get',
    `${base(tournamentId, categoryId)}/brackets/${bracketId}`,
  );
}

export function generatePlayoff(tournamentId: string, categoryId: string) {
  return api<BracketDetail>(
    'post',
    `${base(tournamentId, categoryId)}/generate`,
  );
}

export function reviewBracket(
  tournamentId: string,
  categoryId: string,
  bracketId: string,
  body: { outcome: 'approved' | 'rejected'; note?: string },
) {
  return api<BracketDetail>(
    'post',
    `${base(tournamentId, categoryId)}/brackets/${bracketId}/review`,
    { body },
  );
}

export function publishBracket(
  tournamentId: string,
  categoryId: string,
  bracketId: string,
) {
  return api<BracketDetail>(
    'post',
    `${base(tournamentId, categoryId)}/brackets/${bracketId}/publish`,
  );
}

export function lockPlayoff(tournamentId: string, categoryId: string) {
  return api<PlayoffHeader>('post', `${base(tournamentId, categoryId)}/lock`);
}

export function unlockPlayoff(
  tournamentId: string,
  categoryId: string,
  reason: string,
) {
  return api<PlayoffHeader>(
    'post',
    `${base(tournamentId, categoryId)}/unlock`,
    { body: { reason } },
  );
}

export function getChampion(tournamentId: string, categoryId: string) {
  return api<{
    teamId: string | null;
    team?: { id: string; name: string } | null;
  }>('get', `${base(tournamentId, categoryId)}/champion`);
}
