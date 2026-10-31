import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { userSummarySelect } from '../users/users.repository.js';

const classInclude = {
  teacher: { select: { id: true, user: { select: userSummarySelect } } },
  _count: { select: { students: true } },
} satisfies Prisma.ClassInclude;

const classDetailInclude = {
  ...classInclude,
  students: {
    select: { id: true, user: { select: userSummarySelect } },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ClassInclude;

export type LockedClass = { id: number; name: string; capacity: number };

// A locked class with its current enrolment, handed to the service's check.
export type ClassSeats = LockedClass & { enrolled: number };

// Called inside the transaction, before the write, with the class row locked
// (null if it does not exist). Throwing rolls the transaction back.
export type ClassCheck = (current: ClassSeats | null) => void;

// Replaces Prisma's `_count` with a flat `studentCount` field.
function withStudentCount<T extends { _count: { students: number } }>({
  _count,
  ...rest
}: T) {
  return { ...rest, studentCount: _count.students };
}

// Locks the class row until the transaction ends, so concurrent enrolments
// into the same class are serialised and cannot exceed its capacity.
async function lockClassById(tx: Tx, id: number) {
  const rows = await tx.$queryRaw<LockedClass[]>`
    SELECT "id", "name", "capacity" FROM "Class" WHERE "id" = ${id} FOR UPDATE`;
  return rows[0] ?? null;
}

// Locks several class rows, in id order so concurrent callers cannot
// deadlock. Returns the locked classes keyed by name.
export async function lockClassesByNames(tx: Tx, names: string[]) {
  const rows = await tx.$queryRaw<LockedClass[]>`
    SELECT "id", "name", "capacity" FROM "Class"
    WHERE "name" = ANY(${names}) ORDER BY "id" FOR UPDATE`;
  return new Map(rows.map((row) => [row.name, row]));
}

export async function countStudentsByClass(tx: Tx, classIds: number[]) {
  const groups = await tx.student.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [g.classId, g._count._all]));
}

// Locks the class row and counts its students. The row stays locked until
// the transaction ends, so the count cannot change before the caller writes.
export async function lockClassSeats(
  tx: Tx,
  id: number,
): Promise<ClassSeats | null> {
  const locked = await lockClassById(tx, id);
  if (!locked) {
    return null;
  }
  const enrolled = await tx.student.count({ where: { classId: id } });
  return { ...locked, enrolled };
}

@Injectable()
export class ClassesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const classes = await this.prisma.class.findMany({
      include: classInclude,
      orderBy: { id: 'asc' },
    });
    return classes.map(withStudentCount);
  }

  async findById(id: number) {
    const found = await this.prisma.class.findUnique({
      where: { id },
      include: classDetailInclude,
    });
    return found && withStudentCount(found);
  }

  async findExistingNames(names: string[]) {
    const classes = await this.prisma.class.findMany({
      where: { name: { in: names } },
      select: { name: true },
    });
    return new Set(classes.map((c) => c.name));
  }

  async existsByName(name: string, excludeId?: number) {
    const count = await this.prisma.class.count({
      where: {
        name,
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
    });
    return count > 0;
  }

  async create(data: Prisma.ClassUncheckedCreateInput) {
    return withStudentCount(
      await this.prisma.class.create({ data, include: classInclude }),
    );
  }

  // All-or-nothing: a single statement, so either every class is created or
  // none is.
  async createMany(data: Prisma.ClassUncheckedCreateInput[]) {
    await this.prisma.class.createMany({ data });
  }

  // Runs `check` with the class row locked, then updates it, so a capacity
  // change cannot race with enrolments into the class.
  update(
    id: number,
    data: Prisma.ClassUncheckedUpdateInput,
    check: ClassCheck,
  ) {
    return this.prisma.$transaction(async (tx) => {
      check(await lockClassSeats(tx, id));
      return withStudentCount(
        await tx.class.update({ where: { id }, data, include: classInclude }),
      );
    });
  }

  // Runs `check` with the class row locked, then deletes it, so nobody can
  // enrol in between.
  delete(id: number, check: ClassCheck) {
    return this.prisma.$transaction(async (tx) => {
      check(await lockClassSeats(tx, id));
      await tx.class.delete({ where: { id } });
    });
  }
}
