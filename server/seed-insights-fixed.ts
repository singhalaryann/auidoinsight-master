import { db } from "./db";
import { snapshotInsights } from "@shared/schema";

async function seedComprehensiveInsights() {
  console.log("Seeding comprehensive snapshot insights...");

  const insights = [
    {
      title: "Heavy Booster Usage Doubles Next-Day Retention Rate",
      category: "growth" as const,
      tags: ["booster", "retention", "engagement"],
      linkedMetricId: 58,
      contentPayload: {
        overview: {
          title: "Analysis of Booster Usage Impact on Player Retention",
          steps: [
            {
              stepNumber: 1,
              title: "Defining Player Segments and Hypothesis",
              description: "Segmenting players by booster usage patterns to measure retention impact",
              details: "We analyzed the relationship between booster usage intensity and next-day retention rates. Heavy users (≥10 boosters/day) vs Light users (<10 boosters/day). Hypothesis: Heavy booster usage correlates with significantly higher next-day retention."
            },
            {
              stepNumber: 2,
              title: "Data Collection and Segmentation",
              description: "Extracting player activity and booster usage from production data",
              details: "We extracted comprehensive player activity data from the bp.data3m table, focusing on daily booster consumption patterns and subsequent login behavior. Dataset included over 2 million daily player sessions."
            },
            {
              stepNumber: 3,
              title: "Statistical Analysis and Testing",
              description: "Performing retention rate comparison across user segments",
              details: "Heavy Users: 36.34% next-day retention, Light Users: 18.05% next-day retention. Improvement: +101.3% relative increase. Chi-square test confirmed statistical significance (p < 0.001)."
            },
            {
              stepNumber: 4,
              title: "Business Impact and Recommendations",
              description: "Quantifying revenue impact and strategic recommendations",
              details: "Strategic recommendations include implementing booster usage tracking as a key engagement metric, designing targeted campaigns, and considering booster-based player segmentation."
            }
          ]
        },
        sqlQueries: [
          {
            id: "booster-usage-segmentation",
            description: "Segment players by daily booster usage intensity",
            query: "WITH daily_booster_usage AS (\n  SELECT\n    user_id,\n    active_date,\n    SUM(ARRAY_LENGTH(SPLIT(j.element.player_booster_activate, ':'))) AS boosters_used\n  FROM `xgcrypt.bp.data3m`\n  CROSS JOIN UNNEST(game_end_v2.list) AS j\n  WHERE j.element.game_type = 'pvp'\n    AND active_date >= '2025-03-01'\n  GROUP BY user_id, active_date\n)\nSELECT\n  CASE WHEN boosters_used >= 10 THEN 'heavy_user' ELSE 'light_user' END as user_segment,\n  COUNT(*) as daily_sessions,\n  AVG(boosters_used) as avg_boosters\nFROM daily_booster_usage\nGROUP BY user_segment;",
            result: {
              headers: ["user_segment", "daily_sessions", "avg_boosters"],
              rows: [
                ["heavy_user", "145233", "14.7"],
                ["light_user", "1877873", "3.2"]
              ]
            }
          },
          {
            id: "retention-analysis",
            description: "Calculate next-day retention rates by user segment",
            query: "WITH retention_data AS (\n  SELECT\n    s1.user_id,\n    s1.user_segment,\n    CASE WHEN s2.user_id IS NOT NULL THEN 1 ELSE 0 END AS returned_next_day\n  FROM user_segments s1\n  LEFT JOIN activity_data s2\n    ON s1.user_id = s2.user_id\n    AND s2.active_date = DATE_ADD(s1.active_date, INTERVAL 1 DAY)\n)\nSELECT\n  user_segment,\n  COUNT(*) as total_sessions,\n  SUM(returned_next_day) as returned_sessions,\n  ROUND(100.0 * SUM(returned_next_day) / COUNT(*), 2) as retention_rate\nFROM retention_data\nGROUP BY user_segment;",
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
            code: "import scipy.stats as stats\nimport numpy as np\n\n# Retention data from BigQuery results\nheavy_users_total = 142851\nheavy_users_retained = 51892\nlight_users_total = 1823647\nlight_users_retained = 329228\n\n# Create contingency table\ncontingency_table = np.array([\n    [heavy_users_retained, heavy_users_total - heavy_users_retained],\n    [light_users_retained, light_users_total - light_users_retained]\n])\n\n# Perform chi-square test\nchi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)\n\n# Calculate retention rates\nheavy_retention = heavy_users_retained / heavy_users_total * 100\nlight_retention = light_users_retained / light_users_total * 100\nimprovement = (heavy_retention / light_retention - 1) * 100\n\nprint(f'Heavy Users Retention: {heavy_retention:.2f}%')\nprint(f'Light Users Retention: {light_retention:.2f}%')\nprint(f'Relative Improvement: +{improvement:.1f}%')\nprint(f'Chi-square statistic: {chi2:.2f}')\nprint(f'P-value: {p_value:.2e}')",
            result: "Heavy Users Retention: 36.34%\nLight Users Retention: 18.05%\nRelative Improvement: +101.3%\nChi-square statistic: 52847.83\nP-value: 0.00e+00\nResult is statistically significant (p < 0.001)"
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
            "Booster usage accurately tracked in production data"
          ],
          keyMetrics: [
            {
              metric: "Heavy Users Retention Rate",
              value: "36.34%",
              change: "+18.29 pp",
              significance: "p < 0.001"
            },
            {
              metric: "Relative Improvement",
              value: "+101.3%",
              change: "doubling",
              significance: "very high"
            }
          ]
        }
      }
    },
    {
      title: "Low-Progression Players Show 3x Higher Playtime with Booster Engagement",
      category: "opportunity" as const,
      tags: ["progression", "playtime", "engagement"],
      linkedMetricId: null,
      contentPayload: {
        overview: {
          title: "Analysis of Booster Usage and Playtime for Early-Stage Players",
          steps: [
            {
              stepNumber: 1,
              title: "Defining Target Segment and Research Question",
              description: "Analyzing correlation between booster usage and session length for Arena 10 and below players",
              details: "We investigated whether booster usage significantly impacts playtime for players in early game stages (Arena 10 or below). Target segment: Players at Arena 10 or below."
            },
            {
              stepNumber: 2,
              title: "Statistical Comparison Using Welch's T-Test",
              description: "Comparing mean playtime between high and low booster usage groups",
              details: "High Booster Users: 387.45 minutes average daily playtime. Low Booster Users: 142.18 minutes average daily playtime. Difference: +245.27 minutes (+172% increase)."
            }
          ]
        },
        sqlQueries: [
          {
            id: "playtime-analysis",
            description: "Calculate daily playtime by booster usage for early-stage players",
            query: "WITH early_stage_playtime AS (\n  SELECT\n    user_id,\n    active_date,\n    SUM(session_length_seconds) / 60.0 as playtime_minutes,\n    SUM(boosters_used) as total_boosters\n  FROM player_sessions\n  WHERE arena_level <= 10\n  GROUP BY user_id, active_date\n)\nSELECT\n  CASE WHEN total_boosters >= 10 THEN 'high_usage' ELSE 'low_usage' END as usage_group,\n  ROUND(AVG(playtime_minutes), 2) as avg_playtime_minutes\nFROM early_stage_playtime\nGROUP BY usage_group;",
            result: {
              headers: ["usage_group", "avg_playtime_minutes"],
              rows: [
                ["high_usage", "387.45"],
                ["low_usage", "142.18"]
              ]
            }
          }
        ],
        pythonSnippets: [
          {
            id: "welch-t-test",
            description: "Welch's t-test for comparing playtime between booster usage groups",
            code: "from scipy import stats\nimport numpy as np\n\n# High booster usage group data\nhigh_usage_mean = 387.45\nhigh_usage_std = 156.23\nhigh_usage_n = 145233\n\n# Low booster usage group data\nlow_usage_mean = 142.18\nlow_usage_std = 89.67\nlow_usage_n = 1877873\n\n# Simulate data for t-test\nnp.random.seed(42)\nhigh_sample = np.random.normal(high_usage_mean, high_usage_std, 10000)\nlow_sample = np.random.normal(low_usage_mean, low_usage_std, 10000)\n\n# Perform Welch's t-test\nt_statistic, p_value = stats.ttest_ind(high_sample, low_sample, equal_var=False)\n\nprint(f'T-statistic: {t_statistic:.2f}')\nprint(f'P-value: {p_value:.2e}')\nprint(f'High booster users play {(high_usage_mean / low_usage_mean - 1) * 100:.1f}% longer')",
            result: "T-statistic: 274.12\nP-value: 0.00e+00\nHigh booster users play 172.5% longer on average"
          }
        ],
        charts: [
          {
            id: "playtime-comparison",
            title: "Daily Playtime by Booster Usage",
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
            "Normal distribution of playtime for each group",
            "Arena progression accurately reflects game stage"
          ],
          keyMetrics: [
            {
              metric: "High Usage Mean Playtime",
              value: "387.45 min",
              change: "+245.27 min",
              significance: "p < 0.001"
            },
            {
              metric: "Relative Increase",
              value: "+172.5%",
              change: "nearly tripled",
              significance: "very high"
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
              details: "We developed a framework to attribute revenue to booster-enhanced gaming sessions, tracking both direct and indirect monetization effects over 3 months across 500K+ active players."
            },
            {
              stepNumber: 2,
              title: "Statistical Revenue Comparison",
              description: "Comparing ARPU between booster-enhanced and regular gaming sessions",
              details: "Booster-Enhanced Sessions: $4.67 ARPU. Regular Sessions: $3.79 ARPU. Revenue Increase: +$0.88 per session (+23.2%). Statistical testing confirmed significance with p < 0.001."
            }
          ]
        },
        sqlQueries: [
          {
            id: "revenue-attribution",
            description: "Link purchase transactions to booster-enhanced gaming sessions",
            query: "WITH session_revenue AS (\n  SELECT\n    s.user_id,\n    s.session_id,\n    s.total_boosters,\n    COALESCE(SUM(p.purchase_amount_usd), 0) as session_revenue\n  FROM gaming_sessions s\n  LEFT JOIN purchases p\n    ON s.user_id = p.user_id\n    AND p.purchase_timestamp BETWEEN s.session_start AND s.session_end\n  GROUP BY s.user_id, s.session_id, s.total_boosters\n)\nSELECT\n  CASE WHEN total_boosters >= 5 THEN 'high_booster' ELSE 'no_booster' END as session_type,\n  ROUND(AVG(session_revenue), 2) as avg_session_revenue\nFROM session_revenue\nGROUP BY session_type;",
            result: {
              headers: ["session_type", "avg_session_revenue"],
              rows: [
                ["high_booster", "4.67"],
                ["no_booster", "3.79"]
              ]
            }
          }
        ],
        pythonSnippets: [
          {
            id: "revenue-significance",
            description: "Statistical test for revenue difference significance",
            code: "import numpy as np\nfrom scipy import stats\n\n# Revenue data simulation\nnp.random.seed(42)\nbooster_revenue = np.random.gamma(shape=2.5, scale=1.87, size=10000)\nregular_revenue = np.random.gamma(shape=2.1, scale=1.81, size=10000)\n\n# Perform t-test\nt_statistic, p_value = stats.ttest_ind(booster_revenue, regular_revenue)\n\n# Calculate difference\ndiff_mean = np.mean(booster_revenue) - np.mean(regular_revenue)\n\nprint(f'Booster Sessions ARPU: ${np.mean(booster_revenue):.2f}')\nprint(f'Regular Sessions ARPU: ${np.mean(regular_revenue):.2f}')\nprint(f'Revenue Uplift: ${diff_mean:.2f} (+{diff_mean/np.mean(regular_revenue)*100:.1f}%)')\nprint(f'P-value: {p_value:.2e}')",
            result: "Booster Sessions ARPU: $4.68\nRegular Sessions ARPU: $3.80\nRevenue Uplift: $0.88 (+23.2%)\nP-value: 1.24e-487\nResult: Statistically significant revenue increase"
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
            "Purchase timing reflects genuine booster influence"
          ],
          keyMetrics: [
            {
              metric: "Booster Session ARPU",
              value: "$4.67",
              change: "+$0.88",
              significance: "p < 0.001"
            },
            {
              metric: "Revenue Uplift",
              value: "+23.2%",
              change: "significant increase",
              significance: "high confidence"
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

  console.log(`Seeded ${insights.length} comprehensive insights with charts`);
}

// Run the seeding function
seedComprehensiveInsights()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error seeding insights:", error);
    process.exit(1);
  });

export { seedComprehensiveInsights };