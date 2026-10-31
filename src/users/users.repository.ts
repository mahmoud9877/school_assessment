import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Stored instead of a hash for accounts that must not log in yet (e.g. CSV
// imports). bcrypt.compare() never matches it, so login fails with 401.
export const LOGIN_DISABLED_PASSWORD = '!';

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      omit: { password: true },
      orderBy: { id: 'asc' },
    });
  }

  findById(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
  }

  // Includes the password hash: for credential checks only, never return it.
  findByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  existsByEmail(email: string) {
    return this.prisma.user
      .count({ where: { email } })
      .then((count) => count > 0);
  }

  async findExistingEmails(emails: string[]) {
    const users = await this.prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    return new Set(users.map((user) => user.email));
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data, omit: { password: true } });
  }
}
