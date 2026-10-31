import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

export const MAX_CLASS_CAPACITY = 500;

export class CreateClassDto {
  @ApiProperty({ example: 'Math 101', maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  name: string;

  @ApiProperty({
    example: 30,
    minimum: 1,
    maximum: MAX_CLASS_CAPACITY,
    description: 'Maximum number of students in the class.',
  })
  @IsInt()
  @IsPositive()
  @Max(MAX_CLASS_CAPACITY)
  capacity: number;

  @ApiProperty({ example: 1, description: 'Id of an existing teacher.' })
  @IsInt()
  @IsPositive()
  teacherId: number;
}
