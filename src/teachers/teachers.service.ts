import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import { UsersRepository } from '../users/users.repository.js';
import { CreateTeacherDto } from './dto/create-teacher.dto.js';
import { TeachersRepository } from './teachers.repository.js';

@Injectable()
export class TeachersService {
  constructor(
    private readonly teachers: TeachersRepository,
    private readonly users: UsersRepository,
  ) {}

  async create({ userId }: CreateTeacherDto) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException(`User #${userId} not found`);
    }
    if (user.role !== UserRole.TEACHER) {
      throw new BadRequestException(
        `User #${userId} has role ${user.role}; a teacher must have role TEACHER`,
      );
    }
    if (await this.teachers.existsForUser(userId)) {
      throw new ConflictException(`User #${userId} is already a teacher`);
    }
    return this.teachers.create(userId);
  }

  findAll() {
    return this.teachers.findAll();
  }

  async findOne(id: number) {
    const teacher = await this.teachers.findById(id);
    if (!teacher) {
      throw new NotFoundException(`Teacher #${id} not found`);
    }
    return teacher;
  }

  async remove(id: number) {
    const teacher = await this.findOne(id);
    if (teacher.classes.length > 0) {
      throw new ConflictException(
        `Teacher #${id} still teaches ${teacher.classes.length} classes; reassign or delete them first`,
      );
    }
    await this.teachers.delete(id);
  }
}
