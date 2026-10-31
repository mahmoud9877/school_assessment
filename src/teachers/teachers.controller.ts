import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../auth/auth.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
import { CreateTeacherDto } from './dto/create-teacher.dto.js';
import { TeacherResponseDto } from './dto/teacher-response.dto.js';
import { TeachersService } from './teachers.service.js';

// Read: any logged-in user. Create: admin, operator. Delete: admin.
@ApiTags('Teachers')
@Auth()
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Register a TEACHER user as a teacher',
    description:
      'The user must exist, have role TEACHER and not be a teacher yet.',
  })
  @ApiCreatedResponse({ type: TeacherResponseDto })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User is already a teacher',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@Body() createTeacherDto: CreateTeacherDto) {
    return this.teachersService.create(createTeacherDto);
  }

  @ApiOperation({ summary: 'List all teachers with their classes' })
  @ApiOkResponse({ type: [TeacherResponseDto] })
  @Get()
  findAll() {
    return this.teachersService.findAll();
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Get one teacher' })
  @ApiOkResponse({ type: TeacherResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teachersService.findOne(id);
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Delete a teacher',
    description: 'Only allowed when the teacher has no classes.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Teacher still has classes',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.teachersService.remove(id);
  }
}
