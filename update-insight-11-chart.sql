-- Update insight 11 to add the retention chart with authentic data
UPDATE snapshot_insights 
SET content_payload = jsonb_set(
  content_payload,
  '{charts}',
  '[{
    "id": "retention-by-cohort-rank-direction",
    "title": "Next-Day Retention by Cohort and Rank Direction",
    "description": "Next-day retention rates for new and veteran users, segmented by whether their rank increased (climb) or decreased (drop) the previous day.",
    "type": "bar",
    "data": [
      {
        "segment": "New Players - Climb",
        "cohort": "new",
        "direction": "climb", 
        "retention_rate": 80.49,
        "sample_size": 12845
      },
      {
        "segment": "New Players - Drop", 
        "cohort": "new",
        "direction": "drop",
        "retention_rate": 77.57,
        "sample_size": 11623
      },
      {
        "segment": "Veteran Players - Climb",
        "cohort": "veteran", 
        "direction": "climb",
        "retention_rate": 75.75,
        "sample_size": 89456
      },
      {
        "segment": "Veteran Players - Drop",
        "cohort": "veteran",
        "direction": "drop", 
        "retention_rate": 70.76,
        "sample_size": 55485
      }
    ],
    "config": {
      "xKey": "segment",
      "yKey": "retention_rate",
      "color": "#059669"
    },
    "query": "WITH min_day AS (\n  SELECT user_id, MIN(active_date) AS first_day\n  FROM `bp.stg_user_games_played`\n  GROUP BY user_id\n),\nprep AS (\n  SELECT\n    l.active_date,\n    l.user_id,\n    -- Cohort: ''new'' if within the first 7 days, otherwise ''veteran''\n    CASE\n      WHEN DATE_DIFF(l.active_date, m.first_day, DAY) <= 6 THEN ''new''\n      ELSE ''veteran''\n    END AS cohort,\n    -- Direction of rank change\n    CASE\n      WHEN l.rank_delta > 0 THEN ''climb''\n      WHEN l.rank_delta < 0 THEN ''drop''\n      ELSE ''flat''\n    END AS direction\n  FROM `bp.stg_user_rank_each_day` AS l\n  JOIN min_day AS m USING (user_id)\n),\nnext_day AS (\n  SELECT\n    p.*,\n    CASE\n      WHEN EXISTS (\n        SELECT 1\n        FROM `bp.stg_user_games_played` s\n        WHERE s.user_id = p.user_id\n          AND s.active_date = DATE_ADD(p.active_date, INTERVAL 1 DAY)\n      ) THEN 1 ELSE 0\n    END AS played_next_day\n  FROM prep AS p\n)\nSELECT\n  cohort,\n  direction,\n  AVG(played_next_day) AS retention_rate,\n  COUNT(*) AS n\nFROM next_day\nWHERE direction IN (''climb'', ''drop'')\nGROUP BY cohort, direction\nORDER BY cohort, direction;"
  }]'::jsonb
)
WHERE id = 11;