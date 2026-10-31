import { ConflictException, NotFoundException } from '@nestjs/common';
import type { TeachersRepository } from '../teachers/teachers.repository.js';
import type {
  ClassCheck,
  ClassesRepository,
  ClassSeats,
} from './classes.repository.js';
import { ClassesService } from './classes.service.js';

describe('ClassesService', () => {
  let classes: Record<string, ReturnType<typeof vi.fn>>;
  let teachers: Record<string, ReturnType<typeof vi.fn>>;
  let service: ClassesService;
  // What the repository finds with the class row locked.
  let current: ClassSeats | null;

  beforeEach(() => {
    current = { id: 1, name: 'Art', capacity: 10, enrolled: 4 };
    classes = {
      findById: vi.fn(),
      existsByName: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockImplementation((data) => ({ id: 1, ...data })),
      update: vi.fn((id: number, data: object, check: ClassCheck) => {
        check(current);
        return Promise.resolve({ id, ...data });
      }),
      delete: vi.fn((_id: number, check: ClassCheck) => {
        check(current);
        return Promise.resolve();
      }),
    };
    teachers = { findById: vi.fn().mockResolvedValue({ id: 2 }) };
    service = new ClassesService(
      classes as unknown as ClassesRepository,
      teachers as unknown as TeachersRepository,
    );
  });

  it('creates a class for an existing teacher', async () => {
    const dto = { name: 'Art', capacity: 10, teacherId: 2 };
    await expect(service.create(dto)).resolves.toMatchObject(dto);
  });

  it('rejects a duplicate class name', async () => {
    classes.existsByName.mockResolvedValue(true);
    await expect(
      service.create({ name: 'Art', capacity: 10, teacherId: 2 }),
    ).rejects.toThrow(new ConflictException('Class name "Art" already exists'));
  });

  it('allows renaming a class to its own current name', async () => {
    await service.update(1, { name: 'Art' });
    expect(classes.existsByName).toHaveBeenCalledWith('Art', 1);
  });

  it('rejects a class for an unknown teacher', async () => {
    teachers.findById.mockResolvedValue(null);
    await expect(
      service.create({ name: 'Art', capacity: 10, teacherId: 99 }),
    ).rejects.toThrow(new NotFoundException('Teacher #99 not found'));
    expect(classes.create).not.toHaveBeenCalled();
  });

  describe('update', () => {
    it('allows lowering capacity down to the current enrolment', async () => {
      await expect(service.update(1, { capacity: 4 })).resolves.toEqual({
        id: 1,
        capacity: 4,
      });
    });

    it('rejects capacity below the current enrolment', async () => {
      await expect(service.update(1, { capacity: 3 })).rejects.toThrow(
        new ConflictException(
          'Capacity 3 is below the 4 students already enrolled',
        ),
      );
    });

    it('rejects reassigning to an unknown teacher', async () => {
      teachers.findById.mockResolvedValue(null);
      await expect(service.update(1, { teacherId: 99 })).rejects.toThrow(
        NotFoundException,
      );
      expect(classes.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown class', async () => {
      current = null;
      await expect(service.update(1, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('refuses to delete a class that still has students', async () => {
      await expect(service.remove(1)).rejects.toThrow(ConflictException);
    });

    it('rejects an unknown class', async () => {
      current = null;
      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });

    it('deletes an empty class', async () => {
      current = { id: 1, name: 'Art', capacity: 10, enrolled: 0 };
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(classes.delete).toHaveBeenCalledWith(1, expect.any(Function));
    });
  });

  it('findOne rejects an unknown class', async () => {
    classes.findById.mockResolvedValue(null);
    await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
  });
});
