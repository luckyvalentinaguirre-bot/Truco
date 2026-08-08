# Runbook operativo — TRUCO

Guía rápida ante incidentes. Objetivo: diagnosticar y restaurar servicio.

## ¿El backend cayó?
1. Revisar el health check: `curl -i https://<backend>/healthz` → debe dar `200 {"status":"ok"}`.
2. Ver logs del servicio en el panel del hosting (Render → Logs).
3. Causas típicas: falta `DATABASE_URL`, Neon inaccesible, excepción al iniciar.
4. Restaurar: corregir la variable o **Manual Deploy / Restart** del servicio.

## ¿PostgreSQL (Neon) no responde?
1. Verificar desde el backend: `npm run db:test`.
2. Comprobar en el panel de Neon que el proyecto no esté suspendido (free tier duerme).
3. Revisar `DATABASE_URL` y `DATABASE_SSL=require`.
4. El `Pool` reintenta conexiones; si el problema persiste, es de Neon, no del código.

## ¿WebSockets fallan?
1. El servidor WS actual es el **modo LAN** (`frontend/server/lanServer.ts`), pensado
   para red local, **no** para el multijugador de producción por Internet.
2. Comprobar que el cliente use `wss://` en producción (no `ws://`).
3. El multijugador online autoritativo **todavía no está desplegado** (ver Pendientes).

## ¿El frontend no conecta con el backend?
1. Verificar `VITE_API_URL` (debe apuntar al backend de producción, `https://…`).
2. Revisar CORS: el origin del frontend debe estar en `CORS_ORIGINS` del backend.
3. En el navegador (DevTools → Network) mirar si el preflight `OPTIONS` responde 204.
4. Confirmar que la cookie de sesión viaja (`SameSite=None; Secure` en prod).

## ¿Cómo reviso logs?
- Backend: panel del hosting → Logs del servicio.
- Los logs **no** contienen secretos (passwords, tokens, cookies, `DATABASE_URL`).
- Errores inesperados se registran sólo por tipo (`err.name`), sin stack ni datos.

## ¿Cómo hago rollback?
Ver [ROLLBACK](#rollback).

## <a name="rollback"></a>Rollback

### Aplicación (código)
1. En el hosting, redeploy del commit anterior conocido-bueno
   (Render → Deploys → seleccionar deploy previo → **Redeploy**), **o**
2. Vía git:
   ```bash
   git revert <sha-malo>      # revierte sin reescribir historia (preferido)
   git push origin <branch>
   ```
   Evitar `reset --hard` sobre ramas compartidas.

### Base de datos
- **No** hay migraciones destructivas: las migraciones sólo crean tablas.
- Neon ofrece *point-in-time restore* / branching desde su panel. Ante pérdida de
  datos, restaurar a un branch/punto anterior desde Neon — **no** borrar la base.
- Documentar siempre qué se restauró y a qué timestamp.

## Backups / recuperación de datos
- La persistencia vive en **Neon**, que mantiene historia y permite restaurar a un
  punto en el tiempo (según el plan). No dependemos de dumps manuales para el MVP.
- Ante pérdida: restaurar desde Neon (point-in-time o branch) y verificar con
  `npm run db:test` + un login de prueba.
- No ejecutar `DROP`/`TRUNCATE` sobre producción.

## Pendientes conocidos (no ocultar)
- **Multijugador online autoritativo:** no desplegado. El juego por Internet
  (matchmaking, partidas 1v1/2v2/3v3 remotas, reconexión, bot en producción) aún
  no existe como servicio; sólo hay LAN local y el motor puro validado por tests.
- El rate limiting es **por instancia** (en memoria). Con múltiples instancias hay
  que moverlo a un store compartido.
