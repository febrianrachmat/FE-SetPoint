import { api } from './client';
import { isApiError } from './types';

export type PlacementMode = 'random' | 'seeded';

export type DrawingHeader = {
  id: string;
  categoryId: string;
  publishState: string;
  reviewStatus: string;
  lockState: string;
  currentOfficialVersionId: string | null;
  currentOfficialVersion?: {
    id: string;
    versionNumber: number;
    drawingSeed: string;
    placementMode: string;
    officialFlag: boolean;
    versionStatus: string;
    reviewOutcome: string | null;
    createdAt: string;
  } | null;
  publishedAt?: string | null;
  lockedAt?: string | null;
};

export type DrawingVersionSummary = {
  id: string;
  versionNumber: number;
  drawingSeed: string;
  placementMode: string;
  officialFlag: boolean;
  versionStatus: string;
  reviewOutcome: string | null;
  createdAt: string;
};

export type DrawingVersionDetail = DrawingVersionSummary & {
  prngAlgorithm: string | null;
  engineVersion: string;
  generationDurationMs: number | null;
  drawing: {
    id: string;
    categoryId: string;
    publishState: string;
    lockState: string;
    reviewStatus: string;
    currentOfficialVersionId: string | null;
  };
  groups: Array<{
    id: string;
    name: string;
    label: string | null;
    members: Array<{
      id: string;
      placementOrder: number;
      team: {
        id: string;
        name: string;
        seedRank: number | null;
        eligibilityStatus: string;
        status: string;
      };
    }>;
  }>;
};

export type DrawingVersionList = {
  items: DrawingVersionSummary[];
  currentOfficialVersionId: string | null;
  publishState?: string;
  reviewStatus?: string;
  lockState?: string;
};

function base(tournamentId: string, categoryId: string) {
  return `/tournaments/${tournamentId}/categories/${categoryId}/drawing`;
}

export async function getDrawing(tournamentId: string, categoryId: string) {
  try {
    return await api<DrawingHeader>('get', base(tournamentId, categoryId));
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export function listDrawingVersions(tournamentId: string, categoryId: string) {
  return api<DrawingVersionList>('get', `${base(tournamentId, categoryId)}/versions`);
}

export function getDrawingVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
) {
  return api<DrawingVersionDetail>(
    'get',
    `${base(tournamentId, categoryId)}/versions/${versionId}`,
  );
}

export function generateDrawing(
  tournamentId: string,
  categoryId: string,
  body: { placementMode: PlacementMode; drawingSeed?: string },
) {
  return api<DrawingVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/generate`,
    { body },
  );
}

export function reviewDrawingVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
  body: { outcome: 'approved' | 'rejected'; note?: string },
) {
  return api<DrawingVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/versions/${versionId}/review`,
    { body },
  );
}

export function publishDrawingVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
) {
  return api<DrawingVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/versions/${versionId}/publish`,
  );
}

export function lockDrawing(tournamentId: string, categoryId: string) {
  return api<DrawingHeader>('post', `${base(tournamentId, categoryId)}/lock`);
}

export function unlockDrawing(
  tournamentId: string,
  categoryId: string,
  reason: string,
) {
  return api<DrawingHeader>('post', `${base(tournamentId, categoryId)}/unlock`, {
    body: { reason },
  });
}
