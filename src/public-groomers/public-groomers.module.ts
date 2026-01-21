import { Module } from "@nestjs/common";
import { PublicGroomersController } from "./public-groomers.controller";
import { PublicGroomersService } from "./public-groomers.service";

@Module({
  controllers: [PublicGroomersController],
  providers: [PublicGroomersService],
})
export class PublicGroomersModule {}
