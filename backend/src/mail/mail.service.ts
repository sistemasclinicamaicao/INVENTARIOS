import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mailer: nodemailer.Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const smtpPass = String(this.config.get('SMTP_PASS') ?? '').replace(/\s+/g, '');
      this.mailer = nodemailer.createTransport({
        host,
        port: Number(this.config.get('SMTP_PORT') ?? 587),
        secure: false,
        auth: {
          user: this.config.get('SMTP_USER'),
          pass: smtpPass,
        },
      });
    } else {
      this.mailer = null;
    }
  }

  isConfigured(): boolean {
    return this.mailer != null;
  }

  getDefaultFrom(): string {
    return this.config.get('SMTP_FROM') ?? 'noreply@clinica.local';
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    const from = this.getDefaultFrom();
    if (!this.mailer) {
      this.logger.warn(
        `SMTP no configurado; correo no enviado (${options.subject} → ${String(options.to)})`,
      );
      return false;
    }
    try {
      await this.mailer.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });
      return true;
    } catch (err) {
      this.logger.error(`SMTP falló (${options.subject}): ${(err as Error).message}`);
      return false;
    }
  }
}
