import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../generated/prisma/enums.js';
import { AuthGuard } from './auth.guard.js';
import type { JwtPayload } from './jwt-payload.interface.js';

describe('AuthGuard', () => {
  const jwt = new JwtService({ secret: 'unit-test-secret' });
  const guard = new AuthGuard(jwt);
  const payload: JwtPayload = { sub: 1, email: 'a@b.c', role: UserRole.ADMIN };

  function contextWith(authorization?: string) {
    const request: { headers: Record<string, string>; user?: JwtPayload } = {
      headers: authorization ? { authorization } : {},
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('accepts a valid bearer token and exposes its payload as request.user', async () => {
    const { context, request } = contextWith(
      `Bearer ${await jwt.signAsync(payload)}`,
    );
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject(payload);
  });

  it.each([
    ['no header', undefined],
    ['a non-bearer scheme', 'Basic abc'],
    ['an empty token', 'Bearer '],
    ['a malformed token', 'Bearer not-a-jwt'],
  ])('rejects %s', async (_case, header) => {
    await expect(
      guard.canActivate(contextWith(header).context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'other' }).signAsync(payload);
    await expect(
      guard.canActivate(contextWith(`Bearer ${forged}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync(payload, { expiresIn: -1 });
    await expect(
      guard.canActivate(contextWith(`Bearer ${expired}`).context),
    ).rejects.toThrow(UnauthorizedException);
  });
});
