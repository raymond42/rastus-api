import { IsString } from 'class-validator';

export class UpdateUserRoleDto {
  /** @example 00000000-0000-4000-8000-000000000000 */
  @IsString()
  roleId: string;
}
