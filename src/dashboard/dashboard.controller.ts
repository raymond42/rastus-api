import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { QueryDashboardSummaryDto } from './dto/query-dashboard-summary.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Permissions('dashboard:read')
  @Get('summary')
  summary(@Query() query: QueryDashboardSummaryDto) {
    return this.dashboardService.summary(query.range ?? 7);
  }
}
