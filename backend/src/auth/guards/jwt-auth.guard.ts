import { ExecutionContext, Injectable } from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { Reflector } from '@nestjs/core';

import { InjectDataSource } from '@nestjs/typeorm';

import { AuthGuard } from '@nestjs/passport';

import { DataSource } from 'typeorm';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isAuthDisabled } from '../auth-config.util';
import { JwtPayload } from '../jwt.strategy';



@Injectable()

export class JwtAuthGuard extends AuthGuard('jwt') {

  constructor(

    private readonly reflector: Reflector,

    private readonly config: ConfigService,

    @InjectDataSource()

    private readonly dataSource: DataSource,

  ) {

    super();

  }



  async canActivate(context: ExecutionContext): Promise<boolean> {

    if (isAuthDisabled(this.config)) {

      await this.attachDevUser(context);

      return true;

    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [

      context.getHandler(),

      context.getClass(),

    ]);

    if (isPublic) return true;

    return super.canActivate(context) as Promise<boolean>;

  }



  private async attachDevUser(context: ExecutionContext) {

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (req.user?.sub) return;



    const cedula = this.config.get<string>('DEV_CEDULA') ?? '1234567890';

    const rows = await this.dataSource.query<

      { id: string; cedula: string; roles: string[] | null }[]

    >(

      `SELECT u.id, u.cedula,

              COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}') AS roles

       FROM users u

       LEFT JOIN user_roles ur ON ur.user_id = u.id

       LEFT JOIN roles r ON r.id = ur.role_id

       WHERE u.cedula = $1 AND u.is_active = TRUE

       GROUP BY u.id, u.cedula`,

      [cedula],

    );



    const row = rows[0];

    if (row) {

      req.user = {

        sub: row.id,

        cedula: row.cedula,

        roles: row.roles?.length ? row.roles : ['admin'],

      };

    } else {

      req.user = { sub: 'dev', cedula, roles: ['admin'] };

    }

  }

}

