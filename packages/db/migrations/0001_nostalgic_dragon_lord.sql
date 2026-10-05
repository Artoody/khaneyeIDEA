ALTER TABLE "otp_codes" ADD COLUMN "ip" text;--> statement-breakpoint
CREATE INDEX "otp_ip_idx" ON "otp_codes" USING btree ("ip","created_at");