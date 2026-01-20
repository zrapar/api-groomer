import { Module } from "@nestjs/common";
import { ServiceDurationRulesController } from "./service-duration-rules.controller";
import { ServiceDurationRulesService } from "./service-duration-rules.service";

@Module({
  controllers: [ServiceDurationRulesController],
  providers: [ServiceDurationRulesService],
})
export class ServiceDurationRulesModule {}
