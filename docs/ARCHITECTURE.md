# Arquitectura de la plataforma TRUCO

## Estado actual (Etapa 1 — base frontend)

Solo frontend. Datos simulados detrás de una capa de servicios. Sin backend,
sin auth real, sin WebSockets todavía — pero todo preparado para agregarlos.

```
Truco/
├── frontend/            # React + TypeScript + Vite
│   └── src/
│       ├── game/        # ⚙️  MOTOR DE REGLAS (TS puro, portable a backend)
│       ├── components/
│       │   ├── ui/      # primitivos reutilizables (Button, Panel, Avatar…)
│       │   ├── game/    # componentes de juego (PlayingCard, MatchRow)
│       │   └── layout/  # shell responsive (sidebar/topbar/drawer/bottomnav)
│       ├── pages/       # una página por ruta
│       ├── services/    # fachada de datos (hoy mock → mañana API/WS)
│       ├── config/      # navegación
│       ├── data/        # rangos competitivos
│       ├── types/       # tipos de dominio (usuario, partidas)
│       ├── lib/         # utilidades (formato)
│       ├── styles/      # tokens de diseño + reset global
│       └── router.tsx
├── backend/             # (vacío) Node + TS + PostgreSQL + WS — Etapa 2+
├── database/            # (vacío) esquema/migraciones — Etapa 2+
└── docs/
```

## Por qué Vite

Elegido como herramienta de build por: arranque y HMR casi instantáneos
(esbuild + Rollup), soporte first-class de TypeScript, CSS Modules nativos,
build de producción optimizado y configuración mínima. Es el estándar
moderno para SPAs en React y escala bien al crecer el proyecto.

## Capas y flujo de datos

```
Componentes (pages)  →  services/api.ts  →  [ mock hoy | REST + WebSocket mañana ]
Componentes de juego →  game/ (motor)    →  validación autoritativa (servidor a futuro)
```

La UI **nunca** habla directo con la fuente de datos ni decide reglas: pasa
por `services/api` (swap transparente a HTTP) y por `game/` (swap a servidor
autoritativo). Por eso agregar backend/multiplayer **no** obliga a reescribir.

## Sistema de diseño

Tokens en `src/styles/tokens.css` (color, tipografía, spacing, radios,
sombras, z-index, motion, safe-areas). **Nada hardcodeado** en componentes:
todo referencia `var(--…)`. Cambiar el tema = editar tokens.

## Responsive (mobile-first real, no adaptado)

- Breakpoint principal en **900px**.
- Desktop/laptop: **sidebar** lateral fija.
- Tablet/celular: **topbar** con hamburguesa + **drawer** + **bottom nav**
  táctil.
- Objetivos táctiles mínimos de 48px (`--touch-min`), sin depender de hover,
  `env(safe-area-inset-*)` para notch/gestos, unidades `dvh`, y layouts que
  se reorganizan (la mesa pasa arriba en vertical).

## Preparado para las próximas etapas

- **Auth**: envolver el router con un `AuthProvider` y rutas protegidas.
- **API real**: reemplazar el cuerpo de `services/api.ts` (misma firma).
- **WebSockets**: nuevo `services/socket.ts`; el motor `game/` ya es la base
  de la validación autoritativa del servidor.
- **Ranking/MMR/temporadas**: `data/ranks.ts` ya define tiers y `minMmr`.
- **Cosméticos** (no pay-to-win): `Avatar` ya soporta `framed`; los diseños
  de carta/mesa saldrán de tokens.

## Cómo ejecutar

```bash
cd frontend
npm install --include=dev   # el entorno fuerza NODE_ENV=production
npm run dev                 # http://localhost:5173 (host expuesto para probar en celular)
npm run build               # build de producción + typecheck
npm run preview             # servir el build
```
