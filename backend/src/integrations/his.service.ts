import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HisPrescriptionDto } from './dto/his-prescription.dto';

@Injectable()
export class HisService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  validateSecret(secret?: string) {
    const expected = this.config.get('HIS_WEBHOOK_SECRET') ?? 'dev-his-secret';
    if (secret !== expected) {
      throw new UnauthorizedException('HIS webhook secret inválido');
    }
  }

  async ingestPrescription(dto: HisPrescriptionDto) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const [existing] = await qr.query(
        `SELECT id FROM prescriptions WHERE external_id = $1`,
        [dto.externalId],
      );
      if (existing) {
        throw new BadRequestException(`Prescripción ${dto.externalId} ya existe`);
      }

      const [rx] = await qr.query(
        `INSERT INTO prescriptions (external_id, patient_id, doctor_id, status)
         VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
        [dto.externalId, dto.patientId, dto.doctorId ?? null],
      );

      for (const line of dto.lines) {
        const [p] = await qr.query(
          `SELECT id FROM products WHERE code = $1 AND is_active = TRUE`,
          [line.productCode],
        );
        if (!p) {
          throw new BadRequestException(`Producto ${line.productCode} no en catálogo`);
        }
        await qr.query(
          `INSERT INTO prescription_lines (prescription_id, product_id, dose_qty, dose_unit)
           VALUES ($1, $2, $3, $4)`,
          [rx.id, p.id, line.doseQty, line.doseUnit],
        );
      }

      await qr.commitTransaction();
      return { prescriptionId: rx.id, externalId: dto.externalId, status: 'PENDING' };
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
