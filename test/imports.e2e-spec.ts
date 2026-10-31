import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, login } from './helpers.js';

describe('CSV import (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let auth: { Authorization: string };

  const upload = (type: string, lines: string[], filename = `${type}.csv`) =>
    http()
      .post(`/import/${type}`)
      .set(auth)
      .attach('file', Buffer.from(lines.join('\n')), filename);

  const counts = async () => ({
    users: await prisma.user.count(),
    teachers: await prisma.teacher.count(),
    classes: await prisma.class.count(),
    students: await prisma.student.count(),
  });

  beforeAll(async () => {
    ({ app, prisma, http } = await createTestApp());
    auth = { Authorization: `Bearer ${await login(app, 'admin')}` };
  });
  afterAll(() => app.close());

  it('imports teachers, then their classes, then students into those classes', async () => {
    await upload('teachers', [
      'name,email',
      'Hana Teacher,hana@school.test',
      'Karim Teacher,KARIM@school.test',
    ]).expect(201, { imported: 2 });

    await upload('classes', [
      'name,capacity,teacherEmail',
      'Art 101,2,hana@school.test',
      'Music 101,10,karim@school.test',
    ]).expect(201, { imported: 2 });

    await upload('students', [
      'name,email,className',
      'Rana,rana@school.test,Art 101',
      'Tarek,tarek@school.test,Art 101',
      'Zein,zein@school.test,Music 101',
    ]).expect(201, { imported: 3 });

    const art = await prisma.class.findUniqueOrThrow({
      where: { name: 'Art 101' },
      include: {
        teacher: { include: { user: true } },
        students: { include: { user: true } },
      },
    });
    expect(art.teacher.user).toMatchObject({
      email: 'hana@school.test',
      role: 'TEACHER',
    });
    expect(art.students.map((s) => s.user.email).sort()).toEqual([
      'rana@school.test',
      'tarek@school.test',
    ]);
    expect(art.students.every((s) => s.user.role === 'STUDENT')).toBe(true);
  });

  it('creates imported accounts that cannot log in (no password in CSV)', async () => {
    for (const password of ['', '!', 'password']) {
      await http()
        .post('/auth/login')
        .send({ email: 'hana@school.test', password })
        .expect((res) => {
          expect([400, 401]).toContain(res.status);
        });
    }
  });

  it('is all-or-nothing: one bad row rejects the file and lists every error', async () => {
    const before = await counts();
    const res = await upload('students', [
      'name,email,className',
      'Ok Student,ok@school.test,Math 101',
      'Bad Email,not-an-email,Math 101',
      'Ali Again,ali.student@school.test,Math 101',
      'Late,late@school.test,Art 101',
      'Nobody,nobody@school.test,No Such Class',
    ]).expect(400);

    expect(res.body.message).toContain('nothing was imported');
    expect(res.body.errors).toEqual([
      { line: 3, message: 'email must be an email' },
      {
        line: 4,
        message: 'Email ali.student@school.test already has an account',
      },
      { line: 5, message: 'Class "Art 101" is full (capacity 2)' },
      { line: 6, message: 'No class named "No Such Class"' },
    ]);
    expect(await counts()).toEqual(before);
  });

  it('rejects classes for unknown teachers and duplicate names', async () => {
    const res = await upload('classes', [
      'name,capacity,teacherEmail',
      'Math 101,5,hana@school.test',
      'Drama,0,hana@school.test',
      'Drama 2,5,ali.student@school.test',
    ]).expect(400);
    expect(res.body.errors.map((e: { line: number }) => e.line)).toEqual([
      2, 3, 4,
    ]);
  });

  it.each([
    ['no file', undefined, undefined, 'Upload a CSV file in the "file" field'],
    [
      'a non-CSV file name',
      'name,email\nA,a@b.c',
      'teachers.txt',
      'File must have a .csv extension',
    ],
  ])('rejects %s', async (_case, content, filename, message) => {
    const req = http().post('/import/teachers').set(auth);
    const res = await (
      content ? req.attach('file', Buffer.from(content), filename!) : req
    ).expect(400);
    expect(res.body.message).toBe(message);
  });

  it('rejects a wrong header', async () => {
    const res = await upload('teachers', [
      'name,email,role',
      'Eve,eve@school.test,ADMIN',
    ]).expect(400);
    expect(res.body.errors[0].message).toContain(
      'Header must be exactly: name,email',
    );
  });

  it('rejects files over 1 MB', async () => {
    const big = 'name,email\n' + 'x'.repeat(1024 * 1024 + 1);
    await http()
      .post('/import/teachers')
      .set(auth)
      .attach('file', Buffer.from(big), 'big.csv')
      .expect(413);
  });
});
