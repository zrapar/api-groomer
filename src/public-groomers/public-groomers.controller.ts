import { Controller, Get, Param, Query } from '@nestjs/common';
import { PublicGroomersService } from './public-groomers.service';
import { PaginationDto } from '../shared/pagination.dto';

@Controller('api/v1/public/groomers')
export class PublicGroomersController {
  constructor(private readonly service: PublicGroomersService) {}

  @Get()
  listBusinesses(@Query() pagination: PaginationDto) {
    return this.service.listBusinesses(pagination.limit, pagination.offset);
  }

  @Get('slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @Get('business/:businessId')
  getBusiness(@Param('businessId') businessId: string) {
    return this.service.getBusiness(businessId);
  }

  @Get(':businessId/staff')
  getStaff(@Param('businessId') businessId: string) {
    return this.service.getStaff(businessId);
  }
}
