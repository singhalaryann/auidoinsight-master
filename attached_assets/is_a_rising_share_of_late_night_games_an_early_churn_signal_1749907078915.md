## 1 Business Question

> Does an _increase_ in a player’s **late‑night play share** over the past 7 days predict **churn within the next 7 days**?

## 2 Key Definitions & Parameters

|Item|Definition|
|---|---|
|**Late‑night game**|A round starting 00:00‑04:59 server time.|
|**`ln_pct`**|Late‑night games ÷ total games on a given day.|
|**`ln_pct_slope_7d`**|Ordinary‑least‑squares slope of `ln_pct` across last 7 days (positive = rising night‑share).|
|**Churn gap**|≥ 14 consecutive silent days ⇒ churn.|
|**Early‑churn label**|`True` if churn starts ≤ 7 days after the observation date.|
|**Study window**|2025‑01‑01 → 2025‑04‑01.|

## 3 SQL Feature‑Engineering Pipeline (chain of thought)

```sql
-- PARAMETERS – tune as you like

DECLARE study_start DATE DEFAULT '2025-01-01';

DECLARE study_end DATE DEFAULT '2025-04-01';

DECLARE churn_gap INT64 DEFAULT 14; -- N quiet days ⇒ churn

DECLARE horizon_days INT64 DEFAULT 7; -- “early” = churn ≤ 7 d

DECLARE trend_window INT64 DEFAULT 7; -- slope over last 7 d

  

WITH daily_games AS ( -- 1️⃣ per-player, per-day counts

SELECT

user_id,

active_date,

COUNTIF(

EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) BETWEEN 0 AND 4

) AS ln_games,

COUNT(*) AS total_games

FROM `bp.stg_user_games_played`

WHERE active_date BETWEEN study_start AND study_end

GROUP BY user_id, active_date

),

  

pcts AS ( -- 2️⃣ late-night %

SELECT

*,

SAFE_DIVIDE(ln_games, total_games) AS ln_pct

FROM daily_games

),

  

idxed AS ( -- 3️⃣ add day index per user

SELECT

*,

ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY active_date) AS day_idx

FROM pcts

),

  

trends AS ( -- 4️⃣ seven-day slope of ln_pct

SELECT

*,

-- window stats

COUNT(*) OVER w AS n,

SUM(day_idx) OVER w AS sum_x,

SUM(ln_pct) OVER w AS sum_y,

SUM(day_idx * ln_pct) OVER w AS sum_xy,

SUM(day_idx * day_idx) OVER w AS sum_x2

FROM idxed

WINDOW w AS (

PARTITION BY user_id

ORDER BY active_date

ROWS BETWEEN 6 PRECEDING AND CURRENT ROW

)

),

  

sloped AS (

SELECT

*,

SAFE_DIVIDE( n * sum_xy - sum_x * sum_y,

n * sum_x2 - sum_x * sum_x) AS ln_pct_slope_7d

FROM trends

),

  

next_seen AS ( -- 5️⃣ next activity date

SELECT

s.*,

LEAD(active_date) OVER(

PARTITION BY user_id ORDER BY active_date

) AS next_play_date

FROM sloped s

),

  

labels AS ( -- 6️⃣ churn start date

SELECT

*,

CASE

WHEN DATE_DIFF(next_play_date, active_date, DAY) > churn_gap

OR next_play_date IS NULL

THEN active_date + 1 -- first silent day

END AS churn_start_date

FROM next_seen

),

  

dataset AS ( -- 7️⃣ final modelling frame

SELECT

user_id,

active_date AS obs_date,

ln_pct,

ln_pct_slope_7d,

total_games,

(churn_start_date IS NOT NULL

AND DATE_DIFF(churn_start_date, active_date, DAY) <= horizon_days)

AS churn_next_7d

FROM labels

WHERE active_date BETWEEN study_start

AND DATE_SUB(study_end, INTERVAL horizon_days DAY)

)

  

-- 🔚 hand off to Python / ML

SELECT *

FROM dataset;
```

## 4 Model Specification (Python `statsmodels`)

```python
import statsmodels.api as sm

import numpy as np

  

# 2️⃣ basic logistic model

X = df_1[['ln_pct_slope_7d', 'ln_pct', 'total_games']].astype(float) # Convert to float

X = sm.add_constant(X)

  

# Handle missing values

X = X.dropna()

y = df_1['churn_next_7d'].loc[X.index].astype(float) # Convert to float and align with X

  

logit = sm.Logit(y, X).fit()

print(logit.summary())

  

# 3️⃣ effect interpretation

slope_coef = logit.params['ln_pct_slope_7d']

odds_mult = np.exp(slope_coef)

print(f"Each +0.10 in 7-day slope multiplies churn odds by {odds_mult**0.10:.2f}")
```

- **Family:** Logistic (MLE).
    
- **Predictors:** recent slope, current late‑night%, total games.
    
- **Sample size:** 2.82 M user‑days.
    

## 5 Results

|Predictor|β (coef)|Odds × per +1.0|p‑value|Interpretation|
|---|---|---|---|---|
|**`ln_pct_slope_7d`**|**+0.341**|**1.41×**|< 0.001|Faster rise in night‑share ↑ churn risk.|
|**`ln_pct`**|−0.141|0.87×|< 0.001|Stable night‑owls churn _less_.|
|**`total_games`**|−0.0568|0.95×|< 0.001|More play volume is protective.|
|**Intercept**|−0.994|—|< 0.001|Baseline.|

**Effect scale:** Each **+0.10** in `ln_pct_slope_7d` multiplies churn odds by **1.03** (≈ +3 %).  
**Model lift:** McFadden pseudo‑R² ≈ 0.045 (typical for churn models).

## 6 Interpretation

A _rising_ late‑night share is an **early‑warning** signal: a 30 pp/day climb (~20 %→90 %) lifts churn odds ≈ 9 %. Conversely, players already playing mostly at night—but not accelerating—are actually _stickier_.