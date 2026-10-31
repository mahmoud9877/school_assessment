import { Injectable } from '@nestjs/common';
import {
  countStudentsByClass,
  countStudentsInClass,
  type LockedClass,
  lockClassById,
  lockClassesByNames,
} from '../classes/classes.repository.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
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

// Locks the class and checks it has a free seat. Must run inside the
// transaction that then adds the student: the row stays locked until it
// commits, so two requests cannot take the last seat.
async function reserveSeat(tx: Tx, classId: number) {
  const target = await lockClassById(tx, classId);
  if (!target) {
    return { status: 'class_not_found' as const };
  }
  const enrolled = await countStudentsInClass(tx, classId);
  if (enrolled >= target.capacity) {
    return { status: 'class_full' as const, capacity: target.capacity };
  }
  return null;
}

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

  // Creates the student only if the class has a free seat.
  enrol(data: Prisma.StudentUncheckedCreateInput) {
    return this.prisma.$transaction(async (tx) => {
      const refused = await reserveSeat(tx, data.classId);
      if (refused) {
        return refused;
      }
      const student = await tx.student.create({
        data,
        include: studentInclude,
      });
      return { status: 'ok' as const, student };
    });
  }

  // Moves the student only if the target class has a free seat.
  moveToClass(id: number, classId: number) {
    return this.prisma.$transaction(async (tx) => {
      const refused = await reserveSeat(tx, classId);
      if (refused) {
        return refused;
      }
      const student = await tx.student.update({
        where: { id },
        data: { classId },
        include: studentInclude,
      });
      return { status: 'ok' as const, student };
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
