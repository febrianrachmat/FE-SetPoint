import type { AuthUser } from '@/lib/api/auth';

export function isAdminUser(user: AuthUser | null | undefined) {
  if (!user) return false;
  return user.roles.some(
    (r) => r.role === 'super_admin' || r.role === 'tournament_admin',
  );
}

export function isRefereeOnly(user: AuthUser | null | undefined) {
  if (!user) return false;
  const hasReferee = user.roles.some((r) => r.role === 'referee');
  return hasReferee && !isAdminUser(user);
}

export function homePathForUser(user: AuthUser | null | undefined) {
  if (isRefereeOnly(user)) return '/referee';
  return '/tournaments';
}
