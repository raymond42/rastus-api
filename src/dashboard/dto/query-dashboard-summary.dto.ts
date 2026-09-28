import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

export class QueryDashboardSummaryDto {
  /** @example 7 */
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 15, 30])
  range?: 7 | 15 | 30 = 7;
}
