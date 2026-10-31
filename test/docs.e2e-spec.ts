import { INestApplication } from '@nestjs/common';
import Ajv, { type AnySchema } from 'ajv';
import addFormats from 'ajv-formats';
import type { App } from 'supertest/types.js';
import { createTestApp, DEMO, login, passwordOf } from './helpers.js';

type Operation = {
  security?: unknown[];
  responses: Record<
    string,
    { content?: { 'application/json'?: { schema: AnySchema } } }
  >;
};
type OpenApi = {
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, Record<string, unknown>>;
    securitySchemes: object;
  };
};

// Rewrites local $refs so Ajv can resolve them against the registered document.
function rebase(schema: unknown): unknown {
  return JSON.parse(
    JSON.stringify(schema).replaceAll(
      '"#/components/',
      '"openapi#/components/',
    ),
  );
}

describe('API documentation (e2e)', () => {
  let app: INestApplication<App>;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let doc: OpenApi;
  let ajv: Ajv;

  beforeAll(async () => {
    ({ app, http } = await createTestApp());
    doc = (await http().get('/openapi.json').expect(200)).body;

    // Strict copy: any field the API returns but the docs do not declare
    // (e.g. a leaked password hash) fails validation.
    const schemas = structuredClone(doc.components.schemas);
    for (const schema of Object.values(schemas)) {
      if (schema.type === 'object') schema.additionalProperties = false;
    }
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats.default(ajv);
    ajv.addSchema({ $id: 'openapi', components: { schemas } });
  });
  afterAll(() => app.close());

  // Asserts the response status is documented for the operation and the body
  // matches the documented schema for that status.
  function expectDocumented(
    method: string,
    path: string,
    res: { status: number; body: unknown },
  ) {
    const op = doc.paths[path]?.[method];
    expect(
      op,
      `${method.toUpperCase()} ${path} is not documented`,
    ).toBeDefined();
    const documented = op.responses[String(res.status)];
    expect(
      documented,
      `${method.toUpperCase()} ${path} returned undocumented ${res.status}`,
    ).toBeDefined();
    const schema = documented.content?.['application/json']?.schema;
    if (schema) {
      const valid = ajv.validate(rebase(schema) as AnySchema, res.body);
      expect(
        valid,
        `${method.toUpperCase()} ${path} ${res.status}: ${ajv.errorsText()}`,
      ).toBe(true);
    }
  }

  it('serves Swagger UI at /docs', async () => {
    const res = await http().get('/docs').expect(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('declares bearer authentication on every endpoint except login', () => {
    expect(doc.components.securitySchemes).toHaveProperty('bearer');
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const isLogin = path === '/auth/login';
        expect(Boolean(op.security), `${method} ${path}`).toBe(!isLogin);
      }
    }
  });

  it('documents the status every endpoint really returns without a token', async () => {
    for (const [path, ops] of Object.entries(doc.paths)) {
      for (const method of Object.keys(ops)) {
        const res = await http()
          [method as 'get'](path.replace('{id}', '1'))
          .send({});
        expectDocumented(method, path, res);
      }
    }
  });

  describe('responses match the documented schemas', () => {
    let auth: { Authorization: string };

    beforeAll(async () => {
      auth = { Authorization: `Bearer ${await login(app, 'admin')}` };
    });

    it('POST /auth/login', async () => {
      const res = await http()
        .post('/auth/login')
        .send({ email: DEMO.operator.email, password: passwordOf('operator') });
      expectDocumented('post', '/auth/login', res);
    });

    it.each([
      '/users',
      '/users/{id}',
      '/teachers',
      '/teachers/{id}',
      '/classes',
      '/classes/{id}',
      '/students',
      '/students/{id}',
    ])('GET %s', async (path) => {
      const res = await http().get(path.replace('{id}', '1')).set(auth);
      expect(res.status).toBe(200);
      expectDocumented('get', path, res);
    });

    it('write endpoints and their error responses', async () => {
      const calls: [string, string, string, object?][] = [
        [
          'post',
          '/auth/register',
          '/auth/register',
          {
            name: 'Doc User',
            email: 'doc@school.test',
            password: 'a-long-password',
            confirmPassword: 'a-long-password',
            role: 'TEACHER',
          },
        ],
        [
          'post',
          '/auth/register',
          '/auth/register',
          {
            name: 'Doc User',
            email: 'doc@school.test',
            password: 'a-long-password',
            confirmPassword: 'a-long-password',
          },
        ],
        ['post', '/teachers', '/teachers', { userId: 9 }],
        [
          'post',
          '/classes',
          '/classes',
          { name: 'Docs 101', capacity: 3, teacherId: 1 },
        ],
        ['patch', '/classes/{id}', '/classes/1', { capacity: 1 }],
        ['get', '/classes/{id}', '/classes/999', undefined],
        ['patch', '/students/{id}', '/students/1', { classId: 2 }],
        ['delete', '/students/{id}', '/students/1', undefined],
        ['delete', '/classes/{id}', '/classes/2', undefined],
        ['post', '/classes', '/classes', { capacity: -1 }],
      ];
      const statuses = [];
      for (const [method, docPath, url, body] of calls) {
        const res = await http()[method as 'post'](url).set(auth).send(body);
        statuses.push(res.status);
        expectDocumented(method, docPath, res);
      }
      // Sanity check that the calls covered success and error paths.
      expect(statuses).toEqual([
        201, 409, 201, 201, 409, 404, 200, 204, 409, 400,
      ]);
    });

    it('CSV import success and error responses', async () => {
      const uploads: [string, string, number][] = [
        [
          '/import/teachers',
          'name,email\nDoc Teacher,doc.teacher@school.test',
          201,
        ],
        [
          '/import/classes',
          'name,capacity,teacherEmail\nDocs 202,1,doc.teacher@school.test',
          201,
        ],
        [
          '/import/students',
          'name,email,className\nA,a@school.test,Docs 202\nB,b@school.test,Docs 202',
          400,
        ],
        ['/import/teachers', 'wrong,header\nx,y', 400],
      ];
      for (const [path, content, status] of uploads) {
        const res = await http()
          .post(path)
          .set(auth)
          .attach('file', Buffer.from(content), 'f.csv');
        expect(res.status).toBe(status);
        expectDocumented('post', path, res);
      }
    });
  });
});
