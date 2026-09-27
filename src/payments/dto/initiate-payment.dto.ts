import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentChannel } from '@prisma/client';

export class InitiatePaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(PaymentChannel)
  channel: PaymentChannel;

  @IsEmail()
  email: string;

  @ValidateIf((dto: InitiatePaymentDto) => dto.channel === PaymentChannel.MOMO)
  @IsString()
  @MinLength(8)
  @MaxLength(30)
  payerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
