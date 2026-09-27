import { CustomDesignStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class QueryCustomDesignDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(CustomDesignStatus)
  status?: CustomDesignStatus;

  @IsOptional()
  @IsString()
  userId?: string;
}
