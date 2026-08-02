# 🃏 TRUCO

Plataforma web de **Truco Uruguayo online**. Partidas, jugar con amigos,
matchmaking, ranking competitivo, perfiles, estadísticas e historial —
construida para escalar a un juego online completo. Monetización futura
**solo cosmética** (nunca pay-to-win).

Diseñada **PC + celular desde el comienzo**: no es un desktop "responsivizado",
sino una experiencia táctil real (botones grandes, sin depender de hover,
mesa que se reorganiza en vertical, safe-areas para notch).

## Estado del proyecto

**Etapa 1 — Base frontend** ✅

- React + TypeScript + Vite, arquitectura de componentes escalable.
- Sistema de diseño por tokens (oscuro, elegante, tipo videojuego).
- Navegación responsive: sidebar en desktop, drawer + bottom nav en mobile.
- Páginas base: Jugar, Amigos, Ranking, Perfil, Historial, Configuración.
- **Motor de reglas del Truco** independiente de la UI (TS puro), con la
  jerarquía completa, piezas, excepción del Rey, envido, flor y señas.
- Documentación del reglamento y de la arquitectura.

Todavía **no** implementados (por diseño): login real, PostgreSQL,
WebSockets, matchmaking, partidas online, motor completo de la mano, tienda.
La arquitectura ya está preparada para incorporarlos sin rehacer nada.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + TypeScript + Vite |
| Backend (Etapa 2+) | Node.js + TypeScript |
| Base de datos (Etapa 2+) | PostgreSQL |
| Tiempo real (Etapa 2+) | WebSockets |

## Estructura

```
frontend/   React + TS (app actual)
backend/    Node + TS (pendiente)
database/   esquema/migraciones (pendiente)
docs/       reglamento y arquitectura
```

## Ejecutar

```bash
cd frontend
npm install --include=dev   # el entorno fuerza NODE_ENV=production
npm run dev                 # http://localhost:5173
```

Para probar en el celular real: el server expone la red local
(`host: true`), abrí `http://<IP-de-tu-PC>:5173` desde el teléfono.

## Documentación

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — arquitectura y capas.
- [`docs/REGLAMENTO.md`](docs/REGLAMENTO.md) — reglamento oficial v1.
- [`docs/RULES_ENGINE.md`](docs/RULES_ENGINE.md) — diseño del motor de reglas.
