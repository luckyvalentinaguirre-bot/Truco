/* =============================================================
 * Almacenamiento temporal del token de sesión (sessionStorage).
 * -------------------------------------------------------------
 * Etapa inicial: NO se usa localStorage ni cookies. El token vive
 * sólo en la pestaña actual.
 * ============================================================= */
const KEY = 'truco.session.token';

export function getToken(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    /* almacenamiento no disponible: se ignora */
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
