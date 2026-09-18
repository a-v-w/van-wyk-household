ALTER TABLE "notification_log" DROP CONSTRAINT "notification_log_kind_date_recipient_unique";--> statement-breakpoint
ALTER TABLE "notification_log" ADD COLUMN "list_id" integer;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_list_id_grocery_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."grocery_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_kind_date_recipient_list_unique" UNIQUE("kind","sent_for_date","recipient_user_id","list_id");