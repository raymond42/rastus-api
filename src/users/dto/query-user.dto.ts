import { UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryUserDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  // Filtering by isStaff:false serves the TRD's "customer list" requirement
  // using this same endpoint.
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isStaff?: boolean;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  roleId?: string;
}
