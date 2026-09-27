import { IsString } from 'class-validator';

/**
 * Shared body shape for both POST /auth/refresh and POST /auth/logout —
 * both operate on a single refresh token.
 */
export class RefreshTokenDto {
  /** @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example */
  @IsString()
  refreshToken: string;
}
