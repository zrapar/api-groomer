import { PartialType } from "@nestjs/mapped-types";
import { CreateGroomerBusinessDto } from "./create-groomer-business.dto";

export class UpdateGroomerBusinessDto extends PartialType(
  CreateGroomerBusinessDto,
) {}
