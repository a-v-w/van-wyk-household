CREATE TYPE "public"."monthly_mode" AS ENUM('day_of_month', 'weekday_of_month');--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "monthly_mode" "monthly_mode" DEFAULT 'day_of_month' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "month_week" smallint;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "month_weekday" smallint;