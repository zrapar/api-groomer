import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { GroomerBusinessService } from "./groomer-business.service";
import { CreateGroomerBusinessDto } from "./dto/create-groomer-business.dto";
import { UpdateGroomerBusinessDto } from "./dto/update-groomer-business.dto";
import { Req } from "@nestjs/common";

@Controller("api/v1/groomer-business")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GROOMER_OWNER)
export class GroomerBusinessController {
  constructor(private readonly service: GroomerBusinessService) {}

  @Post()
  create(
    @Req() req: { user: AuthUser },
    @Body() payload: CreateGroomerBusinessDto,
  ) {
    return this.service.create(req.user, payload);
  }

  @Get("me")
  getMyBusiness(@Req() req: { user: AuthUser }) {
    return this.service.getMyBusiness(req.user);
  }

  @Patch("me")
  updateMyBusiness(
    @Req() req: { user: AuthUser },
    @Body() payload: UpdateGroomerBusinessDto,
  ) {
    return this.service.updateMyBusiness(req.user, payload);
  }
}
