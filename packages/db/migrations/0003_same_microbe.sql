CREATE TABLE "course_departments" (
	"course_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	CONSTRAINT "course_departments_course_id_department_id_pk" PRIMARY KEY("course_id","department_id")
);
--> statement-breakpoint
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;