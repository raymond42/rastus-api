import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** @example admin@rastus.dev */
  @IsEmail()
  email: string;

  /** @example ChangeMe123! */
  @IsString()
  @MinLength(8)
  password: string;
}
