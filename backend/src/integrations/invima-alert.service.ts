import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ExternalIntegrationsService } from './external-integrations.service';

type EstadosRow = Awaited<
  ReturnType<ExternalIntegrationsService['buildKrystalosInvimaEstadosDataset']>
>['allRows'][number];

type EstadosAlertKind = 'vencidos' | 'sinRegistro' | 'sinCum';

interface EstadosAlertConfig {
  kind: EstadosAlertKind;
  subject: string;
  chipLabel: string;
  description: string;
  csvPrefix: string;
}

const ALERT_CONFIGS: Record<EstadosAlertKind, EstadosAlertConfig> = {
  vencidos: {
    kind: 'vencidos',
    subject: 'MEDICAMENTOS VENCIDOS EN EL SISTEMA',
    chipLabel: 'Vencidos',
    description:
      'medicamento(s) con estado Vencidos (pestaña Estados, etiqueta roja «Vencidos»)',
    csvPrefix: 'medicamentos-vencidos',
  },
  sinRegistro: {
    kind: 'sinRegistro',
    subject: 'MEDICAMENTOS SIN REGISTRO INVIMA EN EL SISTEMA',
    chipLabel: 'Sin registro INVIMA',
    description:
      'medicamento(s) con etiqueta «Sin registro INVIMA» (pestaña Estados)',
    csvPrefix: 'medicamentos-sin-registro-invima',
  },
  sinCum: {
    kind: 'sinCum',
    subject: 'MEDICAMENTOS SIN CUM EN EL SISTEMA',
    chipLabel: 'Sin CUM',
    description: 'medicamento(s) con etiqueta «Sin CUM» (pestaña Estados)',
    csvPrefix: 'medicamentos-sin-cum',
  },
};

@Injectable()
export class InvimaAlertService {
  private readonly logger = new Logger(InvimaAlertService.name);

  constructor(
    private readonly externalIntegrations: ExternalIntegrationsService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  private alertRecipients(): string[] {
    const raw = this.config.get<string>('INVIMA_VENCIDOS_ALERT_TO') ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/Bogota',
    }).format(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private buildEstadosCodesCsv(rows: EstadosRow[]): string {
    const header =
      'codigo_krystalos,descripcion,cum,estado,estado_label,producto_invima,fecha_vencimiento';
    const escape = (value: string) => {
      const v = value.replace(/"/g, '""');
      return /[",\n\r]/.test(v) ? `"${v}"` : v;
    };
    const lines = rows.map((row) =>
      [
        escape(row.idArticulo),
        escape(row.descripcion),
        escape(row.codcum ?? ''),
        escape(row.estadoKey),
        escape(row.estadoLabel),
        escape(row.invimaProducto ?? ''),
        escape(row.invimaFechaVencimiento ?? ''),
      ].join(','),
    );
    return [header, ...lines].join('\n');
  }

  private buildEstadosEmailHtml(
    config: EstadosAlertConfig,
    rows: EstadosRow[],
    total: number,
    processedAt: Date,
  ): string {
    const codesList = rows.map((r) => r.idArticulo).join(', ');
    const tableRows = rows
      .map(
        (row) => `<tr>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.idArticulo)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.descripcion)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.codcum ?? '—')}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.estadoLabel)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.invimaProducto ?? '—')}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${this.escapeHtml(row.invimaFechaVencimiento ?? '—')}</td>
        </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111;">
  <p>Se detectaron <strong>${total}</strong> ${config.description} tras la sincronización automática.</p>
  <p><strong>Procesado:</strong> ${this.escapeHtml(this.formatDateTime(processedAt))} (hora Colombia)</p>
  <p><strong>Códigos (${config.chipLabel}):</strong> ${this.escapeHtml(codesList)}</p>
  <p style="color:#64748b;font-size:12px;">Lista completa adjunta en CSV.</p>
  <table style="border-collapse:collapse;width:100%;max-width:900px;margin-top:16px;">
    <thead>
      <tr style="background:#f1f5f9;">
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Cód. Krystalos</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Descripción</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">CUM</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Estado</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Producto INVIMA</th>
        <th style="padding:8px;border:1px solid #ddd;text-align:left;">Vence</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <p style="margin-top:20px;color:#64748b;font-size:12px;">Clínica ERP — alerta automática INVIMA</p>
</body>
</html>`;
  }

  private buildEstadosEmailText(
    config: EstadosAlertConfig,
    rows: EstadosRow[],
    total: number,
    processedAt: Date,
  ): string {
    const codesList = rows.map((r) => r.idArticulo).join(', ');
    const lines = rows.map(
      (row) =>
        `- ${row.idArticulo} | ${row.descripcion} | CUM: ${row.codcum ?? '—'} | ${row.estadoLabel} | INVIMA: ${row.invimaProducto ?? '—'} | Vence: ${row.invimaFechaVencimiento ?? '—'}`,
    );
    return [
      `Se detectaron ${total} medicamento(s) en la etiqueta ${config.chipLabel} (pestaña Estados).`,
      `Procesado: ${this.formatDateTime(processedAt)} (hora Colombia)`,
      `Códigos: ${codesList}`,
      '(Ver adjunto CSV con el detalle completo)',
      '',
      ...lines,
    ].join('\n');
  }

  async sendEstadosAlert(
    kind: EstadosAlertKind,
    rows: EstadosRow[],
    total: number,
    processedAt: Date,
    isTest = false,
  ): Promise<boolean> {
    const config = ALERT_CONFIGS[kind];
    const recipients = this.alertRecipients();
    if (!recipients.length) {
      this.logger.warn(
        'INVIMA_VENCIDOS_ALERT_TO vacío; no se puede enviar alerta INVIMA',
      );
      return false;
    }
    if (!this.mailService.isConfigured()) {
      this.logger.warn('SMTP no configurado; alerta INVIMA no enviada');
      return false;
    }

    const dateStamp = processedAt.toISOString().slice(0, 10);
    const csv = this.buildEstadosCodesCsv(rows);

    return this.mailService.sendMail({
      to: recipients,
      subject: isTest ? `[PRUEBA] ${config.subject}` : config.subject,
      html: this.buildEstadosEmailHtml(config, rows, total, processedAt),
      text: this.buildEstadosEmailText(config, rows, total, processedAt),
      attachments: [
        {
          filename: `${config.csvPrefix}-${dateStamp}.csv`,
          content: `\uFEFF${csv}`,
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    });
  }

  /** @deprecated Use sendEstadosAlert('vencidos', ...) */
  async sendVencidosAlert(
    rows: EstadosRow[],
    total: number,
    processedAt: Date,
    isTest = false,
  ): Promise<boolean> {
    return this.sendEstadosAlert('vencidos', rows, total, processedAt, isTest);
  }

  private mockVencidosRows(): EstadosRow[] {
    return [
      {
        idArticulo: 'MD0121',
        descripcion: 'METRONIDAZOL (BENZOILO) 250 MG/5 ML SUSPENSIÓN ORAL',
        codcum: '19961747-1',
        pmvPrecioUnitario: null,
        pmvRegulado: false,
        invimaMatched: true,
        invimaListType: 'VENCIDO',
        invimaEstadoRegistro: 'Vencido',
        invimaFechaVencimiento: '2026-06-06',
        invimaProducto: 'METRONIDAZOL 250 MG/5 ML',
        invimaRegistroSanitario: 'RS-12345',
        invimaAtc: 'J01XD01',
        invimaMatchCount: 1,
        estadoKey: 'VENCIDO',
        estadoLabel: 'Vencido',
        posMatched: false,
        posLabel: 'NO POS',
      },
    ];
  }

  private mockSinRegistroRows(): EstadosRow[] {
    return [
      {
        idArticulo: 'MD0340',
        descripcion: 'TROBAMMICINA GOTAS',
        codcum: '20111222-1',
        pmvPrecioUnitario: null,
        pmvRegulado: false,
        invimaMatched: false,
        invimaListType: null,
        invimaEstadoRegistro: null,
        invimaFechaVencimiento: null,
        invimaProducto: null,
        invimaRegistroSanitario: null,
        invimaAtc: null,
        invimaMatchCount: 0,
        estadoKey: 'SIN_REGISTRO',
        estadoLabel: 'Sin registro INVIMA',
        posMatched: false,
        posLabel: 'NO POS',
      },
      {
        idArticulo: 'MD0401',
        descripcion: 'OXIGENO MEDICO',
        codcum: '20099887-4',
        pmvPrecioUnitario: null,
        pmvRegulado: false,
        invimaMatched: false,
        invimaListType: null,
        invimaEstadoRegistro: null,
        invimaFechaVencimiento: null,
        invimaProducto: null,
        invimaRegistroSanitario: null,
        invimaAtc: null,
        invimaMatchCount: 0,
        estadoKey: 'SIN_REGISTRO',
        estadoLabel: 'Sin registro INVIMA',
        posMatched: false,
        posLabel: 'NO POS',
      },
    ];
  }

  private mockSinCumRows(): EstadosRow[] {
    return [
      {
        idArticulo: 'MTQ0057',
        descripcion: 'ADAPTADOR MACHO PRESION 1"',
        codcum: null,
        pmvPrecioUnitario: null,
        pmvRegulado: false,
        invimaMatched: false,
        invimaListType: null,
        invimaEstadoRegistro: null,
        invimaFechaVencimiento: null,
        invimaProducto: null,
        invimaRegistroSanitario: null,
        invimaAtc: null,
        invimaMatchCount: 0,
        estadoKey: 'SIN_CUM',
        estadoLabel: 'Sin CUM en Krystalos',
        posMatched: false,
        posLabel: 'NO POS',
      },
    ];
  }

  async sendTestVencidosAlert(): Promise<{ emailSent: boolean; recipients: string[] }> {
    const rows = this.mockVencidosRows();
    const recipients = this.alertRecipients();
    const emailSent = await this.sendEstadosAlert(
      'vencidos',
      rows,
      rows.length,
      new Date(),
      true,
    );
    return { emailSent, recipients };
  }

  async sendTestSinRegistroAlert(): Promise<{ emailSent: boolean; recipients: string[] }> {
    const rows = this.mockSinRegistroRows();
    const recipients = this.alertRecipients();
    const emailSent = await this.sendEstadosAlert(
      'sinRegistro',
      rows,
      rows.length,
      new Date(),
      true,
    );
    return { emailSent, recipients };
  }

  async sendTestSinCumAlert(): Promise<{ emailSent: boolean; recipients: string[] }> {
    const rows = this.mockSinCumRows();
    const recipients = this.alertRecipients();
    const emailSent = await this.sendEstadosAlert(
      'sinCum',
      rows,
      rows.length,
      new Date(),
      true,
    );
    return { emailSent, recipients };
  }

  /** Envía correos con datos reales del cruce Estados (sin sincronizar catálogos). */
  async sendRealEstadosAlerts(refreshKrystalos = true) {
    const startedAt = new Date();
    const recipients = this.alertRecipients();

    const dataset =
      await this.externalIntegrations.buildKrystalosInvimaEstadosDataset(
        refreshKrystalos,
      );

    const emailsSent = {
      vencidos: false,
      sinRegistro: false,
      sinCum: false,
    };

    const counts = {
      vencidos: dataset.summary.vencido,
      sinRegistro: dataset.summary.sinRegistro,
      sinCum: dataset.summary.sinCum,
    };

    if (counts.vencidos > 0) {
      emailsSent.vencidos = await this.sendEstadosAlert(
        'vencidos',
        dataset.vencidoRows,
        counts.vencidos,
        startedAt,
        false,
      );
    }

    if (counts.sinRegistro > 0) {
      emailsSent.sinRegistro = await this.sendEstadosAlert(
        'sinRegistro',
        dataset.sinRegistroRows,
        counts.sinRegistro,
        startedAt,
        false,
      );
    }

    if (counts.sinCum > 0) {
      emailsSent.sinCum = await this.sendEstadosAlert(
        'sinCum',
        dataset.sinCumRows,
        counts.sinCum,
        startedAt,
        false,
      );
    }

    return {
      ok: dataset.ok,
      recipients,
      summary: dataset.summary,
      counts,
      emailsSent,
    };
  }

  async runDailyInvimaJob() {
    const startedAt = new Date();
    this.logger.log('INVIMA daily job: iniciando sincronización de catálogos…');

    const syncResult =
      await this.externalIntegrations.syncAllCatalogsSequential(true);

    if (!syncResult.ok) {
      this.logger.warn(`INVIMA daily job: sincronización falló — ${syncResult.message}`);
      return {
        ok: false,
        phase: 'sync' as const,
        syncResult,
        emailsSent: { vencidos: false, sinRegistro: false, sinCum: false },
      };
    }

    this.logger.log(
      'INVIMA daily job: sincronización completada, recalculando Estados…',
    );

    const dataset =
      await this.externalIntegrations.buildKrystalosInvimaEstadosDataset(true);

    const emailsSent = {
      vencidos: false,
      sinRegistro: false,
      sinCum: false,
    };

    if (dataset.summary.vencido > 0) {
      this.logger.log(
        `INVIMA daily job: etiqueta Vencidos = ${dataset.summary.vencido} — enviando correo…`,
      );
      emailsSent.vencidos = await this.sendEstadosAlert(
        'vencidos',
        dataset.vencidoRows,
        dataset.summary.vencido,
        startedAt,
      );
    } else {
      this.logger.log('INVIMA daily job: etiqueta Vencidos en 0 — sin correo');
    }

    if (dataset.summary.sinRegistro > 0) {
      this.logger.log(
        `INVIMA daily job: etiqueta Sin registro INVIMA = ${dataset.summary.sinRegistro} — enviando correo…`,
      );
      emailsSent.sinRegistro = await this.sendEstadosAlert(
        'sinRegistro',
        dataset.sinRegistroRows,
        dataset.summary.sinRegistro,
        startedAt,
      );
    } else {
      this.logger.log(
        'INVIMA daily job: etiqueta Sin registro INVIMA en 0 — sin correo',
      );
    }

    if (dataset.summary.sinCum > 0) {
      this.logger.log(
        `INVIMA daily job: etiqueta Sin CUM = ${dataset.summary.sinCum} — enviando correo…`,
      );
      emailsSent.sinCum = await this.sendEstadosAlert(
        'sinCum',
        dataset.sinCumRows,
        dataset.summary.sinCum,
        startedAt,
      );
    } else {
      this.logger.log('INVIMA daily job: etiqueta Sin CUM en 0 — sin correo');
    }

    return {
      ok: true,
      phase: 'complete' as const,
      syncResult,
      summary: dataset.summary,
      emailsSent,
      vencidosCount: dataset.summary.vencido,
      sinRegistroCount: dataset.summary.sinRegistro,
      sinCumCount: dataset.summary.sinCum,
    };
  }
}
