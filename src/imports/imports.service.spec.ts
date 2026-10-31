import { BadRequestException } from '@nestjs/common';
import type { ClassesRepository } from '../classes/classes.repository.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { StudentsRepository } from '../students/students.repository.js';
import type { TeachersRepository } from '../teachers/teachers.repository.js';
import {
  LOGIN_DISABLED_PASSWORD,
  type UsersRepository,
} from '../users/users.repository.js';
import { ImportsService } from './imports.service.js';

const csv = (...lines: string[]) => Buffer.from(lines.join('\n'));

async function errorsOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => {
      throw new Error('expected the import to fail');
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(BadRequestException);
  return (
    (error as BadRequestException).getResponse() as {
      errors: { line: number; message: string }[];
    }
  ).errors;
}

describe('ImportsService', () => {
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let teachers: Record<string, ReturnType<typeof vi.fn>>;
  let classes: Record<string, ReturnType<typeof vi.fn>>;
  let students: Record<string, ReturnType<typeof vi.fn>>;
  let service: ImportsService;

  beforeEach(() => {
    users = {
      findExistingEmails: vi.fn().mockResolvedValue(new Set()),
    };
    teachers = {
      findIdsByUserEmails: vi
        .fn()
        .mockResolvedValue(new Map([['sara@school.test', 1]])),
      createWithUsers: vi.fn(),
    };
    classes = {
      findExistingNames: vi.fn().mockResolvedValue(new Set()),
      createMany: vi.fn(),
    };
    // Runs the capacity check against Math (capacity 2, 1 student already).
    students = {
      createWithUsers: vi.fn((_rows, check: (...args: unknown[]) => void) =>
        check(
          new Map([['Math', { id: 1, name: 'Math', capacity: 2 }]]),
          new Map([[1, 1]]),
        ),
      ),
    };
    service = new ImportsService(
      users as unknown as UsersRepository,
      teachers as unknown as TeachersRepository,
      classes as unknown as ClassesRepository,
      students as unknown as StudentsRepository,
    );
  });

  describe('importTeachers', () => {
    it('creates a login-disabled TEACHER account and teacher record per row', async () => {
      const result = await service.importTeachers(
        csv('name,email', 'Ann,ANN@school.test', 'Bo,bo@school.test'),
      );
      expect(result).toEqual({ imported: 2 });
      expect(teachers.createWithUsers).toHaveBeenCalledWith([
        {
          name: 'Ann',
          email: 'ann@school.test',
          role: UserRole.TEACHER,
          password: LOGIN_DISABLED_PASSWORD,
        },
        expect.objectContaining({ email: 'bo@school.test' }),
      ]);
    });

    it('reports every invalid row at once and writes nothing', async () => {
      users.findExistingEmails.mockResolvedValue(
        new Set(['taken@school.test']),
      );
      const errors = await errorsOf(
        service.importTeachers(
          csv(
            'name,email',
            'Ann,ann@school.test',
            ',not-an-email',
            'Bo,taken@school.test',
            'Cy,ann@school.test',
          ),
        ),
      );
      expect(errors.map((e) => e.line)).toEqual([3, 3, 4, 5]);
      expect(errors[2].message).toBe(
        'Email taken@school.test already has an account',
      );
      expect(errors[3].message).toContain('Duplicate email');
      expect(teachers.createWithUsers).not.toHaveBeenCalled();
    });
  });

  describe('importClasses', () => {
    it('creates classes for existing teachers', async () => {
      await expect(
        service.importClasses(
          csv('name,capacity,teacherEmail', 'Art,20,sara@school.test'),
        ),
      ).resolves.toEqual({ imported: 1 });
      expect(classes.createMany).toHaveBeenCalledWith([
        { name: 'Art', capacity: 20, teacherId: 1 },
      ]);
    });

    it('rejects bad capacity, unknown teachers and taken or duplicate names', async () => {
      classes.findExistingNames.mockResolvedValue(new Set(['Math']));
      const errors = await errorsOf(
        service.importClasses(
          csv(
            'name,capacity,teacherEmail',
            'Art,ten,sara@school.test',
            'Math,10,sara@school.test',
            'Bio,10,nobody@school.test',
            'Bio,10,sara@school.test',
          ),
        ),
      );
      expect(errors).toEqual([
        { line: 2, message: expect.stringContaining('capacity') },
        { line: 3, message: 'Class name "Math" already exists' },
        { line: 4, message: 'No teacher with email nobody@school.test' },
        { line: 5, message: 'Duplicate class name "Bio" (also on line 4)' },
      ]);
      expect(classes.createMany).not.toHaveBeenCalled();
    });
  });

  describe('importStudents', () => {
    it('enrols students up to the class capacity', async () => {
      await expect(
        service.importStudents(
          csv('name,email,className', 'Ann,ann@school.test,Math'),
        ),
      ).resolves.toEqual({ imported: 1 });
      expect(students.createWithUsers).toHaveBeenCalledWith(
        [
          {
            user: {
              name: 'Ann',
              email: 'ann@school.test',
              role: UserRole.STUDENT,
              password: LOGIN_DISABLED_PASSWORD,
            },
            className: 'Math',
          },
        ],
        expect.any(Function),
      );
    });

    it('rejects the rows that would overfill a class, counting existing students', async () => {
      // Math has capacity 2 and 1 student already: only one more fits.
      const errors = await errorsOf(
        service.importStudents(
          csv(
            'name,email,className',
            'Ann,ann@school.test,Math',
            'Bo,bo@school.test,Math',
            'Cy,cy@school.test,Art',
          ),
        ),
      );
      expect(errors).toEqual([
        { line: 3, message: 'Class "Math" is full (capacity 2)' },
        { line: 4, message: 'No class named "Art"' },
      ]);
    });
  });
});
