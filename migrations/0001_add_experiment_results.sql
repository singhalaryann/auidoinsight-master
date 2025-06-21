-- Add experiment results columns
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS winning_variant text;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS primary_metric_lift double precision;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS effect_size double precision;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS sample_size integer;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS test_type text DEFAULT 'chi_square';
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS interpretation jsonb;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS sql_query text;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS python_script text;
ALTER TABLE experiments ADD COLUMN IF NOT EXISTS chart_data jsonb;