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

## Mesa jugable (Etapa 3)

Partida local **1 humano vs IA** en la ruta a pantalla completa `/mesa`.

```
Usuario pulsa carta → dispatch(PLAY_CARD) → applyAction (motor) →
nuevo MatchState → React re-renderiza → animación
```

- `features/match/useLocalMatch.ts` — **Game Controller / Adapter**: guarda el
  `MatchState`, aplica acciones con `applyAction` y **conduce a la IA** con una
  pausa (setTimeout) para que sus jugadas se vean. La IA (`game/ai.ts`) elige
  siempre dentro de `legalActions` del motor — nunca puede hacer una jugada
  ilegal.
- `features/match/matchView.ts` — adaptador de **vista puro** (estado
  contextual, acciones legales agrupadas, banners). La UI sólo lee esto.
- `features/match/components/` — mesa, mano interactiva, marcador, overlays de
  canto, resúmenes de mano y fin de partida. Composición **específica** para
  desktop, celular vertical y horizontal (no un simple `flex-wrap`).

React muestra el juego; el motor decide el juego. La misma separación permitirá
sustituir `useLocalMatch` por un cliente WebSocket sin tocar la mesa.

### Detalles del vertical slice

- **Cartas españolas** (`components/game/PlayingCard.tsx`): un único `<svg>` con
  `viewBox` fijo (240×384) que escala con el contenedor y **no se recorta nunca**.
  Palos dibujados a mano (oros=monedas, copas, espadas azules, bastos verdes),
  pips para 1-7, figuras Sota/Caballo/Rey, índices en dos esquinas y **reverso
  rojo/dorado** con medallón. El halo de **pieza** lo determina el motor
  (`cardCategory`), no React.
- **Mesa según referencia** (paleta en `styles/tokens.css`: paño `#0e3b2e`,
  madera `#3a2a1a`, dorado `#d4af37`, marfil `#f7f3e9`). Marco de madera + paño
  verde con: barra superior (menú · marcador VOS–RIVAL · sonido/config/abandonar),
  info del rival y cartas boca abajo, indicador **Mano**, caja **Última baza**,
  logo central "TRUCO URUGUAYO" con sol, **Muestra**, **mazo** con contador, panel
  **Acciones** con botones de color (Truco verde, Envido amarillo, Flor azul,
  Quiero verde, No quiero rojo) y chat (placeholder). Composición específica para
  desktop y mobile; cartas del jugador siempre 100% visibles.
- **Sin pantalla entre manos**: al terminar una mano, `useLocalMatch` muestra un
  feedback de ~1,7 s ("Ganaste la mano +2") y **reparte la siguiente
  automáticamente** (`startNextHand`). La pantalla final aparece **sólo** al
  llegar a 40.
- **IA con dificultad** (`game/ai.ts`): perfiles fácil/normal/difícil (umbrales +
  probabilidad de error). Siempre elige dentro de `legalActions`.
- **Preferencias** (`services/settings.ts`): sonido, animaciones y dificultad,
  persistidas en `localStorage`. Las animaciones off se aplican vía
  `:root[data-animations='off']`.
- **Sonido** (`services/sound.ts`): efectos sintetizados con Web Audio (sin
  archivos externos), silenciables. Degradación segura si no hay Web Audio.

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
