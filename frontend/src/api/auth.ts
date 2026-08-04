/* =============================================================
 * API de autenticación y perfil.
 * ============================================================= */
import { apiFetch } from './client';
import { clearToken, setToken } from './token';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthProfile {
  username: string;
  displayName: string | null;
  avatar: string | null;
}

export interface MeResponse {
  user: AuthUser;
  profile: AuthProfile;
  session: { id: string };
}

export interface PublicProfile {
  userId: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
}

/** POST /auth/register → cuenta creada (no inicia sesión). */
export async function register(
  email: string,
  password: string,
  username: string,
): Promise<{ user: AuthUser & { username: string } }> {
  return apiFetch('/auth/register', {
    method: 'POST',
    auth: false,
    body: { email, password, username },
  });
}

/** POST /auth/login → guarda el token y devuelve el usuario. */
export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
  setToken(res.token);
  return res.user;
}

/** POST /auth/logout → revoca en el backend y limpia el token local. */
export async function logout(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
  }
}

/** GET /auth/me → identidad autenticada actual. */
export async function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}

/** GET /profile → perfil público del usuario autenticado. */
export async function getProfile(): Promise<PublicProfile> {
  return apiFetch<PublicProfile>('/profile');
}

/** PATCH /profile → actualiza displayName/avatar. */
export async function updateProfile(changes: {
  displayName?: string | null;
  avatar?: string | null;
}): Promise<PublicProfile> {
  return apiFetch<PublicProfile>('/profile', { method: 'PATCH', body: changes });
}
