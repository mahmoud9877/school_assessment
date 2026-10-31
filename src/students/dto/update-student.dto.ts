import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto.js';

// A student's user account is fixed; only the class can change.
export class UpdateStudentDto extends PartialType(
  OmitType(CreateStudentDto, ['userId'] as const),
) {}
