import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { StaffService } from "./staff.service";

@Controller("api/v1/groomer-business/staff")
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @Roles(UserRole.GROOMER_OWNER)
  list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user.id);
  }

  @Post()
  @Roles(UserRole.GROOMER_OWNER)
  create(
    @Req() req: { user: AuthUser },
    @Body() payload: CreateStaffDto,
  ) {
    return this.service.create(req.user.id, payload);
  }

  @Patch(":id")
  @Roles(UserRole.GROOMER_OWNER)
  update(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdateStaffDto,
  ) {
    return this.service.update(req.user.id, id, payload);
  }

  @Delete(":id")
  @Roles(UserRole.GROOMER_OWNER)
  remove(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.service.deactivate(req.user.id, id);
  }
}
