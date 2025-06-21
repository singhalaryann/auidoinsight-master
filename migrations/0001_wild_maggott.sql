ALTER TABLE "experiments" ADD COLUMN "hypothesis" text NOT NULL;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "goals" text[];--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "target_cohort" text NOT NULL;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "cohort_size" integer;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "exposure_percentage" integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE "experiments" ADD COLUMN "success_criteria" text;