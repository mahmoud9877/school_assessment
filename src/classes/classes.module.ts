import { Module } from '@nestjs/common';
import { TeachersModule } from '../teachers/teachers.module.js';
import { ClassesController } from './classes.controller.js';
import { ClassesRepository } from './classes.repository.js';
import { ClassesService } from './classes.service.js';

@Module({
  imports: [TeachersModule],
  controllers: [ClassesController],
  providers: [ClassesService, ClassesRepository],
  exports: [ClassesRepository],
})
export class ClassesModule {}
