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
  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsUUID()
  orderId: string;

  /** @example MOMO */
  @IsEnum(PaymentChannel)
  channel: PaymentChannel;

  /** @example buyer@rastus.dev */
  @IsEmail()
  email: string;

  /** @example 0788123456 */
  @ValidateIf((dto: InitiatePaymentDto) => dto.channel === PaymentChannel.MOMO)
  @IsString()
  @MinLength(8)
  @MaxLength(30)
  payerPhone?: string;

  /** @example Ama */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  /** @example Keza */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}
