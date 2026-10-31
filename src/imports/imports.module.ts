import { Module } from '@nestjs/common';
import { ClassesModule } from '../classes/classes.module.js';
import { StudentsModule } from '../students/students.module.js';
import { TeachersModule } from '../teachers/teachers.module.js';
import { UsersModule } from '../users/users.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [UsersModule, TeachersModule, ClassesModule, StudentsModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
