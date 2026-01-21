CREATE TYPE "public"."groomer_plan" AS ENUM('FREE', 'PRO');--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "slug" text NOT NULL;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "cover_image_url" text;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD COLUMN "plan" "groomer_plan" DEFAULT 'FREE' NOT NULL;--> statement-breakpoint
CREATE INDEX "groomer_business_slug_idx" ON "groomer_businesses" USING btree ("slug");--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD CONSTRAINT "groomer_businesses_slug_unique" UNIQUE("slug");