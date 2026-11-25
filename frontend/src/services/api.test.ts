import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_TOKEN_STORAGE_KEY,
  apiFetch,
  clearAuthToken,
  loginRequest,
  registerUnauthorizedHandler,
  setAuthToken,
} from './api';

describe('services/api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    registerUnauthorizedHandler(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('usa caminho relativo /api/triagens (nunca http://localhost:3001)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await apiFetch('/triagens');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/triagens');
    expect(String(url)).not.toContain('localhost:3001');
  });

  it('anexa automaticamente o header Authorization: Bearer <token> quando há token no localStorage', async () => {
    setAuthToken('jwt-teste-123');
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('jwt-teste-123');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await apiFetch('/triagens');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-teste-123');
  });

  it('invoca o callback onUnauthorized em respostas 401 fora de /auth/login', async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    setAuthToken('token-expirado');

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Sessão expirada.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(apiFetch('/triagens')).rejects.toThrow('Sessão expirada.');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('NÃO invoca onUnauthorized em 401 retornado por /auth/login', async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    clearAuthToken();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'E-mail ou senha inválidos.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(loginRequest('tech@benchos.local', 'errada')).rejects.toThrow(
      'E-mail ou senha inválidos.',
    );
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
