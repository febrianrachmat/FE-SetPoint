import axios, { AxiosError, type AxiosInstance } from 'axios';
import { ApiError, type ApiErrorBody, type ApiSuccess } from './types';

const TOKEN_KEY = 'setpoint.accessToken';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function createClient(): AxiosInstance {
  const baseURL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000/api/v1';

  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError<ApiErrorBody>) => {
      const body = error.response?.data;
      if (body && body.success === false && body.error) {
        if (body.error.statusCode === 401 && typeof window !== 'undefined') {
          setAccessToken(null);
          if (!window.location.pathname.startsWith('/login')) {
            window.location.assign('/login');
          }
        }
        return Promise.reject(
          new ApiError(body.error, body.meta?.requestId),
        );
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const apiClient = createClient();

type ApiOptions = {
  body?: unknown;
  params?: Record<string, unknown>;
};

/** Unwrap Set Point success envelope → `data`. */
export async function api<T>(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  options?: ApiOptions,
): Promise<T> {
  const response = await apiClient.request<ApiSuccess<T>>({
    method,
    url: path,
    data: options?.body,
    params: options?.params,
  });
  return response.data.data;
}
