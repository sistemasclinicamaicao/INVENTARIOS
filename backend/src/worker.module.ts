import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from './integrations/integrations.module';
import { MailModule } from './mail/mail.module';
import { User } from './users/entities/user.entity';
import { Role } from './users/entities/role.entity';
import { HrSyncProcessor } from './workers/hr-sync.processor';
import { InvimaSyncProcessor } from './workers/invima-sync.processor';
import { redisIoOptions } from './common/redis-options.util';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [User, Role],
        synchronize: false,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: redisIoOptions(config),
      }),
    }),
    BullModule.registerQueue({ name: 'hr-sync' }, { name: 'invima-sync' }),
    MailModule,
    IntegrationsModule,
  ],
  providers: [HrSyncProcessor, InvimaSyncProcessor],
})
export class WorkerModule {}
