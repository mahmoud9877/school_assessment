import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { UserRole } from '../generated/prisma/enums.js';

export const ROLES_KEY = 'roles';

// Restricts a route (or a whole controller) to the given roles and documents
// the restriction in Swagger. Takes effect under @Auth(), which runs RolesGuard.
export const Roles = (...roles: UserRole[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiForbiddenResponse({
      description: `Allowed roles: ${roles.join(', ')}`,
      type: ErrorResponseDto,
    }),
  );
