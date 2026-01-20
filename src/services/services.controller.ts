import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { ServicesService } from "./services.service";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";

@Controller("api/v1/services")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.GROOMER_OWNER)
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.service.listForOwner(req.user);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() payload: CreateServiceDto) {
    return this.service.create(req.user, payload);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdateServiceDto,
  ) {
    return this.service.update(req.user, id, payload);
  }

  @Delete(":id")
  remove(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.service.remove(req.user, id);
  }
}
