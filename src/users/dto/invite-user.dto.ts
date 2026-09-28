import { IsEmail, IsString } from 'class-validator';

export class InviteUserDto {
  /** @example newstaff@rastus.dev */
  @IsEmail()
  email: string;

  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsString()
  roleId: string;
}
