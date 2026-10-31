import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '../generated/prisma/enums.js';
import type { JwtPayload } from './jwt-payload.interface.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // A method-level @Roles() overrides the controller-level one.
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) {
      return true;
    }

    // request.user is set by AuthGuard, which must run before this guard.
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    return !!user && roles.includes(user.role);
  }
}
