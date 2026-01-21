ALTER TABLE "appointments" ADD COLUMN "google_event_id" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "google_access_token" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "google_token_expiry" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "google_calendar_id" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "google_account_email" text;