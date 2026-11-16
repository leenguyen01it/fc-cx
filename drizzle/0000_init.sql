CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"match_id" integer,
	"action" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"name" text NOT NULL,
	"amount" integer NOT NULL,
	"rule" text NOT NULL,
	"loser_pct" integer DEFAULT 70 NOT NULL,
	"bearer" text DEFAULT 'loser' NOT NULL,
	"include_non_eaters" boolean DEFAULT true NOT NULL,
	"eaters_only" boolean DEFAULT false NOT NULL,
	"draw_mode" text DEFAULT 'half' NOT NULL,
	"sponsor_amount" integer DEFAULT 0 NOT NULL,
	"sponsor_name" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"team" text,
	"ate" boolean DEFAULT true NOT NULL,
	"pending" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"time_range" text DEFAULT '' NOT NULL,
	"score_a" integer,
	"score_b" integer,
	"size_a" integer,
	"size_b" integer,
	"note" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"voting" boolean DEFAULT false NOT NULL,
	"cancelled" boolean DEFAULT false NOT NULL,
	"cancel_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"guest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" integer NOT NULL,
	"member_id" integer NOT NULL,
	"going" boolean NOT NULL,
	"eat" boolean DEFAULT true NOT NULL,
	"team" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"team_name" text DEFAULT 'FC CX' NOT NULL,
	"prefix" text DEFAULT 'CX' NOT NULL,
	"transfer_suffix" text DEFAULT 'CK da bong' NOT NULL,
	"default_venue" text DEFAULT 'Sân bóng Mai Về' NOT NULL,
	"default_time" text DEFAULT '18:00' NOT NULL,
	"team_a_name" text DEFAULT 'Nhất' NOT NULL,
	"team_b_name" text DEFAULT 'Bét' NOT NULL,
	"bank_bin" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"account_no" text DEFAULT '' NOT NULL,
	"account_name" text DEFAULT '' NOT NULL,
	"dedicated_account" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"amount" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"member_id" integer,
	"match_id" integer,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_players_uq" ON "match_players" USING btree ("match_id","member_id");--> statement-breakpoint
CREATE INDEX "matches_date_idx" ON "matches" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "members_code_uq" ON "members" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "rsvps_uq" ON "rsvps" USING btree ("match_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_uq" ON "transactions" USING btree ("external_id");