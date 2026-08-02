# TRUCO · Frontend

React + TypeScript + Vite. Base visual y técnica de la plataforma.

## Scripts

```bash
npm install --include=dev   # NODE_ENV=production está forzado en este entorno
npm run dev        # servidor de desarrollo (HMR) en :5173, host expuesto
npm run build      # typecheck (tsc -b) + build de producción (vite)
npm run preview    # sirve el build de producción
npm run lint       # ESLint
npm run typecheck  # solo chequeo de tipos
```

## Mapa de carpetas (`src/`)

- `game/` — **motor de reglas** del Truco (TS puro, sin React). Ver
  `../docs/RULES_ENGINE.md`.
- `components/ui/` — primitivos reutilizables (Button, Panel, Avatar, Badge,
  StatTile, SegmentedControl, Toggle, Icon, PageHeader).
- `components/game/` — componentes de juego (PlayingCard, MatchRow).
- `components/layout/` — shell responsive (AppLayout, BrandLogo).
- `pages/` — una página por ruta.
- `services/` — fachada de datos (mock hoy, API/WS mañana; misma firma).
- `styles/` — `tokens.css` (design tokens) + `global.css` (reset).
- `config/`, `data/`, `types/`, `lib/` — navegación, rangos, tipos, utils.

## Convenciones

- **Nada de valores hardcodeados**: usar los tokens de `styles/tokens.css`.
- **CSS Modules** por componente (`*.module.css`), scope local.
- **Alias `@/`** apunta a `src/`.
- La UI consume el juego solo desde `@/game` y los datos solo desde
  `@/services/api`.
