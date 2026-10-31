import { ArgumentsHost, Catch, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

// Safety net for database errors that slip past the services' own checks
// (e.g. two requests racing on a unique column): answer with a proper HTTP
// status instead of a 500. Anything unrecognised falls through to Nest.
const STATUS_BY_CODE: Record<string, [HttpStatus, string]> = {
  P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
  P2003: [HttpStatus.CONFLICT, 'Operation violates a relation constraint'],
  P2004: [HttpStatus.BAD_REQUEST, 'Operation violates a database constraint'],
  P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const mapped = STATUS_BY_CODE[exception.code];
    if (!mapped) {
      return super.catch(exception, host);
    }
    const [statusCode, message] = mapped;
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(statusCode)
      .json({ statusCode, message, error: HttpStatus[statusCode] });
  }
}
