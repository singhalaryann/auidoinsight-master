CREATE TABLE "cohorts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"user_id_column" text NOT NULL,
	"group_column" text,
	"control_value" text,
	"variant_value" text,
	"size" integer NOT NULL,
	"control_count" integer DEFAULT 0,
	"variant_count" integer DEFAULT 0,
	"has_group_assignments" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
