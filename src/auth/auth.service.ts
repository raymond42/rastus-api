import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TokenPair,
} from './types/jwt-payload.interface';
import { AuthTokenPurpose, User } from '@prisma/client';

const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Verifies email/password credentials. Throws UnauthorizedException if invalid. */
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  /** Issues a fresh access + refresh token pair, persisting the refresh token (hashed). */
  async login(user: User): Promise<TokenPair> {
    return this.issueTokenPair(user);
  }

  /** Verifies a refresh token, rotates it (revoke old, issue new pair). */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (
      !storedToken ||
      storedToken.userId !== payload.sub ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date() ||
      storedToken.tokenHash !== this.hashToken(refreshToken)
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user);
  }

  /** Verifies and revokes a refresh token so it can no longer be used. */
  async logout(refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken, {
      ignoreExpiration: true,
    });

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!storedToken || storedToken.userId !== payload.sub) {
      // Nothing to revoke — treat as a no-op so logout is idempotent.
      return;
    }

    if (!storedToken.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  /**
   * Issues a password-reset token for the given email if (and only if) an
   * active account exists. Always resolves with the same generic message so
   * the endpoint doesn't leak which emails are registered.
   *
   * No email provider is wired up yet — the raw token is logged so it can be
   * exchanged manually with `resetPassword` in the meantime.
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.status === 'ACTIVE') {
      const rawToken = await this.issueAuthToken(
        user.id,
        AuthTokenPurpose.PASSWORD_RESET,
        PASSWORD_RESET_TTL_MS,
      );
      this.logger.warn(
        `[stub email] Password reset for ${email} — token: ${rawToken} ` +
          `(POST /auth/reset-password, expires in 30m)`,
      );
    }

    return {
      message:
        'If that email is registered, a password reset link has been sent.',
    };
  }

  /** Consumes a password-reset token, sets the new password, and revokes existing sessions. */
  async resetPassword(token: string, password: string): Promise<TokenPair> {
    const user = await this.consumeAuthToken(
      token,
      AuthTokenPurpose.PASSWORD_RESET,
    );
    return this.setPasswordAndReauth(user, password);
  }

  /** Consumes a staff-invite token, sets the initial password, and logs the new staff member in. */
  async acceptInvite(token: string, password: string): Promise<TokenPair> {
    const user = await this.consumeAuthToken(
      token,
      AuthTokenPurpose.STAFF_INVITE,
    );
    return this.setPasswordAndReauth(user, password);
  }

  /**
   * Creates a staff-invite `AuthToken` for an already-created user. Called by
   * `UsersService.invite` right after the inert (no-password) user row is
   * created. Logged in place of a real email send.
   */
  async issueStaffInviteToken(userId: string, email: string): Promise<void> {
    const rawToken = await this.issueAuthToken(
      userId,
      AuthTokenPurpose.STAFF_INVITE,
      STAFF_INVITE_TTL_MS,
    );
    this.logger.warn(
      `[stub email] Staff invite for ${email} — token: ${rawToken} ` +
        `(POST /auth/accept-invite, expires in 7d)`,
    );
  }

  private async setPasswordAndReauth(
    user: User,
    password: string,
  ): Promise<TokenPair> {
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Revoke every existing refresh token so old sessions can't outlive a
    // credential change.
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(updated);
  }

  private async issueAuthToken(
    userId: string,
    purpose: AuthTokenPurpose,
    ttlMs: number,
  ): Promise<string> {
    const rawToken = randomUUID();
    await this.prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return rawToken;
  }

  private async consumeAuthToken(
    rawToken: string,
    purpose: AuthTokenPurpose,
  ): Promise<User> {
    const tokenHash = this.hashToken(rawToken);
    const authToken = await this.prisma.authToken.findFirst({
      where: {
        tokenHash,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!authToken) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authToken.userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    await this.prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    return user;
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      roleId: user.roleId,
    };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshTokenId = randomUUID();
    const refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      jti: refreshTokenId,
    };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpiresIn,
    });

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: this.resolveExpiryDate(refreshExpiresIn),
      },
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(
    token: string,
    options: { ignoreExpiration?: boolean } = {},
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        ignoreExpiration: options.ignoreExpiration ?? false,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveExpiryDate(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) {
      // Fallback: treat as seconds if it's a bare number, else default 7 days.
      const seconds = Number(expiresIn);
      return new Date(
        Date.now() + (Number.isFinite(seconds) ? seconds : 604800) * 1000,
      );
    }

    const value = Number(match[1]);
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * unitMs[match[2]]);
  }
}
