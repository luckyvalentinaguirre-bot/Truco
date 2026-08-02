# TRUCO · Backend (pendiente — Etapa 2+)

Todavía sin implementar. Reservado para el servidor de la plataforma.

Plan previsto:

- **Node.js + TypeScript**.
- API REST para usuarios, perfiles, ranking, estadísticas e historial.
- **WebSockets** para partidas en tiempo real.
- **PostgreSQL** como base de datos.
- Servidor **autoritativo**: reusará el motor de reglas de
  `frontend/src/game` (a extraer como paquete compartido). El cliente nunca
  valida jugadas por sí mismo.

Estructura prevista: `controllers/`, `middleware/`, `models/`, `routes/`,
`services/`, `websocket/`.

Ver `../docs/ARCHITECTURE.md`.
