import { pgTable, text, serial, integer, boolean, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  pillars: jsonb("pillars").notNull(), // { engagement: 0.8, retention: 0.9, etc }
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  text: text("text").notNull(),
  source: text("source").notNull(), // 'web', 'slack', 'voice'
  intent: jsonb("intent"), // { pillars: [], confidence: 0.85 }
  status: text("status").notNull().default("queued"), // 'queued', 'processing', 'ready', 'failed'
  result: jsonb("result"), // Analytics result data
  clarifyingQuestions: jsonb("clarifying_questions"), // Array of {question: string, answer: string | null}
  summaryParams: jsonb("summary_params"), // Pre-generated analysis brief parameters for immediate summary display
  timestamp: timestamp("timestamp").defaultNow(),
});

export const dashboardViews = pgTable("dashboard_views", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  viewConfig: jsonb("view_config").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analysisResults = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  
  // Header & Executive Summary
  insightTitle: text("insight_title").notNull(), // "Rank gains drive next-day retention +16 pp"
  executiveSummary: text("executive_summary").notNull(), // One crisp sentence
  liftPercent: doublePrecision("lift_percent"), // +27
  pValue: doublePrecision("p_value"), // <1e-300
  effectSize: doublePrecision("effect_size"), // 0.14 (Φ)
  
  // Key Metrics
  keyMetrics: jsonb("key_metrics"), // Table data: Group, Retention %, Absolute ↑, Relative ↑
  
  // Chart Data
  chartData: jsonb("chart_data"), // For visualization (bar/column data)
  
  // Business Interpretation
  businessInsights: text("business_insights").array(), // 3-4 bullet points
  
  // Assumptions & Caveats
  assumptions: text("assumptions"), // "2 × 2 χ² on 333k player-days..."
  
  // Technical Appendix
  sqlQuery: text("sql_query"),
  queryResult: jsonb("query_result"),
  pythonScript: text("python_script"),
  pythonOutput: text("python_output"),
  tests: jsonb("tests"), // Dynamic array of statistical tests with flexible parameters
  
  // Metadata
  analysisType: text("analysis_type"), // "retention", "engagement", etc.
  dataPoints: integer("data_points"),
  timeframe: text("timeframe"),
  cohortSize: text("cohort_size"),
  confidence: doublePrecision("confidence"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const rcFeatures = pgTable("rc_features", {
  id: serial("id").primaryKey(),
  featureCode: text("feature_code").notNull(),
  rcKeyPath: text("rc_key_path").notNull(),
  type: text("type").notNull(), // 'bool', 'string', 'int', 'json'
  defaultValue: text("default_value").notNull(),
  status: text("status").notNull().default("active"), // 'active', 'inactive'
  provider: text("provider").notNull(), // 'firebase', 'launchdarkly', 'optimizely', 'split'
  createdAt: timestamp("created_at").defaultNow(),
});

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"), // 'draft', 'running', 'paused', 'completed'
  
  // Core configuration
  hypothesis: text("hypothesis").notNull(),
  variants: jsonb("variants").notNull(), // [{ name: "Control", allocation: 50 }, ...]
  
  // Audience targeting
  audience: jsonb("audience").notNull(), // { type: "all|cohort", cohortId?: string, exposurePct: number }
  
  // Metrics and timing
  primaryMetric: text("primary_metric").notNull(),
  secondaryMetrics: text("secondary_metrics").array(),
  duration: integer("duration_days").notNull(),
  observationWindow: integer("observation_window_days").default(0),
  
  // Results (populated when experiment completes)
  results: jsonb("results"), // Complete results data
  keyNumbers: jsonb("key_numbers"), // Dynamic list of key metrics: [{ label: "Delta", value: "+4.2pp", color?: "green" }]
  
  // Timestamps
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cohorts = pgTable("cohorts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  fileName: text("file_name").notNull(), // Original CSV filename
  fileBytes: text("file_bytes").notNull(), // File content stored as base64 bytes
  userIdColumn: text("user_id_column").notNull(), // Which CSV column contains user IDs
  groupColumn: text("group_column"), // Which CSV column contains group assignments (optional)
  controlValue: text("control_value"), // Value that maps to control group
  variantValue: text("variant_value"), // Value that maps to variant group
  size: integer("size").notNull(), // Total number of users
  controlCount: integer("control_count").default(0),
  variantCount: integer("variant_count").default(0),
  hasGroupAssignments: boolean("has_group_assignments").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const snapshotMetrics = pgTable("snapshot_metrics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tags: text("tags").array().notNull(),
  metricType: text("metric_type").notNull(),
  sourceQuery: text("source_query").notNull(),
  queryParams: jsonb("query_params").notNull(),
  displayConfig: jsonb("display_config").notNull(),
  currentPayload: jsonb("current_payload"),
  lastUpdated: timestamp("last_updated"),
  description: text("description"),
});

export const snapshotInsights = pgTable("snapshot_insights", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(), // 'growth' | 'risk' | 'opportunity'
  tags: text("tags").array().notNull(),
  isActive: boolean("is_active").default(true),
  contentPayload: jsonb("content_payload").notNull(),
  linkedMetricId: integer("linked_metric_id").references(() => snapshotMetrics.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).pick({
  userId: true,
  pillars: true,
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  userId: true,
  text: true,
  source: true,
  intent: true,
  status: true,
  result: true,
  clarifyingQuestions: true,
  summaryParams: true,
});

export const insertDashboardViewSchema = createInsertSchema(dashboardViews).pick({
  userId: true,
  viewConfig: true,
  isDefault: true,
});

export const insertAnalysisResultSchema = createInsertSchema(analysisResults).omit({
  id: true,
  createdAt: true,
});

export const insertCohortSchema = createInsertSchema(cohorts).pick({
  userId: true,
  name: true,
  fileName: true,
  fileBytes: true,
  userIdColumn: true,
  groupColumn: true,
  controlValue: true,
  variantValue: true,
  size: true,
  controlCount: true,
  variantCount: true,
  hasGroupAssignments: true,
});

export const insertExperimentSchema = createInsertSchema(experiments).pick({
  userId: true,
  name: true,
  status: true,
  hypothesis: true,
  variants: true,
  audience: true,
  primaryMetric: true,
  secondaryMetrics: true,
  duration: true,
  observationWindow: true,
  results: true,
  keyNumbers: true,
  startDate: true,
  endDate: true,
});

export const insertSnapshotMetricSchema = createInsertSchema(snapshotMetrics).pick({
  name: true,
  tags: true,
  metricType: true,
  sourceQuery: true,
  queryParams: true,
  displayConfig: true,
  currentPayload: true,
  lastUpdated: true,
  description: true,
});

export const insertSnapshotInsightSchema = createInsertSchema(snapshotInsights).pick({
  title: true,
  category: true,
  tags: true,
  isActive: true,
  contentPayload: true,
  linkedMetricId: true,
});

export const insertRcFeatureSchema = createInsertSchema(rcFeatures).pick({
  featureCode: true,
  rcKeyPath: true,
  type: true,
  defaultValue: true,
  status: true,
  provider: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type RcFeature = typeof rcFeatures.$inferSelect;
export type InsertRcFeature = z.infer<typeof insertRcFeatureSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type Question = typeof questions.$inferSelect;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type DashboardView = typeof dashboardViews.$inferSelect;
export type InsertDashboardView = z.infer<typeof insertDashboardViewSchema>;
export type AnalysisResult = typeof analysisResults.$inferSelect;
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;
export type Cohort = typeof cohorts.$inferSelect;
export type InsertCohort = z.infer<typeof insertCohortSchema>;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

export type SnapshotMetric = typeof snapshotMetrics.$inferSelect;
export type InsertSnapshotMetric = z.infer<typeof insertSnapshotMetricSchema>;
export type SnapshotInsight = typeof snapshotInsights.$inferSelect;
export type InsertSnapshotInsight = z.infer<typeof insertSnapshotInsightSchema>;

// Analytics Pillar Types
export type AnalyticsPillar = 'engagement' | 'retention' | 'monetization' | 'store' | 'ua' | 'techHealth' | 'social';

export interface PillarWeights {
  engagement: number;
  retention: number;
  monetization: number;
  store: number;
  ua: number;
  techHealth: number;
  social: number;
}

export interface IntentClassification {
  pillars: AnalyticsPillar[];
  confidence: number;
  primaryPillar: AnalyticsPillar;
}

export interface DashboardConfig {
  pillarWeights: PillarWeights;
  chartOrder: string[];
  lastQuestions: string[];
}
