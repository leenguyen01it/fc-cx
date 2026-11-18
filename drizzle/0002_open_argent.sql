ALTER TABLE "cost_items" ADD COLUMN "sponsor_member_id" integer;--> statement-breakpoint
ALTER TABLE "cost_items" ADD COLUMN "sponsor_cash" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_sponsor_member_id_members_id_fk" FOREIGN KEY ("sponsor_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;