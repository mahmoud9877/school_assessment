import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UserRole } from '../src/generated/prisma/enums.js';

// Safe to run more than once: every record is matched by a unique key and
// only created if it is missing. Used by `npm run db:seed` and the e2e tests.

// Demo passwords come from the environment (.env is git-ignored), one per role,
// so no credential is ever committed to the repository.
export const PASSWORD_ENV: Record<UserRole, string> = {
  ADMIN: 'SEED_ADMIN_PASSWORD',
  OPERATOR: 'SEED_OPERATOR_PASSWORD',
  TEACHER: 'SEED_TEACHER_PASSWORD',
  STUDENT: 'SEED_STUDENT_PASSWORD',
};

async function hashedPasswords() {
  const hashes = {} as Record<UserRole, string>;
  for (const [role, name] of Object.entries(PASSWORD_ENV)) {
    const value = process.env[name];
    if (!value || value.length < 12) {
      throw new Error(`${name} must be set in .env (at least 12 characters)`);
    }
    hashes[role as UserRole] = await bcrypt.hash(value, 12);
  }
  return hashes;
}

export const staff = [
  { name: 'Admin', email: 'admin@school.test', role: UserRole.ADMIN },
  { name: 'Operator', email: 'operator@school.test', role: UserRole.OPERATOR },
];

export const teachers = [
  { name: 'Sara Teacher', email: 'sara.teacher@school.test' },
  { name: 'Omar Teacher', email: 'omar.teacher@school.test' },
];

// Each class belongs to the teacher at the same index.
export const classes = [
  { name: 'Math 101', capacity: 30 },
  { name: 'Science 101', capacity: 25 },
];

// classIndex points into `classes`.
export const students = [
  { name: 'Ali Student', email: 'ali.student@school.test', classIndex: 0 },
  { name: 'Mona Student', email: 'mona.student@school.test', classIndex: 0 },
  {
    name: 'Youssef Student',
    email: 'youssef.student@school.test',
    classIndex: 1,
  },
  { name: 'Nour Student', email: 'nour.student@school.test', classIndex: 1 },
];

// Re-running the seed resets each demo account's role and password to the
// current .env values, so rotating a password is just "edit .env, re-seed".
async function upsertUser(
  prisma: PrismaClient,
  user: { name: string; email: string; role: UserRole },
  password: string,
) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: { role: user.role, password },
    create: { ...user, password },
  });
}

export async function seed(prisma: PrismaClient) {
  const passwords = await hashedPasswords();

  for (const user of staff) {
    await upsertUser(prisma, user, passwords[user.role]);
  }

  const classIds: number[] = [];
  for (const [i, t] of teachers.entries()) {
    const user = await upsertUser(
      prisma,
      { ...t, role: UserRole.TEACHER },
      passwords.TEACHER,
    );
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    // Class names are not unique in the schema, so match on name + teacher.
    const { name, capacity } = classes[i];
    const existing = await prisma.class.findFirst({
      where: { name, teacherId: teacher.id },
    });
    const cls =
      existing ??
      (await prisma.class.create({
        data: { name, capacity, teacherId: teacher.id },
      }));
    classIds.push(cls.id);
  }

  for (const { classIndex, ...s } of students) {
    const user = await upsertUser(
      prisma,
      { ...s, role: UserRole.STUDENT },
      passwords.STUDENT,
    );
    await prisma.student.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, classId: classIds[classIndex] },
    });
  }

  return {
    users: await prisma.user.count(),
    teachers: await prisma.teacher.count(),
    classes: await prisma.class.count(),
    students: await prisma.student.count(),
  };
}

// Run directly (`prisma db seed`), not when imported by the tests.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  seed(prisma)
    .then((counts) => console.log('Seed complete:', counts))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
