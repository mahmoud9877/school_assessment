import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { StudentsController } from './students.controller.js';
import { StudentsRepository } from './students.repository.js';
import { StudentsService } from './students.service.js';

@Module({
  imports: [UsersModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentsRepository],
  exports: [StudentsRepository],
})
export class StudentsModule {}
