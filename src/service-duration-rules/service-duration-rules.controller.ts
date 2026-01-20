import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { ServiceDurationRulesService } from "./service-duration-rules.service";
import {
  CreateServiceDurationRuleDto,
  UpdateServiceDurationRuleDto,
} from "./dto/service-duration-rule.dto";

@Controller("api/v1")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GROOMER_OWNER)
export class ServiceDurationRulesController {
  constructor(private readonly service: ServiceDurationRulesService) {}

  @Post("services/:serviceId/duration-rules")
  create(
    @Req() req: { user: AuthUser },
    @Param("serviceId") serviceId: string,
    @Body() payload: CreateServiceDurationRuleDto,
  ) {
    return this.service.create(req.user, serviceId, payload);
  }

  @Get("services/:serviceId/duration-rules")
  list(@Req() req: { user: AuthUser }, @Param("serviceId") serviceId: string) {
    return this.service.list(req.user, serviceId);
  }

  @Patch("duration-rules/:id")
  update(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdateServiceDurationRuleDto,
  ) {
    return this.service.update(req.user, id, payload);
  }

  @Delete("duration-rules/:id")
  remove(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.service.remove(req.user, id);
  }
}
