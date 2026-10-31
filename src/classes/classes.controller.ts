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
import { ClassesService } from './classes.service.js';
import {
  ClassDetailResponseDto,
  ClassResponseDto,
} from './dto/class-response.dto.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';

// Read: any logged-in user. Create/update: admin, operator. Delete: admin.
@ApiTags('Classes')
@Auth()
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Create a class' })
  @ApiCreatedResponse({ type: ClassResponseDto })
  @ApiNotFoundResponse({
    description: 'Teacher not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Class name already exists',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Post()
  create(@Body() createClassDto: CreateClassDto) {
    return this.classesService.create(createClassDto);
  }

  @ApiOperation({ summary: 'List all classes' })
  @ApiOkResponse({ type: [ClassResponseDto] })
  @Get()
  findAll() {
    return this.classesService.findAll();
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({ summary: 'Get one class with its students' })
  @ApiOkResponse({ type: ClassDetailResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.classesService.findOne(id);
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Update a class',
    description: 'capacity cannot be lowered below the current student count.',
  })
  @ApiOkResponse({ type: ClassResponseDto })
  @ApiNotFoundResponse({
    description: 'Class or teacher not found',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Name taken, or capacity below current enrolment',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClassDto: UpdateClassDto,
  ) {
    return this.classesService.update(id, updateClassDto);
  }

  @ApiBadRequestResponse({
    description: 'Invalid input',
    type: ErrorResponseDto,
  })
  @ApiOperation({
    summary: 'Delete a class',
    description: 'Only allowed when no students are enrolled.',
  })
  @ApiNoContentResponse({ description: 'Deleted' })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({
    description: 'Class still has students',
    type: ErrorResponseDto,
  })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.classesService.remove(id);
  }
}
