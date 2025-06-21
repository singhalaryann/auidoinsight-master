CREATE TABLE "analysis_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"insight_title" text NOT NULL,
	"executive_summary" text NOT NULL,
	"lift_percent" double precision,
	"p_value" double precision,
	"effect_size" double precision,
	"key_metrics" jsonb,
	"chart_data" jsonb,
	"business_insights" text[],
	"assumptions" text,
	"sql_query" text,
	"query_result" jsonb,
	"python_script" text,
	"python_output" text,
	"tests" jsonb,
	"analysis_type" text,
	"data_points" integer,
	"timeframe" text,
	"cohort_size" text,
	"confidence" double precision,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dashboard_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"view_config" jsonb NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"variants" jsonb NOT NULL,
	"audience" jsonb,
	"cohort_file" text,
	"primary_metric" text NOT NULL,
	"secondary_metrics" text[],
	"duration_days" integer NOT NULL,
	"observation_window_days" integer DEFAULT 30,
	"outcome" text,
	"winning_variant" text,
	"primary_metric_delta" double precision,
	"primary_metric_lift" double precision,
	"p_value" double precision,
	"confidence" double precision,
	"effect_size" double precision,
	"sample_size" integer,
	"test_type" text DEFAULT 'chi_square',
	"results" jsonb,
	"interpretation" jsonb,
	"sql_query" text,
	"python_script" text,
	"chart_data" jsonb,
	"can_complete" boolean DEFAULT false,
	"owner" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"completion_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"intent" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"clarifying_questions" jsonb,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pillars" jsonb NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
