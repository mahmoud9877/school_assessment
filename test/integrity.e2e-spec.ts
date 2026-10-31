import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, login } from './helpers.js';

describe('Data integrity (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let auth: { Authorization: string };

  // Creates a user through the API and returns its id.
  async function createUser(email: string, role: string) {
    const res = await http()
      .post('/auth/register')
      .set(auth)
      .send({
        name: email,
        email,
        password: 'a-long-password',
        confirmPassword: 'a-long-password',
        role,
      })
      .expect(201);
    return res.body.id as number;
  }

  let classCounter = 0;
  async function createClass(capacity: number, teacherId = 1) {
    const res = await http()
      .post('/classes')
      .set(auth)
      .send({ name: `Test class ${++classCounter}`, capacity, teacherId })
      .expect(201);
    return res.body.id as number;
  }

  beforeAll(async () => {
    ({ app, prisma, http } = await createTestApp());
    auth = { Authorization: `Bearer ${await login(app, 'admin')}` };
  });
  afterAll(() => app.close());

  describe('class capacity', () => {
    it('refuses to enrol a student into a full class', async () => {
      const classId = await createClass(1);
      const first = await createUser('cap1@school.test', 'STUDENT');
      const second = await createUser('cap2@school.test', 'STUDENT');

      await http()
        .post('/students')
        .set(auth)
        .send({ userId: first, classId })
        .expect(201);
      const res = await http()
        .post('/students')
        .set(auth)
        .send({ userId: second, classId })
        .expect(409);
      expect(res.body.message).toBe(`Class #${classId} is full (capacity 1)`);
    });

    it('never overfills a class under concurrent enrolments', async () => {
      const classId = await createClass(1);
      const userIds = await Promise.all(
        [1, 2, 3, 4, 5].map((n) =>
          createUser(`race${n}@school.test`, 'STUDENT'),
        ),
      );

      const statuses = (
        await Promise.all(
          userIds.map((userId) =>
            http().post('/students').set(auth).send({ userId, classId }),
          ),
        )
      ).map((res) => res.status);

      expect(statuses.filter((s) => s === 201)).toHaveLength(1);
      expect(statuses.filter((s) => s === 409)).toHaveLength(4);
      expect(await prisma.student.count({ where: { classId } })).toBe(1);
    });

    it('refuses to move a student into a full class', async () => {
      const fullClass = await createClass(1);
      const userId = await createUser('mover@school.test', 'STUDENT');
      await http()
        .post('/students')
        .set(auth)
        .send({ userId, classId: fullClass })
        .expect(201);

      // Seeded student #1 tries to move into the full class.
      await http()
        .patch('/students/1')
        .set(auth)
        .send({ classId: fullClass })
        .expect(409);
    });

    it('refuses to lower capacity below current enrolment', async () => {
      // Seeded Math 101 (#1) has 2 students.
      await http()
        .patch('/classes/1')
        .set(auth)
        .send({ capacity: 1 })
        .expect(409);
      const res = await http()
        .patch('/classes/1')
        .set(auth)
        .send({ capacity: 2 })
        .expect(200);
      expect(res.body).toMatchObject({ capacity: 2, studentCount: 2 });
    });
  });

  describe('roles and relations', () => {
    it('only a STUDENT user can be enrolled, and only once', async () => {
      const teacherUser = await createUser('t.user@school.test', 'TEACHER');
      await http()
        .post('/students')
        .set(auth)
        .send({ userId: teacherUser, classId: 1 })
        .expect(400);
      // Seeded student user (ali) is already enrolled.
      const ali = await prisma.user.findUniqueOrThrow({
        where: { email: 'ali.student@school.test' },
      });
      await http()
        .post('/students')
        .set(auth)
        .send({ userId: ali.id, classId: 2 })
        .expect(409);
    });

    it('only a TEACHER user can become a teacher, and only once', async () => {
      const studentUser = await createUser('s.user@school.test', 'STUDENT');
      await http()
        .post('/teachers')
        .set(auth)
        .send({ userId: studentUser })
        .expect(400);

      const teacherUser = await createUser(
        'new.teacher@school.test',
        'TEACHER',
      );
      await http()
        .post('/teachers')
        .set(auth)
        .send({ userId: teacherUser })
        .expect(201);
      await http()
        .post('/teachers')
        .set(auth)
        .send({ userId: teacherUser })
        .expect(409);
    });

    it('rejects a duplicate class name, also when renaming', async () => {
      await http()
        .post('/classes')
        .set(auth)
        .send({ name: 'Math 101', capacity: 5, teacherId: 1 })
        .expect(409);
      await http()
        .patch('/classes/2')
        .set(auth)
        .send({ name: 'Math 101' })
        .expect(409);
      await http()
        .patch('/classes/1')
        .set(auth)
        .send({ name: 'Math 101' })
        .expect(200);
    });

    it('returns 404 for references that do not exist', async () => {
      await http()
        .post('/classes')
        .set(auth)
        .send({ name: 'X', capacity: 5, teacherId: 9999 })
        .expect(404);
      const userId = await createUser('orphan@school.test', 'STUDENT');
      await http()
        .post('/students')
        .set(auth)
        .send({ userId, classId: 9999 })
        .expect(404);
      await http().get('/classes/9999').set(auth).expect(404);
    });

    it('refuses to delete a teacher with classes or a class with students', async () => {
      await http().delete('/teachers/1').set(auth).expect(409);
      await http().delete('/classes/1').set(auth).expect(409);
    });

    it('deletes an empty class, then its teacher', async () => {
      const teacherUser = await createUser('leaving@school.test', 'TEACHER');
      const teacher = await http()
        .post('/teachers')
        .set(auth)
        .send({ userId: teacherUser })
        .expect(201);
      const classId = await createClass(3, teacher.body.id);

      await http().delete(`/teachers/${teacher.body.id}`).set(auth).expect(409);
      await http().delete(`/classes/${classId}`).set(auth).expect(204);
      await http().delete(`/teachers/${teacher.body.id}`).set(auth).expect(204);
      await http().get(`/teachers/${teacher.body.id}`).set(auth).expect(404);
    });
  });

  describe('input validation', () => {
    it.each([
      ['a non-integer id', 'get', '/classes/abc', undefined],
      [
        'zero capacity',
        'post',
        '/classes',
        { name: 'X', capacity: 0, teacherId: 1 },
      ],
      [
        'a string capacity',
        'post',
        '/classes',
        { name: 'X', capacity: '10', teacherId: 1 },
      ],
      ['a missing field', 'post', '/students', { userId: 1 }],
      ['an unknown field', 'patch', '/classes/1', { name: 'X', secret: true }],
      ['changing a student userId', 'patch', '/students/1', { userId: 2 }],
    ] as const)('rejects %s with 400', async (_case, method, path, body) => {
      await http()[method](path).set(auth).send(body).expect(400);
    });
  });

  describe('database constraints (defence in depth)', () => {
    it('rejects a non-positive capacity written directly to the database', async () => {
      await expect(
        prisma.class.create({
          data: { name: 'Bad', capacity: 0, teacherId: 1 },
        }),
      ).rejects.toThrow();
    });

    it('rejects a blank class name written directly to the database', async () => {
      await expect(
        prisma.class.create({
          data: { name: '   ', capacity: 5, teacherId: 1 },
        }),
      ).rejects.toThrow();
    });
  });
});
