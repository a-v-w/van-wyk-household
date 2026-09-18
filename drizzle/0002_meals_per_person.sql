ALTER TABLE "meals" DROP CONSTRAINT "meals_household_date_slot_unique";--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "for_whom" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN "sort_order" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "meals_household_date_idx" ON "meals" USING btree ("household_id","date");