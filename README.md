# School Assessment API

NestJS + Prisma (PostgreSQL) API that manages teachers, classes and students.

- Each class has exactly one teacher and a limited capacity.
- Each student belongs to exactly one class.
- Every user has one role: `ADMIN`, `OPERATOR`, `TEACHER` or `STUDENT`.

## Setup

Requires Node 20+ and PostgreSQL.

```bash
npm install                   # also generates the Prisma client
cp .env.example .env          # then fill in every value (see below)
npm run db:setup              # apply all migrations, then seed demo data
npm run start:dev             # http://localhost:3000
```

- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/openapi.json

To try a protected endpoint in Swagger UI: call `POST /auth/login` with a demo
account, copy `accessToken`, click **Authorize** and paste it.

## Architecture

Each module (`auth`, `users`, `teachers`, `classes`, `students`) is split into
three layers:

| Layer | File | Responsibility |
|---|---|---|
| Request handling | `*.controller.ts` | Routes, guards, input DTOs, Swagger docs. No logic. |
| Business logic | `*.service.ts` | Rules (capacity, roles, delete restrictions) and HTTP errors. Never calls Prisma. |
| Persistence | `*.repository.ts` | The only code that queries the database. |

Services that must change several records atomically use `TransactionService`
and pass its transaction handle to the repositories.

## Validation and data integrity

- **Input:** every body is validated by DTOs (`class-validator`); unknown
  fields are rejected; ids must be integers. Emails are trimmed and
  lower-cased.
- **Class capacity:** enrolling or moving a student locks the class row
  (`SELECT … FOR UPDATE`) in the same transaction as the count and insert, so
  concurrent requests cannot overfill a class. Capacity cannot be lowered below
  the current enrolment.
- **Roles match records:** only a `TEACHER` user can become a teacher and only a
  `STUDENT` user can become a student, each at most once.
- **Unique class names** (also enforced by a unique index).
- **Safe deletes:** a class with students, or a teacher with classes, cannot be
  deleted (`409`).
- **Database constraints** back these up: foreign keys, unique `email` /
  `userId`, and `CHECK` constraints (positive capacity, non-blank names,
  lower-case emails) in `prisma/migrations`.
- Database errors that slip through (e.g. a race on a unique email) are mapped
  to `404`/`409` instead of `500`.

## Authentication

**Approach: email + password login that returns a short-lived JWT access token.**

```http
POST /auth/login
Content-Type: application/json

{ "email": "admin@school.test", "password": "<from .env>" }
```

The response contains `accessToken`. Send it on every other request:

```http
Authorization: Bearer <accessToken>
```

Why this approach:

- **Stateless JWT (`@nestjs/jwt`).** The API is consumed by clients, not a
  server-rendered site, so a bearer token is simpler than cookies and sessions
  and needs no session store. The token carries the user's id, email and role,
  so permission checks need no database lookup.
- **Short expiry (`JWT_EXPIRES_IN`, default `1h`).** A stolen token is only
  useful for a limited time. There is no refresh token; clients log in again.
  A role change takes effect at the user's next login.
- **Passwords hashed with bcrypt.** Plain-text passwords are never stored or
  returned; every user response omits the `password` field.
- **Login is rate-limited** to 5 attempts per IP per minute (HTTP 429 after
  that) to slow down password guessing. Wrong email and wrong password return
  the same `401 Invalid credentials`, so the API does not reveal which emails
  exist.
- **No public sign-up.** `POST /auth/register` is admin-only and lets the admin
  choose the new account's role. Open sign-up would let anyone get read access
  to every record, or make themselves an admin.
- **Input is validated** on every request (`class-validator`); unknown fields
  are rejected.

## Permissions

Enforced on the server by two guards on every protected route:
`AuthGuard` (is the token valid?) then `RolesGuard` (is the role allowed?),
configured per route with `@Roles(...)`.

| Action | Admin | Operator | Teacher | Student |
|---|:-:|:-:|:-:|:-:|
| Read teachers, classes, students | ✅ | ✅ | ✅ | ✅ |
| Create / update teachers, classes, students | ✅ | ✅ | ❌ | ❌ |
| Delete teachers, classes, students | ✅ | ❌ | ❌ | ❌ |
| List users (`GET /users`) | ✅ | ✅ | ❌ | ❌ |
| Create accounts (`POST /auth/register`) | ✅ | ❌ | ❌ | ❌ |
| CSV import | ✅ | ❌ | ❌ | ❌ |

Missing or invalid token → `401`. Valid token but role not allowed → `403`.

## CSV import (admin only)

Upload a CSV file as multipart field `file` (max 1 MB, 1000 rows). Import in
this order, because later files refer to earlier ones:

| Endpoint | Header | Each row creates |
|---|---|---|
| `POST /import/teachers` | `name,email` | A TEACHER account and its teacher record |
| `POST /import/classes` | `name,capacity,teacherEmail` | A class taught by an existing teacher |
| `POST /import/students` | `name,email,className` | A STUDENT account enrolled in an existing class |

Example `students.csv`:

```csv
name,email,className
Rana Student,rana@school.test,Math 101
Tarek Student,tarek@school.test,Science 101
```

- **All or nothing.** Every row is validated first (format, duplicate emails
  or class names in the file, emails that already have accounts, unknown
  teachers or classes, class capacity including students already enrolled).
  If anything is wrong, nothing is imported and the `400` response lists every
  error by line number.
- Header columns may be in any order; case, spaces and blank lines are ignored.
- **No passwords in CSV files.** Imported accounts are created unable to log
  in until a password is set for them.
- Class names are unique, so students can refer to a class by name.



`npm run db:seed` creates one or more accounts for every role:

| Role | Email | Password variable in `.env` |
|---|---|---|
| Admin | `admin@school.test` | `SEED_ADMIN_PASSWORD` |
| Operator | `operator@school.test` | `SEED_OPERATOR_PASSWORD` |
| Teacher | `sara.teacher@school.test`, `omar.teacher@school.test` | `SEED_TEACHER_PASSWORD` |
| Student | `ali.student@school.test`, `mona.student@school.test`, `youssef.student@school.test`, `nour.student@school.test` | `SEED_STUDENT_PASSWORD` |

It also creates two classes (Math 101 and Science 101, one per teacher) with
two students each.

How the credentials are kept secure:

- **No password is in the source code or git.** Each role's password is read
  from `.env`, which is git-ignored. `.env.example` lists the variables with
  empty values.
- **One password per role**, at least 12 characters; the seeder refuses to run
  without them.
- **Stored only as bcrypt hashes.**
- **Easy to rotate:** change the value in `.env` and run `npm run db:seed`
  again. The seeder is safe to re-run; it updates the existing accounts instead
  of creating duplicates.
- Share demo passwords with reviewers through a private channel, never in the
  repository, an issue or a chat log.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign tokens. Long and random; the app will not start without it |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `1h` (default) |
| `SEED_*_PASSWORD` | Demo account passwords for the seeder |

## Scripts

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with auto-reload |
| `npm run build` / `npm run start:prod` | Production build / run |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (uses a separate `_test` database) |
| `npm run db:setup` | Apply migrations and seed (fresh database) |
| `npm run db:seed` | Seed demo accounts and sample data |
| `npx prisma migrate dev` | Create/apply a migration after a schema change |

## Tests

- **Unit (`npm test`):** guards, auth (hashing, token contents, identical
  errors for unknown email and wrong password), every business rule in the
  services with in-memory fakes, and DTO validation.
- **End-to-end (`npm run test:e2e`):** boots the real app against a real
  PostgreSQL database and covers login and rate limiting, the full permission
  matrix for every role, capacity enforcement including concurrent
  enrolments, integrity rules, validation, and the database constraints. The
  docs test calls every documented endpoint and checks that the real status
  code and response body match `/openapi.json`.

The e2e suite uses `TEST_DATABASE_URL`, or `DATABASE_URL` with `_test` added
to the database name, and refuses to run against a database whose name does
not end in `_test`, because it empties all tables. It creates and migrates
that database itself, and generates a random JWT secret and demo passwords
for each run.
# school_assessment
