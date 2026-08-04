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
npm run db:migrate # aplica las migraciones pendientes (migrations/*.sql)
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

## Migraciones

Runner propio y mínimo (sin dependencias extra), en `src/db/migrate.ts`. Aplica
en orden los archivos `migrations/NNN_*.sql` **una sola vez** cada uno, dentro de
una transacción, y registra lo aplicado en la tabla `schema_migrations`. Es
idempotente: volver a correrlo no reaplica nada.

```
migrations/
├── 001_create_users.sql      # cuentas (UUID, email único, password_hash)
├── 002_create_profiles.sql   # perfil 1:1 con users (username único)
└── 003_create_sessions.sql   # sesiones de auth (token_hash, expires_at, …)
```

```bash
npm run db:migrate
```

> En Render conviene ejecutar `npm run db:migrate` como paso previo al deploy
> (o manualmente una vez), no en el arranque del servidor HTTP.

## Capa de datos (repositories)

Acceso a datos tipado en `src/repositories/`, sobre el `pool` compartido y con
queries **siempre parametrizadas**:

- `users.repository.ts` — `createUser`, `findUserByEmail`, `findUserById`,
  `emailExists` (recibe un `password_hash` ya generado; el hashing llega luego).
- `profiles.repository.ts` — `createProfile`, `findProfileByUserId`,
  `findProfileByUsername`, `isUsernameAvailable`.
- `errors.ts` — traduce errores SQLSTATE de PostgreSQL a errores de dominio
  (`EmailAlreadyExistsError`, `UsernameTakenError`, `UserNotFoundError`, …).

## Servicios de dominio

En `src/services/`:

- `account.service.ts` — `createAccount(email, password, username)`: valida y
  normaliza los datos, hashea la contraseña y crea `users` + `profiles` dentro
  de **una única transacción** (`withTransaction`), con rollback conjunto. Nunca
  deja un user sin profile y nunca devuelve el hash ni la contraseña.
- `password.ts` — `hashPassword` / `verifyPassword` con **scrypt** de
  `node:crypto` (sin dependencias externas). Sólo se persiste el hash.

### Tests

```bash
npm test   # vitest
```

Los tests de repositorios corren contra una base PostgreSQL **real** (la de
`DATABASE_URL`): aplican las migraciones y limpian las tablas entre casos. Si
`DATABASE_URL` no está definida, la suite se **salta** (no falla).

## Dependencias

- **[`pg`](https://node-postgres.com/)** — cliente PostgreSQL para Node.js.
- **[`dotenv`](https://github.com/motdotla/dotenv)** — carga de `.env`.
- Dev: `typescript`, `tsx` (runner de TS), `@types/node`, `@types/pg`.
