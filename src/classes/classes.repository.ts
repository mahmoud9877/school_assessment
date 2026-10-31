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

// Replaces Prisma's `_count` with a flat `studentCount` field.
function withStudentCount<T extends { _count: { students: number } }>({
  _count,
  ...rest
}: T) {
  return { ...rest, studentCount: _count.students };
}

// Locks the class row until the transaction ends, so concurrent enrolments
// into the same class are serialised and cannot exceed its capacity.
export async function lockClassById(tx: Tx, id: number) {
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

export function countStudentsInClass(tx: Tx, classId: number) {
  return tx.student.count({ where: { classId } });
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

  // Updates the class with its row locked, so a capacity change cannot race
  // with enrolments into it.
  update(id: number, data: Prisma.ClassUncheckedUpdateInput) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockClassById(tx, id))) {
        return { status: 'not_found' as const };
      }
      if (typeof data.capacity === 'number') {
        const enrolled = await countStudentsInClass(tx, id);
        if (data.capacity < enrolled) {
          return { status: 'below_enrolment' as const, enrolled };
        }
      }
      const updated = await tx.class.update({
        where: { id },
        data,
        include: classInclude,
      });
      return { status: 'ok' as const, class: withStudentCount(updated) };
    });
  }

  // Deletes the class only while it has no students, with its row locked so
  // nobody can enrol in between.
  deleteIfEmpty(id: number) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await lockClassById(tx, id))) {
        return { status: 'not_found' as const };
      }
      const enrolled = await countStudentsInClass(tx, id);
      if (enrolled > 0) {
        return { status: 'has_students' as const, enrolled };
      }
      await tx.class.delete({ where: { id } });
      return { status: 'ok' as const };
    });
  }
}
