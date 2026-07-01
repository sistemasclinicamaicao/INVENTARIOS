import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bull';
import { ExternalIntegrationsService } from './external-integrations.service';
import {
  formatInvimaSyncCronHuman,
  resolveInvimaSyncCron,
} from '../workers/invima-sync-cron.util';

function formatBogotaNow(): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date());
}

@Injectable()
export class InvimaSyncDiagnosticsService {
  constructor(
    @InjectQueue('invima-sync')
    private readonly invimaQueue: Queue,
    private readonly config: ConfigService,
    private readonly externalIntegrations: ExternalIntegrationsService,
  ) {}

  async getDiagnostics() {
    const backendEnv = resolveInvimaSyncCron(this.config);
    const serverTimeUtc = new Date().toISOString();
    const serverTimeBogota = formatBogotaNow();

    let repeatableJobs: Awaited<ReturnType<Queue['getRepeatableJobs']>> = [];
    let jobCounts: Awaited<ReturnType<Queue['getJobCounts']>> | Record<string, never> =
      {};
    let recentCompleted: Array<{
      id: string | number;
      finishedOn: number | null;
      processedOn: number | null;
    }> = [];
    let recentFailed: Array<{ id: string | number; failedReason: string }> = [];
    let redisError: string | null = null;

    try {
      repeatableJobs = await this.invimaQueue.getRepeatableJobs();
      jobCounts = await this.invimaQueue.getJobCounts();
      const completed = await this.invimaQueue.getCompleted(0, 4);
      const failed = await this.invimaQueue.getFailed(0, 4);
      recentCompleted = completed.map((j) => ({
        id: j.id,
        finishedOn: j.finishedOn ?? null,
        processedOn: j.processedOn ?? null,
      }));
      recentFailed = failed.map((j) => ({
        id: j.id,
        failedReason: j.failedReason ?? 'unknown',
      }));
    } catch (e) {
      redisError = (e as Error).message;
    }

    const invimaRepeatable = repeatableJobs.filter((j) => j.name === 'daily');
    const hints: string[] = [];

    if (redisError) {
      hints.push(`No se pudo consultar Redis/Bull: ${redisError}`);
    } else if (invimaRepeatable.length === 0) {
      hints.push(
        'No hay cron INVIMA registrado en Redis. El servicio worker probablemente no está corriendo o no arrancó con INVIMA_SYNC_CRON_ENABLED=true.',
      );
    } else {
      for (const job of invimaRepeatable) {
        const nextAt =
          job.next != null
            ? new Intl.DateTimeFormat('es-CO', {
                timeZone: 'America/Bogota',
                dateStyle: 'medium',
                timeStyle: 'medium',
              }).format(new Date(job.next))
            : null;
        hints.push(
          `Cron en Redis: "${job.cron}" tz="${job.tz ?? 'UTC'}" — próxima ejecución (Bogotá): ${nextAt ?? 'desconocida'}`,
        );
      }
    }

    if (
      backendEnv.cron &&
      invimaRepeatable.length > 0 &&
      !invimaRepeatable.some((j) => j.cron === backendEnv.cron)
    ) {
      hints.push(
        `El cron del backend (${backendEnv.cron}) no coincide con el registrado en Redis. Redeploy del worker tras cambiar variables.`,
      );
    }

    if (recentCompleted.length === 0 && invimaRepeatable.length > 0) {
      hints.push(
        'Nunca se completó un job "daily" en esta cola (o Redis fue limpiado). Verifique logs del worker a la hora programada.',
      );
    }

    const integrationsAudit =
      await this.externalIntegrations.auditInvimaDailyJobIntegrations();

    if (!integrationsAudit.allReady) {
      const broken = integrationsAudit.items.filter((i) => !i.ready);
      hints.push(
        `Integraciones incompletas para el job diario (${broken.length}/7): ${broken.map((i) => i.label).join(', ')}`,
      );
    }

    return {
      serverTimeUtc,
      serverTimeBogota,
      backendEnv: {
        ...backendEnv,
        humanSchedule: formatInvimaSyncCronHuman(backendEnv.cron, backendEnv.tz),
      },
      note: 'INVIMA_SYNC_CRON en el backend solo informa la UI. El cron real lo registra el servicio worker al arrancar.',
      integrationsAudit,
      bull: {
        redisError,
        jobCounts,
        repeatableJobs: invimaRepeatable.map((j) => ({
          name: j.name,
          cron: j.cron,
          tz: j.tz ?? null,
          nextUtc: j.next != null ? new Date(j.next).toISOString() : null,
          nextBogota:
            j.next != null
              ? new Intl.DateTimeFormat('es-CO', {
                  timeZone: 'America/Bogota',
                  dateStyle: 'medium',
                  timeStyle: 'medium',
                }).format(new Date(j.next))
              : null,
          key: j.key,
        })),
        recentCompleted,
        recentFailed,
      },
      hints,
    };
  }
}
