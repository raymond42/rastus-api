import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuditLog } from '../audit-logs/decorators/audit-log.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @AuditLog('payment')
  @Post('initiate')
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiate(dto);
  }

  @Public()
  @AuditLog('payment')
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Req() req: RawBodyRequest<Request>) {
    return this.paymentsService.handleWebhook({
      headers: req.headers,
      rawBody: req.rawBody,
      body: req.body,
    });
  }

  @Permissions('payments:read')
  @Get(':orderId')
  findByOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.findByOrder(orderId);
  }
}
