-- Class names are unique so CSV imports can refer to a class by name.
CREATE UNIQUE INDEX "Class_name_key" ON "Class"("name");
