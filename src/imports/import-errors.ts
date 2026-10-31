import { BadRequestException } from '@nestjs/common';

export interface RowError {
  line: number;
  message: string;
}

// Collects problems from every row so the client gets the full list in one
// response, then rejects the whole file if there are any.
export class ImportErrors {
  private readonly errors: RowError[] = [];

  add(line: number, message: string) {
    this.errors.push({ line, message });
  }

  throwIfAny() {
    if (this.errors.length > 0) {
      throw importFailed(this.errors);
    }
  }
}

export function importFailed(errors: RowError[]) {
  const sorted = [...errors].sort((a, b) => a.line - b.line);
  return new BadRequestException({
    statusCode: 400,
    message: `CSV import failed with ${sorted.length} error(s); nothing was imported`,
    error: 'Bad Request',
    errors: sorted,
  });
}
