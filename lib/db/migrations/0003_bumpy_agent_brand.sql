CREATE TABLE "file_operations" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"type" varchar(20) NOT NULL,
	"path" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'completed' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_operations" ADD CONSTRAINT "file_operations_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;