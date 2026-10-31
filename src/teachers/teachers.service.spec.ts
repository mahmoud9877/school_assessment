import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../generated/prisma/enums.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { TeachersRepository } from './teachers.repository.js';
import { TeachersService } from './teachers.service.js';

describe('TeachersService', () => {
  let teachers: Record<string, ReturnType<typeof vi.fn>>;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let service: TeachersService;

  beforeEach(() => {
    teachers = {
      findById: vi.fn(),
      existsForUser: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockImplementation((userId) => ({ id: 1, userId })),
      delete: vi.fn(),
    };
    users = {
      findById: vi.fn().mockResolvedValue({ id: 3, role: UserRole.TEACHER }),
    };
    service = new TeachersService(
      teachers as unknown as TeachersRepository,
      users as unknown as UsersRepository,
    );
  });

  describe('create', () => {
    it('creates a teacher for a TEACHER user', async () => {
      await expect(service.create({ userId: 3 })).resolves.toMatchObject({
        userId: 3,
      });
    });

    it.each([UserRole.STUDENT, UserRole.ADMIN, UserRole.OPERATOR])(
      'rejects a user with role %s',
      async (role) => {
        users.findById.mockResolvedValue({ id: 3, role });
        await expect(service.create({ userId: 3 })).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('rejects an unknown user', async () => {
      users.findById.mockResolvedValue(null);
      await expect(service.create({ userId: 3 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a user who is already a teacher', async () => {
      teachers.existsForUser.mockResolvedValue(true);
      await expect(service.create({ userId: 3 })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('refuses to delete a teacher who still has classes', async () => {
      teachers.findById.mockResolvedValue({ id: 1, classes: [{ id: 9 }] });
      await expect(service.remove(1)).rejects.toThrow(ConflictException);
      expect(teachers.delete).not.toHaveBeenCalled();
    });

    it('deletes a teacher without classes', async () => {
      teachers.findById.mockResolvedValue({ id: 1, classes: [] });
      await service.remove(1);
      expect(teachers.delete).toHaveBeenCalledWith(1);
    });

    it('rejects an unknown teacher', async () => {
      teachers.findById.mockResolvedValue(null);
      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});
