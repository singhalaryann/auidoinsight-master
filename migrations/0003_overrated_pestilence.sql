ALTER TABLE "experiments" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "audience" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "experiments" ALTER COLUMN "observation_window_days" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "goals";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "cohort_file";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "target_cohort";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "cohort_size";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "exposure_percentage";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "success_criteria";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "outcome";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "winning_variant";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "primary_metric_delta";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "primary_metric_lift";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "p_value";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "confidence";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "effect_size";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "sample_size";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "test_type";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "interpretation";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "sql_query";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "python_script";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "chart_data";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "can_complete";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "owner";--> statement-breakpoint
ALTER TABLE "experiments" DROP COLUMN "completion_date";