/**
 * Envía correos con datos reales de las etiquetas Estados (Vencidos, Sin registro INVIMA, Sin CUM).
 * Uso: npm run send:invima-estados-real
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InvimaAlertService } from '../integrations/invima-alert.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const alert = app.get(InvimaAlertService);
    console.log('[REAL] Cargando cruce Krystalos ↔ INVIMA (Estados)…');
    const result = await alert.sendRealEstadosAlerts(true);

    if (!result.recipients.length) {
      console.error('[REAL] INVIMA_VENCIDOS_ALERT_TO no está configurado.');
      process.exit(1);
    }

    console.log(`[REAL] Destinatario(s): ${result.recipients.join(', ')}`);
    console.log(
      `[REAL] Conteos — Vencidos: ${result.counts.vencidos} | Sin registro INVIMA: ${result.counts.sinRegistro} | Sin CUM: ${result.counts.sinCum}`,
    );

    const labels: [string, boolean, number][] = [
      ['Vencidos', result.emailsSent.vencidos, result.counts.vencidos],
      ['Sin registro INVIMA', result.emailsSent.sinRegistro, result.counts.sinRegistro],
      ['Sin CUM', result.emailsSent.sinCum, result.counts.sinCum],
    ];

    for (const [label, sent, count] of labels) {
      if (count === 0) {
        console.log(`[REAL] ${label}: 0 — no se envía correo`);
      } else if (sent) {
        console.log(`[REAL] ${label}: ${count} — correo enviado`);
      } else {
        console.error(`[REAL] ${label}: ${count} — falló el envío (revise SMTP)`);
      }
    }

    const anySent = Object.values(result.emailsSent).some(Boolean);
    const anyCount = Object.values(result.counts).some((n) => n > 0);
    process.exit(anyCount && !anySent ? 1 : 0);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
