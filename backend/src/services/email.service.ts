/**
 * Servicio de email transaccional usando Resend (https://resend.com).
 *
 * Si la env var `RESEND_API_KEY` está vacía, los emails se loguean a console
 * en su lugar — útil para desarrollo local y para arrancar sin cuenta.
 *
 * Usa fetch nativo (Node 18+) para evitar agregar la dep `resend` al bundle
 * serverless. La API HTTP de Resend es sencilla y estable.
 */

const RESEND_API = 'https://api.resend.com/emails';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Envía un email vía Resend. Si no hay API key, lo loguea (no falla).
 * Devuelve true si se mandó (o se logueó), false si falló el envío real.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  // Email de remite. Hasta que verifiques un dominio en Resend, usa el de testing
  // que Resend habilita por defecto (`onboarding@resend.dev`).
  const from = process.env.EMAIL_FROM || 'Genimatech <onboarding@resend.dev>';

  if (!apiKey) {
    // Modo dev / sin Resend: solo loguea.
    console.log('\n📧 [EMAIL no enviado — RESEND_API_KEY vacío]');
    console.log('   De:     ', from);
    console.log('   Para:   ', params.to);
    console.log('   Asunto: ', params.subject);
    console.log('   HTML:   ', params.html.replace(/\s+/g, ' ').substring(0, 200) + '...\n');
    return true;
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[email.service] Resend rechazó el email:', res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email.service] Error de red al llamar Resend:', err);
    return false;
  }
}

/**
 * Email transaccional: código de 6 dígitos para reset de contraseña.
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<boolean> {
  const html = `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;font-family:'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:32px;background:linear-gradient(135deg,#4f46e5,#9333ea);text-align:center;color:#fff;">
              <h1 style="margin:0;font-size:22px;letter-spacing:-0.02em;">Genimatech</h1>
              <p style="margin:4px 0 0 0;opacity:0.85;font-size:14px;">POS para pastelerías</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;">Tu código para recuperar la contraseña</h2>
              <p style="margin:0 0 24px 0;color:#475569;line-height:1.55;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta
                <strong>${escapeHtml(email)}</strong>. Usa el siguiente código para
                continuar. Vence en 15 minutos.
              </p>
              <div style="text-align:center;padding:20px;background:#f1f5f9;border-radius:12px;letter-spacing:0.4em;font-size:32px;font-weight:700;color:#4f46e5;">
                ${code}
              </div>
              <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.55;">
                Si no fuiste tú quien pidió esto, ignora este correo. Tu contraseña
                actual sigue funcionando.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;text-align:center;">
              © ${new Date().getFullYear()} Genimatech · Hecho en Perú
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  return sendEmail({
    to: email,
    subject: `Genimatech: tu código de verificación es ${code}`,
    html,
    text: `Tu código para recuperar la contraseña es: ${code}\n\nVence en 15 minutos. Si no fuiste tú, ignora este mensaje.`,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
