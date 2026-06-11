ALTER TABLE "services" ADD COLUMN "price_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_currency" text DEFAULT 'EUR' NOT NULL;