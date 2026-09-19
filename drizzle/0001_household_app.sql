CREATE TYPE "public"."grocery_category" AS ENUM('fresh', 'pantry', 'household', 'baby', 'other');--> statement-breakpoint
CREATE TYPE "public"."grocery_status" AS ENUM('pending', 'ordered', 'unavailable', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('lunch', 'dinner');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('employee_grocery_reminder', 'admin_order_reminder');--> statement-breakpoint
CREATE TYPE "public"."prep_timing" AS ENUM('same_day', 'day_before');--> statement-breakpoint
CREATE TYPE "public"."task_frequency" AS ENUM('daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."task_kind" AS ENUM('once', 'recurring');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'employee');--> statement-breakpoint
CREATE TABLE "grocery_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"order_date" date NOT NULL,
	"locks_at" timestamp with time zone NOT NULL,
	"unlocked_by_admin" boolean DEFAULT false NOT NULL,
	"ordered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grocery_cycles_household_order_date_unique" UNIQUE("household_id","order_date")
);
--> statement-breakpoint
CREATE TABLE "grocery_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" text,
	"category" "grocery_category" DEFAULT 'other' NOT NULL,
	"note" text,
	"added_by" integer,
	"status" "grocery_status" DEFAULT 'pending' NOT NULL,
	"carried_from_item_id" integer,
	"carry_count" smallint DEFAULT 0 NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"meal_id" integer NOT NULL,
	"completed_by" integer,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meal_completions_meal_unique" UNIQUE("meal_id")
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"date" date NOT NULL,
	"slot" "meal_slot" NOT NULL,
	"dish" text NOT NULL,
	"notes" text,
	"prep_timing" "prep_timing" DEFAULT 'same_day' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meals_household_date_slot_unique" UNIQUE("household_id","date","slot")
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"sent_for_date" date NOT NULL,
	"recipient_user_id" integer,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_log_kind_date_recipient_unique" UNIQUE("kind","sent_for_date","recipient_user_id")
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"occurrence_date" date NOT NULL,
	"completed_by" integer,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_completions_task_date_unique" UNIQUE("task_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "task_skips" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"occurrence_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_skips_task_date_unique" UNIQUE("task_id","occurrence_date")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"kind" "task_kind" NOT NULL,
	"assigned_to" integer NOT NULL,
	"created_by" integer,
	"due_date" date,
	"frequency" "task_frequency",
	"working_days_only" boolean DEFAULT true NOT NULL,
	"interval" smallint DEFAULT 1 NOT NULL,
	"weekdays" smallint[],
	"month_day" smallint,
	"start_date" date,
	"end_date" date,
	"time_of_day" time,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'employee' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workday_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"household_id" integer NOT NULL,
	"date" date NOT NULL,
	"is_working" boolean NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workday_overrides_household_date_unique" UNIQUE("household_id","date")
);
--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "timezone" text DEFAULT 'Africa/Johannesburg' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "working_weekdays" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "grocery_lock_weekday" smallint DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "grocery_lock_time" time DEFAULT '18:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "grocery_order_weekday" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "households" ADD COLUMN "reminder_time" time DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "grocery_cycles" ADD CONSTRAINT "grocery_cycles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_cycle_id_grocery_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."grocery_cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grocery_items" ADD CONSTRAINT "grocery_items_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_completions" ADD CONSTRAINT "meal_completions_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_completions" ADD CONSTRAINT "meal_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_skips" ADD CONSTRAINT "task_skips_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workday_overrides" ADD CONSTRAINT "workday_overrides_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grocery_items_cycle_idx" ON "grocery_items" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "meals_date_idx" ON "meals" USING btree ("date");--> statement-breakpoint
CREATE INDEX "task_completions_date_idx" ON "task_completions" USING btree ("occurrence_date");--> statement-breakpoint
CREATE INDEX "tasks_household_idx" ON "tasks" USING btree ("household_id");