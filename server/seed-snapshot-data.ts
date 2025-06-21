import { db } from "./db";
import { snapshotMetrics, snapshotInsights } from "@shared/schema";

// Sample metric data with realistic business KPIs
const sampleMetrics = [
  {
    name: "Revenue per DAU",
    tags: ["monetization", "retention"],
    metricType: "currency",
    sourceQuery: "SELECT AVG(daily_revenue / dau) FROM daily_metrics WHERE date >= CURRENT_DATE - 7",
    queryParams: { timeframe: "7d", currency: "USD" },
    displayConfig: { format: "currency", precision: 2 },
    currentPayload: {
      currentValue: "$1.27",
      displayName: "Rev / DAU",
      deltaDisplay: "+3.2%",
      deltaType: "positive",
      sparklineData: [1.18, 1.22, 1.19, 1.25, 1.23, 1.26, 1.27]
    }
  },
  {
    name: "Day 1 Retention",
    tags: ["retention", "engagement"],
    metricType: "percentage",
    sourceQuery: "SELECT AVG(day1_retention) FROM cohort_retention WHERE cohort_date >= CURRENT_DATE - 7",
    queryParams: { cohort_days: 7 },
    displayConfig: { format: "percentage", precision: 1 },
    currentPayload: {
      currentValue: "42.3%",
      displayName: "Retention",
      deltaDisplay: "▲1.2pp",
      deltaType: "positive",
      sparklineData: [38.1, 39.2, 41.0, 40.5, 42.1, 41.8, 42.3]
    }
  },
  {
    name: "ARPDAU",
    tags: ["monetization", "store"],
    metricType: "currency",
    sourceQuery: "SELECT AVG(revenue / dau) FROM daily_metrics WHERE date >= CURRENT_DATE - 7",
    queryParams: { timeframe: "7d" },
    displayConfig: { format: "currency", precision: 2 },
    currentPayload: {
      currentValue: "$0.37",
      displayName: "ARPDAU",
      deltaDisplay: "▼0.5%",
      deltaType: "negative",
      sparklineData: [0.39, 0.38, 0.37, 0.38, 0.36, 0.37, 0.37]
    }
  },
  {
    name: "Paying User Percentage",
    tags: ["monetization", "engagement"],
    metricType: "percentage",
    sourceQuery: "SELECT (COUNT(DISTINCT paying_users) / COUNT(DISTINCT active_users)) * 100 FROM user_metrics",
    queryParams: { min_purchase: 0.01 },
    displayConfig: { format: "percentage", precision: 1 },
    currentPayload: {
      currentValue: "4.5%",
      displayName: "Paying %",
      deltaDisplay: "▲0.2pp",
      deltaType: "positive",
      sparklineData: [4.1, 4.2, 4.3, 4.4, 4.3, 4.4, 4.5]
    }
  },
  {
    name: "Onboarding Funnel",
    tags: ["engagement", "ua"],
    metricType: "funnel",
    sourceQuery: "SELECT tutorial_completion_rate, first_purchase_rate FROM onboarding_funnel",
    queryParams: { steps: ["tutorial", "first_purchase"] },
    displayConfig: { format: "funnel", steps: 2 },
    currentPayload: {
      currentValue: "85% → 22%",
      displayName: "Onboard Funnel",
      deltaDisplay: "▼1.5%",
      deltaType: "negative",
      sparklineData: [24.1, 23.2, 22.8, 23.1, 21.9, 22.3, 22.0]
    }
  }
];

// Sample insight data with realistic business intelligence
const sampleInsights = [
  {
    title: "Spanish Whale Revenue Spike",
    tags: ["monetization", "engagement"],
    isActive: true,
    contentPayload: {
      category: "growth",
      message: "Spain whales: ARPPU +18% vs EU avg.",
      timestamp: "2h ago",
      details: "Spanish high-value users are spending significantly more than the European average. This trend has been consistent for the past week, with Spanish players in the top 10% spending tier showing exceptional engagement with premium content and in-app purchases.",
      cta: "View Spanish cohort analysis",
      sqlQuery: `SELECT 
  country,
  COUNT(*) as total_players,
  AVG(total_revenue) as avg_revenue_per_user,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY total_revenue) as p90_revenue
FROM user_metrics um
JOIN user_profiles up ON um.user_id = up.id
WHERE up.registration_date >= CURRENT_DATE - INTERVAL '30 days'
  AND um.total_revenue > 50
GROUP BY country
HAVING COUNT(*) > 100
ORDER BY avg_revenue_per_user DESC;`,
      pythonScript: `import pandas as pd
import numpy as np
from scipy import stats

# Load revenue data by country
df = pd.read_sql(query, connection)

# Calculate statistical significance
spain_revenue = df[df['country'] == 'Spain']['avg_revenue_per_user'].values[0]
eu_avg_revenue = df[df['country'].isin(['Germany', 'France', 'Italy', 'Netherlands'])]['avg_revenue_per_user'].mean()

# Perform t-test
spain_data = get_user_revenue_data('Spain')
eu_data = get_user_revenue_data(['Germany', 'France', 'Italy', 'Netherlands'])

t_stat, p_value = stats.ttest_ind(spain_data, eu_data)
effect_size = (spain_revenue - eu_avg_revenue) / np.sqrt((np.var(spain_data) + np.var(eu_data)) / 2)

print(f'Spain ARPPU: $' + str(spain_revenue))
print(f'EU Average ARPPU: $' + str(eu_avg_revenue))
print(f'Lift: ' + str(((spain_revenue / eu_avg_revenue) - 1) * 100) + '%')
print(f'P-value: ' + str(p_value))
print(f'Effect size (Cohen d): ' + str(effect_size))`,
      statisticalBacking: {
        sampleSize: 12450,
        confidenceLevel: 95,
        pValue: 0.0023,
        effectSize: 0.734,
        methodology: "Two-sample t-test comparing Spanish whale revenue against European average. Data collected over 30-day period with minimum spend threshold of $50 to qualify as whale segment.",
        assumptions: [
          "Revenue data follows approximately normal distribution after log transformation",
          "Independent observations between country cohorts",
          "Minimum 100 users per country for statistical significance",
          "Exchange rates normalized to USD for comparison"
        ],
        keyMetrics: [
          { metric: "Spanish ARPPU", value: "$127.45", change: "+18.2%", significance: "High" },
          { metric: "EU Average ARPPU", value: "$107.83", change: "Baseline", significance: "-" },
          { metric: "Sample Size (Spain)", value: "2,847", change: "+12%", significance: "Medium" },
          { metric: "Conversion Rate", value: "4.8%", change: "+0.7pp", significance: "Medium" }
        ]
      }
    },
    linkedMetricId: null
  },
  {
    title: "Level 10 Churn Risk",
    tags: ["retention", "engagement"],
    isActive: true,
    contentPayload: {
      category: "risk",
      message: "Churn risk rising in Lvl 10 players",
      timestamp: "4h ago",
      details: "Players reaching level 10 show 25% higher churn than previous levels. This suggests a difficulty spike or content gap that needs immediate attention to prevent player loss.",
      cta: "Analyze level progression",
      sqlQuery: `SELECT 
  player_level,
  COUNT(*) as total_players,
  SUM(CASE WHEN churned = true THEN 1 ELSE 0 END) as churned_players,
  (SUM(CASE WHEN churned = true THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as churn_rate,
  AVG(session_duration) as avg_session_time
FROM player_progression pp
JOIN user_metrics um ON pp.user_id = um.user_id
WHERE player_level BETWEEN 8 AND 12
  AND pp.level_reached_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY player_level
ORDER BY player_level;`,
      pythonScript: `import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import chi2_contingency

# Load level progression and churn data
df = pd.read_sql(query, connection)

# Calculate churn rate increase at level 10
level_9_churn = df[df['player_level'] == 9]['churn_rate'].values[0]
level_10_churn = df[df['player_level'] == 10]['churn_rate'].values[0]

churn_increase = ((level_10_churn / level_9_churn) - 1) * 100

# Statistical test for significance
contingency_table = df[['total_players', 'churned_players']].values
chi2, p_value, dof, expected = chi2_contingency(contingency_table)

print(f'Level 9 Churn Rate: {level_9_churn:.1f}%')
print(f'Level 10 Churn Rate: {level_10_churn:.1f}%')
print(f'Churn Increase: +{churn_increase:.1f}%')
print(f'Statistical Significance (p-value): {p_value:.4f}')

# Visualization
plt.figure(figsize=(10, 6))
plt.plot(df['player_level'], df['churn_rate'], marker='o', linewidth=2)
plt.xlabel('Player Level')
plt.ylabel('Churn Rate (%)')
plt.title('Churn Rate by Player Level')
plt.axvline(x=10, color='red', linestyle='--', alpha=0.7, label='Level 10 Spike')
plt.legend()
plt.savefig('level_churn_analysis.png')`,
      statisticalBacking: {
        sampleSize: 8920,
        confidenceLevel: 95,
        pValue: 0.0012,
        effectSize: 0.423,
        methodology: "Chi-square test of independence comparing churn rates across player levels 8-12. Sample includes players who reached these levels in the past 14 days.",
        assumptions: [
          "Independent player progression events",
          "Minimum 500 players per level for statistical power",
          "Churn defined as 7+ days of inactivity",
          "Level progression tracked accurately"
        ],
        keyMetrics: [
          { metric: "Level 10 Churn Rate", value: "18.3%", change: "+25%", significance: "High" },
          { metric: "Average Churn (Levels 8-9)", value: "14.6%", change: "Baseline", significance: "-" },
          { metric: "Players Affected", value: "1,247", change: "Daily", significance: "High" },
          { metric: "Revenue Impact", value: "$-23.4K", change: "Weekly", significance: "High" }
        ]
      }
    },
    linkedMetricId: null
  },
  {
    title: "Weekend Engagement Boost",
    tags: ["engagement", "social"],
    isActive: true,
    contentPayload: {
      category: "opportunity",
      message: "Weekend sessions +35% vs weekdays",
      timestamp: "6h ago",
      details: "Players show significantly higher engagement during weekends. Session duration and frequency both increase, suggesting optimal timing for events and social features.",
      cta: "Plan weekend campaigns",
      sqlQuery: `SELECT 
  EXTRACT(DOW FROM session_date) as day_of_week,
  AVG(session_duration) as avg_duration,
  AVG(sessions_per_user) as avg_frequency,
  COUNT(DISTINCT user_id) as active_users
FROM user_sessions
WHERE session_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY EXTRACT(DOW FROM session_date)
ORDER BY day_of_week;`,
      pythonScript: `import pandas as pd
import numpy as np

# Load session data
df = pd.read_sql(query, connection)

# Map day numbers to names
day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
df['day_name'] = df['day_of_week'].map(lambda x: day_names[int(x)])

# Calculate weekend vs weekday metrics
weekend_data = df[df['day_of_week'].isin([0, 6])]  # Sunday and Saturday
weekday_data = df[df['day_of_week'].isin([1, 2, 3, 4, 5])]  # Monday to Friday

weekend_avg_duration = weekend_data['avg_duration'].mean()
weekday_avg_duration = weekday_data['avg_duration'].mean()

engagement_lift = ((weekend_avg_duration / weekday_avg_duration) - 1) * 100

print(f'Weekend Average Session: {weekend_avg_duration:.1f} minutes')
print(f'Weekday Average Session: {weekday_avg_duration:.1f} minutes')
print(f'Weekend Engagement Lift: +{engagement_lift:.1f}%')

# Opportunity sizing
weekend_users = weekend_data['active_users'].sum()
potential_revenue_lift = weekend_users * 0.37 * (engagement_lift / 100)  # ARPDAU * lift
print(f'Potential Weekly Revenue Opportunity: ${potential_revenue_lift:.0f}')`,
      statisticalBacking: {
        sampleSize: 45600,
        confidenceLevel: 95,
        pValue: 0.0001,
        effectSize: 0.892,
        methodology: "ANOVA comparing session metrics across days of week. Sample includes all active users over 30-day period with minimum 3 sessions per week.",
        assumptions: [
          "Session duration measured accurately",
          "Users active across multiple days",
          "Timezone differences normalized",
          "Outlier sessions (>4 hours) excluded"
        ],
        keyMetrics: [
          { metric: "Weekend Session Duration", value: "47.3 min", change: "+35%", significance: "High" },
          { metric: "Weekday Session Duration", value: "35.1 min", change: "Baseline", significance: "-" },
          { metric: "Weekend Active Users", value: "89.2K", change: "+12%", significance: "Medium" },
          { metric: "Revenue Opportunity", value: "$14.7K", change: "Weekly", significance: "Medium" }
        ]
      }
    },
    linkedMetricId: null
  }
];

export async function seedSnapshotData() {
  try {
    console.log('Seeding snapshot metrics...');
    
    // Insert metrics
    for (const metric of sampleMetrics) {
      await db.insert(snapshotMetrics).values(metric);
    }
    
    console.log('Seeding snapshot insights...');
    
    // Insert insights
    for (const insight of sampleInsights) {
      await db.insert(snapshotInsights).values(insight);
    }
    
    console.log('✅ Snapshot data seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding snapshot data:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSnapshotData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}