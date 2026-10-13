CREATE TABLE "terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" jsonb NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terms_tenant_start_idx" ON "terms" USING btree ("tenant_id","starts_on");--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "term_id" uuid;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_groups_term_idx" ON "class_groups" USING btree ("term_id");--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "ended_on" date;--> statement-breakpoint
DROP INDEX IF EXISTS "enrollment_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_open_uq" ON "enrollments" USING btree ("class_group_id","student_id") WHERE status IN ('active', 'waitlist', 'paused');--> statement-breakpoint
CREATE INDEX "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
