import { Controller, Get, Param } from "@nestjs/common";
import { ServicesService } from "./services.service";

@Controller("api/v1/public/groomers")
export class PublicServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get(":businessId/services")
  list(@Param("businessId") businessId: string) {
    return this.service.listPublicServices(businessId);
  }
}
