import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { redisIoOptions } from '../common/redis-options.util';

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
  private mailer: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
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

    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const smtpPass = String(this.config.get('SMTP_PASS') ?? '').replace(/\s+/g, '');
      this.mailer = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: smtpPass,
        },
      });
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
    const from = this.config.get('SMTP_FROM') ?? 'noreply@clinica.local';
    if (!this.mailer) {
      console.log(`[DEV OTP] ${to} => ${otp}`);
      return false;
    }
    try {
      await this.mailer.sendMail({
        from,
        to,
        subject: 'Código de verificación - Clínica ERP',
        text: `Su código OTP es: ${otp}. Válido por ${this.ttl() / 60} minutos.`,
        html: `<p>Su código OTP es: <strong>${otp}</strong></p><p>Válido por ${this.ttl() / 60} minutos.</p>`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`SMTP falló (${to}): ${(err as Error).message}`);
      console.log(`[OTP fallback] ${to} => ${otp}`);
      return false;
    }
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
