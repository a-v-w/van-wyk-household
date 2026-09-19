ALTER TABLE "workday_overrides" DROP CONSTRAINT "workday_overrides_household_date_unique";--> statement-breakpoint
ALTER TABLE "workday_overrides" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "workday_overrides_household_date_idx" ON "workday_overrides" USING btree ("household_id","date");--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD CONSTRAINT "workday_overrides_user_date_unique" UNIQUE("user_id","date");