/**
 * Envía correo de prueba simulando medicamentos vencidos.
 * Uso: npm run send:invima-vencidos-test
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
    const result = await alert.sendTestVencidosAlert();
    if (!result.recipients.length) {
      console.error('[PRUEBA] INVIMA_VENCIDOS_ALERT_TO no está configurado.');
      process.exit(1);
    }
    if (result.emailSent) {
      console.log(
        `[PRUEBA] Correo enviado a: ${result.recipients.join(', ')}`,
      );
      process.exit(0);
    }
    console.error(
      '[PRUEBA] No se pudo enviar. Verifique SMTP_HOST, SMTP_USER y SMTP_PASS en .env',
    );
    process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
