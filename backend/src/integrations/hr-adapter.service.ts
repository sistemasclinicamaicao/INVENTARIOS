import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface HrUserRecord {
  cedula: string;
  email: string;
  fullName: string;
  active: boolean;
  roleCode?: string;
}

@Injectable()
export class HrAdapterService {
  private readonly logger = new Logger(HrAdapterService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async fetchUsers(): Promise<HrUserRecord[]> {
    const useMock =
      this.config.get('HR_USE_MOCK') === 'true'
      || !this.config.get('HR_API_URL');

    if (useMock) {
      return this.mockUsers();
    }

    const url = this.config.get<string>('HR_API_URL')!;
    const apiKey = this.config.get<string>('HR_API_KEY') ?? '';

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: apiKey ? `Bearer ${apiKey}` : '',
          'X-API-Key': apiKey,
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        throw new Error(`HR API ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as HrUserRecord[] | { users: HrUserRecord[] };
      const list = Array.isArray(data) ? data : data.users ?? [];
      return list.map((u) => ({
        cedula: String(u.cedula).trim(),
        email: u.email,
        fullName: u.fullName,
        active: u.active !== false,
        roleCode: u.roleCode,
      }));
    } catch (e) {
      this.logger.warn(`HR API falló, usando mock: ${(e as Error).message}`);
      return this.mockUsers();
    }
  }

  async syncToDatabase(): Promise<{ recordsProcessed: number; source: string }> {
    const users = await this.fetchUsers();
    let processed = 0;

    for (const u of users) {
      const [row] = await this.dataSource.query(
        `INSERT INTO users (cedula, email, full_name, is_active, last_sync_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (cedula) DO UPDATE SET
           email = EXCLUDED.email,
           full_name = EXCLUDED.full_name,
           is_active = EXCLUDED.is_active,
           last_sync_at = NOW(),
           updated_at = NOW()
         RETURNING id`,
        [u.cedula, u.email, u.fullName, u.active],
      );
      if (u.roleCode && row?.id) {
        await this.dataSource.query(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT $1, r.id FROM roles r WHERE r.code = $2
           ON CONFLICT DO NOTHING`,
          [row.id, u.roleCode],
        );
      }
      processed++;
    }

    const source = this.config.get('HR_USE_MOCK') === 'true' ? 'mock' : 'api';
    await this.dataSource.query(
      `INSERT INTO user_sync_log (status, records_processed, payload)
       VALUES ('OK', $1, $2)`,
      [processed, JSON.stringify({ source, at: new Date().toISOString() })],
    );

    return { recordsProcessed: processed, source };
  }

  private mockUsers(): HrUserRecord[] {
    return [
      {
        cedula: '1234567890',
        email: 'admin@clinica.local',
        fullName: 'Admin Demo',
        active: true,
        roleCode: 'admin',
      },
      {
        cedula: '9876543210',
        email: 'bodega@clinica.local',
        fullName: 'Ana Bodeguero',
        active: true,
        roleCode: 'bodeguero',
      },
    ];
  }
}
