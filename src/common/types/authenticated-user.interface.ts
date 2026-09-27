/**
 * Shape attached to `req.user` by JwtStrategy after a valid access token is
 * presented. Deliberately minimal — permission checks always re-fetch the
 * Role.permissions JSON fresh from Prisma rather than trusting the JWT
 * payload, so role changes take effect immediately without re-login.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roleId: string | null;
  isStaff: boolean;
}
