import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

// Deactivate/reactivate goes through here (status). Email, password, and
// role are deliberately excluded — role has its own endpoint, and there's
// no self-service reset flow yet.
export class UpdateUserDto {
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

  /** @example +250788123456 */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /** @example ACTIVE */
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
