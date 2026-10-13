CREATE TYPE "public"."report_status" AS ENUM('draft', 'pending_approval', 'approved', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "group_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"chat_id" text NOT NULL,
	"message_id" text NOT NULL,
	"class_group_id" uuid,
	"teacher_id" uuid NOT NULL,
	"snippet" text,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone,
	"reminded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"endpoint" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"platform" text,
	"standalone" boolean DEFAULT false NOT NULL,
	"fail_count" integer DEFAULT 0 NOT NULL,
	"last_ok_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_failed_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "report_approval_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "eve_notice_hour" integer DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "eod_report_deadline_hour" integer DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "meeting_url" text;--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "ai_report_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN "eve_notice_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "raw_text" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "ai_text" text;--> statement-breakpoint
ALTER TABLE "homework" ADD COLUMN "voice_key" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "status" "report_status" DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "raw_text" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "voice_key" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "ai_text" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "final_text" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "group_mentions" ADD CONSTRAINT "group_mentions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_mentions" ADD CONSTRAINT "group_mentions_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_mentions" ADD CONSTRAINT "group_mentions_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_mentions_msg_uq" ON "group_mentions" USING btree ("channel","chat_id","message_id");--> statement-breakpoint
CREATE INDEX "group_mentions_open_idx" ON "group_mentions" USING btree ("teacher_id","answered_at");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_username_uq" ON "users" USING btree ("tenant_id","username");