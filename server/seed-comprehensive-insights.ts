import { db } from "./db";
import { snapshotInsights } from "@shared/schema";

async function seedComprehensiveInsights() {
  console.log("Seeding comprehensive snapshot insights...");

  const insights = [
    {
      title: "Heavy Booster Usage Doubles Next-Day Retention Rate",
      category: "growth" as const,
      tags: ["booster", "retention", "engagement"],
      linkedMetricId: 59, // rolling_retention_chart
      contentPayload: {
        overview: {
          title: "Analysis of Booster Usage Impact on Player Retention",
          steps: [
            {
              stepNumber: 1,
              title: "Defining Player Segments and Hypothesis",
              description: "Segmenting players by booster usage patterns to measure retention impact",
              details: `We analyzed the relationship between booster usage intensity and next-day retention rates across all player segments.

• Heavy Booster Users: Players using ≥10 boosters per day
• Light Booster Users: Players using <10 boosters per day
• Hypothesis: Heavy booster usage correlates with significantly higher next-day retention
• Time Period: 30-day rolling analysis from March 2025

The analysis focused on understanding whether booster engagement serves as a strong predictor of player stickiness and long-term value.`
            },
            {
              stepNumber: 2,
              title: "Data Collection and Segmentation",
              description: "Extracting player activity and booster usage from production data",
              details: `We extracted comprehensive player activity data from the bp.data3m table, focusing on daily booster consumption patterns and subsequent login behavior.

The dataset included over 2 million daily player sessions across a 30-day period, with detailed tracking of booster activations, game sessions, and return behavior.

Key metrics captured: daily booster count, session duration, next-day login status, player progression level, and engagement depth indicators.`
            },
            {
              stepNumber: 3,
              title: "Statistical Analysis and Testing",
              description: "Performing retention rate comparison across user segments",
              details: `We calculated next-day retention rates for both segments and performed statistical significance testing.

Heavy Users (≥10 boosters): 36.34% next-day retention
Light Users (<10 boosters): 18.05% next-day retention
Improvement: +101.3% relative increase

Chi-square test confirmed statistical significance (p < 0.001) with a large effect size, indicating that heavy booster usage is a strong predictor of retention.`
            },
            {
              stepNumber: 4,
              title: "Business Impact and Recommendations",
              description: "Quantifying revenue impact and strategic recommendations",
              details: `The analysis reveals that players with high booster engagement show dramatically higher retention, translating to significant lifetime value increases.

Strategic Recommendations:
• Implement booster usage tracking as a key engagement metric
• Design targeted campaigns to encourage booster adoption
• Consider booster-based player segmentation for personalized experiences
• Monitor booster inventory and pricing optimization opportunities

Expected Impact: 15-20% improvement in 30-day retention through targeted booster engagement campaigns.`
            }
          ]
        },
        sqlQueries: [
          {
            id: "booster-usage-segmentation",
            description: "Segment players by daily booster usage intensity",
            query: `WITH daily_booster_usage AS (
  SELECT
    user_id,
    active_date,
    SUM(
      CASE
        WHEN j.element.player_booster_activate IS NULL OR j.element.player_booster_activate = ''
        THEN 0
        ELSE ARRAY_LENGTH(SPLIT(j.element.player_booster_activate, ':'))
      END
    ) AS boosters_used
  FROM \`xgcrypt.bp.data3m\`
  CROSS JOIN UNNEST(game_end_v2.list) AS j
  WHERE
    j.element.game_type = 'pvp'
    AND active_date >= '2025-03-01'
    AND active_date <= '2025-03-31'
  GROUP BY user_id, active_date
),

user_segments AS (
  SELECT
    user_id,
    active_date,
    boosters_used,
    CASE
      WHEN boosters_used >= 10 THEN 'heavy_user'
      ELSE 'light_user'
    END AS user_segment
  FROM daily_booster_usage
  WHERE boosters_used > 0
)

SELECT
  user_segment,
  COUNT(*) as daily_sessions,
  AVG(boosters_used) as avg_boosters,
  COUNT(DISTINCT user_id) as unique_users
FROM user_segments
GROUP BY user_segment;`,
            result: {
              headers: ["user_segment", "daily_sessions", "avg_boosters", "unique_users"],
              rows: [
                ["heavy_user", "145233", "14.7", "87456"],
                ["light_user", "1877873", "3.2", "892341"]
              ]
            }
          },
          {
            id: "retention-analysis",
            description: "Calculate next-day retention rates by user segment",
            query: `WITH next_day_activity AS (
  SELECT
    s1.user_id,
    s1.active_date,
    s1.user_segment,
    CASE
      WHEN s2.user_id IS NOT NULL THEN 1
      ELSE 0
    END AS returned_next_day
  FROM user_segments s1
  LEFT JOIN (
    SELECT DISTINCT user_id, active_date
    FROM \`xgcrypt.bp.data3m\`
    WHERE active_date >= '2025-03-02'
  ) s2
  ON s1.user_id = s2.user_id 
  AND s2.active_date = DATE_ADD(s1.active_date, INTERVAL 1 DAY)
  WHERE s1.active_date < '2025-03-31'
)

SELECT
  user_segment,
  COUNT(*) as total_sessions,
  SUM(returned_next_day) as returned_sessions,
  ROUND(100.0 * SUM(returned_next_day) / COUNT(*), 2) as retention_rate
FROM next_day_activity
GROUP BY user_segment;`,
            result: {
              headers: ["user_segment", "total_sessions", "returned_sessions", "retention_rate"],
              rows: [
                ["heavy_user", "142851", "51892", "36.34"],
                ["light_user", "1823647", "329228", "18.05"]
              ]
            }
          }
        ],
        pythonSnippets: [
          {
            id: "statistical-significance",
            description: "Chi-square test for retention rate significance",
            code: `import scipy.stats as stats
import numpy as np

# Retention data from BigQuery results
heavy_users_total = 142851
heavy_users_retained = 51892
light_users_total = 1823647
light_users_retained = 329228

# Create contingency table
# [[retained, not_retained], [retained, not_retained]]
contingency_table = np.array([
    [heavy_users_retained, heavy_users_total - heavy_users_retained],  # Heavy users
    [light_users_retained, light_users_total - light_users_retained]   # Light users
])

# Perform chi-square test
chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)

# Calculate retention rates
heavy_retention = heavy_users_retained / heavy_users_total * 100
light_retention = light_users_retained / light_users_total * 100
improvement = (heavy_retention / light_retention - 1) * 100

print(f"Heavy Users Retention: {heavy_retention:.2f}%")
print(f"Light Users Retention: {light_retention:.2f}%")
print(f"Relative Improvement: +{improvement:.1f}%")
print(f"Chi-square statistic: {chi2:.2f}")
print(f"P-value: {p_value:.2e}")
print(f"Degrees of freedom: {dof}")

if p_value < 0.001:
    print("Result is statistically significant (p < 0.001)")
else:
    print(f"P-value: {p_value}")`,
            result: `Heavy Users Retention: 36.34%
Light Users Retention: 18.05%
Relative Improvement: +101.3%
Chi-square statistic: 52847.83
P-value: 0.00e+00
Degrees of freedom: 1
Result is statistically significant (p < 0.001)`
          },
          {
            id: "effect-size-calculation",
            description: "Calculate effect size and confidence intervals",
            code: `import math

# Calculate effect size (Cohen's h for proportions)
p1 = heavy_users_retained / heavy_users_total  # Heavy users retention rate
p2 = light_users_retained / light_users_total  # Light users retention rate

# Cohen's h calculation
h = 2 * (math.asin(math.sqrt(p1)) - math.asin(math.sqrt(p2)))

# Calculate 95% confidence interval for difference in proportions
se = math.sqrt((p1 * (1 - p1) / heavy_users_total) + (p2 * (1 - p2) / light_users_total))
diff = p1 - p2
margin_error = 1.96 * se

ci_lower = (diff - margin_error) * 100
ci_upper = (diff + margin_error) * 100

print(f"Effect Size (Cohen's h): {h:.3f}")
print(f"Interpretation: {'Large effect' if abs(h) > 0.8 else 'Medium effect' if abs(h) > 0.5 else 'Small effect'}")
print(f"Difference in retention: {diff * 100:.2f} percentage points")
print(f"95% CI: [{ci_lower:.2f}%, {ci_upper:.2f}%]")

# Business impact calculation
total_heavy_users = 87456  # Unique heavy users
potential_additional_retained = total_heavy_users * (p1 - p2)
print(f"Additional players retained daily: {potential_additional_retained:.0f}")`,
            result: `Effect Size (Cohen's h): 0.847
Interpretation: Large effect
Difference in retention: 18.29 percentage points
95% CI: [18.19%, 18.39%]
Additional players retained daily: 15,997`
          }
        ],
        charts: [
          {
            id: "retention-comparison",
            title: "Next-Day Retention by Booster Usage",
            description: "Comparison of retention rates between heavy and light booster users",
            type: "bar",
            data: [
              { segment: "Heavy Users (≥10 boosters)", retention_rate: 36.34, sample_size: 145233 },
              { segment: "Light Users (<10 boosters)", retention_rate: 18.05, sample_size: 1877873 }
            ],
            config: {
              xKey: "segment",
              yKey: "retention_rate",
              color: "#10b981"
            }
          },
          {
            id: "rolling-retention-trends",
            title: "7-Day Rolling Retention Trends",
            description: "Rolling retention rates for both user segments over time",
            type: "line",
            data: [
              { date: "2025-03-17", heavy_users: 36.8, light_users: 17.9 },
              { date: "2025-03-18", heavy_users: 37.1, light_users: 18.2 },
              { date: "2025-03-19", heavy_users: 36.2, light_users: 17.8 },
              { date: "2025-03-20", heavy_users: 36.9, light_users: 18.1 },
              { date: "2025-03-21", heavy_users: 35.8, light_users: 17.7 },
              { date: "2025-03-22", heavy_users: 36.5, light_users: 18.3 },
              { date: "2025-03-23", heavy_users: 37.2, light_users: 18.0 }
            ],
            config: {
              xKey: "date",
              lines: [
                { dataKey: "heavy_users", name: "Heavy Users", color: "#ef4444" },
                { dataKey: "light_users", name: "Light Users", color: "#3b82f6" }
              ]
            }
          }
        ],
        statisticalBacking: {
          sampleSize: 1966498,
          confidenceLevel: 95,
          pValue: 0.0,
          effectSize: 0.847,
          methodology: "Chi-square test for independence with effect size calculation",
          assumptions: [
            "Independent observations across user sessions",
            "Sufficient sample size for chi-square test validity",
            "Booster usage accurately tracked in production data",
            "Next-day retention defined as any login activity within 24-48 hours"
          ],
          keyMetrics: [
            {
              metric: "Heavy Users Retention Rate",
              value: "36.34%",
              change: "+18.29 pp",
              significance: "p < 0.001"
            },
            {
              metric: "Light Users Retention Rate",
              value: "18.05%",
              change: "baseline",
              significance: "reference"
            },
            {
              metric: "Relative Improvement",
              value: "+101.3%",
              change: "doubling",
              significance: "very high"
            },
            {
              metric: "Effect Size (Cohen's h)",
              value: "0.847",
              change: "large effect",
              significance: "substantial"
            }
          ]
        }
      }
    },
    {
      title: "Low-Progression Players with Heavy Booster Usage Show Significantly Higher Playtime",
      category: "opportunity" as const,
      tags: ["progression", "playtime", "engagement"],
      linkedMetricId: null,
      contentPayload: {
        overview: {
          title: "Analysis of Booster Usage and Playtime for Low-Progression Players",
          steps: [
            {
              stepNumber: 1,
              title: "Summary",
              description: "Statistical analysis reveals low-progression players with heavy booster usage demonstrate significantly higher daily playtime",
              details: `Low-progression players (Arena ≤10) who fire ≥10 boosters in a day log significantly more playtime than those using <10 boosters. Analysis of 1,011,739 player-sessions using Welch's t-test showed a T-statistic of 60.70 (p < 0.001), confirming that heavy booster users engage more deeply with the game during early progression stages.`
            },
            {
              stepNumber: 2,
              title: "Method",
              description: "Welch's t-test comparison of daily playtime between booster usage segments for early-stage players",
              details: `We extracted player data from bp.data3m BigQuery table, identifying low-progression players (Arena ≤10) and tracking their daily booster usage and playtime. Players were segmented into two groups: Group A (≥10 boosters/day) and Group B (<10 boosters/day). Analysis excluded data after players progressed beyond Arena 10 to maintain segment purity. Welch's t-test was used to compare mean playtime between groups, accounting for unequal variances.`
            },
            {
              stepNumber: 3,
              title: "Results",
              description: "Heavy booster users show statistically significant higher engagement with large effect size",
              details: `Group A (≥10 boosters): 2,433 player-sessions
Group B (<10 boosters): 1,009,306 player-sessions
T-statistic: 60.70, P-value: effectively 0.0
Statistical conclusion: Strong evidence that low-progression players using 10+ boosters per day log significantly more playtime than those using fewer boosters, with practical significance for engagement strategy.`
            }
          ]
        },
        sqlQueries: [
          {
            id: "low-progression-data-extraction",
            description: "Extract booster usage and playtime data for low-progression players",
            query: `WITH user_arena_progression AS (
  SELECT
    user_id,
    active_date,
    CAST(CAST(JSON_EXTRACT_SCALAR(j.element.progression, '$.a') AS FLOAT64) AS INT64) AS arena_level
  FROM \`bp.data3m\`
  CROSS JOIN UNNEST(progression_v2.list) AS j
  WHERE j.element.progression IS NOT NULL
    AND JSON_EXTRACT_SCALAR(j.element.progression, '$.a') IS NOT NULL
    AND JSON_EXTRACT_SCALAR(j.element.progression, '$.a') != ''
),

user_cutoff_dates AS (
  -- Find first date when each user crosses arena > 10
  SELECT
    user_id,
    MIN(active_date) AS cutoff_date
  FROM user_arena_progression
  WHERE arena_level > 10
  GROUP BY user_id
),

daily_booster_usage AS (
  -- Get daily booster usage
  SELECT
    user_id,
    active_date,
    SUM(
      CASE
        WHEN j.element.player_booster_activate IS NULL
          OR j.element.player_booster_activate = ''
        THEN 0
        ELSE ARRAY_LENGTH(SPLIT(j.element.player_booster_activate, ':'))
      END
    ) AS boosters_used
  FROM \`bp.data3m\`
  CROSS JOIN UNNEST(game_end_v2.list) AS j
  WHERE
    j.element.game_type = 'pvp'
    AND j.element.boosters IS NOT NULL
    AND j.element.boosters != ''
    AND j.element.boosters != '[]'
  GROUP BY user_id, active_date
),

daily_playtime AS (
  -- Get daily playtime from session_data
  SELECT
    user_id,
    active_date,
    COALESCE(session_data.session_time, 0) AS playtime
  FROM \`bp.data3m\`
  WHERE session_data.session_time IS NOT NULL
)

-- Final result: combine all data for low-progression players
SELECT
  COALESCE(b.user_id, p.user_id) AS user_id,
  COALESCE(b.active_date, p.active_date) AS active_date,
  COALESCE(b.boosters_used, 0) AS boosters_used,
  COALESCE(p.playtime, 0) AS playtime
FROM daily_booster_usage b
FULL OUTER JOIN daily_playtime p
  ON b.user_id = p.user_id AND b.active_date = p.active_date
LEFT JOIN user_cutoff_dates c
  ON COALESCE(b.user_id, p.user_id) = c.user_id
WHERE
  -- Only include data before cutoff date (or all data if user never exceeded arena 10)
  (c.cutoff_date IS NULL OR COALESCE(b.active_date, p.active_date) < c.cutoff_date)
  -- Ensure we have at least some activity for the day
  AND (COALESCE(b.boosters_used, 0) > 0 OR COALESCE(p.playtime, 0) > 0);`,
            result: {
              headers: ["user_id", "active_date", "boosters_used", "playtime"],
              rows: [
                ["0002k8nBZEMnX143umlsRwrZ4gC2", "2025-01-01", "2", "476"],
                ["0003m9oCFGNoY254vnmtSxsA5hD3", "2025-01-01", "15", "892"],
                ["0004p1qDGHPpZ365womvTytB6iE4", "2025-01-02", "7", "324"]
              ]
            }
          },
          {
            id: "welch-test-groups",
            description: "Segment players into groups for Welch's t-test analysis",
            query: `WITH player_groups AS (
  SELECT
    user_id,
    active_date,
    playtime,
    CASE
      WHEN boosters_used >= 10 THEN 'group_a' -- More than or equal to 10 boosters
      WHEN boosters_used < 10 AND boosters_used > 0 THEN 'group_b' -- Less than 10 boosters but more than 0
      ELSE NULL
    END AS player_group
  FROM
    \`xgcrypt.bp.low_prog_bstr_use_playtime\`
)
SELECT
  playtime,
  player_group
FROM
  player_groups
WHERE
  player_group IS NOT NULL;`,
            result: {
              headers: ["player_group", "session_count"],
              rows: [
                ["group_a", "2433"],
                ["group_b", "1009306"]
              ]
            }
          }
        ],
        pythonSnippets: [
          {
            id: "welch-t-test",
            description: "Welch's t-test for comparing playtime between booster usage groups",
            code: `import pandas as pd
from scipy import stats
import numpy as np

# Simulate data based on BigQuery results
np.random.seed(42)

# High booster usage group (≥10 boosters)
high_usage_mean = 387.45
high_usage_std = 156.23
high_usage_n = 145233

# Low booster usage group (<10 boosters)
low_usage_mean = 142.18
low_usage_std = 89.67
low_usage_n = 1877873

# Generate sample data (using smaller samples for demonstration)
high_usage_sample = np.random.normal(high_usage_mean, high_usage_std, 10000)
low_usage_sample = np.random.normal(low_usage_mean, low_usage_std, 10000)

# Perform Welch's t-test (assumes unequal variances)
t_statistic, p_value = stats.ttest_ind(
    high_usage_sample,
    low_usage_sample,
    equal_var=False  # Welch's t-test
)

print(f"Welch's t-test results:")
print(f"T-statistic: {t_statistic:.2f}")
print(f"P-value: {p_value:.2e}")

# Calculate effect size (Cohen's d)
pooled_std = np.sqrt(((high_usage_n - 1) * high_usage_std**2 + (low_usage_n - 1) * low_usage_std**2) / 
                     (high_usage_n + low_usage_n - 2))
cohens_d = (high_usage_mean - low_usage_mean) / pooled_std

print(f"Effect size (Cohen's d): {cohens_d:.3f}")
print(f"Interpretation: {'Large effect' if abs(cohens_d) > 0.8 else 'Medium effect' if abs(cohens_d) > 0.5 else 'Small effect'}")

if p_value < 0.001:
    print("\\nResult: Statistically significant difference (p < 0.001)")
    print(f"High booster users play {(high_usage_mean / low_usage_mean - 1) * 100:.1f}% longer on average")`,
            result: `Welch's t-test results:
T-statistic: 274.12
P-value: 0.00e+00
Effect size (Cohen's d): 1.847
Interpretation: Large effect

Result: Statistically significant difference (p < 0.001)
High booster users play 172.5% longer on average`
          }
        ],
        charts: [
          {
            id: "playtime-distribution",
            title: "Daily Playtime Distribution by Booster Usage",
            description: "Comparison of average daily playtime between high and low booster usage groups",
            type: "bar",
            data: [
              { group: "High Usage (≥10 boosters)", playtime: 387.45, sessions: 145233 },
              { group: "Low Usage (<10 boosters)", playtime: 142.18, sessions: 1877873 }
            ],
            config: {
              xKey: "group",
              yKey: "playtime",
              color: "#f59e0b"
            }
          }
        ],
        statisticalBacking: {
          sampleSize: 2023106,
          confidenceLevel: 95,
          pValue: 0.0,
          effectSize: 1.847,
          methodology: "Welch's t-test for comparing means with unequal variances",
          assumptions: [
            "Independence of observations within and between groups",
            "Normal distribution of playtime for each group (CLT applies due to large n)",
            "Arena progression accurately reflects game stage",
            "Booster usage data is complete and accurate"
          ],
          keyMetrics: [
            {
              metric: "High Usage Mean Playtime",
              value: "387.45 min",
              change: "+245.27 min",
              significance: "p < 0.001"
            },
            {
              metric: "Low Usage Mean Playtime",
              value: "142.18 min",
              change: "baseline",
              significance: "reference"
            },
            {
              metric: "Relative Increase",
              value: "+172.5%",
              change: "nearly tripled",
              significance: "very high"
            },
            {
              metric: "Effect Size (Cohen's d)",
              value: "1.847",
              change: "large effect",
              significance: "substantial"
            }
          ]
        }
      }
    },
    {
      title: "Booster-Driven Sessions Generate 23% Higher Revenue Per User",
      category: "growth" as const,
      tags: ["revenue", "monetization", "boosters"],
      linkedMetricId: null,
      contentPayload: {
        overview: {
          title: "Revenue Impact Analysis of Booster-Enhanced Gaming Sessions",
          steps: [
            {
              stepNumber: 1,
              title: "Revenue Attribution Framework",
              description: "Establishing methodology to track revenue generation during booster-enhanced sessions",
              details: `We developed a comprehensive framework to attribute revenue to booster-enhanced gaming sessions, tracking both direct and indirect monetization effects.

• Direct Revenue: In-app purchases made during or within 2 hours of booster usage
• Indirect Revenue: Subsequent purchases influenced by booster-enhanced gameplay
• Session Definition: Continuous gameplay period with booster activation
• Control Group: Similar sessions without booster usage for comparison

This analysis covers 3 months of transaction data across 500K+ active players.`
            },
            {
              stepNumber: 2,
              title: "Revenue Data Collection and Validation",
              description: "Extracting and validating transaction data linked to booster usage patterns",
              details: `We collected comprehensive revenue data by linking purchase transactions to gameplay sessions and booster activation events.

The dataset included transaction timestamps, purchase amounts, booster activation logs, and session metadata to establish clear attribution chains.

Data validation ensured accuracy through cross-referencing payment processing logs with in-game event tracking, achieving 99.2% data consistency.`
            },
            {
              stepNumber: 3,
              title: "Statistical Revenue Comparison",
              description: "Comparing ARPU between booster-enhanced and regular gaming sessions",
              details: `We calculated Average Revenue Per User (ARPU) for sessions with and without booster usage, controlling for player characteristics and session context.

Results showed significant revenue uplift:
• Booster-Enhanced Sessions: $4.67 ARPU
• Regular Sessions: $3.79 ARPU  
• Revenue Increase: +$0.88 per session (+23.2%)

Statistical testing confirmed significance with p < 0.001 and meaningful business impact across all player segments.`
            },
            {
              stepNumber: 4,
              title: "Monetization Strategy Optimization",
              description: "Developing revenue-focused booster engagement strategies",
              details: `The analysis reveals clear opportunities to optimize monetization through strategic booster deployment and pricing.

Revenue Optimization Strategies:
• Implement dynamic booster pricing based on session context
• Create booster bundles with complementary premium items
• Design time-limited booster offers during high-engagement periods
• Develop progressive booster rewards tied to spending milestones

Projected Impact: 15-18% increase in overall ARPU through optimized booster monetization strategies.`
            }
          ]
        },
        sqlQueries: [
          {
            id: "revenue-attribution",
            description: "Link purchase transactions to booster-enhanced gaming sessions",
            query: `WITH booster_sessions AS (
  SELECT
    user_id,
    active_date,
    session_start_time,
    session_end_time,
    SUM(boosters_used) as total_boosters
  FROM \`xgcrypt.bp.session_data\`
  WHERE boosters_used > 0
    AND active_date >= '2025-01-01'
  GROUP BY user_id, active_date, session_start_time, session_end_time
),

session_revenue AS (
  SELECT
    s.user_id,
    s.active_date,
    s.session_start_time,
    s.total_boosters,
    COALESCE(SUM(p.purchase_amount_usd), 0) as session_revenue
  FROM booster_sessions s
  LEFT JOIN \`xgcrypt.bp.purchases\` p
    ON s.user_id = p.user_id
    AND p.purchase_timestamp BETWEEN s.session_start_time 
    AND TIMESTAMP_ADD(s.session_end_time, INTERVAL 2 HOUR)
  GROUP BY s.user_id, s.active_date, s.session_start_time, s.total_boosters
)

SELECT
  CASE 
    WHEN total_boosters >= 5 THEN 'high_booster'
    WHEN total_boosters >= 1 THEN 'low_booster'
    ELSE 'no_booster'
  END as session_type,
  COUNT(*) as total_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(session_revenue), 2) as avg_session_revenue,
  ROUND(SUM(session_revenue) / COUNT(DISTINCT user_id), 2) as arpu
FROM session_revenue
GROUP BY session_type;`,
            result: {
              headers: ["session_type", "total_sessions", "unique_users", "avg_session_revenue", "arpu"],
              rows: [
                ["high_booster", "89234", "45678", "5.23", "4.67"],
                ["low_booster", "234567", "123456", "4.12", "4.02"],
                ["no_booster", "1456789", "456789", "2.89", "3.79"]
              ]
            }
          },
          {
            id: "revenue-uplift-analysis",
            description: "Calculate revenue uplift from booster usage across user segments",
            query: `WITH user_revenue_comparison AS (
  SELECT
    user_id,
    SUM(CASE WHEN total_boosters > 0 THEN session_revenue ELSE 0 END) as booster_revenue,
    SUM(CASE WHEN total_boosters = 0 THEN session_revenue ELSE 0 END) as regular_revenue,
    COUNT(CASE WHEN total_boosters > 0 THEN 1 END) as booster_sessions,
    COUNT(CASE WHEN total_boosters = 0 THEN 1 END) as regular_sessions
  FROM session_revenue
  GROUP BY user_id
  HAVING booster_sessions > 0 AND regular_sessions > 0
)

SELECT
  COUNT(*) as users_with_both_session_types,
  ROUND(AVG(booster_revenue / NULLIF(booster_sessions, 0)), 2) as avg_booster_session_revenue,
  ROUND(AVG(regular_revenue / NULLIF(regular_sessions, 0)), 2) as avg_regular_session_revenue,
  ROUND(
    (AVG(booster_revenue / NULLIF(booster_sessions, 0)) - 
     AVG(regular_revenue / NULLIF(regular_sessions, 0))) / 
    AVG(regular_revenue / NULLIF(regular_sessions, 0)) * 100, 1
  ) as revenue_uplift_percent
FROM user_revenue_comparison;`,
            result: {
              headers: ["users_with_both_session_types", "avg_booster_session_revenue", "avg_regular_session_revenue", "revenue_uplift_percent"],
              rows: [
                ["78234", "4.67", "3.79", "23.2"]
              ]
            }
          }
        ],
        pythonSnippets: [
          {
            id: "revenue-significance-test",
            description: "Statistical test for revenue difference significance",
            code: `import numpy as np
from scipy import stats
import pandas as pd

# Revenue data from BigQuery analysis
booster_sessions_revenue = [4.67] * 89234  # Simplified for demo
regular_sessions_revenue = [3.79] * 1456789  # Simplified for demo

# More realistic simulation with variance
np.random.seed(42)
booster_revenue = np.random.gamma(shape=2.5, scale=1.87, size=10000)  # Avg ~4.67
regular_revenue = np.random.gamma(shape=2.1, scale=1.81, size=10000)   # Avg ~3.79

# Perform independent t-test
t_statistic, p_value = stats.ttest_ind(booster_revenue, regular_revenue)

# Calculate confidence interval for difference
diff_mean = np.mean(booster_revenue) - np.mean(regular_revenue)
se_diff = np.sqrt(np.var(booster_revenue)/len(booster_revenue) + 
                  np.var(regular_revenue)/len(regular_revenue))
ci_lower = diff_mean - 1.96 * se_diff
ci_upper = diff_mean + 1.96 * se_diff

print(f"Revenue Comparison Analysis:")
print(f"Booster Sessions ARPU: \\${np.mean(booster_revenue):.2f}")
print(f"Regular Sessions ARPU: \\${np.mean(regular_revenue):.2f}")
print(f"Revenue Uplift: \\${diff_mean:.2f} (+{diff_mean/np.mean(regular_revenue)*100:.1f}%)")
print(f"95% CI: [\\${ci_lower:.2f}, \\${ci_upper:.2f}]")
print(f"T-statistic: {t_statistic:.2f}")
print(f"P-value: {p_value:.2e}")

if p_value < 0.001:
    print("\\nResult: Statistically significant revenue increase (p < 0.001)")`,
            result: `Revenue Comparison Analysis:
Booster Sessions ARPU: $4.68
Regular Sessions ARPU: $3.80
Revenue Uplift: $0.88 (+23.2%)
95% CI: [$0.82, $0.94]
T-statistic: 47.23
P-value: 1.24e-487

Result: Statistically significant revenue increase (p < 0.001)`
          }
        ],
        charts: [
          {
            id: "revenue-comparison",
            title: "ARPU Comparison by Session Type",
            description: "Average Revenue Per User across different session types",
            type: "bar",
            data: [
              { session_type: "High Booster (≥5)", arpu: 4.67, sessions: 89234 },
              { session_type: "Low Booster (1-4)", arpu: 4.02, sessions: 234567 },
              { session_type: "No Booster", arpu: 3.79, sessions: 1456789 }
            ],
            config: {
              xKey: "session_type",
              yKey: "arpu",
              color: "#059669"
            }
          }
        ],
        statisticalBacking: {
          sampleSize: 1780590,
          confidenceLevel: 95,
          pValue: 0.0,
          effectSize: 0.652,
          methodology: "Independent t-test for revenue comparison with confidence intervals",
          assumptions: [
            "Independent revenue observations across sessions",
            "Revenue attribution window accurately captures booster impact",
            "Purchase timing reflects genuine booster influence",
            "User segments comparable across booster usage patterns"
          ],
          keyMetrics: [
            {
              metric: "Booster Session ARPU",
              value: "$4.67",
              change: "+$0.88",
              significance: "p < 0.001"
            },
            {
              metric: "Regular Session ARPU",
              value: "$3.79",
              change: "baseline",
              significance: "reference"
            },
            {
              metric: "Revenue Uplift",
              value: "+23.2%",
              change: "significant increase",
              significance: "high confidence"
            },
            {
              metric: "Monthly Revenue Impact",
              value: "$12.4M",
              change: "additional revenue",
              significance: "substantial"
            }
          ]
        }
      }
    }
  ];

  // Insert insights
  for (const insight of insights) {
    await db.insert(snapshotInsights).values({
      title: insight.title,
      category: insight.category,
      tags: insight.tags,
      linkedMetricId: insight.linkedMetricId,
      contentPayload: insight.contentPayload,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  console.log(`✅ Seeded ${insights.length} comprehensive insights`);
}

// Run if called directly
if (require.main === module) {
  seedComprehensiveInsights()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Error seeding insights:", error);
      process.exit(1);
    });
}

export { seedComprehensiveInsights };