import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { isAuthDisabled } from '../auth-config.util';
import { RbacService } from '../rbac.service';
import { JwtPayload } from '../jwt.strategy';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (isAuthDisabled(this.config)) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = req.user;
    if (!user?.sub) {
      throw new ForbiddenException('No autenticado');
    }

    if (user.roles?.includes('admin')) {
      return true;
    }

    const granted = await this.rbac.getUserPermissions(user.sub);
    const ok = required.some((p) => granted.includes(p));
    if (!ok) {
      throw new ForbiddenException(
        `Permiso requerido: ${required.join(' o ')}`,
      );
    }
    return true;
  }
}
