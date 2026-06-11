DROP INDEX "groomer_business_owner_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "groomer_business_owner_user_id_unique" ON "groomer_businesses" USING btree ("owner_user_id");