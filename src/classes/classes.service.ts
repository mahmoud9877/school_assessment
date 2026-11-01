import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeachersRepository } from '../teachers/teachers.repository.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { ClassesRepository, type ClassSeats } from './classes.repository.js';

@Injectable()
export class ClassesService {
  constructor(
    private readonly classes: ClassesRepository,
    private readonly teachers: TeachersRepository,
  ) {}

  async create(createClassDto: CreateClassDto) {
    await this.assertNameAvailable(createClassDto.name);
    await this.assertTeacherExists(createClassDto.teacherId);
    return this.classes.create(createClassDto);
  }

  findAll() {
    return this.classes.findAll();
  }

  async findOne(id: number) {
    const found = await this.classes.findById(id);
    if (!found) {
      throw new NotFoundException(`Class #${id} not found`);
    }
    return found;
  }

  async update(id: number, updateClassDto: UpdateClassDto) {
    const { name, teacherId, capacity } = updateClassDto;
    if (name !== undefined) {
      await this.assertNameAvailable(name, id);
    }
    if (teacherId !== undefined) {
      await this.assertTeacherExists(teacherId);
    }

    return this.classes.update(id, updateClassDto, (current) => {
      const seats = this.assertClassFound(id, current);
      if (capacity !== undefined && capacity < seats.enrolled) {
        throw new ConflictException(
          `Capacity ${capacity} is below the ${seats.enrolled} students already enrolled`,
        );
      }
    });
  }

  async remove(id: number) {
    await this.classes.delete(id, (current) => {
      const seats = this.assertClassFound(id, current);
      if (seats.enrolled > 0) {
        throw new ConflictException(
          `Class #${id} still has ${seats.enrolled} students; move or remove them first`,
        );
      }
    });
  }

  private assertClassFound(id: number, current: ClassSeats | null) {
    if (!current) {
      throw new NotFoundException(`Class #${id} not found`);
    }
    return current;
  }

  private async assertNameAvailable(name: string, excludeId?: number) {
    if (await this.classes.existsByName(name, excludeId)) {
      throw new ConflictException(`Class name "${name}" already exists`);
    }
  }

  private async assertTeacherExists(teacherId: number) {
    if (!(await this.teachers.findById(teacherId))) {
      throw new NotFoundException(`Teacher #${teacherId} not found`);
    }
  }
}
