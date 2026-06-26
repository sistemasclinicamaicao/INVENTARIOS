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
  replyTo?: string;
  headers?: Record<string, string>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly mailer: nodemailer.Transporter | null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      const smtpPass = String(this.config.get('SMTP_PASS') ?? '').replace(/\s+/g, '');
      const port = Number(this.config.get('SMTP_PORT') ?? 587);
      this.mailer = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        requireTLS: port === 587,
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

  getDefaultFromAddress(): string {
    return String(this.config.get('SMTP_FROM') ?? this.config.get('SMTP_USER') ?? 'noreply@clinica.local').trim();
  }

  getDefaultFromName(): string {
    return String(this.config.get('SMTP_FROM_NAME') ?? 'Clínica Maicao — Inventarios').trim();
  }

  getFormattedFrom(): string {
    const address = this.getDefaultFromAddress();
    const name = this.getDefaultFromName();
    return name ? `"${name.replace(/"/g, '')}" <${address}>` : address;
  }

  getDefaultReplyTo(): string {
    return String(this.config.get('SMTP_REPLY_TO') ?? this.getDefaultFromAddress()).trim();
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (!this.mailer) {
      this.logger.warn(
        `SMTP no configurado; correo no enviado (${options.subject} → ${String(options.to)})`,
      );
      return false;
    }
    try {
      await this.mailer.sendMail({
        from: this.getFormattedFrom(),
        replyTo: options.replyTo ?? this.getDefaultReplyTo(),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        headers: {
          'Auto-Submitted': 'auto-generated',
          'X-Auto-Response-Suppress': 'All',
          Importance: 'normal',
          'X-Priority': '3',
          ...options.headers,
        },
      });
      return true;
    } catch (err) {
      this.logger.error(`SMTP falló (${options.subject}): ${(err as Error).message}`);
      return false;
    }
  }
}
