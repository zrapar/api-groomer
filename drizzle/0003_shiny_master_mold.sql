CREATE TABLE "groomer_staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "groomer_id" uuid;--> statement-breakpoint
UPDATE "appointments" AS a
SET "groomer_id" = b."owner_user_id"
FROM "groomer_businesses" AS b
WHERE a."business_id" = b."id" AND a."groomer_id" IS NULL;--> statement-breakpoint
ALTER TABLE "groomer_staff_members" ADD CONSTRAINT "groomer_staff_members_business_id_groomer_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."groomer_businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groomer_staff_members" ADD CONSTRAINT "groomer_staff_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groomer_staff_members_business_id_idx" ON "groomer_staff_members" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "groomer_staff_members_business_user_idx" ON "groomer_staff_members" USING btree ("business_id","user_id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_groomer_id_users_id_fk" FOREIGN KEY ("groomer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
