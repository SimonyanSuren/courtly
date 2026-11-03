CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"court_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"hours" integer NOT NULL,
	"price_cents" integer NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "bookings_hours_valid" CHECK ("bookings"."hours" in (1, 2)),
	CONSTRAINT "bookings_ends_after_hours" CHECK ("bookings"."ends_at" = "bookings"."starts_at" + make_interval(hours => "bookings"."hours")),
	CONSTRAINT "bookings_price_cents_positive" CHECK ("bookings"."price_cents" > 0),
	CONSTRAINT "bookings_cancelled_at_when_cancelled" CHECK (("bookings"."status" = 'cancelled') = ("bookings"."cancelled_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_courts_id_fk" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_user_id_index" ON "bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bookings_starts_at_index" ON "bookings" USING btree ("starts_at");