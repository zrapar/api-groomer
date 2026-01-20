import { IsInt, IsString, Matches, Max, Min } from "class-validator";

export class WorkingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "startTime must be in HH:mm format",
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "endTime must be in HH:mm format",
  })
  endTime: string;
}
