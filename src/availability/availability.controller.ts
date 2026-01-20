import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { AvailabilityService } from "./availability.service";
import { AvailabilityRequestDto } from "./dto/availability.dto";

@Controller("api/v1/groomers")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT, UserRole.GROOMER_OWNER)
export class AvailabilityController {
  constructor(private readonly service: AvailabilityService) {}

  @Post(":businessId/availability")
  getAvailability(
    @Req() req: { user: AuthUser },
    @Param("businessId") businessId: string,
    @Body() payload: AvailabilityRequestDto,
  ) {
    return this.service.getAvailability(req.user, businessId, payload);
  }
}
