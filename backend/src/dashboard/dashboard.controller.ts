import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@RequirePermissions('dashboard.view')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('expiry-alerts')
  getExpiryAlerts() {
    return this.dashboardService.getExpiryAlerts();
  }

  @Get('requisitions')
  getRequisitions() {
    return this.dashboardService.getRequisitions();
  }

  @Get('notifications-count')
  getNotificationsCount() {
    return this.dashboardService.getNotificationCount();
  }
}
