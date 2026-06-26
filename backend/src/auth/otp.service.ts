import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisIoOptions } from '../common/redis-options.util';
import { MailService } from '../mail/mail.service';

interface MemoryEntry {
  value: string;
  expires: number;
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private redis: Redis | null = null;
  private redisOk = true;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor(
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {
    try {
      this.redis = new Redis(redisIoOptions(config));
      this.redis.on('error', (err) => {
        this.redisOk = false;
        this.logger.warn(`Redis OTP: ${err.message}`);
      });
    } catch (err) {
      this.redisOk = false;
      this.logger.warn('Redis OTP no disponible; usando memoria local');
    }
  }

  private ttl(): number {
    return Number(this.config.get('OTP_TTL_SECONDS') ?? 300);
  }

  private purgeMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (entry.expires <= now) this.memory.delete(key);
    }
  }

  private async setex(key: string, ttlSec: number, value: string): Promise<void> {
    if (this.redis && this.redisOk) {
      try {
        await this.redis.setex(key, ttlSec, value);
        return;
      } catch {
        this.redisOk = false;
        this.logger.warn('Redis caído; OTP/sesión en memoria local');
      }
    }
    this.purgeMemory();
    this.memory.set(key, { value, expires: Date.now() + ttlSec * 1000 });
  }

  private async get(key: string): Promise<string | null> {
    if (this.redis && this.redisOk) {
      try {
        return await this.redis.get(key);
      } catch {
        this.redisOk = false;
      }
    }
    this.purgeMemory();
    const entry = this.memory.get(key);
    if (!entry || entry.expires <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private async del(key: string): Promise<void> {
    if (this.redis && this.redisOk) {
      try {
        await this.redis.del(key);
        return;
      } catch {
        this.redisOk = false;
      }
    }
    this.memory.delete(key);
  }

  /** Dominios de demo/local que no reciben correo real. */
  isDeliverableEmail(email: string): boolean {
    const normalized = String(email ?? '').trim().toLowerCase();
    if (!normalized.includes('@')) return false;
    const domain = normalized.split('@')[1] ?? '';
    const blocked = ['.local', '.invalid', '.test', 'localhost', 'example.com', 'example.org'];
    return !blocked.some((suffix) => domain === suffix || domain.endsWith(suffix));
  }

  maskEmail(email: string): string {
    const normalized = String(email ?? '').trim();
    const at = normalized.indexOf('@');
    if (at <= 0) return '***';
    const local = normalized.slice(0, at);
    const domain = normalized.slice(at + 1);
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***@${domain}`;
  }

  resolveOtpRecipient(userEmail: string): string {
    const override = String(this.config.get('OTP_EMAIL_OVERRIDE') ?? '').trim();
    if (override && this.isDeliverableEmail(override)) return override;
    if (this.isDeliverableEmail(userEmail)) return userEmail;
    const alertFallback = String(this.config.get('INVIMA_VENCIDOS_ALERT_TO') ?? '')
      .split(',')
      .map((e) => e.trim())
      .find((e) => e && this.isDeliverableEmail(e));
    if (alertFallback) return alertFallback;
    return userEmail;
  }

  private buildOtpMailContent(otp: string): { subject: string; text: string; html: string } {
    const ttlMin = Math.max(1, Math.round(this.ttl() / 60));
    const fromName = String(this.config.get('SMTP_FROM_NAME') ?? 'Clínica Maicao — Inventarios').trim();
    const subject = `Código de acceso — ${fromName}`;
    const text = [
      'Hola,',
      '',
      'Recibió este mensaje porque alguien intentó iniciar sesión en el Sistema de Inventarios.',
      '',
      `Su código de verificación es: ${otp}`,
      '',
      `El código vence en ${ttlMin} minuto(s). Si usted no solicitó este acceso, ignore este correo.`,
      '',
      '—',
      fromName,
      'Este es un mensaje automático; no responda a este correo.',
    ].join('\n');
    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 8px;font-size:14px;color:#64748b;">${fromName}</p>
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">Código de verificación</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;">Use el siguiente código para completar su inicio de sesión:</p>
          <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#1d4ed8;">${otp}</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.5;color:#475569;">Válido por <strong>${ttlMin} minuto(s)</strong>.</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#94a3b8;">Si no solicitó este acceso, puede ignorar este mensaje.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">Mensaje automático del sistema de inventarios.</p>
    </td></tr>
  </table>
</body>
</html>`;
    return { subject, text, html };
  }

  async generateAndStore(userId: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.setex(`otp:${userId}`, this.ttl(), otp);
    return otp;
  }

  async verify(userId: string, otp: string): Promise<boolean> {
    const key = `otp:${userId}`;
    const stored = await this.get(key);
    if (!stored || stored !== otp) return false;
    await this.del(key);
    return true;
  }

  async sendEmail(to: string, otp: string): Promise<boolean> {
    if (!this.isDeliverableEmail(to)) {
      this.logger.warn(`OTP no enviado: correo no entregable (${to})`);
      console.log(`[OTP undeliverable] ${to} => ${otp}`);
      return false;
    }
    if (!this.mailService.isConfigured()) {
      console.log(`[DEV OTP] ${to} => ${otp}`);
      return false;
    }
    const mail = this.buildOtpMailContent(otp);
    const sent = await this.mailService.sendMail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: {
        'X-Entity-Ref-ID': `otp-${Date.now()}`,
      },
    });
    if (!sent) {
      console.log(`[OTP fallback] ${to} => ${otp}`);
    }
    return sent;
  }

  async storeSession(token: string, userId: string): Promise<void> {
    await this.setex(`session:${token}`, this.ttl(), userId);
  }

  async getSessionUserId(token: string): Promise<string | null> {
    return this.get(`session:${token}`);
  }

  async deleteSession(token: string): Promise<void> {
    await this.del(`session:${token}`);
  }
}
