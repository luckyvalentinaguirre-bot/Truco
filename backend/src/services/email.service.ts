/* =============================================================
 * Backend · Envío de email (config-gated) — alertas de seguridad
 * -------------------------------------------------------------
 * Si no hay proveedor configurado, NO rompe: registra que "enviaría" el aviso
 * (sin secretos). Cuando cargues EMAIL_API_KEY/EMAIL_FROM funciona. Nunca se
 * envían contraseñas ni secretos por email.
 *
 * Variables (sólo en el entorno, nunca en Git):
 *   EMAIL_PROVIDER   p. ej. "resend"
 *   EMAIL_API_KEY    clave del proveedor (secreto)
 *   EMAIL_FROM       remitente verificado
 *   ADMIN_ALERT_EMAIL  destino de las alertas (default el del admin)
 * ============================================================= */

export function emailConfigured(): boolean {
  return Boolean(process.env.EMAIL_API_KEY && process.env.EMAIL_FROM);
}

export const ADMIN_ALERT_EMAIL = 'luckyvalentinaguirre@gmail.com';

/** Envía un email simple. Config-gated; nunca incluir secretos en el cuerpo. */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!emailConfigured()) {
    // Sin proveedor: se deja constancia (sin datos sensibles) y no se envía.
    console.log(`[email] (no configurado) a=${to} · asunto="${subject}"`);
    return false;
  }
  const provider = process.env.EMAIL_PROVIDER ?? 'resend';
  try {
    if (provider === 'resend') {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
      });
      return res.ok;
    }
    // Otros proveedores: agregar acá según corresponda.
    console.warn(`[email] proveedor no soportado: ${provider}`);
    return false;
  } catch (err) {
    console.error('[email] error al enviar:', err instanceof Error ? err.name : err);
    return false;
  }
}

/** Alerta de seguridad del panel admin (bloqueo por intentos fallidos). */
export async function sendAdminLockoutAlert(origin: string | null): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL ?? ADMIN_ALERT_EMAIL;
  const when = new Date().toISOString();
  const text =
    'ALERTA DE SEGURIDAD — PANEL ADMIN\n\n' +
    'Se detectaron más de 3 intentos incorrectos de acceso al panel administrativo.\n' +
    'El acceso administrativo fue bloqueado durante 8 horas.\n\n' +
    `Fecha y hora: ${when}\n` +
    `IP/origen: ${origin ?? 'no disponible'}\n`;
  await sendEmail(to, 'ALERTA DE SEGURIDAD — PANEL ADMIN', text);
}
