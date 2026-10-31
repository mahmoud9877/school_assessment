import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { TeachersModule } from './teachers/teachers.module.js';
import { ClassesModule } from './classes/classes.module.js';
import { StudentsModule } from './students/students.module.js';
import { ImportsModule } from './imports/imports.module.js';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    TeachersModule,
    ClassesModule,
    StudentsModule,
    ImportsModule,
  ],
})
export class AppModule {}
