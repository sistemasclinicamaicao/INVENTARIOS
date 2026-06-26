/**
 * Envía correos de prueba: Sin registro INVIMA y Sin CUM.
 * Uso: npm run send:invima-estados-alerts-test
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

    for (const [label, fn] of [
      ['Sin registro INVIMA', () => alert.sendTestSinRegistroAlert()],
      ['Sin CUM', () => alert.sendTestSinCumAlert()],
    ] as const) {
      const result = await fn();
      if (!result.recipients.length) {
        console.error(`[PRUEBA ${label}] INVIMA_VENCIDOS_ALERT_TO no configurado.`);
        process.exit(1);
      }
      if (result.emailSent) {
        console.log(`[PRUEBA ${label}] Correo enviado a: ${result.recipients.join(', ')}`);
      } else {
        console.error(`[PRUEBA ${label}] No se pudo enviar. Revise SMTP en .env`);
        process.exit(1);
      }
    }
    process.exit(0);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
