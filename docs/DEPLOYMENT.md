# Despliegue y operación — TRUCO

Guía mínima para levantar el proyecto en desarrollo y en producción.
**Ningún valor secreto vive en el repo**: sólo se documentan los nombres.

## Estructura

- `frontend/` — React + Vite (sitio estático).
- `backend/` — API HTTP sobre `node:http` (sin Express) + PostgreSQL.
- `packages/game-rules/` — motor de reglas puro, compartido.

## Desarrollo local

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Backend
```bash
cd backend
npm install
# Requiere un .env con DATABASE_URL (ver Variables). NUNCA se commitea.
npm run dev          # http://localhost:10000  (GET /healthz)
```

### Base de datos / migraciones
```bash
cd backend
npm run db:test      # verifica conexión (SELECT NOW())
npm run db:migrate   # aplica migraciones pendientes (idempotente)
```

### Tests
```bash
# Motor de reglas
cd packages/game-rules && NODE_ENV=test npx vitest run
# Frontend (jsdom → requiere NODE_ENV=test)
cd frontend && NODE_ENV=test npx vitest run
# Backend (requiere PostgreSQL accesible por DATABASE_URL)
cd backend && npm test
```

## Producción

El despliegue está descrito como Infra-as-Code en [`render.yaml`](../render.yaml).

### Backend (Render — web service, runtime node)
- **Build:** `npm install && npm run build`
- **Start:** `npm start` (ejecuta `tsx src/index.ts`)
- **Health check:** `GET /healthz` → `{"status":"ok"}` (HTTP 200)
- Render inyecta `PORT`; el server usa `10000` como fallback.

### Frontend (Render — static site)
- **Build:** `npm install && npm run build`
- **Publish dir:** `dist`
- SPA rewrite: todas las rutas → `/index.html`.

### Base de datos (Neon — externa)
No se declara en `render.yaml` para no tocarla de forma destructiva.
La cadena de conexión se pasa como `DATABASE_URL` con `sslmode=require`.

## Variables de entorno (sólo nombres — nunca valores)

### Backend
| Nombre | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión PostgreSQL/Neon (`postgresql://…?sslmode=require`). |
| `DATABASE_SSL` | `require` \| `no-verify` \| `disable`. Neon: `require`. |
| `NODE_ENV` | `development` \| `test` \| `production`. |
| `PORT` | Puerto HTTP. Render lo inyecta; local fallback `10000`. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma. **Nunca `*`.** |

### Frontend (públicas, prefijo `VITE_`)
| Nombre | Descripción |
|---|---|
| `VITE_API_URL` | URL pública del backend (`https://…` en prod). |

> Las variables que en el futuro requiera el proveedor de pagos
> (`PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET`, …) se cargan **sólo** en el
> panel del hosting, nunca en el repo. Ver `COMPETITIVE.md`.

## Seguridad de producción (estado actual)

- **HTTPS/WSS:** los provee el hosting (Render/estático) — no terminar TLS a mano.
- **Cookies de sesión:** `HttpOnly; SameSite=None; Secure` en producción.
- **CORS:** allowlist por `CORS_ORIGINS`, con credenciales; jamás `*`.
- **Rate limiting:** login y registro limitados por IP (en memoria, por instancia).
- **SQL:** siempre parametrizado (`$1..$N`).
- **Errores:** nunca se exponen stack traces; los 500 devuelven mensaje genérico.
- **Sin secretos en logs** (passwords, tokens, cookies, `DATABASE_URL`).
