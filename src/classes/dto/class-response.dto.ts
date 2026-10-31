import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../users/dto/user-response.dto.js';

export class ClassSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Math 101' })
  name: string;

  @ApiProperty({ example: 30 })
  capacity: number;
}

class ClassTeacherDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;
}

class ClassStudentDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;
}

export class ClassResponseDto extends ClassSummaryDto {
  @ApiProperty({ example: 1 })
  teacherId: number;

  @ApiProperty({ type: ClassTeacherDto })
  teacher: ClassTeacherDto;

  @ApiProperty({ example: 12, description: 'Students currently enrolled.' })
  studentCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ClassDetailResponseDto extends ClassResponseDto {
  @ApiProperty({ type: [ClassStudentDto] })
  students: ClassStudentDto[];
}
