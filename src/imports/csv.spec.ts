import { BadRequestException } from '@nestjs/common';
import { MAX_IMPORT_ROWS, parseCsv } from './csv.js';

const csv = (text: string) => Buffer.from(text);
const columns = ['name', 'email'] as const;

function rowErrors(text: string) {
  try {
    parseCsv(csv(text), columns);
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (
      (error as BadRequestException).getResponse() as { errors: unknown[] }
    ).errors;
  }
  throw new Error('expected parseCsv to throw');
}

describe('parseCsv', () => {
  it('maps columns by header, trims values and reports line numbers', () => {
    const rows = parseCsv(
      csv('﻿ Email , NAME\n a@b.c , Ann \n\n"x@y.z","Smith, Jo"\n'),
      columns,
    );
    expect(rows).toEqual([
      { line: 2, values: { email: 'a@b.c', name: 'Ann' } },
      { line: 4, values: { email: 'x@y.z', name: 'Smith, Jo' } },
    ]);
  });

  it.each([
    ['an empty file', '', 'File is empty'],
    ['a header-only file', 'name,email\n', 'File has no data rows'],
    ['a missing column', 'name\nAnn\n', 'Header must be exactly: name,email'],
    [
      'an extra column',
      'name,email,role\nAnn,a@b.c,ADMIN\n',
      'Header must be exactly',
    ],
    ['a repeated column', 'name,name\nAnn,Bo\n', 'Header must be exactly'],
  ])('rejects %s', (_case, text, message) => {
    expect(rowErrors(text)).toEqual([
      expect.objectContaining({ message: expect.stringContaining(message) }),
    ]);
  });

  it('rejects a row with the wrong number of values', () => {
    expect(rowErrors('name,email\nAnn,a@b.c,extra\n')).toHaveLength(1);
  });

  it(`rejects more than ${MAX_IMPORT_ROWS} rows`, () => {
    const body = Array.from(
      { length: MAX_IMPORT_ROWS + 1 },
      (_, i) => `n${i},e${i}@x.y`,
    );
    expect(rowErrors(`name,email\n${body.join('\n')}`)[0]).toMatchObject({
      message: expect.stringContaining(`At most ${MAX_IMPORT_ROWS} rows`),
    });
  });
});
