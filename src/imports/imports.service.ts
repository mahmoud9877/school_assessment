import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ClassesRepository } from '../classes/classes.repository.js';
import { UserRole } from '../generated/prisma/enums.js';
import { StudentsRepository } from '../students/students.repository.js';
import { TeachersRepository } from '../teachers/teachers.repository.js';
import {
  LOGIN_DISABLED_PASSWORD,
  UsersRepository,
} from '../users/users.repository.js';
import { parseCsv } from './csv.js';
import {
  ClassRow,
  COLUMNS,
  StudentRow,
  TeacherRow,
} from './dto/import-rows.dto.js';
import { ImportErrors } from './import-errors.js';

type Parsed<T> = { line: number; row: T }[];

// Every import is all-or-nothing: all rows are validated first, then written
// in one transaction. Any problem rejects the whole file with a list of
// errors by line number.
//
// Imported accounts cannot log in until a password is set for them, so no
// passwords ever travel in CSV files.
@Injectable()
export class ImportsService {
  constructor(
    private readonly users: UsersRepository,
    private readonly teachers: TeachersRepository,
    private readonly classes: ClassesRepository,
    private readonly students: StudentsRepository,
  ) {}

  async importTeachers(file: Buffer) {
    const errors = new ImportErrors();
    const rows = this.parse(file, COLUMNS.teachers, TeacherRow, errors);
    await this.checkNewEmails(rows, errors);
    errors.throwIfAny();

    await this.teachers.createWithUsers(
      rows.map(({ row }) => ({
        name: row.name,
        email: row.email,
        role: UserRole.TEACHER,
        password: LOGIN_DISABLED_PASSWORD,
      })),
    );
    return { imported: rows.length };
  }

  async importClasses(file: Buffer) {
    const errors = new ImportErrors();
    const rows = this.parse(file, COLUMNS.classes, ClassRow, errors);

    this.flagDuplicates(rows, (row) => row.name, 'class name', errors);
    const taken = await this.classes.findExistingNames(
      rows.map((r) => r.row.name),
    );
    const teacherIds = await this.teachers.findIdsByUserEmails(
      rows.map((r) => r.row.teacherEmail),
    );
    for (const { line, row } of rows) {
      if (taken.has(row.name)) {
        errors.add(line, `Class name "${row.name}" already exists`);
      }
      if (!teacherIds.has(row.teacherEmail)) {
        errors.add(line, `No teacher with email ${row.teacherEmail}`);
      }
    }
    errors.throwIfAny();

    await this.classes.createMany(
      rows.map(({ row }) => ({
        name: row.name,
        capacity: row.capacity,
        teacherId: teacherIds.get(row.teacherEmail)!,
      })),
    );
    return { imported: rows.length };
  }

  async importStudents(file: Buffer) {
    const errors = new ImportErrors();
    const rows = this.parse(file, COLUMNS.students, StudentRow, errors);
    await this.checkNewEmails(rows, errors);

    // Capacity is checked with the classes locked, so concurrent enrolments
    // cannot push a class over capacity while this import runs.
    await this.students.createWithUsers(
      rows.map(({ row }) => ({
        user: {
          name: row.name,
          email: row.email,
          role: UserRole.STUDENT,
          password: LOGIN_DISABLED_PASSWORD,
        },
        className: row.className,
      })),
      (classes, enrolled) => {
        for (const { line, row } of rows) {
          const target = classes.get(row.className);
          if (!target) {
            errors.add(line, `No class named "${row.className}"`);
            continue;
          }
          const count = (enrolled.get(target.id) ?? 0) + 1;
          enrolled.set(target.id, count);
          if (count > target.capacity) {
            errors.add(
              line,
              `Class "${target.name}" is full (capacity ${target.capacity})`,
            );
          }
        }
        // Reports these together with the earlier row errors. Throwing here
        // rolls the import back, so nothing is written.
        errors.throwIfAny();
      },
    );
    return { imported: rows.length };
  }

  // Parses the file and validates every row. A malformed file (bad header,
  // broken quoting) is rejected at once; invalid rows are added to `errors`
  // and left out, so the cross-row checks still run on the rest and the
  // client gets every problem in one response.
  private parse<T extends object>(
    file: Buffer,
    columns: readonly string[],
    rowClass: new () => T,
    errors: ImportErrors,
  ): Parsed<T> {
    const parsed: Parsed<T> = [];
    for (const { line, values } of parseCsv(file, columns)) {
      const row = plainToInstance(rowClass, values);
      const problems = validateSync(row, { stopAtFirstError: true });
      for (const problem of problems) {
        for (const message of Object.values(problem.constraints ?? {})) {
          errors.add(line, message);
        }
      }
      if (problems.length === 0) {
        parsed.push({ line, row });
      }
    }
    return parsed;
  }

  private async checkNewEmails(
    rows: Parsed<{ email: string }>,
    errors: ImportErrors,
  ) {
    this.flagDuplicates(rows, (row) => row.email, 'email', errors);
    const existing = await this.users.findExistingEmails(
      rows.map((r) => r.row.email),
    );
    for (const { line, row } of rows) {
      if (existing.has(row.email)) {
        errors.add(line, `Email ${row.email} already has an account`);
      }
    }
  }

  private flagDuplicates<T>(
    rows: Parsed<T>,
    key: (row: T) => string,
    label: string,
    errors: ImportErrors,
  ) {
    const firstLine = new Map<string, number>();
    for (const { line, row } of rows) {
      const value = key(row);
      const first = firstLine.get(value);
      if (first === undefined) {
        firstLine.set(value, line);
      } else {
        errors.add(
          line,
          `Duplicate ${label} "${value}" (also on line ${first})`,
        );
      }
    }
  }
}
