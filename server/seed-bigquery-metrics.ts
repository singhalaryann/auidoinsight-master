import { db } from "./db";
import { snapshotMetrics } from "@shared/schema";

// Using the provided daily_active_users metric as reference
const bigQueryMetrics = [
  {
    name: "Daily Active Users",
    tags: ["engagement"],
    metricType: "chart",
    sourceQuery: `
      SELECT
        t1.active_date,
        COUNT(DISTINCT t1.user_id) AS dau_count
      FROM
        \`xgcrypt.bp.wide\` AS t1
      WHERE
        t1.user_id IS NOT NULL
        AND {{date_filter_clause}}
      GROUP BY
        t1.active_date
      ORDER BY
        t1.active_date DESC
      LIMIT 1
    `,
    queryParams: {
      date_filter_clause: "t1.active_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)"
    },
    displayConfig: {
      title: "Daily Active Users",
      description: "Number of unique users active each day",
      chart_type: "combo",
      x_axis_key: "active_date",
      elements: [
        {
          type: "area",
          data_key: "dau_count",
          name: "DAU",
          fill: "#3b82f6",
          stroke: "#1e40af"
        }
      ]
    }
  },
  {
    name: "Weekly Active Users",
    tags: ["engagement", "retention"],
    metricType: "chart",
    sourceQuery: `
      SELECT
        DATE_TRUNC(t1.active_date, WEEK) as week_date,
        COUNT(DISTINCT t1.user_id) AS wau_count
      FROM
        \`xgcrypt.bp.wide\` AS t1
      WHERE
        t1.user_id IS NOT NULL
        AND {{date_filter_clause}}
      GROUP BY
        week_date
      ORDER BY
        week_date DESC
      LIMIT 1
    `,
    queryParams: {
      date_filter_clause: "t1.active_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)"
    },
    displayConfig: {
      title: "Weekly Active Users",
      description: "Number of unique users active each week"
    }
  },
  {
    name: "Monthly Active Users",
    tags: ["engagement", "retention"],
    metricType: "chart",
    sourceQuery: `
      SELECT
        DATE_TRUNC(t1.active_date, MONTH) as month_date,
        COUNT(DISTINCT t1.user_id) AS mau_count
      FROM
        \`xgcrypt.bp.wide\` AS t1
      WHERE
        t1.user_id IS NOT NULL
        AND {{date_filter_clause}}
      GROUP BY
        month_date
      ORDER BY
        month_date DESC
      LIMIT 1
    `,
    queryParams: {
      date_filter_clause: "t1.active_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)"
    },
    displayConfig: {
      title: "Monthly Active Users",
      description: "Number of unique users active each month"
    }
  }
];

export async function updateMetricsWithBigQuery() {
  try {
    console.log('Updating metrics with BigQuery queries...');
    
    // Clear existing metrics
    await db.delete(snapshotMetrics);
    
    // Insert new BigQuery metrics
    for (const metric of bigQueryMetrics) {
      await db.insert(snapshotMetrics).values({
        ...metric,
        currentPayload: null, // Will be populated by BigQuery processing
        lastUpdated: null
      });
    }
    
    console.log('✅ Metrics updated with BigQuery queries');
  } catch (error) {
    console.error('❌ Error updating metrics:', error);
    throw error;
  }
}

// Run update if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMetricsWithBigQuery()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}