CREATE TABLE "waitlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp,
	"registered_at" timestamp,
	CONSTRAINT "waitlist_entries_email_unique" UNIQUE("email")
);
