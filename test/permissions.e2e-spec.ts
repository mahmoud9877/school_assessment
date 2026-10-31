import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { createTestApp, type DemoRole, login } from './helpers.js';

// Admin: everything. Operator: read, create, update. Teacher/Student: read.
const ALLOWED = 'allowed';
const DENIED = 403;

const roles: DemoRole[] = ['admin', 'operator', 'teacher', 'student'];

type Case = {
  method: 'get' | 'post' | 'patch' | 'delete';
  path: string;
  // Body that would succeed, so "allowed" means the action really happens.
  // A function gives each role its own body (e.g. a unique class name).
  body?: object | ((role: DemoRole) => object);
  expect: Record<DemoRole, typeof ALLOWED | typeof DENIED>;
};

const read = {
  admin: ALLOWED,
  operator: ALLOWED,
  teacher: ALLOWED,
  student: ALLOWED,
} as const;
const write = {
  admin: ALLOWED,
  operator: ALLOWED,
  teacher: DENIED,
  student: DENIED,
} as const;
const adminOnly = {
  admin: ALLOWED,
  operator: DENIED,
  teacher: DENIED,
  student: DENIED,
} as const;
const staffOnly = write;

const cases: Case[] = [
  { method: 'get', path: '/teachers', expect: read },
  { method: 'get', path: '/teachers/1', expect: read },
  { method: 'get', path: '/classes', expect: read },
  { method: 'get', path: '/classes/1', expect: read },
  { method: 'get', path: '/students', expect: read },
  { method: 'get', path: '/students/1', expect: read },
  {
    method: 'post',
    path: '/classes',
    body: (role) => ({ name: `Art (${role})`, capacity: 5, teacherId: 1 }),
    expect: write,
  },
  {
    method: 'patch',
    path: '/classes/1',
    body: { name: 'Math 101 (renamed)' },
    expect: write,
  },
  { method: 'patch', path: '/students/1', body: { classId: 2 }, expect: write },
  { method: 'delete', path: '/students/4', expect: adminOnly },
  { method: 'get', path: '/users', expect: staffOnly },
  { method: 'get', path: '/users/1', expect: staffOnly },
];

describe('Permissions (e2e)', () => {
  let app: INestApplication<App>;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  const tokens = {} as Record<DemoRole, string>;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    for (const role of roles) {
      tokens[role] = await login(app, role);
    }
  });
  afterAll(() => app.close());

  // Denied roles are checked first so the allowed call (which may change data,
  // e.g. a delete) never affects the outcome for another role.
  describe.each(cases)(
    '$method $path',
    ({ method, path, body, expect: rules }) => {
      const ordered = [...roles].sort((a, b) =>
        rules[a] === rules[b] ? 0 : rules[a] === DENIED ? -1 : 1,
      );

      it('returns 401 without a token', async () => {
        await http()
          [method](path)
          .send(typeof body === 'function' ? body('admin') : body)
          .expect(401);
      });

      it.each(ordered)('%s', async (role) => {
        const res = await http()
          [method](path)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .send(typeof body === 'function' ? body(role) : body);
        if (rules[role] === DENIED) {
          expect(res.status).toBe(403);
        } else {
          expect(res.status).toBeLessThan(300);
        }
      });
    },
  );

  it('only an admin can delete, even when the operator tries first', async () => {
    await http()
      .delete('/classes/2')
      .set('Authorization', `Bearer ${tokens.operator}`)
      .expect(403);
    // Class 2 still has students, so the admin's delete is refused for integrity.
    await http()
      .delete('/classes/2')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .expect(409);
  });

  it.each(['teachers', 'classes', 'students'])(
    'only an admin can import %s',
    async (type) => {
      for (const role of ['operator', 'teacher', 'student'] as const) {
        await http()
          .post(`/import/${type}`)
          .set('Authorization', `Bearer ${tokens[role]}`)
          .attach('file', Buffer.from('a,b\n1,2\n'), 'x.csv')
          .expect(403);
      }
      await http()
        .post(`/import/${type}`)
        .attach('file', Buffer.from('a,b\n1,2\n'), 'x.csv')
        .expect(401);
    },
  );

  it('only an admin can create accounts', async () => {
    const body = {
      name: 'X',
      email: 'x@school.test',
      password: 'a-long-password',
      confirmPassword: 'a-long-password',
    };
    for (const role of ['operator', 'teacher', 'student'] as const) {
      await http()
        .post('/auth/register')
        .set('Authorization', `Bearer ${tokens[role]}`)
        .send(body)
        .expect(403);
    }
  });
});
