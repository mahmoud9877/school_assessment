import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../generated/prisma/enums.js';
import { ROLES_KEY } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

function contextFor(user?: { role: UserRole }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);
  const requireRoles = (roles?: UserRole[]) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);

  afterEach(() => vi.restoreAllMocks());

  it('allows any authenticated user when the route has no @Roles', () => {
    requireRoles(undefined);
    expect(guard.canActivate(contextFor({ role: UserRole.STUDENT }))).toBe(
      true,
    );
  });

  it('allows a user whose role is listed', () => {
    requireRoles([UserRole.ADMIN, UserRole.OPERATOR]);
    expect(guard.canActivate(contextFor({ role: UserRole.OPERATOR }))).toBe(
      true,
    );
  });

  it.each([UserRole.TEACHER, UserRole.STUDENT])(
    'rejects %s on an admin/operator route',
    (role) => {
      requireRoles([UserRole.ADMIN, UserRole.OPERATOR]);
      expect(guard.canActivate(contextFor({ role }))).toBe(false);
    },
  );

  it('rejects when no user is on the request', () => {
    requireRoles([UserRole.ADMIN]);
    expect(guard.canActivate(contextFor(undefined))).toBe(false);
  });

  it('reads method metadata before controller metadata', () => {
    const spy = requireRoles([UserRole.ADMIN]);
    guard.canActivate(contextFor({ role: UserRole.ADMIN }));
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, [undefined, undefined]);
  });
});
