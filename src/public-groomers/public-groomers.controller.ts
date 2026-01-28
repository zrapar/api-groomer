import { Controller, Get, Param } from "@nestjs/common";
import { PublicGroomersService } from "./public-groomers.service";

@Controller("api/v1/public/groomers")
export class PublicGroomersController {
  constructor(private readonly service: PublicGroomersService) {}

  @Get()
  listBusinesses() {
    return this.service.listBusinesses();
  }

  @Get("slug/:slug")
  getBySlug(@Param("slug") slug: string) {
    return this.service.getBySlug(slug);
  }

  @Get("business/:businessId")
  getBusiness(@Param("businessId") businessId: string) {
    return this.service.getBusiness(businessId);
  }

  @Get(":businessId/staff")
  getStaff(@Param("businessId") businessId: string) {
    return this.service.getStaff(businessId);
  }
}
