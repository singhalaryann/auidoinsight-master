import { 
  users, 
  userProfiles, 
  questions, 
  dashboardViews,
  analysisResults,
  experiments,
  cohorts,
  snapshotMetrics,
  snapshotInsights,
  type User, 
  type InsertUser,
  type UserProfile,
  type InsertUserProfile,
  type Question,
  type InsertQuestion,
  type DashboardView,
  type InsertDashboardView,
  type AnalysisResult,
  type InsertAnalysisResult,
  type Experiment,
  type InsertExperiment,
  type Cohort,
  type InsertCohort,
  type SnapshotMetric,
  type SnapshotInsight,
  type PillarWeights,
  type AnalyticsPillar
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, ne, arrayContains, or } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // User profile operations
  getUserProfile(userId: number): Promise<UserProfile | undefined>;
  updateUserProfile(userId: number, pillars: PillarWeights): Promise<UserProfile>;
  
  // Question operations
  createQuestion(question: InsertQuestion): Promise<Question>;
  getUserQuestions(userId: number, limit?: number): Promise<Question[]>;
  updateQuestionStatus(questionId: number, status: string, result?: any): Promise<Question>;
  updateQuestionSummaryParams(questionId: number, summaryParams: any): Promise<Question>;
  
  // Analysis results operations
  createAnalysisResult(analysisResult: InsertAnalysisResult): Promise<AnalysisResult>;
  getAnalysisResultByQuestionId(questionId: number): Promise<AnalysisResult | undefined>;
  updateAnalysisResult(id: number, updates: Partial<InsertAnalysisResult>): Promise<AnalysisResult>;
  
  // Dashboard view operations
  getDashboardView(userId: number): Promise<DashboardView | undefined>;
  saveDashboardView(view: InsertDashboardView): Promise<DashboardView>;
  
  // Experiment operations
  createExperiment(experiment: InsertExperiment): Promise<Experiment>;
  getUserExperiments(userId: number, status?: string): Promise<Experiment[]>;
  getExperiment(id: number): Promise<Experiment | undefined>;
  updateExperiment(id: number, updates: Partial<InsertExperiment>): Promise<Experiment>;
  deleteExperiment(id: number): Promise<void>;
  
  // Cohort operations
  createCohort(cohort: InsertCohort): Promise<Cohort>;
  getUserCohorts(userId: number): Promise<Cohort[]>;
  getCohort(id: number): Promise<Cohort | undefined>;
  deleteCohort(id: number): Promise<void>;
  
  // Business snapshot operations
  getSnapshotDefinitionsByTags(tags: string[]): Promise<{ metrics: SnapshotMetric[], insights: SnapshotInsight[] }>;
  getSnapshotInsightById(id: number): Promise<SnapshotInsight | undefined>;
  getSnapshotMetricById(id: number): Promise<SnapshotMetric | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getUserProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId));
    return profile || undefined;
  }

  async updateUserProfile(userId: number, pillars: PillarWeights): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userProfiles)
        .set({ pillars: pillars })
        .where(eq(userProfiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userProfiles)
        .values({
          userId,
          pillars: pillars
        })
        .returning();
      return created;
    }
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db
      .insert(questions)
      .values({
        ...question,
        status: question.status || "queued",
        intent: question.intent || null,
        result: question.result || null,
        clarifyingQuestions: question.clarifyingQuestions || null,
        summaryParams: question.summaryParams || null
      })
      .returning();
    return newQuestion;
  }

  async updateQuestionStatus(questionId: number, status: string, result?: any): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({ 
        status, 
        result: result || null 
      })
      .where(eq(questions.id, questionId))
      .returning();
    
    if (!updated) {
      throw new Error(`Question ${questionId} not found`);
    }
    
    return updated;
  }

  async updateQuestionSummaryParams(questionId: number, summaryParams: any): Promise<Question> {
    const [updated] = await db
      .update(questions)
      .set({ 
        summaryParams: summaryParams 
      })
      .where(eq(questions.id, questionId))
      .returning();
    
    if (!updated) {
      throw new Error(`Question ${questionId} not found`);
    }
    
    return updated;
  }

  async getUserQuestions(userId: number, limit: number = 10): Promise<Question[]> {
    const userQuestions = await db
      .select()
      .from(questions)
      .where(and(
        eq(questions.userId, userId),
        ne(questions.status, 'cancelled')
      ))
      .orderBy(desc(questions.timestamp))
      .limit(limit);
    return userQuestions;
  }

  async getDashboardView(userId: number): Promise<DashboardView | undefined> {
    const [view] = await db.select().from(dashboardViews).where(eq(dashboardViews.userId, userId));
    return view || undefined;
  }

  async saveDashboardView(view: InsertDashboardView): Promise<DashboardView> {
    const existing = await this.getDashboardView(view.userId);
    
    if (existing) {
      const [updated] = await db
        .update(dashboardViews)
        .set({
          viewConfig: view.viewConfig,
          isDefault: view.isDefault ?? null
        })
        .where(eq(dashboardViews.userId, view.userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(dashboardViews)
        .values({
          ...view,
          isDefault: view.isDefault ?? null
        })
        .returning();
      return created;
    }
  }

  async createAnalysisResult(analysisResult: InsertAnalysisResult): Promise<AnalysisResult> {
    const [created] = await db.insert(analysisResults).values(analysisResult).returning();
    return created;
  }

  async getAnalysisResultByQuestionId(questionId: number): Promise<AnalysisResult | undefined> {
    const [result] = await db.select().from(analysisResults).where(eq(analysisResults.questionId, questionId));
    return result || undefined;
  }

  async updateAnalysisResult(id: number, updates: Partial<InsertAnalysisResult>): Promise<AnalysisResult> {
    const [updated] = await db
      .update(analysisResults)
      .set(updates)
      .where(eq(analysisResults.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Analysis result ${id} not found`);
    }
    
    return updated;
  }

  async createExperiment(experiment: InsertExperiment): Promise<Experiment> {
    const [created] = await db.insert(experiments).values(experiment).returning();
    return created;
  }

  async getUserExperiments(userId: number, status?: string): Promise<Experiment[]> {
    const conditions = [eq(experiments.userId, userId)];
    if (status) {
      conditions.push(eq(experiments.status, status));
    }
    
    const userExperiments = await db
      .select()
      .from(experiments)
      .where(and(...conditions))
      .orderBy(desc(experiments.createdAt));
    
    return userExperiments;
  }

  async getExperiment(id: number): Promise<Experiment | undefined> {
    const [experiment] = await db.select().from(experiments).where(eq(experiments.id, id));
    return experiment || undefined;
  }

  async updateExperiment(id: number, updates: Partial<InsertExperiment>): Promise<Experiment> {
    const [updated] = await db
      .update(experiments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(experiments.id, id))
      .returning();
    return updated;
  }

  async deleteExperiment(id: number): Promise<void> {
    await db.delete(experiments).where(eq(experiments.id, id));
  }

  async createCohort(cohort: InsertCohort): Promise<Cohort> {
    const [created] = await db.insert(cohorts).values(cohort).returning();
    return created;
  }

  async getUserCohorts(userId: number): Promise<Cohort[]> {
    const userCohorts = await db
      .select()
      .from(cohorts)
      .where(eq(cohorts.userId, userId))
      .orderBy(desc(cohorts.createdAt));
    
    return userCohorts;
  }

  async getCohort(id: number): Promise<Cohort | undefined> {
    const [cohort] = await db.select().from(cohorts).where(eq(cohorts.id, id));
    return cohort || undefined;
  }

  async deleteCohort(id: number): Promise<void> {
    await db.delete(cohorts).where(eq(cohorts.id, id));
  }

  async getSnapshotDefinitionsByTags(tags: string[]): Promise<{ metrics: SnapshotMetric[], insights: SnapshotInsight[] }> {
    // Create conditions to check if any tag in the array matches any of the input tags
    const tagConditions = tags.map(tag => arrayContains(snapshotMetrics.tags, [tag]));
    const insightTagConditions = tags.map(tag => arrayContains(snapshotInsights.tags, [tag]));

    // Query snapshot metrics - no limits, fetch all matching records
    const metrics = await db
      .select()
      .from(snapshotMetrics)
      .where(or(...tagConditions));

    // Query snapshot insights - only active insights, ordered by newest first
    const insights = await db
      .select()
      .from(snapshotInsights)
      .where(and(
        eq(snapshotInsights.isActive, true),
        or(...insightTagConditions)
      ))
      .orderBy(desc(snapshotInsights.createdAt));

    return { metrics, insights };
  }

  async getSnapshotInsightById(id: number): Promise<SnapshotInsight | undefined> {
    const [insight] = await db
      .select()
      .from(snapshotInsights)
      .where(eq(snapshotInsights.id, id));
    return insight || undefined;
  }

  async getSnapshotMetricById(id: number): Promise<SnapshotMetric | undefined> {
    const [metric] = await db
      .select()
      .from(snapshotMetrics)
      .where(eq(snapshotMetrics.id, id));
    return metric || undefined;
  }
}

export const storage = new DatabaseStorage();
