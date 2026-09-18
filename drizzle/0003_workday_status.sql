CREATE TYPE "public"."workday_status" AS ENUM('working', 'sick', 'leave', 'off');--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD COLUMN "status" "workday_status" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD COLUMN "recorded_by" integer;--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD CONSTRAINT "workday_overrides_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Carry the old boolean across: a day that was marked as working becomes
-- "working", anything else becomes a plain "off".
UPDATE "workday_overrides" SET "status" = CASE WHEN "is_working" THEN 'working'::"public"."workday_status" ELSE 'off'::"public"."workday_status" END;
