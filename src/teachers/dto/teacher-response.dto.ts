import { ApiProperty } from '@nestjs/swagger';
import { ClassSummaryDto } from '../../classes/dto/class-response.dto.js';
import { UserSummaryDto } from '../../users/dto/user-response.dto.js';

export class TeacherResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 3 })
  userId: number;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;

  @ApiProperty({ type: [ClassSummaryDto] })
  classes: ClassSummaryDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
