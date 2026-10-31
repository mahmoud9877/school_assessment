import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UserRole } from '../generated/prisma/enums.js';
import type { UsersRepository } from '../users/users.repository.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  let users: {
    existsByEmail: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    findByEmailWithPassword: ReturnType<typeof vi.fn>;
  };
  let service: AuthService;

  beforeEach(() => {
    users = {
      existsByEmail: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockImplementation(({ password: _p, ...rest }) => ({
        id: 1,
        ...rest,
      })),
      findByEmailWithPassword: vi.fn(),
    };
    service = new AuthService(users as unknown as UsersRepository, jwt);
  });

  describe('register', () => {
    const dto = {
      name: 'New User',
      email: 'new@school.test',
      password: 'correct-horse',
      confirmPassword: 'correct-horse',
      role: UserRole.TEACHER,
    };

    it('stores a bcrypt hash, never the plain password', async () => {
      await service.register(dto);
      const stored = users.create.mock.calls[0][0].password as string;
      expect(stored).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, stored)).toBe(true);
    });

    it('does not pass confirmPassword to the database', async () => {
      await service.register(dto);
      expect(users.create.mock.calls[0][0]).not.toHaveProperty(
        'confirmPassword',
      );
    });

    it('rejects an email that is already registered', async () => {
      users.existsByEmail.mockResolvedValue(true);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(users.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const password = 'correct-horse';
    const storedUser = async () => ({
      id: 7,
      name: 'Admin',
      email: 'admin@school.test',
      role: UserRole.ADMIN,
      password: await bcrypt.hash(password, 4),
    });

    it('returns a token carrying id, email and role, and no password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(await storedUser());
      const result = await service.login({
        email: 'admin@school.test',
        password,
      });

      expect(result.user).not.toHaveProperty('password');
      expect(await jwt.verifyAsync(result.accessToken)).toMatchObject({
        sub: 7,
        email: 'admin@school.test',
        role: UserRole.ADMIN,
      });
    });

    it('rejects a wrong password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(await storedUser());
      await expect(
        service.login({
          email: 'admin@school.test',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });

    it('rejects an unknown email with the same error as a wrong password', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@school.test', password }),
      ).rejects.toThrow(new UnauthorizedException('Invalid credentials'));
    });
  });
});
