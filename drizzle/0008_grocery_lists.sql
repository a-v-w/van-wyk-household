CREATE TYPE "public"."grocery_list_kind" AS ENUM('weekly', 'standing');--> statement-breakpoint
CREATE TABLE "grocery_lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"name" text NOT NULL,
	"kind" "grocery_list_kind" DEFAULT 'weekly' NOT NULL,
	"lock_weekday" smallint,
	"lock_time" time,
	"order_weekday" smallint,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grocery_cycles" DROP CONSTRAINT "grocery_cycles_household_order_date_unique";--> statement-breakpoint
ALTER TABLE "grocery_cycles" ALTER COLUMN "order_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_cycles" ALTER COLUMN "locks_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_cycles" ADD COLUMN "list_id" integer;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD COLUMN "source_meal_id" integer;--> statement-breakpoint
ALTER TABLE "grocery_lists" ADD CONSTRAINT "grocery_lists_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_lists_household_idx" ON "grocery_lists" USING btree ("household_id");--> statement-breakpoint
ALTER TABLE "grocery_cycles" ADD CONSTRAINT "grocery_cycles_list_id_grocery_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_source_meal_id_meals_id_fk" FOREIGN KEY ("source_meal_id") REFERENCES "public"."meals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_cycles_list_idx" ON "grocery_cycles" USING btree ("list_id","order_date");--> statement-breakpoint
-- Every household gets its existing weekly shop as a named list, and the
-- cycles that already exist are pointed at it.
INSERT INTO "grocery_lists" ("household_id", "name", "kind", "sort_order")
SELECT h."id", 'Weekly shop', 'weekly', 0 FROM "households" h;
--> statement-breakpoint
UPDATE "grocery_cycles" c
SET "list_id" = (
  SELECT l."id" FROM "grocery_lists" l
  WHERE l."household_id" = c."household_id"
  ORDER BY l."id"
  LIMIT 1
)
WHERE c."list_id" IS NULL;
