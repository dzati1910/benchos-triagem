import type { LoginResponse, MeResponse } from '../types';

export const API_BASE = '/api';
export const AUTH_TOKEN_STORAGE_KEY = 'benchos_token';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function registerUnauthorizedHandler(cb: UnauthorizedHandler | null): void {
  unauthorizedHandler = cb;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !normalizedPath.startsWith('/auth/login')) {
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: unknown; code?: unknown }
      | null;
    const message =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error
        : `Erro na requisição (${res.status})`;
    const code = payload && typeof payload.code === 'string' ? payload.code : undefined;
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function loginRequest(email: string, senha: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

export function fetchMeRequest(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}
