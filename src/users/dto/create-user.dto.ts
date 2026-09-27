import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  /** @example staff@rastus.dev */
  @IsEmail()
  email: string;

  /**
   * Admin-supplied initial password — no email infra exists yet to send
   * generated credentials, so the creator sets this directly.
   * @example Password123!
   */
  @IsString()
  @MinLength(8)
  password: string;

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

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsOptional()
  @IsString()
  roleId?: string;

  /** @example true */
  @IsOptional()
  @IsBoolean()
  isStaff?: boolean = true;
}
