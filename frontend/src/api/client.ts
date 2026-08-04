/* =============================================================
 * Cliente HTTP central para la API del backend.
 * -------------------------------------------------------------
 * Centraliza fetch, base URL, Content-Type, Authorization (Bearer),
 * parseo de JSON y manejo de errores. La URL sale de VITE_API_URL.
 * ============================================================= */
import { clearToken, getToken } from './token';

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
  /** Enviar el Authorization: Bearer si hay token (default true). */
  auth?: boolean;
}

/**
 * Realiza una request a la API. Agrega Authorization si corresponde, parsea
 * JSON y lanza ApiError en respuestas no OK. Ante 401 limpia el token local.
 */
export async function apiFetch<T = unknown>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = auth ? getToken() : null;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // Sesión inválida/expirada: se descarta el token local.
    clearToken();
  }

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
