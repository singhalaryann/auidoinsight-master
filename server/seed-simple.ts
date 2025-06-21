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
      details: "Spanish high-value users are spending significantly more than the European average. This trend has been consistent for the past week.",
      cta: "View Spanish cohort analysis",
      sqlQuery: "SELECT country, AVG(total_revenue) as avg_revenue FROM user_metrics WHERE total_revenue > 50 GROUP BY country ORDER BY avg_revenue DESC;",
      pythonScript: "import pandas as pd\ndf = pd.read_sql(query, connection)\nprint('Spain ARPPU analysis complete')",
      statisticalBacking: {
        sampleSize: 12450,
        confidenceLevel: 95,
        pValue: 0.0023,
        effectSize: 0.734,
        methodology: "Two-sample t-test comparing Spanish whale revenue against European average.",
        assumptions: ["Revenue data follows normal distribution", "Independent observations"],
        keyMetrics: [
          { metric: "Spanish ARPPU", value: "$127.45", change: "+18.2%", significance: "High" },
          { metric: "EU Average ARPPU", value: "$107.83", change: "Baseline", significance: "-" }
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
      details: "Players reaching level 10 show 25% higher churn than previous levels. This suggests a difficulty spike that needs attention.",
      cta: "Analyze level progression",
      sqlQuery: "SELECT player_level, COUNT(*) as total_players, AVG(churn_rate) as avg_churn FROM player_progression GROUP BY player_level;",
      pythonScript: "import pandas as pd\ndf = pd.read_sql(query, connection)\nprint('Level progression analysis complete')",
      statisticalBacking: {
        sampleSize: 8920,
        confidenceLevel: 95,
        pValue: 0.0012,
        effectSize: 0.423,
        methodology: "Chi-square test comparing churn rates across player levels.",
        assumptions: ["Independent player progression", "Minimum 500 players per level"],
        keyMetrics: [
          { metric: "Level 10 Churn Rate", value: "18.3%", change: "+25%", significance: "High" },
          { metric: "Average Churn", value: "14.6%", change: "Baseline", significance: "-" }
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
      details: "Players show significantly higher engagement during weekends. Session duration and frequency both increase.",
      cta: "Plan weekend campaigns",
      sqlQuery: "SELECT EXTRACT(DOW FROM session_date) as day_of_week, AVG(session_duration) FROM user_sessions GROUP BY day_of_week;",
      pythonScript: "import pandas as pd\ndf = pd.read_sql(query, connection)\nprint('Weekend engagement analysis complete')",
      statisticalBacking: {
        sampleSize: 45600,
        confidenceLevel: 95,
        pValue: 0.0001,
        effectSize: 0.892,
        methodology: "ANOVA comparing session metrics across days of week.",
        assumptions: ["Session duration measured accurately", "Users active across multiple days"],
        keyMetrics: [
          { metric: "Weekend Session Duration", value: "47.3 min", change: "+35%", significance: "High" },
          { metric: "Weekday Session Duration", value: "35.1 min", change: "Baseline", significance: "-" }
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