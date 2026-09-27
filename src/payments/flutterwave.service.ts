import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

const TOKEN_URL =
  'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token';

export interface DirectChargeResult {
  id: string;
  redirectUrl: string | null;
  instruction: string | null;
  raw: unknown;
}

export interface VerifiedCharge {
  id: string;
  reference: string | null;
  status: string;
  amount: string;
  currency: string;
  raw: unknown;
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);
  private tokenCache: TokenCache | null = null;

  constructor(private readonly configService: ConfigService) {}

  async createDirectCharge(
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<DirectChargeResult> {
    const payload = await this.request<Record<string, unknown>>(
      'POST',
      '/orchestration/direct-charges',
      idempotencyKey,
      body,
    );
    const data = asRecord(payload.data);
    const nextAction = asRecord(data?.next_action);
    const redirect = asRecord(nextAction?.redirect_url);
    const instructionBlock = asRecord(nextAction?.payment_instruction);
    const id = typeof data?.id === 'string' ? data.id : null;
    const redirectUrl = typeof redirect?.url === 'string' ? redirect.url : null;
    const instruction =
      typeof instructionBlock?.note === 'string' ? instructionBlock.note : null;
    if (!redirectUrl && !instruction) {
      this.logger.warn(
        `Charge ${id ?? 'unknown'} returned no redirect URL or payment instruction`,
      );
    }
    if (!id) {
      throw new BadGatewayException(
        'Flutterwave charge response did not include a charge id',
      );
    }
    return {
      id,
      redirectUrl,
      instruction,
      raw: payload,
    };
  }

  async verifyCharge(
    chargeId: string,
    idempotencyKey: string,
  ): Promise<VerifiedCharge> {
    const payload = await this.request<Record<string, unknown>>(
      'GET',
      `/charges/${encodeURIComponent(chargeId)}`,
      idempotencyKey,
    );
    const data = asRecord(payload.data) ?? payload;
    const id = typeof data.id === 'string' ? data.id : chargeId;
    const reference =
      (typeof data.reference === 'string' && data.reference) ||
      (typeof data.tx_ref === 'string' && data.tx_ref) ||
      null;
    const status = typeof data.status === 'string' ? data.status : '';
    const amount =
      data.amount === undefined || data.amount === null
        ? ''
        : String(data.amount);
    const currency = typeof data.currency === 'string' ? data.currency : '';
    return { id, reference, status, amount, currency, raw: payload };
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt - 60_000 > now) {
      return this.tokenCache.token;
    }

    const clientId = this.configService.get<string>('FLW_CLIENT_ID_SANDBOX');
    const clientSecret = this.configService.get<string>(
      'FLW_SECRET_KEY_SANDBOX',
    );
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Flutterwave OAuth credentials are not configured',
      );
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (error) {
      throw new BadGatewayException(
        `Flutterwave token request failed: ${String(error)}`,
      );
    }

    const payload = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error_description?: string;
    } | null;

    if (!response.ok || !payload?.access_token) {
      throw new BadGatewayException(
        payload?.error_description || 'Flutterwave token request was rejected',
      );
    }

    const expiresInMs = (payload.expires_in ?? 600) * 1000;
    this.tokenCache = {
      token: payload.access_token,
      expiresAt: Date.now() + expiresInMs,
    };
    return payload.access_token;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    idempotencyKey: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const base =
      this.configService.get<string>('FLW_API_BASE_URL') ??
      'https://developersandbox-api.flutterwave.com';
    const token = await this.getAccessToken();

    let response: Response;
    try {
      response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Trace-Id': randomUUID(),
          'X-Idempotency-Key': idempotencyKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      throw new BadGatewayException(
        `Flutterwave request failed: ${String(error)}`,
      );
    }

    const payload = (await response.json().catch(() => null)) as
      (T & { message?: string; error?: { message?: string } }) | null;

    if (!response.ok || !payload) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `Flutterwave request failed with status ${response.status}`;
      throw new BadGatewayException(message);
    }

    return payload;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}
