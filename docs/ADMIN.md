# Panel administrativo — TRUCO

Backend del panel `/admin`. Autorización **siempre server-side**: sesión válida
+ rol `admin` + 2ª credencial (contraseña administrativa → sesión admin elevada).

## Seguridad
- **Contraseña admin**: se guarda como **hash** en la variable `ADMIN_PASSWORD_HASH`
  (scrypt, el mismo esquema que las contraseñas de usuario). Nunca en el código,
  Git, React, logs ni APIs.
- **Bloqueo por fuerza bruta**: 3 intentos incorrectos permitidos; el **4º
  bloquea 8 horas**. El bloqueo vive en la base (`admin_lockout`), persiste
  aunque se borren cookies/localStorage. Al bloquear se envía una **alerta por
  email** y se registra en auditoría.
- **Baneo server-side**: un usuario baneado no puede operar (403) en **cada**
  request autenticado, ni creando una sesión nueva.
- **Auditoría**: toda acción admin queda en `admin_audit_log`
  (`ADMIN_LOGIN`, `ADMIN_LOGIN_FAILED`, `ADMIN_LOCKOUT`, `BAN`, `UNBAN`,
  `PREMIUM_GRANT`, …).

## Variables de entorno (sólo nombres — nunca en Git)
```
ADMIN_PASSWORD_HASH   # hash scrypt de la contraseña admin (ver "generar" abajo)
ADMIN_ALERT_EMAIL     # destino de las alertas (default luckyvalentinaguirre@gmail.com)
EMAIL_PROVIDER        # p. ej. "resend"
EMAIL_API_KEY         # clave del proveedor de email (secreto)
EMAIL_FROM            # remitente verificado
```
Si el email no está configurado, la alerta se registra en el log (sin secretos)
y no rompe. Si `ADMIN_PASSWORD_HASH` no está, el login admin responde 503.

### Generar el hash de la contraseña admin
```bash
cd backend
node -e "import('./dist/services/password.js').then(m=>m.hashPassword(process.argv[1]).then(h=>console.log(h)))" 'TU_CLAVE'
# o con tsx sobre el fuente:
npx tsx -e "import('./src/services/password.js').then(m=>m.hashPassword('TU_CLAVE').then(console.log))"
```
Copiá el resultado a `ADMIN_PASSWORD_HASH` en el entorno (no en el repo).

### Hacer admin a un usuario
```sql
UPDATE users SET role = 'admin' WHERE email = 'tu-email@dominio';
```

## Endpoints (todos server-side, auditados)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/login` | 2ª credencial (sesión + rol admin requeridos). |
| POST | `/admin/logout` | Cierra la sesión admin elevada. |
| GET | `/admin/session` | ¿Hay sesión admin activa? |
| GET | `/admin/users/search?q=` | Buscar por username / email / id. |
| GET | `/admin/users/detail?userId=` | Ficha completa del usuario. |
| POST | `/admin/users/ban` | `{ userId, reason, days? }`. |
| POST | `/admin/users/unban` | `{ userId }`. |
| POST | `/admin/users/premium` | `{ userId, days }` (otorga/extiende). |
| GET | `/admin/stats` | Contadores del dashboard. |
| GET | `/admin/audit` | Registro de acciones administrativas. |

## Pendiente
- Frontend `/admin` (UI del panel).
- Secciones de sólo-lectura restantes: partidas (activas/finalizadas), matchmaking,
  ranking/temporadas admin, reportes/moderación, pagos MP. (Reutilizan repos/managers
  existentes; se agregan endpoints `/admin/...` a medida.)
