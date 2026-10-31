import { ApiProperty } from '@nestjs/swagger';
import { UserSummaryDto } from '../../users/dto/user-response.dto.js';

class StudentClassDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Math 101' })
  name: string;
}

export class StudentResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 7 })
  userId: number;

  @ApiProperty({ example: 1 })
  classId: number;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;

  @ApiProperty({ type: StudentClassDto })
  class: StudentClassDto;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
