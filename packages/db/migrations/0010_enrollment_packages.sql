ALTER TABLE "enrollments" ADD COLUMN "planned_sessions" smallint DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "term_started_on" date;
