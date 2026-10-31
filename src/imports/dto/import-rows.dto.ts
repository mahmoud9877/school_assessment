import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { MAX_CLASS_CAPACITY } from '../../classes/dto/create-class.dto.js';

// One CSV row each. Same rules as the matching API DTOs; CSV values arrive as
// strings, so numbers are converted first.

const lowerCase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() : value;
const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

export class TeacherRow {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(100)
  @Transform(lowerCase)
  email: string;
}

export class ClassRow {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @Transform(toInteger)
  @IsInt()
  @IsPositive()
  @Max(MAX_CLASS_CAPACITY)
  capacity: number;

  @IsEmail()
  @Transform(lowerCase)
  teacherEmail: string;
}

export class StudentRow {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  @MaxLength(100)
  @Transform(lowerCase)
  email: string;

  @IsNotEmpty()
  @IsString()
  className: string;
}

export const COLUMNS = {
  teachers: ['name', 'email'],
  classes: ['name', 'capacity', 'teacherEmail'],
  students: ['name', 'email', 'className'],
} as const;
