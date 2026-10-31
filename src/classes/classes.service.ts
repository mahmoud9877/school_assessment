import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TeachersRepository } from '../teachers/teachers.repository.js';
import { ClassesRepository } from './classes.repository.js';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';

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

    const result = await this.classes.update(id, updateClassDto);
    switch (result.status) {
      case 'not_found':
        throw new NotFoundException(`Class #${id} not found`);
      case 'below_enrolment':
        throw new ConflictException(
          `Capacity ${capacity} is below the ${result.enrolled} students already enrolled`,
        );
      case 'ok':
        return result.class;
    }
  }

  async remove(id: number) {
    const result = await this.classes.deleteIfEmpty(id);
    switch (result.status) {
      case 'not_found':
        throw new NotFoundException(`Class #${id} not found`);
      case 'has_students':
        throw new ConflictException(
          `Class #${id} still has ${result.enrolled} students; move or remove them first`,
        );
    }
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
