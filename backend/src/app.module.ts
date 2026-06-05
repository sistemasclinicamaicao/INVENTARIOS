import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { InventoryModule } from './inventory/inventory.module';
import { MastersModule } from './masters/masters.module';
import { OperationsModule } from './operations/operations.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { PickingModule } from './picking/picking.module';
import { PrintingModule } from './printing/printing.module';
import { PurchasesModule } from './purchases/purchases.module';
import { ReceptionsModule } from './receptions/receptions.module';
import { User } from './users/entities/user.entity';
import { Role } from './users/entities/role.entity';
import { UsersModule } from './users/users.module';
import { WarehouseModule } from './warehouse/warehouse.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), '.env'),
        join(process.cwd(), '..', '.env'),
        join(__dirname, '..', '..', '.env'),
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, Role],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
        extra: { options: '-c client_encoding=UTF8' },
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      }),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    DashboardModule,
    ReceptionsModule,
    MastersModule,
    InventoryModule,
    PharmacyModule,
    WarehouseModule,
    PurchasesModule,
    OperationsModule,
    PickingModule,
    PrintingModule,
    IntegrationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
