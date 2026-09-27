import { Controller, Get, Param, Query } from '@nestjs/common';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CustomDesignsService } from './custom-designs.service';
import { QueryCustomDesignDto } from './dto/query-custom-design.dto';

@Controller('custom-designs')
export class CustomDesignsController {
  constructor(private readonly customDesignsService: CustomDesignsService) {}

  @Permissions('custom-designs:read')
  @Get()
  findAll(@Query() query: QueryCustomDesignDto) {
    return this.customDesignsService.findAll(query);
  }

  @Permissions('custom-designs:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customDesignsService.findOne(id);
  }
}
