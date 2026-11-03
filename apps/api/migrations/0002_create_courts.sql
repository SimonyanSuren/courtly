CREATE TYPE "public"."sport" AS ENUM('padel', 'tennis', 'squash', 'badminton', 'pickleball');--> statement-breakpoint
CREATE TABLE "courts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"sport" "sport" NOT NULL,
	"hourly_price_cents" integer NOT NULL,
	"opening_hour" integer NOT NULL,
	"closing_hour" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courts_name_trimmed" CHECK ("courts"."name" = btrim("courts"."name")),
	CONSTRAINT "courts_name_length" CHECK (char_length("courts"."name") between 1 and 100),
	CONSTRAINT "courts_hourly_price_cents_range" CHECK ("courts"."hourly_price_cents" between 1 and 100000),
	CONSTRAINT "courts_opening_hours_valid" CHECK (0 <= "courts"."opening_hour" and "courts"."opening_hour" < "courts"."closing_hour" and "courts"."closing_hour" <= 24)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "courts_name_unique" ON "courts" USING btree (lower("name"));