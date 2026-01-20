import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { UserRole } from "../auth/dto/user-role.enum";
import { AuthUser } from "../auth/types/auth-user";
import { PetsService } from "./pets.service";
import { CreatePetDto } from "./dto/create-pet.dto";
import { UpdatePetDto } from "./dto/update-pet.dto";

@Controller("api/v1/pets")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class PetsController {
  constructor(private readonly service: PetsService) {}

  @Get()
  list(@Req() req: { user: AuthUser }) {
    return this.service.list(req.user);
  }

  @Post()
  create(@Req() req: { user: AuthUser }, @Body() payload: CreatePetDto) {
    return this.service.create(req.user, payload);
  }

  @Patch(":id")
  update(
    @Req() req: { user: AuthUser },
    @Param("id") id: string,
    @Body() payload: UpdatePetDto,
  ) {
    return this.service.update(req.user, id, payload);
  }

  @Delete(":id")
  remove(@Req() req: { user: AuthUser }, @Param("id") id: string) {
    return this.service.remove(req.user, id);
  }
}
