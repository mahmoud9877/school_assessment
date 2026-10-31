import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../generated/prisma/enums.js';

export class UserSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Sara Teacher' })
  name: string;

  @ApiProperty({ example: 'sara.teacher@school.test' })
  email: string;
}

// A user as returned by the API. The password hash is never included.
export class UserResponseDto extends UserSummaryDto {
  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
