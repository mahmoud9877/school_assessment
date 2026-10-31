import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { TeachersController } from './teachers.controller.js';
import { TeachersRepository } from './teachers.repository.js';
import { TeachersService } from './teachers.service.js';

@Module({
  imports: [UsersModule],
  controllers: [TeachersController],
  providers: [TeachersService, TeachersRepository],
  exports: [TeachersRepository],
})
export class TeachersModule {}
