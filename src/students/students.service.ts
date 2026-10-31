import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ClassCheck } from '../classes/classes.repository.js';
import { UserRole } from '../generated/prisma/enums.js';
import { UsersRepository } from '../users/users.repository.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { StudentsRepository } from './students.repository.js';

@Injectable()
export class StudentsService {
  constructor(
    private readonly students: StudentsRepository,
    private readonly users: UsersRepository,
  ) {}

  async create({ userId, classId }: CreateStudentDto) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException(`User #${userId} not found`);
    }
    if (user.role !== UserRole.STUDENT) {
      throw new BadRequestException(
        `User #${userId} has role ${user.role}; a student must have role STUDENT`,
      );
    }
    if (await this.students.existsForUser(userId)) {
      throw new ConflictException(`User #${userId} is already a student`);
    }

    return this.students.enrol(
      { userId, classId },
      this.assertSeatAvailable(classId),
    );
  }

  findAll() {
    return this.students.findAll();
  }

  async findOne(id: number) {
    const student = await this.students.findById(id);
    if (!student) {
      throw new NotFoundException(`Student #${id} not found`);
    }
    return student;
  }

  async update(id: number, { classId }: UpdateStudentDto) {
    const student = await this.findOne(id);
    if (classId === undefined || classId === student.classId) {
      return student;
    }

    return this.students.moveToClass(
      id,
      classId,
      this.assertSeatAvailable(classId),
    );
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.students.delete(id);
  }

  // Runs with the class row locked, so two requests cannot take the last seat.
  private assertSeatAvailable(classId: number): ClassCheck {
    return (target) => {
      if (!target) {
        throw new NotFoundException(`Class #${classId} not found`);
      }
      if (target.enrolled >= target.capacity) {
        throw new ConflictException(
          `Class #${classId} is full (capacity ${target.capacity})`,
        );
      }
    };
  }
}
