import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  /** @example admin@rastus.dev */
  @IsEmail()
  email: string;
}
