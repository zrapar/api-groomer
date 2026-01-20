CREATE TYPE "public"."appointment_status" AS ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."coat_type" AS ENUM('SHORT', 'MEDIUM', 'LONG', 'DENSE', 'CURLY');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('IN_SALON', 'AT_HOME');--> statement-breakpoint
CREATE TYPE "public"."pet_size" AS ENUM('MINI', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT');--> statement-breakpoint
CREATE TYPE "public"."species" AS ENUM('DOG', 'CAT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('GROOMER_OWNER', 'GROOMER_STAFF', 'CLIENT', 'ADMIN');--> statement-breakpoint
CREATE TABLE "appointment_pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"pet_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"calculated_duration_minutes" integer NOT NULL,
	"extras" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"location_type" "location_type" NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" "appointment_status" NOT NULL,
	"cancel_reason" text,
	"home_address" text,
	"home_zone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_working_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groomer_businesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"offers_in_salon" boolean DEFAULT true NOT NULL,
	"offers_at_home" boolean DEFAULT false NOT NULL,
	"max_dogs_per_home_visit" integer,
	"home_visit_setup_minutes" integer DEFAULT 0 NOT NULL,
	"home_visit_teardown_minutes" integer DEFAULT 0 NOT NULL,
	"default_transport_minutes" integer DEFAULT 0 NOT NULL,
	"min_hours_before_cancel_or_reschedule" integer DEFAULT 24 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"species" "species" NOT NULL,
	"name" text NOT NULL,
	"breed" text NOT NULL,
	"size" "pet_size" NOT NULL,
	"coat_type" "coat_type" NOT NULL,
	"birth_date" timestamp,
	"weight_kg" numeric(5, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_duration_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"species" "species" NOT NULL,
	"size" "pet_size",
	"breed" text,
	"base_duration_minutes" integer NOT NULL,
	"is_default_for_species" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"species_supported" text[] NOT NULL,
	"locations_supported" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_pet_id_pets_id_fk" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_pets" ADD CONSTRAINT "appointment_pets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_business_id_groomer_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."groomer_businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_working_hours" ADD CONSTRAINT "business_working_hours_business_id_groomer_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."groomer_businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groomer_businesses" ADD CONSTRAINT "groomer_businesses_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pets" ADD CONSTRAINT "pets_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_duration_rules" ADD CONSTRAINT "service_duration_rules_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_groomer_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."groomer_businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointment_pets_appointment_id_idx" ON "appointment_pets" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "appointment_pets_pet_id_idx" ON "appointment_pets" USING btree ("pet_id");--> statement-breakpoint
CREATE INDEX "appointments_business_start_idx" ON "appointments" USING btree ("business_id","start_time");--> statement-breakpoint
CREATE INDEX "appointments_client_id_idx" ON "appointments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "business_working_hours_business_weekday_idx" ON "business_working_hours" USING btree ("business_id","weekday");--> statement-breakpoint
CREATE INDEX "groomer_business_owner_user_id_idx" ON "groomer_businesses" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "pets_owner_user_id_idx" ON "pets" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "service_duration_rules_service_species_idx" ON "service_duration_rules" USING btree ("service_id","species");--> statement-breakpoint
CREATE INDEX "services_business_id_idx" ON "services" USING btree ("business_id");