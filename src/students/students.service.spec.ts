import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { ClassCheck, ClassSeats } from '../classes/classes.repository.js';
import { UserRole } from '../generated/prisma/enums.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { StudentsRepository } from './students.repository.js';
import { StudentsService } from './students.service.js';

describe('StudentsService', () => {
  let students: Record<string, ReturnType<typeof vi.fn>>;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let service: StudentsService;
  // What the repository finds with the target class row locked.
  let target: ClassSeats | null;

  beforeEach(() => {
    target = { id: 1, name: 'Math', capacity: 2, enrolled: 1 };
    students = {
      findById: vi.fn(),
      existsForUser: vi.fn().mockResolvedValue(false),
      enrol: vi.fn((data: object, check: ClassCheck) => {
        check(target);
        return Promise.resolve({ id: 1, ...data });
      }),
      moveToClass: vi.fn((id: number, classId: number, check: ClassCheck) => {
        check(target);
        return Promise.resolve({ id, classId });
      }),
      delete: vi.fn(),
    };
    users = {
      findById: vi.fn().mockResolvedValue({ id: 5, role: UserRole.STUDENT }),
    };
    service = new StudentsService(
      students as unknown as StudentsRepository,
      users as unknown as UsersRepository,
    );
  });

  describe('create', () => {
    const dto = { userId: 5, classId: 1 };

    it('enrols a STUDENT user into a class', async () => {
      await expect(service.create(dto)).resolves.toMatchObject(dto);
      expect(students.enrol).toHaveBeenCalledWith(dto, expect.any(Function));
    });

    it('rejects enrolment when the class is full', async () => {
      target = { id: 1, name: 'Math', capacity: 2, enrolled: 2 };
      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Class #1 is full (capacity 2)'),
      );
    });

    it('rejects an unknown class', async () => {
      target = null;
      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException('Class #1 not found'),
      );
    });

    it('rejects an unknown user', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(students.enrol).not.toHaveBeenCalled();
    });

    it.each([UserRole.TEACHER, UserRole.ADMIN, UserRole.OPERATOR])(
      'rejects a user with role %s',
      async (role) => {
        users.findById.mockResolvedValue({ id: 5, role });
        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      },
    );

    it('rejects a user who is already a student', async () => {
      students.existsForUser.mockResolvedValue(true);
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(students.enrol).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      students.findById.mockResolvedValue({ id: 3, classId: 1 });
    });

    it('moves a student into another class', async () => {
      await expect(service.update(3, { classId: 2 })).resolves.toEqual({
        id: 3,
        classId: 2,
      });
      expect(students.moveToClass).toHaveBeenCalledWith(
        3,
        2,
        expect.any(Function),
      );
    });

    it('rejects moving into a full class', async () => {
      target = { id: 2, name: 'Art', capacity: 1, enrolled: 1 };
      await expect(service.update(3, { classId: 2 })).rejects.toThrow(
        ConflictException,
      );
    });

    it('does nothing when the class does not change', async () => {
      await service.update(3, { classId: 1 });
      expect(students.moveToClass).not.toHaveBeenCalled();
    });

    it('rejects an unknown student', async () => {
      students.findById.mockResolvedValue(null);
      await expect(service.update(3, { classId: 2 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
