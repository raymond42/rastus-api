/** Payload embedded in signed access tokens. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  roleId: string | null;
}

/** Payload embedded in signed refresh tokens. */
export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // RefreshToken row id
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
