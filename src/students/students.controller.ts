import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
import { CreateStudentDto } from './dto/create-student.dto.js';
import { StudentResponseDto } from './dto/student-response.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsService } from './students.service.js';

// Read: any logged-in user. Create/update: admin, operator. Delete: admin.
@ApiTags('Students')
@Auth()
@Controller('students')
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) { }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Enrol a STUDENT user in a class',
    description:
      'The user must have role STUDENT and not be enrolled yet; the class must have a free seat.',
  })
  @ApiCreatedResponse({ type: StudentResponseDto })
  @ApiNotFoundResponse({
    description: 'User or class not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User is already a student, or the class is full',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@Body() createStudentDto: CreateStudentDto) {
    return this.studentsService.create(createStudentDto);
  }

  @ApiOperation({ summary: 'List all students' })
  @ApiOkResponse({ type: [StudentResponseDto] })
  @Get()
  findAll() {
    return this.studentsService.findAll();
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Get one student' })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.findOne(id);
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Move a student to another class',
    description: 'The target class must have a free seat.',
  })
  @ApiOkResponse({ type: StudentResponseDto })
  @ApiNotFoundResponse({
    description: 'Student or class not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Target class is full',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStudentDto: UpdateStudentDto,
  ) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Delete a student' })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.studentsService.remove(id);
  }
}
