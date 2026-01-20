import { Module } from "@nestjs/common";
import { GroomerBusinessController } from "./groomer-business.controller";
import { GroomerBusinessService } from "./groomer-business.service";

@Module({
  controllers: [GroomerBusinessController],
  providers: [GroomerBusinessService],
})
export class GroomerBusinessModule {}
