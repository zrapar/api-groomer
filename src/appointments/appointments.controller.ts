import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { AppointmentsService } from "./appointments.service";
import { CreateAppointmentDto } from "./dto/create-appointment.dto";
import { UpdateAppointmentStatusDto } from "./dto/update-appointment-status.dto";
import { UpdateAppointmentDto } from "./dto/update-appointment.dto";
import { CancelAppointmentDto } from "./dto/cancel-appointment.dto";

@Controller("api/v1/appointments")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT, UserRole.GROOMER_OWNER, UserRole.GROOMER_STAFF)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  create(@Req() req: { user: AuthUser }, @Body() payload: CreateAppointmentDto) {
    return this.service.create(req.user, payload);
  }

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user);
  }

  @Get(":id")
  getById(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.service.getById(req.user, id);
  }

  @Patch(":id/status")
  @Roles(UserRole.GROOMER_OWNER, UserRole.GROOMER_STAFF)
  updateStatus(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdateAppointmentStatusDto,
  ) {
    return this.service.updateStatus(req.user, id, payload);
  }

  @Patch(":id/cancel")
  cancel(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: CancelAppointmentDto,
  ) {
    return this.service.cancel(req.user, id, payload);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdateAppointmentDto,
  ) {
    return this.service.update(req.user, id, payload);
  }
}
