/**
 * Importa Excel PMV INVIMA a la base configurada en DATABASE_URL.
 * Uso: node dist/scripts/import-invima-pmv-cli.js "ruta/al/archivo.xlsb"
 */
import { readFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InvimaPmvService } from '../masters/invima-pmv/invima-pmv.service';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node dist/scripts/import-invima-pmv-cli.js <archivo.xlsx|.xlsb>');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  const filename = filePath.replace(/^.*[\\/]/, '');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const svc = app.get(InvimaPmvService);
    console.log(`[PMV] Importando ${filename}...`);
    const result = await svc.importFromBuffer({
      buffer,
      filename,
      replaceExisting: true,
    });
    console.log(result.message ?? JSON.stringify(result));
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    console.error('[PMV] Error:', (e as Error).message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
