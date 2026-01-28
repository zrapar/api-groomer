import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AdminService } from "./admin.service";

@Controller("api/v1/admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get("overview")
  getOverview() {
    return this.service.getOverview();
  }

  @Get("users")
  getUsers(@Query("role") role?: UserRole) {
    return this.service.getUsers(role);
  }
}
