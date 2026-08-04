# TRUCO · Backend

Backend de la plataforma **Truco Uruguayo Online**. Proyecto independiente
(Node.js + TypeScript), arranca sin depender del frontend.

> Etapa actual: **base inicial + conexión a PostgreSQL (Neon)**.
> Todavía **no** hay autenticación, usuarios, WebSockets, lobby ni partidas
> persistentes: eso llega en etapas posteriores. Servidor **autoritativo**
> previsto: reusará el motor de reglas de `frontend/src/game` (a extraer como
> paquete compartido). Ver `../docs/ARCHITECTURE.md`.

## Estructura

```
backend/
├── src/
│   ├── config/
│   │   └── env.ts            # Carga y valida variables de entorno (.env)
│   ├── db/
│   │   ├── pool.ts           # Pool de PostgreSQL reutilizable (pg)
│   │   └── testConnection.ts # Prueba mínima: SELECT NOW()
│   └── index.ts              # Punto de entrada (health-check de la base)
├── .env.example              # Plantilla de variables (sin valores reales)
├── package.json
├── tsconfig.json
└── README.md
```

## Configuración

La conexión se toma de la variable de entorno **`DATABASE_URL`** (nunca se
hardcodea). Definila en un archivo `.env` en la **raíz del repo** (o en
`backend/`), o directamente en el entorno del proceso.

```bash
cp backend/.env.example .env   # y completá DATABASE_URL
```

Variables soportadas (ver `.env.example`):

| Variable       | Descripción                                            | Default       |
| -------------- | ------------------------------------------------------ | ------------- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (Neon). **Requerida.** | —             |
| `DATABASE_SSL` | Modo TLS: `require` \| `no-verify` \| `disable`.       | `require`     |
| `NODE_ENV`     | `development` \| `test` \| `production`.               | `development` |
| `PORT`         | Puerto del servidor HTTP (Render lo inyecta).          | `10000`       |

> 🔒 El `.env` real está en `.gitignore` y **no** debe commitearse. El código
> nunca imprime `DATABASE_URL`; los logs sólo muestran host/base.

## Comandos

```bash
cd backend
npm install        # instala dependencias

npm run typecheck  # chequeo de tipos (tsc --noEmit)
npm run build      # compila a dist/
npm run db:test    # prueba real de conexión: SELECT NOW()
npm start          # levanta el servidor HTTP (queda escuchando)
npm run dev        # arranque en modo watch
```

### Servidor HTTP

`npm start` levanta un servidor HTTP (Node nativo, sin dependencias extra) que
escucha en `0.0.0.0:$PORT` (fallback `10000`) y **permanece vivo** esperando
peticiones. Endpoint de salud para Render y monitoreo:

```bash
curl http://localhost:10000/healthz   # → 200 {"status":"ok"}
```

### Probar la conexión a PostgreSQL

```bash
npm run db:test
```

Ejecuta `SELECT NOW()` contra `DATABASE_URL` y reporta hora del servidor,
versión de PostgreSQL y latencia. Requiere que `DATABASE_URL` esté definida.

## Dependencias

- **[`pg`](https://node-postgres.com/)** — cliente PostgreSQL para Node.js.
- **[`dotenv`](https://github.com/motdotla/dotenv)** — carga de `.env`.
- Dev: `typescript`, `tsx` (runner de TS), `@types/node`, `@types/pg`.
