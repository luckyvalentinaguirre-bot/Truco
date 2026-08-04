/* =============================================================
 * Backend · Router HTTP mínimo (sobre node:http, sin Express)
 * -------------------------------------------------------------
 * Coincidencia exacta por método + path. Cada handler puede lanzar
 * HttpError o errores de dominio: el router los mapea a una respuesta
 * JSON segura (sin stack traces).
 * ============================================================= */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { mapError } from './errorMapper.js';
import { sendJson } from './respond.js';

export type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;

export interface Route {
  method: string;
  path: string;
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, path: string, handler: Handler): this {
    this.routes.push({ method: method.toUpperCase(), path, handler });
    return this;
  }

  /** Intenta despachar el request. Devuelve false si ninguna ruta coincide. */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '').split('?')[0];
    const route = this.routes.find((r) => r.method === method && r.path === path);
    if (!route) return false;

    try {
      await route.handler(req, res);
    } catch (err) {
      const { status, body } = mapError(err);
      sendJson(res, status, body);
    }
    return true;
  }
}
