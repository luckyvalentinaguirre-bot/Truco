# Reglamento oficial de TRUCO (v1)

> Truco Uruguayo tradicional. Primera versión competitiva.
> Este documento es la **fuente de verdad** del motor de reglas
> (`frontend/src/game`). Las reglas **no** viven en la UI.

## Partida

- **40 puntos**: 20 malas + 20 buenas.
- Arquitectura preparada para variantes (por ej. 30 puntos → `SHORT_30`).

## Mazo

Baraja española de **40 cartas**. Se eliminan **8, 9 y comodines**.
Rangos vigentes: **1, 2, 3, 4, 5, 6, 7, 10, 11, 12** en los cuatro palos
(oros, copas, espadas, bastos). Cada jugador recibe **3 cartas** y se
descubre **la muestra**, que define el palo de las piezas.

## Piezas (según la muestra)

Orden: **2 > 4 > 5 > 11 > 10** del palo de la muestra.

**Excepción del Rey**: si la muestra es una pieza (su rango es 2/4/5/11/10),
el **12 del mismo palo** la reemplaza y hereda su fuerza y valores.

## Jerarquía completa (mayor → menor)

| # | Carta |
|---|-------|
| 1–5 | Piezas: 2, 4, 5, 11, 10 de la muestra |
| 6 | 1 de Espadas |
| 7 | 1 de Bastos |
| 8 | 7 de Espadas |
| 9 | 7 de Oros |
| 10 | 3 |
| 11 | 2 (excepto pieza) |
| 12 | 1 de Copas / 1 de Oros |
| 13 | 12 |
| 14 | 11 (excepto pieza) |
| 15 | 10 (excepto pieza) |
| 16 | 7 de Copas / 7 de Bastos |
| 17 | 6 |
| 18 | 5 (excepto pieza) |
| 19 | 4 (excepto pieza) |

Igual fuerza ⇒ **parda**.

## Truco

Se juegan hasta 3 bazas; gana quien gane 2. Valores:

| Grito | Aceptado | No querido |
|-------|:--------:|:----------:|
| Truco | 2 | 1 |
| Retruco | 3 | 2 |
| Vale 4 | 4 | 3 |

Los aumentos alternan entre equipos.

## Pardas

- Equipo que ya ganó una baza + parda posterior ⇒ gana ese equipo.
- Primera baza parda ⇒ la segunda decide.
- Todas pardas ⇒ gana quien es **mano**.

## Mano y pie

**Mano** empieza jugando; **pie** es el último. La ventaja en empates es
del mano. Tras cada mano, el reparto pasa al siguiente jugador.

## Envido

Apuesta independiente del Truco. Anulado si hay Flor.

**Cálculo**: dos cartas del mismo palo → 20 + ambas; tres palos distintos →
la carta más alta (figuras valen 0).

Valor especial de piezas: 2→30, 4→29, 5→28, 11→27, 10→27.
Máximo normal: **37**.

Cantos: Envido (2), Real Envido (3), Falta Envido (según marcador).
Revoques encadenables (p. ej. Envido → Real Envido = 5 si se acepta).

## Flor

Se tiene Flor con: (1) tres del mismo palo, (2) dos piezas, o
(3) una pieza + dos del mismo palo.

**Valor**: 20 + aportes. Piezas: 2→+10, 4→+9, 5→+8, 11→+7, 10→+7.
Cartas comunes: su número. Figuras no-pieza: 0.

Con Flor **no se juega Envido**. Apuestas: Flor (3), Con Flor Envido,
Contra Flor al Resto (configurables/extensibles).

## Señas (mecánica real)

Comunicación con el compañero en modos por equipos. Catálogo en
`frontend/src/game/senas.ts`. En mobile se ejecutan con controles táctiles.

## Otras acciones

- **Irse al mazo**: abandonar la mano; el rival cobra la apuesta vigente.
- **Echar los perros**: cantos previos al reparto (Contra Flor al Resto +
  Falta Envido + Truco); el rival responde **en ley** (tiene Flor) o
  **a punto** (no tiene).

## Modos

`1v1`, `2v2` (A-B-A-B, con señas), `3v3` (con pico a pico) y **3 jugadores**
(el mano recibe 4 cartas y descarta una boca abajo).

---

Ver `docs/RULES_ENGINE.md` para cómo esto se traduce en código.
