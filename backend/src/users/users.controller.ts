import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RbacService } from '../auth/rbac.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { DashboardService } from '../dashboard/dashboard.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly dashboardService: DashboardService,
    private readonly rbac: RbacService,
  ) {}

  @Get('me')
  async me(@Req() req: { user: JwtPayload }) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) return null;
    const role = user.roles?.[0];
    const permissions = await this.rbac.getUserPermissions(user.id);
    const notifications = await this.dashboardService.getNotificationCount();
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      cedula: user.cedula,
      roles: user.roles?.map((r) => r.code) ?? [],
      roleLabel: role?.name ?? 'Usuario',
      permissions,
      initials: this.initials(user.fullName ?? user.cedula),
      notificationCount: notifications,
    };
  }

  @Get('header')
  async header(@Req() req: { user: JwtPayload }) {
    return this.me(req);
  }

  private initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
}
