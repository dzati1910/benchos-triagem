import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_TOKEN_STORAGE_KEY,
  apiFetch,
  clearAuthToken,
  concluirTriagem,
  iniciarAnaliseTriagem,
  loginRequest,
  reabrirTriagem,
  registerUnauthorizedHandler,
  salvarProgressoTriagem,
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

  it('envia PATCH corretamente para iniciar, salvar progresso, concluir e reabrir triagem', async () => {
    setAuthToken('jwt-teste-123');
    const okJson = () =>
      new Response(JSON.stringify({ id: 10 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    fetchMock
      .mockResolvedValueOnce(okJson())
      .mockResolvedValueOnce(okJson())
      .mockResolvedValueOnce(okJson())
      .mockResolvedValueOnce(okJson());

    await iniciarAnaliseTriagem(10);
    await salvarProgressoTriagem(10, {
      respostas: [{ itemChecklistId: 1, resultado: 'APROVADO', observacao: 'OK' }],
    });
    await concluirTriagem(10, {
      diagnosticoFinal: 'OPERACIONAL',
      parecerTecnico: 'Sem defeitos',
      resumoCliente: 'Tudo ok',
      respostas: [{ itemChecklistId: 1, resultado: 'APROVADO', observacao: 'OK' }],
    });
    await reabrirTriagem(10);

    expect(fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).method])).toEqual([
      ['/api/triagens/10/iniciar', 'PATCH'],
      ['/api/triagens/10/progresso', 'PATCH'],
      ['/api/triagens/10/concluir', 'PATCH'],
      ['/api/triagens/10/reabrir', 'PATCH'],
    ]);
  });
});
