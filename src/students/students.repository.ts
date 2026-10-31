import { Injectable } from '@nestjs/common';
import {
  type ClassCheck,
  countStudentsByClass,
  type LockedClass,
  lockClassesByNames,
  lockClassSeats,
} from '../classes/classes.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { userSummarySelect } from '../users/users.repository.js';

const studentInclude = {
  user: { select: userSummarySelect },
  class: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

export type NewStudent = { user: Prisma.UserCreateInput; className: string };

// Called with the target classes locked and their current enrolment, before
// anything is written. Throwing rolls the whole import back.
export type EnrolmentCheck = (
  classes: Map<string, LockedClass>,
  enrolled: Map<number, number>,
) => void;

@Injectable()
export class StudentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.student.findMany({
      include: studentInclude,
      orderBy: { id: 'asc' },
    });
  }

  findById(id: number) {
    return this.prisma.student.findUnique({
      where: { id },
      include: studentInclude,
    });
  }

  existsForUser(userId: number) {
    return this.prisma.student
      .count({ where: { userId } })
      .then((count) => count > 0);
  }

  // Runs `check` with the target class locked, then creates the student. The
  // lock is held until commit, so two requests cannot take the last seat.
  enrol(data: Prisma.StudentUncheckedCreateInput, check: ClassCheck) {
    return this.prisma.$transaction(async (tx) => {
      check(await lockClassSeats(tx, data.classId));
      return tx.student.create({ data, include: studentInclude });
    });
  }

  // Runs `check` with the target class locked, then moves the student.
  moveToClass(id: number, classId: number, check: ClassCheck) {
    return this.prisma.$transaction(async (tx) => {
      check(await lockClassSeats(tx, classId));
      return tx.student.update({
        where: { id },
        data: { classId },
        include: studentInclude,
      });
    });
  }

  // Creates a user and a student per row in one transaction, after `check`
  // has approved them against the locked classes.
  createWithUsers(rows: NewStudent[], check: EnrolmentCheck) {
    return this.prisma.$transaction(async (tx) => {
      const classNames = [...new Set(rows.map((r) => r.className))];
      const classes = await lockClassesByNames(tx, classNames);
      const enrolled = await countStudentsByClass(
        tx,
        [...classes.values()].map((c) => c.id),
      );
      check(classes, enrolled);

      for (const { user, className } of rows) {
        const { id: userId } = await tx.user.create({
          data: user,
          select: { id: true },
        });
        await tx.student.create({
          data: { userId, classId: classes.get(className)!.id },
        });
      }
    });
  }

  async delete(id: number) {
    await this.prisma.student.delete({ where: { id } });
  }
}
