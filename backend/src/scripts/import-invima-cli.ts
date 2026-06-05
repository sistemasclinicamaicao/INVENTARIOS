/**
 * Importación offline de listados INVIMA desde data/invima/.
 * Uso: npm run import:invima [-- ruta-al-dir]
 */
import { NestFactory } from '@nestjs/core';
import { resolve } from 'path';
import { AppModule } from '../app.module';
import { InvimaService } from '../masters/invima/invima.service';

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const filePath = argValue('--file');
  const listType = argValue('--list-type') as
    | 'VIGENTE'
    | 'VENCIDO'
    | 'RENOVACION'
    | 'OTRO_ESTADO'
    | undefined;
  const positional = process.argv
    .slice(2)
    .filter((a) => !a.startsWith('--'));
  const dataDir = positional[0]
    ? resolve(positional[0])
    : resolve(process.cwd(), '..', 'data', 'invima');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const invima = app.get(InvimaService);

    if (filePath) {
      const r = await invima.importFromFile({
        filePath: resolve(filePath),
        listType,
        replaceExisting: true,
      });
      console.log(`[OK] ${r.listType}: ${r.rowsImported} filas (${r.sourceFilename})`);
      process.exit(0);
    }

    const results = await invima.importAllFromDataDir(dataDir);
    for (const r of results) {
      if ('ok' in r && r.ok === false) {
        console.error(`[FAIL] ${(r as { file: string }).file}: ${(r as { error: string }).error}`);
      } else {
        console.log(
          `[OK] ${(r as { listType: string }).listType}: ${(r as { rowsImported: number }).rowsImported} filas`,
        );
      }
    }
    const failed = results.filter((r) => 'ok' in r && r.ok === false).length;
    process.exit(failed > 0 ? 1 : 0);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
