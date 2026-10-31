import { Injectable } from '@nestjs/common';
import { CreateClassDto } from './dto/create-class.dto.js';
import { UpdateClassDto } from './dto/update-class.dto.js';
import { ClassesRepository } from './classes.repository.js';

@Injectable()
export class ClassesService {
  constructor(private readonly classesRepository: ClassesRepository) { }

  create(createClassDto: CreateClassDto) {
    const createdClass = this.classesRepository.create(createClassDto);
    return createdClass;
  }

  findAll() {
    const classes = this.classesRepository.findAll();
    return classes;
  }


  findOne(id: number) {
    const foundClass = this.classesRepository.findById(id);
    return foundClass;
  }


  update(id: number, updateClassDto: UpdateClassDto) {
    const updatedClass = this.classesRepository.update(id, updateClassDto);
    return updatedClass;
  }

  remove(id: number) {
    const deletedClass = this.classesRepository.delete(id);
    return deletedClass;
  }
}