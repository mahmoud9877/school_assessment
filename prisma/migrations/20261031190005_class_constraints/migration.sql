-- Integrity rules Prisma's schema language cannot express. The API checks
-- them too; these constraints protect against any other writer.

-- A class must have room for at least one student.
ALTER TABLE "Class" ADD CONSTRAINT "Class_capacity_positive" CHECK ("capacity" > 0);

-- Names must not be blank.
ALTER TABLE "Class" ADD CONSTRAINT "Class_name_not_blank" CHECK (length(trim("name")) > 0);
ALTER TABLE "User" ADD CONSTRAINT "User_name_not_blank" CHECK (length(trim("name")) > 0);

-- Emails are stored lower-cased, so uniqueness is effectively case-insensitive.
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" = lower("email"));
