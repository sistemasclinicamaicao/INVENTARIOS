import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as net from 'net';

@Injectable()
export class ZebraPrintService {
  private readonly logger = new Logger(ZebraPrintService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return !!this.config.get('ZEBRA_HOST');
  }

  async sendZpl(zpl: string): Promise<{ sent: boolean; mode: string; message?: string }> {
    const host = this.config.get<string>('ZEBRA_HOST');
    const port = Number(this.config.get('ZEBRA_PORT') ?? 9100);

    if (!host) {
      return {
        sent: false,
        mode: 'download_only',
        message: 'ZEBRA_HOST no configurado. Use el ZPL devuelto o imprima manualmente.',
      };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        resolve({
          sent: false,
          mode: 'tcp_error',
          message: `Timeout conectando a ${host}:${port}`,
        });
      }, 8000);

      socket.connect(port, host, () => {
        socket.write(zpl, 'utf8', () => {
          socket.end();
          clearTimeout(timeout);
          this.logger.log(`ZPL enviado a ${host}:${port}`);
          resolve({ sent: true, mode: 'zebra_tcp' });
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        this.logger.error(err.message);
        resolve({
          sent: false,
          mode: 'tcp_error',
          message: err.message,
        });
      });
    });
  }
}
