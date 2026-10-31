import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';

// Requires a valid bearer token, then applies any @Roles() restriction.
export const Auth = () =>
  applyDecorators(
    UseGuards(AuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, invalid or expired token',
      type: ErrorResponseDto,
    }),
  );
