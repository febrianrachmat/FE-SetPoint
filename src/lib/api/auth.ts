import { api } from './client';

export type AuthRole = {
  role: string;
  tournamentId: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  roles: AuthRole[];
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: AuthUser;
};

export function login(email: string, password: string) {
  return api<LoginResponse>('post', '/auth/login', {
    body: { email, password },
  });
}

export function fetchMe() {
  return api<AuthUser>('get', '/auth/me');
}
