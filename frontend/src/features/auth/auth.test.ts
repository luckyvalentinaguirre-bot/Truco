import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';

/** Respuesta fake tipo fetch. */
function res(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  // Aseguramos que NO exista storage del que depender.
  (globalThis as { sessionStorage?: unknown }).sessionStorage = undefined;
  (globalThis as { localStorage?: unknown }).localStorage = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/auth (cookie de sesión)', () => {
  it('register llama POST /auth/register con credentials: include', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { user: { id: '1', email: 'a@b.com', username: 'u' } }));
    await authApi.register('a@b.com', 'clavefuerte9', 'u');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/register$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com', password: 'clavefuerte9', username: 'u' });
    // Nunca Authorization Bearer.
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('login NO almacena ningún token y usa credentials: include', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { user: { id: '1', email: 'a@b.com' } }));
    const user = await authApi.login('a@b.com', 'clavefuerte9');
    expect(user.email).toBe('a@b.com');
    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBe('include');
    // No hay storage de token.
    expect((globalThis as { sessionStorage?: unknown }).sessionStorage).toBeUndefined();
    expect((globalThis as { localStorage?: unknown }).localStorage).toBeUndefined();
  });

  it('logout usa credentials: include (borra la cookie en el backend)', async () => {
    fetchMock.mockResolvedValueOnce(res(204));
    await authApi.logout();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/logout$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });

  it('getMe usa la cookie (credentials: include) y devuelve user + profile', async () => {
    fetchMock.mockResolvedValueOnce(
      res(200, { user: { id: '1', email: 'a@b.com' }, profile: { username: 'u', displayName: 'N', avatar: null }, session: { id: 's1' } }),
    );
    const me = await authApi.getMe();
    expect(me.user.email).toBe('a@b.com');
    expect(me.profile.username).toBe('u');
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('profile usa la cookie (credentials: include)', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { userId: '1', username: 'u', displayName: null, avatar: null }));
    await authApi.getProfile();
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
  });

  it('un 401 se propaga como ApiError (la sesión pasa a no válida)', async () => {
    fetchMock.mockResolvedValueOnce(res(401, { error: { code: 'invalid_session', message: 'Sesión inválida' } }));
    const err = await authApi.getMe().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(401);
  });

  it('los errores HTTP se propagan como ApiError con status/code', async () => {
    fetchMock.mockResolvedValueOnce(res(409, { error: { code: 'email_taken', message: 'Ya existe' } }));
    const err = await authApi.register('a@b.com', 'x', 'u').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('email_taken');
  });
});
