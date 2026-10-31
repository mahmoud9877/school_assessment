import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from '../auth/dto/register.dto.js';
import { CreateClassDto } from '../classes/dto/create-class.dto.js';
import { UpdateStudentDto } from '../students/dto/update-student.dto.js';

// Mirrors the global ValidationPipe options in app.setup.ts.
function invalidFields(cls: new () => object, body: object) {
  return validateSync(plainToInstance(cls, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((error) => error.property);
}

describe('DTO validation', () => {
  describe('RegisterDto', () => {
    const valid = {
      name: '  Laila  ',
      email: '  Laila@School.TEST ',
      password: 'long-enough',
      confirmPassword: 'long-enough',
    };

    it('accepts a valid body and normalises name and email', () => {
      expect(invalidFields(RegisterDto, valid)).toEqual([]);
      const dto = plainToInstance(RegisterDto, valid);
      expect(dto.name).toBe('Laila');
      expect(dto.email).toBe('laila@school.test');
    });

    it.each([
      ['confirmPassword', { confirmPassword: 'different' }],
      ['password', { password: 'short', confirmPassword: 'short' }],
      ['email', { email: 'not-an-email' }],
      ['role', { role: 'admin' }],
      ['name', { name: '   ' }],
    ])('rejects an invalid %s', (field, override) => {
      expect(invalidFields(RegisterDto, { ...valid, ...override })).toContain(
        field,
      );
    });

    it('rejects unknown fields', () => {
      expect(invalidFields(RegisterDto, { ...valid, isAdmin: true })).toContain(
        'isAdmin',
      );
    });
  });

  describe('CreateClassDto', () => {
    const valid = { name: 'Math', capacity: 30, teacherId: 1 };

    it.each([
      ['capacity', { capacity: 0 }],
      ['capacity', { capacity: 1.5 }],
      ['capacity', { capacity: 10_000 }],
      ['teacherId', { teacherId: -1 }],
      ['name', { name: '' }],
    ])('rejects an invalid %s', (field, override) => {
      expect(invalidFields(CreateClassDto, { ...valid, ...override })).toEqual([
        field,
      ]);
    });
  });

  it('UpdateStudentDto does not allow changing userId', () => {
    expect(invalidFields(UpdateStudentDto, { userId: 2 })).toEqual(['userId']);
    expect(invalidFields(UpdateStudentDto, { classId: 2 })).toEqual([]);
  });
});
