import { Module } from '@nestjs/common';
import { FlutterwaveService } from './flutterwave.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, FlutterwaveService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
