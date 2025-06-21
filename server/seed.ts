import { storage } from "./storage.js";

async function seedAnalysisResults() {
  try {
    // First, create a question that will have analysis results
    const question = await storage.createQuestion({
      userId: 1,
      text: "How does weekend gameplay affect weekday retention rates?",
      source: "web",
      status: "ready",
      intent: JSON.stringify({
        pillars: ["engagement", "retention"],
        confidence: 0.92,
        primaryPillar: "retention"
      }),
      result: null
    });

    // Create comprehensive analysis result for this question
    const analysisResult = await storage.createAnalysisResult({
      questionId: question.id,
      insightTitle: "Weekend play drives next-day retention +16 pp",
      executiveSummary: "Weekend players show significantly higher weekday retention than weekday-only players.",
      liftPercent: 27,
      pValue: 1e-300,
      effectSize: 0.14,
      keyMetrics: JSON.stringify([
        { group: "Weekend Players", retentionPercent: 75.8, absoluteUplift: 16.1, relativeUplift: 27.0 },
        { group: "Weekday-Only Players", retentionPercent: 59.7, absoluteUplift: 0, relativeUplift: 0 }
      ]),
      chartData: JSON.stringify([
        { name: "Weekend Players", value: 75.8 },
        { name: "Weekday-Only Players", value: 59.7 }
      ]),
      businessInsights: [
        "Effect is statistically significant with p < 1e-300",
        "16.1 percentage point absolute lift represents meaningful impact", 
        "Correlation doesn't imply causation; confounders possible",
        "Highlight weekend features in Monday push notifications"
      ],
      assumptions: "2 × 2 χ² on 333k player-days, Jan – Mar 2025; no seasonality controls.",
      sqlQuery: `SELECT 
  weekend_player_flag,
  COUNT(*) as players,
  SUM(CASE WHEN retained_next_day = 1 THEN 1 ELSE 0 END) as retained,
  AVG(CASE WHEN retained_next_day = 1 THEN 1.0 ELSE 0.0 END) as retention_rate
FROM player_sessions 
WHERE session_date BETWEEN '2025-01-01' AND '2025-03-31'
GROUP BY weekend_player_flag;`,
      queryResult: JSON.stringify({
        rows: [
          { weekend_player_flag: false, players: 187432, retained: 111834, retention_rate: 0.597 },
          { weekend_player_flag: true, players: 145621, retained: 110361, retention_rate: 0.758 }
        ]
      }),
      pythonScript: `import scipy.stats as stats
import numpy as np

# Data from SQL query
weekend_retained = 110361
weekend_total = 145621
weekday_retained = 111834
weekday_total = 187432

# Chi-square test
contingency_table = np.array([
    [weekend_retained, weekend_total - weekend_retained],
    [weekday_retained, weekday_total - weekday_retained]
])

chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
effect_size = np.sqrt(chi2 / np.sum(contingency_table))

print(f"Chi-square statistic: {chi2:.2f}")
print(f"P-value: {p_value:.2e}")
print(f"Effect size (Phi): {effect_size:.3f}")`,
      pythonOutput: `Chi-square statistic: 6547.23
P-value: 0.00e+00
Effect size (Phi): 0.140`,
      tests: JSON.stringify([
        {
          id: "chi_square",
          label: "Chi-Square Test",
          summary: "χ² = 6547.23, p < 1e-300, df = 1",
          params: {
            "χ² Statistic": 6547.23,
            "P-value": 0.0,
            "Degrees of Freedom": 1
          },
          tables: [
            {
              title: "Expected vs Observed",
              headers: ["Group", "Observed", "Expected"],
              rows: [
                ["Weekend Retained", 110361, 103284],
                ["Weekend Not Retained", 35260, 42337],
                ["Weekday Retained", 111834, 118911],
                ["Weekday Not Retained", 75598, 68521]
              ]
            }
          ]
        },
        {
          id: "effect_size",
          label: "Effect Size Analysis",
          summary: "Phi = 0.140 (Small to medium effect)",
          params: {
            "Phi": 0.140,
            "Interpretation": "Small to medium effect",
            "Cohen's Guidelines": "0.1 = small, 0.3 = medium, 0.5 = large"
          }
        },
        {
          id: "confidence_interval",
          label: "95% Confidence Interval",
          summary: "Difference: 16.1pp [15.8pp, 16.4pp]",
          params: {
            "Point Estimate": "16.1pp",
            "Lower Bound": "15.8pp",
            "Upper Bound": "16.4pp",
            "Confidence Level": "95%"
          }
        }
      ]),
      analysisType: "retention",
      dataPoints: 333053,
      timeframe: "Jan - Mar 2025",
      cohortSize: "333k player-days",
      confidence: 0.92
    });

    console.log('Successfully seeded analysis results:', {
      questionId: question.id,
      analysisResultId: analysisResult.id
    });

  } catch (error) {
    console.error('Error seeding analysis results:', error);
  }
}

export { seedAnalysisResults };