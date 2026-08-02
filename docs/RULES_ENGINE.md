# Arquitectura del motor de reglas

## Principio rector

El Truco se modela como un sistema de reglas **independiente de la UI**:

```
Game State  →  Rules Engine  →  Actions  →  Events  →  UI
```

- La **UI muestra** el estado; **no decide** qué jugada es válida.
- El **motor** (backend en el futuro) es la única autoridad. Esto es clave
  para multiplayer/WebSockets: el cliente nunca valida por sí mismo.
- El motor es **TypeScript puro**, sin dependencias de React. Puede
  ejecutarse igual en el navegador y en Node (mismo código en el backend).

## Ubicación

`frontend/src/game/` (paquete portátil; la idea es moverlo a un paquete
compartido `packages/engine` cuando exista el backend).

| Archivo | Responsabilidad |
|---------|-----------------|
| `types.ts` | Tipos del dominio (Card, Suit, Ruleset, cantos…). |
| `deck.ts` | Mazo de 40, barajado determinista (RNG inyectable). |
| `ranking.ts` | Piezas, matas, jerarquía, excepción del Rey, pardas. |
| `envido.ts` | Cálculo del envido y puntos de los cantos. |
| `flor.ts` | Detección y valor de la Flor. |
| `ruleset.ts` | Reglamentos y tablas de valores (variantes). |
| `senas.ts` | Catálogo de señas (mecánica de juego). |
| `index.ts` | Superficie pública estable que consume la UI. |

## Decisiones

- **RNG inyectable** en `shuffle()` → partidas deterministas, testeables y
  verificables por el servidor (anti-trampa, replays).
- **Reglamentos como datos** (`Ruleset`) → 40 pts hoy, 30 pts u otras
  variantes sin tocar la lógica.
- **Fuerza numérica** por carta → resolver bazas y detectar pardas es una
  comparación; la excepción del Rey se resuelve en un único lugar
  (`resolvePieces`).
- Funciones **puras** (sin estado global) → fáciles de testear y de mover al
  backend.

## Estado de implementación (v1)

Implementado y verificado contra los ejemplos del reglamento:

- Jerarquía completa con piezas, matas y comunes.
- Excepción del Rey (muestra pieza → 12 del palo).
- Cálculo de Envido (con piezas) y de Flor (3 casos).
- Tablas de valores de Truco/Envido/Flor y reglamentos.

**Pendiente** (próximas etapas, ya contemplado por la arquitectura): máquina
de estados de la mano (turnos, bazas, cadena de cantos), resolución de
Envido/Flor enfrentados, "irse al mazo", "echar los perros", modos 2v2/3v3/
3 jugadores, y el servidor autoritativo con WebSockets.

## Próximo paso sugerido

Introducir un reductor de estado de mano:

```ts
type MatchState = { /* … */ };
type Action = { type: 'PLAY_CARD' | 'CALL_TRUCO' | 'CALL_ENVIDO' | 'FOLD' | ... };
function reduce(state: MatchState, action: Action): { state: MatchState; events: GameEvent[] };
```

La UI despacha `Action`s y renderiza a partir de `events` + `state`. El
mismo `reduce` correrá en el servidor como fuente de verdad.
