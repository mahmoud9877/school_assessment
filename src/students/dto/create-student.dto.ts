import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class CreateStudentDto {
  @ApiProperty({
    example: 7,
    description: 'Id of an existing user with the STUDENT role.',
  })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiProperty({
    example: 1,
    description: 'Id of a class that still has a free seat.',
  })
  @IsInt()
  @IsPositive()
  classId: number;
}
