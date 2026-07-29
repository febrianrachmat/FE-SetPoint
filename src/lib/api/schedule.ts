import { api } from './client';
import { isApiError } from './types';

export type ScheduleHeader = {
  id: string;
  categoryId: string;
  publishState: string;
  reviewStatus: string;
  lockState: string;
  currentOfficialVersionId: string | null;
  currentOfficialVersion?: {
    id: string;
    versionNumber: number;
    versionStatus: string;
    officialFlag: boolean;
    conflictStatus: string;
    createdAt: string;
  } | null;
  publishedAt?: string | null;
  lockedAt?: string | null;
};

export type ScheduleVersionSummary = {
  id: string;
  versionNumber: number;
  officialFlag: boolean;
  versionStatus: string;
  conflictStatus: string;
  reviewOutcome: string | null;
  createdAt: string;
  _count?: { matches: number; entries: number };
};

export type ScheduleEntry = {
  id: string;
  sequenceOrder: number;
  scheduledStartAt: string;
  scheduledEndAt: string | null;
  court: { id: string; name: string; label: string } | null;
  match: {
    id: string;
    status: string;
    group: { id: string; name: string; label: string | null } | null;
    participations: Array<{
      sideLabel: string;
      team: { id: string; name: string };
    }>;
  };
};

export type ScheduleVersionDetail = ScheduleVersionSummary & {
  engineVersion?: string;
  schedule: {
    id: string;
    categoryId: string;
    publishState: string;
    lockState: string;
    reviewStatus: string;
    currentOfficialVersionId: string | null;
  };
  entries: ScheduleEntry[];
};

export type ScheduleVersionList = {
  items: ScheduleVersionSummary[];
  currentOfficialVersionId: string | null;
  publishState?: string;
  reviewStatus?: string;
  lockState?: string;
};

function base(tournamentId: string, categoryId: string) {
  return `/tournaments/${tournamentId}/categories/${categoryId}/schedule`;
}

export async function getSchedule(tournamentId: string, categoryId: string) {
  try {
    return await api<ScheduleHeader>('get', base(tournamentId, categoryId));
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
}

export function listScheduleVersions(tournamentId: string, categoryId: string) {
  return api<ScheduleVersionList>(
    'get',
    `${base(tournamentId, categoryId)}/versions`,
  );
}

export function getScheduleVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
) {
  return api<ScheduleVersionDetail>(
    'get',
    `${base(tournamentId, categoryId)}/versions/${versionId}`,
  );
}

export function generateSchedule(
  tournamentId: string,
  categoryId: string,
  body?: { startAt?: string; matchDurationMinutes?: number },
) {
  return api<ScheduleVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/generate`,
    { body: body ?? {} },
  );
}

export function reviewScheduleVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
  body: { outcome: 'approved' | 'rejected'; note?: string },
) {
  return api<ScheduleVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/versions/${versionId}/review`,
    { body },
  );
}

export function publishScheduleVersion(
  tournamentId: string,
  categoryId: string,
  versionId: string,
) {
  return api<ScheduleVersionDetail>(
    'post',
    `${base(tournamentId, categoryId)}/versions/${versionId}/publish`,
  );
}

export function lockSchedule(tournamentId: string, categoryId: string) {
  return api<ScheduleHeader>('post', `${base(tournamentId, categoryId)}/lock`);
}

export function unlockSchedule(
  tournamentId: string,
  categoryId: string,
  reason: string,
) {
  return api<ScheduleHeader>(
    'post',
    `${base(tournamentId, categoryId)}/unlock`,
    { body: { reason } },
  );
}
