import { PartialType } from '@nestjs/swagger';
import { CreateClassDto } from './create-class.dto.js';

// capacity cannot go below the number of students already enrolled.
export class UpdateClassDto extends PartialType(CreateClassDto) {}
