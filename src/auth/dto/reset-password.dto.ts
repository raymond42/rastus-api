import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  /** @example 5b1b6f9e-6e0a-4a1a-9c1a-7f9c9a8e0b3f */
  @IsString()
  token: string;

  /** @example NewPassword123! */
  @IsString()
  @MinLength(8)
  password: string;
}
