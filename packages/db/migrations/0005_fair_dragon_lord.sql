CREATE TABLE "link_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "custom" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class_sessions" ADD COLUMN "original_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "link_codes" ADD CONSTRAINT "link_codes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "link_codes_code_uq" ON "link_codes" USING btree ("code");