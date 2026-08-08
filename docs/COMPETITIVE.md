# Sistema competitivo — TRUCO (Etapa 7)

Modo competitivo por **suscripción de US$3/mes**. El pago **sólo habilita el
acceso** a la competición: **no hay pay-to-win**. Todos juegan con las mismas
cartas, jerarquía, reglas y motor.

## Autoridad

El **backend es la única autoridad** para acceso, ELO, resultado, ranking,
temporada y estadísticas. El frontend nunca envía `newElo`, `winner`, `rank`,
`score` ni `seasonPoints` como valores confiables.

## Dominio implementado (puro y testeado)

`backend/src/competitive/`:

| Módulo | Responsabilidad |
|---|---|
| `elo.ts` | Cálculo de rating (ELO clásico), 1v1 y equipos 2v2/3v3. |
| `ranks.ts` | Derivación server-authoritative del rango a partir del ELO. |
| `subscription.ts` | Máquina de estados de la suscripción + acceso efectivo. |
| `eligibility.ts` | `canPlayCompetitive` — decisión central de acceso (§11). |
| `season.ts` | Estado de temporada (`upcoming`/`active`/`finished`). |

Esquema: `backend/migrations/004_create_competitive.sql`
(`seasons`, `subscriptions`, `payments`, `competitive_ratings`,
`competitive_matches`, `competitive_match_players`).

## ELO — fórmula

```
E_A  = 1 / (1 + 10^((R_B - R_A) / 400))     // puntaje esperado del lado A
R_A' = round( R_A + K · (S_A - E_A) )        // S_A = 1 gana, 0 pierde
```

- `K = 32` por defecto; rating inicial `1000`; piso `100` (nunca baja de ahí).
- **Equipos (2v2/3v3):** se usa el **promedio** de rating de cada equipo como
  "rating del lado"; el delta resultante se aplica **por igual** a cada
  integrante. No se calcula como N duelos 1v1 independientes.
- **Pico a Pico:** es parte de **una** partida competitiva global → un único
  cálculo de equipo, no tres partidas separadas.

Casos verificados (`elo.test.ts`): simétrico (±16, suma cero), favorito gana
poco, underdog gana mucho, piso respetado, equipos con promedio.

## Suscripción — estados y acceso

Estados persistidos: `active`, `pending`, `past_due`, `canceled`, `expired`.
El **acceso efectivo** se deriva (`deriveAccess`) respetando el período pagado:

- **Cancelar** no revoca de inmediato: sigue con acceso hasta `currentPeriodEnd`,
  luego se bloquea (no se renueva).
- `past_due`: hay acceso sólo si aún queda período pagado.
- La activación depende de **confirmación del backend** (webhook del proveedor),
  nunca de un `success=true` del navegador.

## Rangos (integración con la escalera de la Etapa 4)

`rankByRating(elo)` usa los **mismos umbrales** que `frontend/src/data/ranks.ts`
(Principiante→Mate→Copa→Flor→Truco→Retruco→Vale 4). El rango lo calcula el
backend; el frontend nunca lo elige.

> Nota honesta: la Etapa 7 pide "temática de peces" para los rangos, pero la
> escalera ya definida en el código de la Etapa 4 usa nombres de Truco. Para
> **no rediseñar** (regla 21/22), se mantuvieron esos nombres y umbrales. Si se
> desea la temática de peces, es un cambio cosmético de nombres/íconos a decidir
> aparte, sin tocar la lógica de ELO ni los umbrales.

## Temporadas

`upcoming → active → finished` según fechas. El reset **no borra historial**:
cada temporada tiene su propia tabla de `competitive_ratings` (unique por
`user_id, season_id`), así el ranking de temporadas anteriores se conserva.

## Pagos — integración pendiente (no se instaló proveedor)

**No** se agregó ninguna dependencia de pagos (regla 20). El esquema ya está
preparado para un proveedor tipo Stripe:

- `payments.provider_event_id` es **UNIQUE por proveedor** ⇒ **idempotencia**:
  un webhook repetido no registra dos pagos ni activa dos veces (§41).
- Sólo se guardan referencias del proveedor (customer/subscription id); **nunca**
  tarjetas ni CVV (§10, §47).

Webhooks a procesar cuando se integre el proveedor: `payment_succeeded`,
`payment_failed`, `subscription_created/renewed/canceled/expired`, `refund`.

### Proveedor: Mercado Pago (implementado, config-gated)

La integración está **completa** vía la API REST de MP con `fetch` (sin
dependencias). Si no hay credenciales, `isConfigured()` es false y
`/subscription/checkout` responde `503 payments_unconfigured` — el resto sigue
funcionando. Cuando cargues las variables, funciona sin tocar código.

Flujo: `POST /subscription/checkout` crea una *preapproval* (suscripción
US$3/mes) y devuelve la URL de checkout de MP → el usuario paga → **MP notifica
por webhook** `POST /webhooks/mercadopago` (firma verificada) → el backend
consulta el recurso real en MP y activa la suscripción (nunca por la vuelta del
navegador). `POST /subscription/cancel` cancela la renovación (sigue vigente
hasta vencer). Idempotente: pagos por `provider_event_id UNIQUE`; estados de
suscripción por upsert.

Variables de entorno (sólo nombres — **nunca en Git**, sólo en el panel):
```
MP_ACCESS_TOKEN         # Access Token de la cuenta MP (secreto)
MP_WEBHOOK_SECRET       # clave para verificar la firma del webhook
MP_PREAPPROVAL_PLAN_ID  # (opcional) id del plan US$3/mes
MP_PRICE_AMOUNT         # (opcional) monto si no usás plan (default 3)
MP_CURRENCY             # (opcional) moneda (default UYU)
MP_BACK_URL             # URL de retorno tras el checkout
```

Pendiente antes de cobrar de verdad: solicitar/crear las credenciales en MP,
configurar la `notification_url` al endpoint del webhook y verificar requisitos
legales (§48).

## Legal (§48)

Antes de activar pagos reales, verificar la legislación aplicable en Uruguay y
demás jurisdicciones. Distinguir **suscripción de acceso** de cualquier apuesta,
premio monetario o juego de azar. Si se incorpora dinero/premios, **detener** la
activación pública de esa parte hasta cumplir los requisitos legales.

## Pendiente (no ocultar)

- **Servidor de juego online autoritativo:** no existe todavía. Por eso no hay
  partidas competitivas reales end-to-end (matchmaking, resolución de resultado
  en vivo, reconexión/bot en producción). El dominio de arriba es la capa que
  ese servidor invocará; está listo y testeado, pero **no conectado** a partidas
  online porque esas partidas aún no se juegan por Internet.
- **Endpoints HTTP** de suscripción/ranking/checkout y **webhooks**: no expuestos
  aún (requieren el proveedor de pagos y decisiones de producto).
- **UI competitiva** (pantalla de suscripción, post-partida, ranking con ELO):
  no incluida en esta entrega de dominio.
