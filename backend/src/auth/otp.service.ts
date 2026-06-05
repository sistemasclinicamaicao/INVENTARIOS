import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';

@Injectable()
export class OtpService {
  private redis: Redis;
  private mailer: nodemailer.Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    this.redis = new Redis(this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.mailer = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: this.config.get('SMTP_PASS'),
        },
      });
    }
  }

  private ttl(): number {
    return Number(this.config.get('OTP_TTL_SECONDS') ?? 300);
  }

  async generateAndStore(userId: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `otp:${userId}`;
    await this.redis.setex(key, this.ttl(), otp);
    return otp;
  }

  async verify(userId: string, otp: string): Promise<boolean> {
    const stored = await this.redis.get(`otp:${userId}`);
    if (!stored || stored !== otp) return false;
    await this.redis.del(`otp:${userId}`);
    return true;
  }

  async sendEmail(to: string, otp: string): Promise<void> {
    const from = this.config.get('SMTP_FROM') ?? 'noreply@clinica.local';
    if (this.mailer) {
      await this.mailer.sendMail({
        from,
        to,
        subject: 'Código de verificación - Clínica ERP',
        text: `Su código OTP es: ${otp}. Válido por ${this.ttl() / 60} minutos.`,
        html: `<p>Su código OTP es: <strong>${otp}</strong></p><p>Válido por ${this.ttl() / 60} minutos.</p>`,
      });
    } else {
      console.log(`[DEV OTP] ${to} => ${otp}`);
    }
  }

  async storeSession(token: string, userId: string): Promise<void> {
    await this.redis.setex(`session:${token}`, this.ttl(), userId);
  }

  async getSessionUserId(token: string): Promise<string | null> {
    return this.redis.get(`session:${token}`);
  }

  async deleteSession(token: string): Promise<void> {
    await this.redis.del(`session:${token}`);
  }
}
