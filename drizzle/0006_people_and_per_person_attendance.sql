ALTER TABLE "users" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD CONSTRAINT "workday_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Attendance used to belong to the household because there was only ever one
-- employee. Give every existing record to that person.
UPDATE "workday_overrides" o
SET "user_id" = (
  SELECT u."id" FROM "users" u
  WHERE u."household_id" = o."household_id" AND u."role" = 'employee'
  ORDER BY u."id"
  LIMIT 1
)
WHERE o."user_id" IS NULL;
