import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OrderStatus,
  PaymentChannel,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { FlutterwaveService } from './flutterwave.service';

interface WebhookInput {
  headers: Record<string, string | string[] | undefined>;
  rawBody?: Buffer;
  body: unknown;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwave: FlutterwaveService,
    private readonly configService: ConfigService,
  ) {}

  async initiate(dto: InitiatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} not found`);
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'Payment can only be initiated for a pending order',
      );
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'flutterwave',
        channel: dto.channel,
        txRef: randomUUID(),
        amount: order.totalAmount,
        currency: order.currency,
        status: PaymentStatus.PENDING,
        payerPhone: dto.channel === PaymentChannel.MOMO ? dto.payerPhone : null,
      },
    });

    const redirectUrl =
      this.configService.get<string>('FLW_REDIRECT_URL') ??
      'http://localhost:3000';

    try {
      const charge = await this.flutterwave.createDirectCharge(
        this.buildChargeBody(
          dto,
          payment.txRef,
          order.totalAmount.toString(),
          order.currency,
          redirectUrl,
        ),
        payment.txRef,
      );
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerTxId: charge.id },
      });
      return {
        paymentId: updated.id,
        txRef: updated.txRef,
        status: updated.status,
        redirectUrl: charge.redirectUrl,
        instruction: charge.instruction,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw error;
    }
  }

  async handleWebhook(input: WebhookInput) {
    this.assertSignature(input);

    const payload = asRecord(input.body);
    const event =
      (typeof payload?.event === 'string' && payload.event) ||
      (typeof payload?.type === 'string' && payload.type) ||
      '';
    if (event !== 'charge.completed') {
      return { received: true };
    }

    const data = asRecord(payload?.data);
    const txRef =
      (typeof data?.tx_ref === 'string' && data.tx_ref) ||
      (typeof data?.reference === 'string' && data.reference) ||
      '';
    const chargeId = typeof data?.id === 'string' ? data.id : '';
    if (!txRef) {
      this.logger.warn('charge.completed webhook missing tx_ref');
      return { received: true };
    }

    const existing = await this.prisma.payment.findUnique({
      where: { txRef },
    });
    if (!existing) {
      this.logger.warn(`No payment for tx_ref ${txRef}`);
      return { received: true };
    }
    if (existing.status === PaymentStatus.SUCCESSFUL) {
      return {
        received: true,
        id: existing.id,
        status: existing.status,
      };
    }

    const verified = await this.flutterwave.verifyCharge(
      chargeId || existing.providerTxId || txRef,
      txRef,
    );
    const mapped = mapVerifiedStatus(verified.status);
    const amountMatches = new Prisma.Decimal(verified.amount || '0').equals(
      existing.amount,
    );
    const currencyMatches =
      verified.currency.toUpperCase() === existing.currency.toUpperCase();
    const markPaid =
      mapped === PaymentStatus.SUCCESSFUL && amountMatches && currencyMatches;

    if (mapped === PaymentStatus.SUCCESSFUL && !markPaid) {
      this.logger.warn(
        `Verified charge ${verified.id} amount/currency did not match payment ${existing.id}`,
      );
    }

    const nextStatus = markPaid
      ? PaymentStatus.SUCCESSFUL
      : mapped === PaymentStatus.FAILED
        ? PaymentStatus.FAILED
        : existing.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { txRef },
        data: {
          status: nextStatus,
          providerTxId: verified.id || existing.providerTxId,
          rawPayload: (input.body ?? undefined) as
            Prisma.InputJsonValue | undefined,
        },
      });
      if (markPaid) {
        await tx.order.update({
          where: { id: existing.orderId },
          data: { status: OrderStatus.PAID },
        });
      }
      return payment;
    });

    return {
      received: true,
      id: updated.id,
      status: updated.status,
    };
  }

  async findByOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true },
    });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildChargeBody(
    dto: InitiatePaymentDto,
    txRef: string,
    amount: string,
    currency: string,
    redirectUrl: string,
  ): Record<string, unknown> {
    const phone = normalizeRwandaPhone(dto.payerPhone);
    const customer: Record<string, unknown> = {
      email: dto.email,
      name: {
        first: dto.firstName || 'Customer',
        last: dto.lastName || 'Rastus',
      },
    };
    if (phone) {
      customer.phone = { country_code: '250', number: phone };
    }

    const paymentMethod =
      dto.channel === PaymentChannel.MOMO
        ? {
            type: 'mobile_money',
            mobile_money: {
              country_code: '250',
              network: 'MTN',
              phone_number: phone,
            },
          }
        : { type: 'card' };

    return {
      amount: Number(amount),
      currency,
      reference: txRef,
      redirect_url: redirectUrl,
      customer,
      payment_method: paymentMethod,
    };
  }

  private assertSignature(input: WebhookInput) {
    const secret = this.configService.get<string>('FLW_WEBHOOK_SECRET_HASH');
    if (!secret) {
      throw new UnauthorizedException('Webhook secret is not configured');
    }

    const verifHash = headerValue(input.headers, 'verif-hash');
    if (verifHash && safeEqual(verifHash, secret)) {
      return;
    }

    const signature = headerValue(input.headers, 'flutterwave-signature');
    if (signature && input.rawBody) {
      const expected = createHmac('sha256', secret)
        .update(input.rawBody)
        .digest('base64');
      if (safeEqual(signature, expected)) {
        return;
      }
    }

    throw new UnauthorizedException('Invalid webhook signature');
  }
}

function mapVerifiedStatus(status: string): PaymentStatus | null {
  const normalized = status.toLowerCase();
  if (normalized === 'succeeded' || normalized === 'successful') {
    return PaymentStatus.SUCCESSFUL;
  }
  if (
    normalized === 'failed' ||
    normalized === 'cancelled' ||
    normalized === 'canceled'
  ) {
    return PaymentStatus.FAILED;
  }
  return null;
}

function normalizeRwandaPhone(phone?: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('250')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
