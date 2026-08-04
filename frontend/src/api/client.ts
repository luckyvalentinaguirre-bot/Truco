/* =============================================================
 * Cliente HTTP central para la API del backend.
 * -------------------------------------------------------------
 * La sesión viaja en una cookie HttpOnly: el navegador la envía
 * automáticamente con `credentials: "include"`. JavaScript NO tiene
 * acceso al token. No se usa Authorization ni sessionStorage.
 * ============================================================= */

/** URL base del backend (configurable por entorno de Vite). */
export const API_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ??
  'http://localhost:10000';

/** Error tipado para respuestas HTTP fallidas. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

/**
 * Realiza una request a la API con la cookie de sesión (credentials: include),
 * parsea JSON y lanza ApiError en respuestas no OK.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include', // envía/recibe la cookie de sesión
  });

  // 204 No Content: sin cuerpo.
  if (res.status === 204) {
    if (!res.ok) throw new ApiError(res.status, 'http_error', 'Error');
    return undefined as T;
  }

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? 'Error');
  }
  return data as T;
}
