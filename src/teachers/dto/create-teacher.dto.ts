import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class CreateTeacherDto {
  @ApiProperty({
    example: 3,
    description: 'Id of an existing user with the TEACHER role.',
  })
  @IsInt()
  @IsPositive()
  userId: number;
}
