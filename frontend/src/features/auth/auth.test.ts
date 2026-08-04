import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as authApi from '@/api/auth';
import { ApiError } from '@/api/client';
import { getToken } from '@/api/token';

/** sessionStorage en memoria para el entorno node de vitest. */
function installSessionStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

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
  installSessionStorage();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/auth', () => {
  it('register llama POST /auth/register con el body correcto (sin Authorization)', async () => {
    fetchMock.mockResolvedValueOnce(res(201, { user: { id: '1', email: 'a@b.com', username: 'u' } }));
    await authApi.register('a@b.com', 'clavefuerte9', 'u');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/register$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@b.com', password: 'clavefuerte9', username: 'u' });
    expect(init.headers['Authorization']).toBeUndefined();
  });

  it('login guarda el token', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { token: 'tok-123', user: { id: '1', email: 'a@b.com' } }));
    const user = await authApi.login('a@b.com', 'clavefuerte9');
    expect(user.email).toBe('a@b.com');
    expect(getToken()).toBe('tok-123');
  });

  it('las requests autenticadas incluyen Authorization: Bearer', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { token: 'tok-xyz', user: { id: '1', email: 'a@b.com' } }));
    await authApi.login('a@b.com', 'clavefuerte9');
    fetchMock.mockResolvedValueOnce(res(200, { userId: '1', username: 'u', displayName: null, avatar: null }));
    await authApi.getProfile();
    const init = fetchMock.mock.calls[1][1];
    expect(init.headers['Authorization']).toBe('Bearer tok-xyz');
  });

  it('logout llama al backend y borra el token', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { token: 'tok', user: { id: '1', email: 'a@b.com' } }));
    await authApi.login('a@b.com', 'clavefuerte9');
    expect(getToken()).toBe('tok');
    fetchMock.mockResolvedValueOnce(res(204));
    await authApi.logout();
    expect(getToken()).toBeNull();
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/auth\/logout$/);
  });

  it('un 401 limpia el token local', async () => {
    fetchMock.mockResolvedValueOnce(res(200, { token: 'tok', user: { id: '1', email: 'a@b.com' } }));
    await authApi.login('a@b.com', 'clavefuerte9');
    expect(getToken()).toBe('tok');
    fetchMock.mockResolvedValueOnce(res(401, { error: { code: 'invalid_session', message: 'Sesión inválida' } }));
    await expect(authApi.getMe()).rejects.toBeInstanceOf(ApiError);
    expect(getToken()).toBeNull();
  });

  it('getMe devuelve el usuario y su perfil', async () => {
    fetchMock.mockResolvedValueOnce(
      res(200, { user: { id: '1', email: 'a@b.com' }, profile: { username: 'u', displayName: 'N', avatar: null }, session: { id: 's1' } }),
    );
    const me = await authApi.getMe();
    expect(me.user.email).toBe('a@b.com');
    expect(me.profile.username).toBe('u');
  });

  it('los errores HTTP se propagan como ApiError con status/code', async () => {
    fetchMock.mockResolvedValueOnce(res(409, { error: { code: 'email_taken', message: 'Ya existe' } }));
    const err = await authApi.register('a@b.com', 'x', 'u').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect((err as ApiError).code).toBe('email_taken');
  });
});
