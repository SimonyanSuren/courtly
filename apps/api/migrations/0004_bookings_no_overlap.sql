-- No double booking: two confirmed bookings of one court can never hold overlapping times, whatever
-- the application does and however many requests arrive at once. Of two overlapping inserts, the
-- second waits for the first to commit or roll back, then fails with SQLSTATE 23P01 or succeeds.
-- The ranges exclude their end ('[)'), so a booking may start when the previous one ends. Only
-- confirmed bookings take part: cancelling one frees its time at once.
--
-- Written by hand: Drizzle has no syntax for exclusion constraints, so the schema in
-- bookings.schema.ts names it (BOOKINGS_NO_OVERLAP) but cannot declare it. drizzle-kit compares
-- the schema with its snapshots, which never contain this constraint, so it never drops it.
--
-- A GiST index combines the court's = with the ranges' &&; btree_gist supplies = for uuid. It is
-- a trusted extension, so a database owner without superuser rights can create it.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist (
	"court_id" WITH =,
	tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" = 'confirmed');
