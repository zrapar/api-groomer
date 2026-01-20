import { Module } from "@nestjs/common";
import { PublicServicesController } from "./public-services.controller";
import { ServicesController } from "./services.controller";
import { ServicesService } from "./services.service";

@Module({
  controllers: [ServicesController, PublicServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
