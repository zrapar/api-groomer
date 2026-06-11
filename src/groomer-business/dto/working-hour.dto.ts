import {
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsAfterStartTime(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfterStartTime',

      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options,
      validator: {
        validate(
          endTime: unknown,
          args?: import('class-validator').ValidationArguments,
        ) {
          const start = (args?.object as Record<string, unknown> | undefined)
            ?.startTime;
          if (typeof endTime !== 'string' || typeof start !== 'string')
            return true;
          return endTime > start;
        },
        defaultMessage: () => 'endTime must be after startTime',
      },
    });
  };
}

export class WorkingHourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:mm format',
  })
  @IsAfterStartTime({ message: 'endTime must be after startTime' })
  endTime: string;
}
