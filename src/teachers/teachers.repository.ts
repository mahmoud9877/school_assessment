import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { userSummarySelect } from '../users/users.repository.js';

const teacherInclude = {
  user: { select: userSummarySelect },
  classes: {
    select: { id: true, name: true, capacity: true },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.TeacherInclude;

@Injectable()
export class TeachersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.teacher.findMany({
      include: teacherInclude,
      orderBy: { id: 'asc' },
    });
  }

  findById(id: number) {
    return this.prisma.teacher.findUnique({
      where: { id },
      include: teacherInclude,
    });
  }

  existsForUser(userId: number) {
    return this.prisma.teacher
      .count({ where: { userId } })
      .then((count) => count > 0);
  }

  // Maps each given user email that belongs to a teacher to that teacher's id.
  async findIdsByUserEmails(emails: string[]) {
    const teachers = await this.prisma.teacher.findMany({
      where: { user: { email: { in: emails } } },
      select: { id: true, user: { select: { email: true } } },
    });
    return new Map(teachers.map((t) => [t.user.email, t.id]));
  }

  create(userId: number) {
    return this.prisma.teacher.create({
      data: { userId },
      include: teacherInclude,
    });
  }

  // Creates a user and a teacher per entry, all in one transaction.
  async createWithUsers(users: Prisma.UserCreateInput[]) {
    await this.prisma.$transaction(async (tx) => {
      for (const data of users) {
        await tx.teacher.create({ data: { user: { create: data } } });
      }
    });
  }

  async delete(id: number) {
    await this.prisma.teacher.delete({ where: { id } });
  }
}
