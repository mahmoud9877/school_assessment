import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seed } from '../prisma/seed.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const DEMO = {
  admin: { email: 'admin@school.test', passwordEnv: 'SEED_ADMIN_PASSWORD' },
  operator: {
    email: 'operator@school.test',
    passwordEnv: 'SEED_OPERATOR_PASSWORD',
  },
  teacher: {
    email: 'sara.teacher@school.test',
    passwordEnv: 'SEED_TEACHER_PASSWORD',
  },
  student: {
    email: 'ali.student@school.test',
    passwordEnv: 'SEED_STUDENT_PASSWORD',
  },
} as const;
export type DemoRole = keyof typeof DEMO;

export const passwordOf = (role: DemoRole) =>
  process.env[DEMO[role].passwordEnv]!;

// Boots the real application (same configuration as main.ts) against a
// freshly truncated and seeded test database.
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Student", "Class", "Teacher", "User" RESTART IDENTITY CASCADE',
  );
  await seed(prisma);

  return { app, prisma, http: () => request(app.getHttpServer()) };
}

export async function login(app: INestApplication<App>, role: DemoRole) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: DEMO[role].email, password: passwordOf(role) })
    .expect(200);
  return response.body.accessToken as string;
}
