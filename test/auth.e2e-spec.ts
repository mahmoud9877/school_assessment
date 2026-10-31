import { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { createTestApp, DEMO, login, passwordOf } from './helpers.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
  });
  afterAll(() => app.close());

  // Login is limited to 5 attempts per minute per IP, and each test file gets
  // a fresh limiter. This file uses exactly 5 attempts before the limit test.

  it('logs in a demo account and returns a token but never the password', async () => {
    const res = await http()
      .post('/auth/login')
      .send({ email: '  ADMIN@school.test ', password: passwordOf('admin') })
      .expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      email: DEMO.admin.email,
      role: 'ADMIN',
    });
    expect(res.body.user).not.toHaveProperty('password');
  });

  it('rejects a wrong password and an unknown email with the same 401', async () => {
    const wrongPassword = await http()
      .post('/auth/login')
      .send({ email: DEMO.admin.email, password: 'definitely-wrong' })
      .expect(401);
    const unknownEmail = await http()
      .post('/auth/login')
      .send({ email: 'nobody@school.test', password: 'definitely-wrong' })
      .expect(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('rejects requests without a token, or with a forged one', async () => {
    await http().get('/classes').expect(401);
    await http()
      .get('/classes')
      .set('Authorization', 'Bearer forged.token.value')
      .expect(401);
  });

  describe('POST /auth/register', () => {
    let adminToken: string;
    const newUser = {
      name: 'Laila Student',
      email: 'laila.student@school.test',
      password: 'a-long-password',
      confirmPassword: 'a-long-password',
    };

    beforeAll(async () => {
      adminToken = await login(app, 'admin');
    });

    it('lets an admin create an account, defaulting to STUDENT', async () => {
      const res = await http()
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUser)
        .expect(201);
      expect(res.body).toMatchObject({ email: newUser.email, role: 'STUDENT' });
      expect(res.body).not.toHaveProperty('password');
    });

    it('rejects a duplicate email', async () => {
      await http()
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...newUser, email: 'LAILA.student@school.test' })
        .expect(409);
    });

    it('rejects mismatched passwords and unknown fields', async () => {
      const res = await http()
        .post('/auth/register')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...newUser,
          email: 'x@school.test',
          confirmPassword: 'nope',
          isAdmin: true,
        })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'property isAdmin should not exist',
          'confirmPassword must match password',
        ]),
      );
    });

    it('lets the new account log in', async () => {
      await http()
        .post('/auth/login')
        .send({ email: newUser.email, password: newUser.password })
        .expect(200);
    });
  });

  it('rate-limits login after 5 attempts per minute', async () => {
    await http()
      .post('/auth/login')
      .send({ email: DEMO.admin.email, password: passwordOf('admin') })
      .expect(429);
  });
});
