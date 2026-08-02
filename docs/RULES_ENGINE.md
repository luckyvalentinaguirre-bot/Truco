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
| `types.ts` | Tipos del dominio (Card, Suit, Ruleset, TeamId, cantos…). |
| `deck.ts` | Mazo de 40, barajado determinista (RNG inyectable). |
| `prng.ts` | PRNG sembrado (mulberry32): partidas reproducibles. |
| `ranking.ts` | Piezas, matas, jerarquía, excepción del Rey. |
| `tricks.ts` | Resolución de bazas y de la mano (pardas, ventaja de mano). |
| `envido.ts` | Cálculo del envido. |
| `envidoBetting.ts` | Cadena de cantos del Envido (revoques, falta). |
| `flor.ts` | Detección y valor de la Flor. |
| `florBetting.ts` | Apuestas de Flor y "echar los perros". |
| `trucoBetting.ts` | Máquina de estados del Truco (alternancia, puntos). |
| `scoring.ts` | Marcador, malas/buenas, fin de partida. |
| `state.ts` | `MatchState` / `HandState` serializables. |
| `actions.ts` | Acciones (intención del jugador). |
| `events.ts` | Eventos (qué ocurrió). |
| `setup.ts` | Creación de partida y reparto por modo. |
| `engine.ts` | **Reductor** `applyAction` + `isLegal` + `startNextHand`. |
| `senas.ts` / `senasEngine.ts` | Catálogo de señas y señas disponibles por mano. |
| `ruleset.ts` | Reglamentos y tablas de valores (variantes). |
| `index.ts` | Superficie pública estable que consume la UI. |

## El reductor

```ts
applyAction(state: MatchState, action: Action): { state: MatchState; events: GameEvent[] }
```

Es **puro** (no muta la entrada) y **determinista** (el azar sólo entra por
`seed`). Valida todo: turno, pertenencia de la carta, cantos válidos,
alternancia, ventanas de Envido/Flor y fin de mano/partida. Las acciones
ilegales lanzan error — el cliente nunca decide. `isLegal(state, action)`
permite a la UI habilitar/deshabilitar controles sin duplicar reglas.

## Tests

`npm test` (Vitest). Cubren: jerarquía y excepción del Rey, matas, comunes y
empates; bazas y todas las variantes de parda + ventaja de mano; envido
(mismo palo, tres palos, piezas, máximo 37); flor (3 casos + sin flor);
cadena de Truco (aceptar/rechazar/retruco/vale 4 e inválidos); cadena de
Envido (revoques, falta, rechazos); y partidas completas (reparto
determinista, puntuación, irse al mazo, acciones inválidas y fin de partida).

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

## Estado de implementación (Etapa 2)

Implementado, tipado fuerte y cubierto por tests:

- Jerarquía completa (piezas, matas, comunes) y excepción del Rey.
- Bazas y resolución de la mano con todas las reglas de parda + ventaja de mano.
- Cálculo de Envido y de Flor (3 casos); cadenas de cantos de Truco y Envido.
- Reductor `applyAction` con validación total, eventos y fin de partida.
- Irse al mazo; estructura de Flor/"echar los perros"; señas disponibles por mano.
- Reparto determinista por semilla; setup de 1v1/2v2/3v3/3 jugadores.

**Pendiente** (próximas etapas): duelo de tantos de Flor enfrentada
(Con Flor Envido / Contra Flor al Resto), reglas finas de 3 jugadores
(4ª carta + descarte) y pico a pico en 3v3, y el servidor autoritativo con
WebSockets. La arquitectura ya lo contempla.

## Flujo con la UI

La UI despacha `Action`s a `applyAction` y renderiza a partir de `state` +
`events`. El mismo reductor correrá en el servidor como fuente de verdad en
la etapa de multiplayer (la próxima etapa conecta el motor a una mesa visual).
