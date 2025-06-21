import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import axios from "axios";
import { storage } from "./storage";
import { classifyIntent, generateClarifyingQuestions, openai } from "./openai";
import { sendSlackMessage, sendAnalyticsResponse, sendWelcomeMessage, handleSlackCommand, processSlackQuestion, diagnoseSlackConnection, processClarificationAnswers } from "./slack";
import { handleSlackMessage, handleSlackSlashCommand } from "./slack-simple";
import { debugSlackIntegration, testSlackMessage } from "./slack-debug";
import { verifySlackSignature, handleAnalyseCommand, handleInteractiveAction } from "./slack-interactive";
import { getModalPreview, sendTestMessage } from "./slack-modal-test";
import { newsletterEngine } from "./newsletter";
import { generateQuickStarts } from "./quickStart";
import { launchDarklyRollout } from "./launchDarkly";
import { insertQuestionSchema, insertExperimentSchema, insertCohortSchema, insertRcFeatureSchema } from "@shared/schema";
import { db } from "./db";
import { rcFeatures } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { PillarWeights, AnalyticsPillar, DashboardConfig } from "@shared/schema";

// Async error handler wrapper
const asyncHandler = (fn: (req: any, res: any, next?: any) => Promise<any>) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads', 'cohorts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `cohort-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Set<WebSocket>();

  // Helper function to parse CSV data and count groups
  function parseCsvData(csvContent: string, userIdColumn: string, groupColumn?: string, controlValue?: string, variantValue?: string) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length <= 1) {
      throw new Error('CSV must contain at least a header and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const userIdIndex = headers.indexOf(userIdColumn);
    const groupIndex = (groupColumn && groupColumn !== "none") ? headers.indexOf(groupColumn) : -1;
    
    if (userIdIndex === -1) {
      throw new Error(`User ID column '${userIdColumn}' not found in CSV headers`);
    }
    
    if (groupColumn && groupColumn !== "none" && groupIndex === -1) {
      throw new Error(`Group column '${groupColumn}' not found in CSV headers`);
    }
    
    let controlCount = 0;
    let variantCount = 0;
    let totalUsers = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(cell => cell.trim());
      if (row.length <= userIdIndex || !row[userIdIndex]) continue;
      
      totalUsers++;
      
      if (groupIndex >= 0 && row.length > groupIndex) {
        const groupValue = row[groupIndex];
        if (controlValue && groupValue === controlValue) {
          controlCount++;
        } else if (variantValue && groupValue === variantValue) {
          variantCount++;
        }
      }
    }
    
    return {
      totalUsers,
      controlCount,
      variantCount,
      hasGroupAssignments: (groupColumn && groupColumn !== "none") ? true : false
    };
  }

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log('WebSocket client connected');

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  function broadcastUpdate(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Get current user (simplified for demo)
  app.get('/api/user', async (req, res) => {
    try {
      const user = await storage.getUser(1); // Default user
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // Get user profile and dashboard configuration
  app.get('/api/profile', async (req, res) => {
    try {
      const userId = 1; // Default user
      const profile = await storage.getUserProfile(userId);
      const recentQuestions = await storage.getUserQuestions(userId, 5);
      
      const defaultPillars: PillarWeights = {
        engagement: 0.7,
        retention: 0.8,
        monetization: 0.4,
        store: 0.3,
        ua: 0.5,
        techHealth: 0.6,
        social: 0.3
      };

      const config: DashboardConfig = {
        pillarWeights: profile?.pillars as PillarWeights || defaultPillars,
        chartOrder: ['retention', 'engagement', 'monetization', 'store', 'ua', 'techHealth', 'social'],
        lastQuestions: recentQuestions.map(q => q.text)
      };

      res.json(config);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  // Get business snapshot data
  app.get('/api/business-snapshot', async (req, res) => {
    try {
      const userId = 1; // Default user
      
      // Get user profile to determine their interests
      const profile = await storage.getUserProfile(userId);
      
      if (!profile || !profile.pillars) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      // Extract pillars and find top 5 with highest scores
      const pillarsObj = profile.pillars as PillarWeights;
      const pillarEntries = Object.entries(pillarsObj)
        .sort(([, a], [, b]) => b - a) // Sort by score descending
        .slice(0, 5); // Take top 5

      const topTags = pillarEntries.map(([pillarName]) => pillarName);

      // Get metric and insight definitions based on tags
      const definitions = await storage.getSnapshotDefinitionsByTags(topTags);

      // Process metrics with live BigQuery data
      const { processMetric } = await import('./services/snapshot_processor.js');
      const processedMetrics = await Promise.all(
        definitions.metrics.map(async (metric) => {
          try {
            const liveData = await processMetric(metric);
            return {
              ...metric,
              liveData
            };
          } catch (error) {
            console.error(`Error processing metric ${metric.name}:`, error);
            // Return metric with fallback data on error
            return {
              ...metric,
              liveData: {
                currentValue: 'N/A',
                displayName: metric.name,
                deltaDisplay: '0%',
                deltaType: 'neutral',
                sparklineData: []
              }
            };
          }
        })
      );

      res.json({
        metrics: processedMetrics,
        insights: definitions.insights
      });
    } catch (error: any) {
      console.error('Error fetching business snapshot data:', error);
      res.status(500).json({ error: 'Failed to fetch business snapshot data' });
    }
  });

  // Get chart data for insight
  app.get('/api/snapshot-charting/:insightId', async (req, res) => {
    try {
      const { insightId } = req.params;
      
      // Get the insight to check for linked metric
      const insight = await storage.getSnapshotInsightById(parseInt(insightId));
      
      if (!insight || !insight.linkedMetricId) {
        return res.json({ charts: [] });
      }

      // Get the linked metric (rolling retention chart)
      const metric = await storage.getSnapshotMetricById(insight.linkedMetricId);
      
      if (!metric || metric.metricType !== 'chart') {
        return res.json({ charts: [] });
      }

      // Generate sample retention data based on the rolling retention metric
      const retentionData = [
        { day0_date: '2025-03-17', rolling_day1_retention: 42.5, rolling_day7_retention: 28.3, rolling_day30_retention: 18.1 },
        { day0_date: '2025-03-18', rolling_day1_retention: 43.2, rolling_day7_retention: 29.1, rolling_day30_retention: 18.5 },
        { day0_date: '2025-03-19', rolling_day1_retention: 41.8, rolling_day7_retention: 27.9, rolling_day30_retention: 17.8 },
        { day0_date: '2025-03-20', rolling_day1_retention: 44.1, rolling_day7_retention: 30.2, rolling_day30_retention: 19.2 },
        { day0_date: '2025-03-21', rolling_day1_retention: 43.7, rolling_day7_retention: 29.8, rolling_day30_retention: 18.9 },
        { day0_date: '2025-03-22', rolling_day1_retention: 42.9, rolling_day7_retention: 28.7, rolling_day30_retention: 18.3 },
        { day0_date: '2025-03-23', rolling_day1_retention: 44.3, rolling_day7_retention: 30.5, rolling_day30_retention: 19.4 },
        { day0_date: '2025-03-24', rolling_day1_retention: 43.1, rolling_day7_retention: 29.3, rolling_day30_retention: 18.7 }
      ];

      // Booster usage comparison data
      const boosterComparisonData = [
        { group: 'Heavy Users (≥10 boosters)', retention_rate: 36.34, sample_size: 145233 },
        { group: 'Light Users (<10 boosters)', retention_rate: 18.05, sample_size: 1877873 }
      ];

      const charts = [
        {
          id: 'rolling-retention-trends',
          title: 'Rolling Retention Trends',
          description: 'Day 1, 7, and 30 retention rates by cohort start date',
          type: 'line',
          data: retentionData,
          config: {
            xKey: 'day0_date',
            lines: [
              { dataKey: 'rolling_day1_retention', name: 'Day 1', color: '#ef4444' },
              { dataKey: 'rolling_day7_retention', name: 'Day 7', color: '#eab308' },
              { dataKey: 'rolling_day30_retention', name: 'Day 30', color: '#3b82f6' }
            ]
          }
        },
        {
          id: 'booster-retention-comparison',
          title: 'Next-Day Retention by Booster Usage',
          description: 'Comparison of retention rates between heavy and light booster users',
          type: 'bar',
          data: boosterComparisonData,
          config: {
            xKey: 'group',
            yKey: 'retention_rate',
            color: '#10b981'
          }
        }
      ];

      res.json({ charts });
    } catch (error: any) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({ error: 'Failed to fetch chart data' });
    }
  });

  // Generate tags for a question using OpenAI
  app.post('/api/generate-tags', asyncHandler(async (req, res) => {
    try {
      const { question } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const { getTags } = await import('../server/openai.js');
      const tags = await getTags(question);
      
      res.json({ tags });
    } catch (error: any) {
      console.error('Error generating tags:', error);
      res.status(500).json({ error: 'Failed to generate tags' });
    }
  }));

  // Generate suggested answer for clarifying questions
  app.post('/api/generate-suggested-answer', async (req, res) => {
    try {
      const { question, clarifyingQuestion } = req.body;
      
      if (!question || !clarifyingQuestion) {
        return res.status(400).json({ error: 'Both question and clarifyingQuestion are required' });
      }

      const { generateSuggestedAnswer } = await import('./openai.js');
      const suggestedAnswer = await generateSuggestedAnswer(question, clarifyingQuestion);
      
      res.json({ suggestedAnswer });
    } catch (error: any) {
      console.error('Error generating suggested answer:', error);
      res.status(500).json({ error: 'Failed to generate suggested answer' });
    }
  });

  // Generate dynamic QuickStart questions
  app.get('/api/quickstart-questions', async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 4;
      const questions = await generateQuickStarts(Math.min(Math.max(count, 2), 6));
      
      res.json({ questions });
    } catch (error: any) {
      console.error('Error generating QuickStart questions:', error);
      res.status(500).json({ error: 'Failed to generate QuickStart questions' });
    }
  });

  // Process a new question
  app.post('/api/questions', async (req, res) => {
    try {
      const userId = 1; // Default user
      const { text, source = 'web', clarifyingQuestions, analysisParameters } = req.body;

      if (!text) {
        return res.status(400).json({ error: 'Question text is required' });
      }

      // Classify intent using OpenAI
      const intent = await classifyIntent(text);

      // Generate analysis brief immediately if clarifying questions are provided
      let summaryParams = null;
      if (clarifyingQuestions && clarifyingQuestions.length > 0) {
        try {
          const { generateAnalysisBrief } = await import('./openai.js');
          const brief = await generateAnalysisBrief(text, clarifyingQuestions, analysisParameters || {});
          summaryParams = brief;
        } catch (error) {
          console.error('Error generating analysis brief:', error);
          // Continue without summary params if generation fails
        }
      }

      // Only create complete questions in the insights queue
      // Ambiguous questions should be handled by the frontend clarification flow
      const question = await storage.createQuestion({
        userId,
        text,
        source,
        intent: intent as any,
        status: 'queued',
        clarifyingQuestions: clarifyingQuestions || null,
        summaryParams: summaryParams
      });

      // Update user profile with exponential decay
      const currentProfile = await storage.getUserProfile(userId);
      const currentWeights = currentProfile?.pillars as PillarWeights || {
        engagement: 0.5,
        retention: 0.5,
        monetization: 0.5,
        store: 0.5,
        ua: 0.5,
        techHealth: 0.5,
        social: 0.5
      };

      // Apply exponential decay (14-day half-life)
      const decayFactor = 0.95; // Slight decay per question
      const boostFactor = 0.1; // Boost for current intent

      const newWeights: PillarWeights = { ...currentWeights };
      
      // Apply decay to all pillars
      Object.keys(newWeights).forEach(key => {
        newWeights[key as AnalyticsPillar] *= decayFactor;
      });

      // Boost the identified pillars
      intent.pillars.forEach(pillar => {
        newWeights[pillar] = Math.min(1, newWeights[pillar] + boostFactor * intent.confidence);
      });

      // Update profile
      await storage.updateUserProfile(userId, newWeights);

      // Broadcast update to connected clients
      broadcastUpdate({
        type: 'dashboard_update',
        intent,
        pillars: newWeights,
        question: text
      });

      // Send Slack notification if configured
      try {
        if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
          const dashboardUrl = `${req.protocol}://${req.get('host')}/`;
          await sendAnalyticsResponse(text, intent, dashboardUrl);
        }
      } catch (slackError) {
        console.warn('Failed to send Slack notification:', slackError);
      }

      res.json({
        question,
        intent,
        updatedWeights: newWeights
      });
    } catch (error) {
      console.error('Error processing question:', error);
      res.status(500).json({ error: 'Failed to process question' });
    }
  });

  // Get recent questions with analysis results
  app.get('/api/questions', async (req, res) => {
    try {
      const userId = 1; // Default user
      const limit = parseInt(req.query.limit as string) || 10;
      const questions = await storage.getUserQuestions(userId, limit);
      
      // For questions with "ready" status, fetch their analysis results from the database
      const questionsWithResults = await Promise.all(
        questions.map(async (question) => {
          if (question.status === 'ready') {
            const analysisResult = await storage.getAnalysisResultByQuestionId(question.id);
            if (analysisResult) {
              // Structure the result data according to the frontend interface
              const structuredResult = {
                insightTitle: analysisResult.insightTitle,
                executiveSummary: analysisResult.executiveSummary,
                liftPercent: analysisResult.liftPercent,
                pValue: analysisResult.pValue,
                effectSize: analysisResult.effectSize,
                keyMetrics: analysisResult.keyMetrics,
                chartData: analysisResult.chartData,
                businessInsights: analysisResult.businessInsights,
                assumptions: analysisResult.assumptions,
                sqlQuery: analysisResult.sqlQuery,
                queryResult: analysisResult.queryResult,
                pythonScript: analysisResult.pythonScript,
                pythonOutput: analysisResult.pythonOutput,
                tests: analysisResult.tests,
                analysisType: analysisResult.analysisType,
                dataPoints: analysisResult.dataPoints,
                timeframe: analysisResult.timeframe,
                cohortSize: analysisResult.cohortSize,
                confidence: analysisResult.confidence
              };
              
              return {
                ...question,
                result: structuredResult
              };
            }
          }
          return question;
        })
      );
      
      res.json(questionsWithResults);
    } catch (error) {
      console.error('Error fetching questions with analysis results:', error);
      res.status(500).json({ error: 'Failed to get questions' });
    }
  });

  // Update question status endpoint for backend integration
  app.patch('/api/questions/:id/status', async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);
      const { status, result } = req.body;
      
      if (!questionId || !status) {
        return res.status(400).json({ error: 'Question ID and status are required' });
      }
      
      const updatedQuestion = await storage.updateQuestionStatus(questionId, status, result);
      
      // Broadcast status update to WebSocket clients
      broadcastUpdate({
        type: 'question_status_updated',
        question: updatedQuestion
      });
      
      res.json({ question: updatedQuestion });
    } catch (error) {
      console.error('Error updating question status:', error);
      res.status(500).json({ error: 'Failed to update question status' });
    }
  });

  // Slack webhook endpoint for receiving messages
  app.post('/api/slack/events', async (req, res) => {
    try {
      const { type, event } = req.body;

      // Handle URL verification challenge
      if (type === 'url_verification') {
        return res.json({ challenge: req.body.challenge });
      }

      // Respond immediately to Slack to avoid timeout
      res.status(200).json({ ok: true });

      // Process event asynchronously if it's a message or mention
      if (type === 'event_callback' && 
          (event?.type === 'message' || event?.type === 'app_mention') && 
          !event.bot_id && 
          event.text && 
          event.text.trim().length > 0) {
        
        // Process in background to avoid blocking Slack webhook
        setImmediate(async () => {
          try {
            await handleSlackMessage(event.text, event.user, event.channel);
          } catch (error) {
            console.error('Error processing Slack event:', error);
          }
        });
      }

    } catch (error) {
      console.error('Slack webhook error:', error);
      if (!res.headersSent) {
        res.status(200).json({ ok: true }); // Always respond OK to Slack
      }
    }
  });



  // Slack slash command handler
  app.post('/api/slack/commands', async (req, res) => {
    try {
      const { command, text, user_name, channel_id } = req.body;
      
      if (command === '/ask' || command === '/analytics' || command === '/dashboard') {
        if (!text || text.trim() === '') {
          return res.json({
            response_type: 'ephemeral',
            text: 'Please ask a question! Example: `/ask what\'s driving churn this week?`'
          });
        }

        const dashboardUrl = `${req.protocol}://${req.get('host')}/`;
        
        // Use the simplified Slack command handler
        const result = await handleSlackSlashCommand(command, text, user_name, channel_id);
        return res.json(result);
      }

      res.json({
        response_type: 'ephemeral',
        text: 'Sorry, I couldn\'t process that request. Please try again.'
      });
    } catch (error) {
      console.error('Slack command error:', error);
      res.json({
        response_type: 'ephemeral',
        text: 'An error occurred while processing your request.'
      });
    }
  });

  // Slack /ask slash command handler
  app.post('/api/slack/ask', async (req, res) => {
    try {
      const { text, user_name, channel_id } = req.body;
      
      if (!text || text.trim() === '') {
        return res.json({
          response_type: 'ephemeral',
          text: 'Please provide a question after the /ask command. Example: /ask How is user retention performing?'
        });
      }

      const dashboardUrl = `${req.protocol}://${req.get('host')}/`;
      
      // Use the Slack integration function to process the question
      const result = await processSlackQuestion(text.trim(), 1, dashboardUrl);
      
      // Return immediate acknowledgment to Slack
      return res.json({
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:thinking_face: *${user_name} asked:* "${text}"`
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*AI Classification:*\n${result.intent ? (result.intent.primaryPillar.charAt(0).toUpperCase() + result.intent.primaryPillar.slice(1)) : 'General'}`
              },
              {
                type: 'mrkdwn',
                text: `*Confidence:*\n${Math.round((result.intent?.confidence || 0) * 100)}%`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Your dashboard is being updated with focus on *${result.intent?.pillars?.join(', ') || 'general'}* analytics...`
            }
          }
        ]
      });
    } catch (error) {
      console.error('Slack /ask command error:', error);
      res.json({
        response_type: 'ephemeral',
        text: `Sorry, I encountered an error processing your question: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Slack /experiment slash command handler
  app.post('/api/slack/experiment', async (req, res) => {
    try {
      const { text, user_name, channel_id } = req.body;
      const dashboardUrl = `${req.protocol}://${req.get('host')}/`;
      
      // Parse the command parameters
      const params = text ? text.trim().split(' ') : [];
      const action = params[0]?.toLowerCase() || 'start';
      
      if (action === 'start' || action === '') {
        // Start experiment creation workflow
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:test_tube: *${user_name} is creating a new experiment!*`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Step 1: Experiment Name*\nWhat would you like to call your experiment?'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: 'Reply with: `/experiment name Your Experiment Name`'
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Example: `/experiment name Boost Purchase Flow Test`'
                }
              ]
            }
          ]
        });
      }
      
      if (action === 'name' && params.length > 1) {
        const experimentName = params.slice(1).join(' ');
        
        // Create a basic experiment record
        const experiment = await storage.createExperiment({
          userId: 1,
          name: experimentName,
          hypothesis: '',
          audience: JSON.stringify({ type: 'all', exposurePct: 100 }),
          primaryMetric: 'retention_d7',
          duration: 14,
          variants: []
        });
        
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:white_check_mark: *Experiment "${experimentName}" created!*`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Step 2: Hypothesis*\nWhat hypothesis are you testing?'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Reply with: \`/experiment hypothesis ${experiment.id} Your hypothesis here\``
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Example: `/experiment hypothesis ${experiment.id} Users who see the new purchase flow will have 15% higher conversion rates`'
                }
              ]
            }
          ]
        });
      }
      
      if (action === 'hypothesis' && params.length > 2) {
        const experimentId = parseInt(params[1]);
        const hypothesis = params.slice(2).join(' ');
        
        if (isNaN(experimentId)) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Invalid experiment ID. Please use the ID from the previous step.'
          });
        }
        
        // Update experiment with hypothesis
        await storage.updateExperiment(experimentId, { hypothesis });
        
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:memo: *Hypothesis set!*\n"${hypothesis}"`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Step 3: Primary Metric*\nWhat metric will you track?'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Choose: \`/experiment metric ${experimentId} [option]\`\n\n*Available metrics:*\n• \`retention_d7\` - 7-day retention\n• \`session_length\` - Average session length\n• \`conversion_rate\` - Conversion rate\n• \`revenue_per_user\` - Revenue per user\n• \`engagement_score\` - Engagement score`
              }
            }
          ]
        });
      }
      
      if (action === 'metric' && params.length === 3) {
        const experimentId = parseInt(params[1]);
        const metric = params[2];
        
        const validMetrics = ['retention_d7', 'session_length', 'conversion_rate', 'revenue_per_user', 'engagement_score'];
        
        if (isNaN(experimentId)) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Invalid experiment ID. Please use the ID from the previous step.'
          });
        }
        
        if (!validMetrics.includes(metric)) {
          return res.json({
            response_type: 'ephemeral',
            text: `Invalid metric. Choose from: ${validMetrics.join(', ')}`
          });
        }
        
        // Update experiment with primary metric
        await storage.updateExperiment(experimentId, { primaryMetric: metric });
        
        const metricNames = {
          'retention_d7': '7-Day Retention',
          'session_length': 'Session Length',
          'conversion_rate': 'Conversion Rate',
          'revenue_per_user': 'Revenue Per User',
          'engagement_score': 'Engagement Score'
        };
        
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:chart_with_upwards_trend: *Primary metric set to: ${metricNames[metric as keyof typeof metricNames]}*`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Step 4: Variants*\nAdd your experiment variants (Control and Test groups)'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `Add variants: \`/experiment variant ${experimentId} "Variant Name" description\`\n\nStart with your control group first!`
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `Example: \`/experiment variant ${experimentId} "Control" Current purchase flow\``
                }
              ]
            }
          ]
        });
      }
      
      if (action === 'variant' && params.length > 3) {
        const experimentId = parseInt(params[1]);
        const restOfParams = params.slice(2).join(' ');
        
        // Parse variant name (in quotes) and description
        const quoteMatch = restOfParams.match(/^"([^"]+)"\s*(.*)$/);
        if (!quoteMatch) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Invalid format. Use: `/experiment variant [id] "Variant Name" description`'
          });
        }
        
        const variantName = quoteMatch[1];
        const description = quoteMatch[2] || '';
        
        if (isNaN(experimentId)) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Invalid experiment ID.'
          });
        }
        
        // Get current experiment
        const experiment = await storage.getExperiment(experimentId);
        if (!experiment) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Experiment not found.'
          });
        }
        
        // Add variant to existing variants
        const currentVariants = Array.isArray(experiment.variants) ? experiment.variants : [];
        const newVariant = {
          name: variantName,
          description: description,
          allocation: currentVariants.length === 0 ? 50 : 25 // First variant gets 50%, others get 25%
        };
        
        const updatedVariants = [...currentVariants, newVariant];
        await storage.updateExperiment(experimentId, { variants: updatedVariants });
        
        const isFirstVariant = currentVariants.length === 0;
        
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:heavy_plus_sign: *Added variant: "${variantName}"*\n${description}`
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: isFirstVariant ? 
                  `*Current variants:* ${updatedVariants.length}\n\nAdd another variant or finish setup:\n• Add: \`/experiment variant ${experimentId} "Test Group" New purchase flow\`\n• Finish: \`/experiment finish ${experimentId}\`` :
                  `*Current variants:* ${updatedVariants.length}\n\nAdd more variants or finish setup:\n• Add another: \`/experiment variant ${experimentId} "Variant Name" description\`\n• Finish: \`/experiment finish ${experimentId}\``
              }
            }
          ]
        });
      }
      
      if (action === 'finish' && params.length === 2) {
        const experimentId = parseInt(params[1]);
        
        if (isNaN(experimentId)) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Invalid experiment ID.'
          });
        }
        
        // Get final experiment details
        const experiment = await storage.getExperiment(experimentId);
        if (!experiment) {
          return res.json({
            response_type: 'ephemeral',
            text: 'Experiment not found.'
          });
        }
        
        const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
        if (variants.length < 2) {
          return res.json({
            response_type: 'ephemeral',
            text: 'You need at least 2 variants (Control and Test group) to complete the experiment.'
          });
        }
        
        // Update experiment status to active
        await storage.updateExperiment(experimentId, { status: 'active' });
        
        const variantList = variants.map(v => `• *${v.name}*: ${v.description} (${v.allocation}%)`).join('\n');
        
        return res.json({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:rocket: *Experiment "${experiment.name}" is now live!*`
              }
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Hypothesis:*\n${experiment.hypothesis}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Primary Metric:*\n${experiment.primaryMetric}`
                }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Variants:*\n${variantList}`
              }
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Dashboard'
                  },
                  url: `${dashboardUrl}#experiments`,
                  action_id: 'view_dashboard',
                  style: 'primary'
                }
              ]
            }
          ]
        });
      }
      
      // Help/usage information
      return res.json({
        response_type: 'ephemeral',
        text: `*Experiment Command Usage:*

*Start new experiment:*
\`/experiment start\` or just \`/experiment\`

*Commands during setup:*
\`/experiment name [Experiment Name]\`
\`/experiment hypothesis [ID] [Your hypothesis]\`
\`/experiment metric [ID] [metric_name]\`
\`/experiment variant [ID] "Variant Name" description\`
\`/experiment finish [ID]\`

*Available metrics:* retention_d7, session_length, conversion_rate, revenue_per_user, engagement_score`
      });
      
    } catch (error) {
      console.error('Slack /experiment command error:', error);
      res.json({
        response_type: 'ephemeral',
        text: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Slack connection diagnostic endpoint
  app.get('/api/slack/status', async (req, res) => {
    try {
      const diagnostic = await diagnoseSlackConnection();
      res.json(diagnostic);
    } catch (error) {
      console.error('Slack diagnostic error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to run diagnostics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test Slack integration endpoint
  app.post('/api/slack/test', async (req, res) => {
    try {
      // Use the diagnostic function to get detailed connection status
      const diagnostic = await diagnoseSlackConnection();
      
      if (diagnostic.status === 'error' || diagnostic.status === 'warning') {
        return res.status(400).json({ 
          error: diagnostic.message,
          details: diagnostic.details
        });
      }

      // If diagnostics pass, try sending a test message
      const channelId = process.env.SLACK_CHANNEL_ID;
      if (!channelId) {
        throw new Error('SLACK_CHANNEL_ID not configured');
      }
      
      await sendSlackMessage({
        channel: channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Analytics Dashboard Test* :white_check_mark:'
            }
          },
          {
            type: 'section',
            text: {
              type: 'plain_text',
              text: 'Your Slack integration is working perfectly! You can now ask analytics questions directly in this channel.'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Try asking:*\n• "What\'s driving churn this week?"\n• "Show me engagement metrics"\n• "How is revenue performing?"'
            }
          }
        ]
      });

      res.json({ 
        success: true, 
        message: 'Test message sent to Slack successfully!',
        connectionDetails: diagnostic.details
      });
    } catch (error) {
      console.error('Slack test error:', error);
      res.status(500).json({ 
        error: `Failed to send test message to Slack: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });

  // Generate weekly newsletter
  app.post('/api/newsletter/generate', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const newsletter = await newsletterEngine.generateWeeklyNewsletter(userId);
      res.json(newsletter);
    } catch (error: any) {
      console.error('Newsletter generation failed:', error);
      res.status(500).json({ error: error.message || 'Newsletter generation failed' });
    }
  });

  // Send newsletter via email
  app.post('/api/newsletter/send-email', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newsletter = await newsletterEngine.generateWeeklyNewsletter(userId);
      const emailSent = await newsletterEngine.sendNewsletterEmail(newsletter, user);
      
      if (emailSent) {
        res.json({ success: true, message: 'Newsletter sent via email' });
      } else {
        res.status(500).json({ error: 'Failed to send newsletter email' });
      }
    } catch (error: any) {
      console.error('Email newsletter failed:', error);
      res.status(500).json({ error: error.message || 'Email sending failed' });
    }
  });

  // Send newsletter via Slack
  app.post('/api/newsletter/send-slack', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const newsletter = await newsletterEngine.generateWeeklyNewsletter(userId);
      const slackSent = await newsletterEngine.sendNewsletterSlack(newsletter, user);
      
      if (slackSent) {
        res.json({ success: true, message: 'Newsletter sent via Slack' });
      } else {
        res.status(500).json({ error: 'Failed to send newsletter to Slack' });
      }
    } catch (error: any) {
      console.error('Slack newsletter failed:', error);
      res.status(500).json({ error: error.message || 'Slack sending failed' });
    }
  });

  // Generate clarifying questions endpoint (legacy)
  app.post('/api/clarifying-questions', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required' });
      }

      const questions = await generateClarifyingQuestions(question.trim());
      res.json({ questions });
    } catch (error: any) {
      console.error('Error generating clarifying questions:', error);
      res.status(500).json({ error: 'Failed to generate clarifying questions' });
    }
  });

  // Generate analysis setup endpoint
  app.post('/api/analysis-setup', async (req, res) => {
    try {
      const { question } = req.body;
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: 'Question is required' });
      }

      const { generateAnalysisSetup } = await import('./openai.js');
      const analysisSetup = await generateAnalysisSetup(question.trim());
      res.json(analysisSetup);
    } catch (error: any) {
      console.error('Error generating analysis setup:', error);
      res.status(500).json({ error: 'Failed to generate analysis setup' });
    }
  });

  // Refine hypothesis endpoint for experiments
  app.post('/api/refine-hypothesis', async (req, res) => {
    try {
      const { hypothesis } = req.body;
      if (!hypothesis || typeof hypothesis !== 'string') {
        return res.status(400).json({ error: 'Hypothesis is required' });
      }

      const { refineHypothesis } = await import('./openai.js');
      const result = await refineHypothesis(hypothesis.trim());
      res.json(result);
    } catch (error: any) {
      console.error('Error refining hypothesis:', error);
      res.status(500).json({ error: 'Failed to refine hypothesis' });
    }
  });

  // Generate analysis brief endpoint
  app.post('/api/analysis-brief', async (req, res) => {
    try {
      const { question, clarifyingQuestions, analysisSetup } = req.body;
      
      if (!question) {
        return res.status(400).json({ error: 'Question is required' });
      }

      const { generateAnalysisBrief } = await import('./openai.js');
      const brief = await generateAnalysisBrief(question, clarifyingQuestions || [], analysisSetup || {});
      
      res.json(brief);
    } catch (error: any) {
      console.error('Error generating analysis brief:', error);
      res.status(500).json({ error: 'Failed to generate analysis brief' });
    }
  });

  // Get saved summary parameters for a question
  app.get('/api/questions/:id/summary', async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);
      
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID' });
      }

      const userId = 1; // Default user
      const questions = await storage.getUserQuestions(userId, 100);
      const question = questions.find(q => q.id === questionId);
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      if (!question.summaryParams) {
        return res.status(404).json({ error: 'Summary parameters not available for this question' });
      }

      res.json(question.summaryParams);
    } catch (error: any) {
      console.error('Error fetching summary parameters:', error);
      res.status(500).json({ error: 'Failed to fetch summary parameters' });
    }
  });

  // Cancel analysis endpoint
  app.delete('/api/questions/:id', async (req, res) => {
    try {
      const questionId = parseInt(req.params.id);
      
      if (isNaN(questionId)) {
        return res.status(400).json({ error: 'Invalid question ID' });
      }

      const updatedQuestion = await storage.updateQuestionStatus(questionId, 'cancelled');
      
      // Broadcast update to connected clients
      broadcastUpdate({
        type: 'question_cancelled',
        questionId: questionId
      });

      res.json({ success: true, question: updatedQuestion });
    } catch (error: any) {
      console.error('Error cancelling question:', error);
      res.status(500).json({ error: 'Failed to cancel question' });
    }
  });

  // Voice processing endpoint (placeholder for future implementation)
  app.post('/api/voice', async (req, res) => {
    try {
      // In a real implementation, this would handle audio transcription
      // For now, return a placeholder response
      res.json({ 
        transcribed: false, 
        message: 'Voice processing not yet implemented' 
      });
    } catch (error) {
      res.status(500).json({ error: 'Voice processing failed' });
    }
  });

  // Experiment API endpoints
  
  // Get all experiments for a user
  app.get('/api/experiments', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const status = req.query.status as string | undefined;
      const experiments = await storage.getUserExperiments(userId, status);
      res.json(experiments);
    } catch (error: any) {
      console.error('Error fetching experiments:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch experiments' });
    }
  });

  // Helper function to generate dynamic interpretation based on experiment results
  function generateDynamicInterpretation(experiment: any, winningVariant: any, controlVariant: any, liftAmount: number, config: any, isSignificant: boolean) {
    const metricName = experiment.primaryMetric.replace('_', ' ').toLowerCase();
    const isPositive = liftAmount > 0;
    const magnitude = Math.abs(liftAmount);
    
    // Generate "What happened" section
    const whatHappened = isSignificant ? 
      `${winningVariant.name} ${isPositive ? 'increased' : 'decreased'} ${metricName} by ${magnitude.toFixed(1)}${config.unit} compared to ${controlVariant.name} (statistically significant).` :
      `No statistically significant difference detected between ${winningVariant.name} and ${controlVariant.name} for ${metricName}.`;
    
    // Generate "So what" section based on metric type and results
    let soWhat = '';
    if (isSignificant && isPositive) {
      if (experiment.primaryMetric === 'retention_d7') {
        soWhat = `${winningVariant.name.toLowerCase()} demonstrates stronger user engagement patterns that effectively reduce churn and improve long-term user value.`;
      } else if (experiment.primaryMetric === 'session_length') {
        soWhat = `${winningVariant.name.toLowerCase()} creates more engaging user experiences that keep players active for longer periods.`;
      } else if (experiment.primaryMetric === 'conversion_rate') {
        soWhat = `${winningVariant.name.toLowerCase()} removes friction in the conversion funnel and drives higher monetization rates.`;
      } else {
        soWhat = `${winningVariant.name.toLowerCase()} demonstrates superior user experience design that drives measurable business impact.`;
      }
    } else if (isSignificant && !isPositive) {
      soWhat = `${winningVariant.name.toLowerCase()} may introduce friction or negative user experience elements that harm ${metricName}.`;
    } else {
      soWhat = `Current test variants show minimal impact on user behavior, suggesting the changes may not be substantial enough to drive meaningful results.`;
    }
    
    // Generate "Now what" action items
    const nowWhat = [];
    if (isSignificant && isPositive && magnitude > 5) {
      nowWhat.push(`Roll out ${winningVariant.name.toLowerCase()} to all users`);
      nowWhat.push(`Monitor ${metricName} metrics for sustained impact`);
      nowWhat.push(`Test additional features building on this success`);
    } else if (isSignificant && isPositive) {
      nowWhat.push(`Consider gradual rollout to validate results at scale`);
      nowWhat.push(`Investigate why the impact is moderate`);
      nowWhat.push(`Test enhanced versions to amplify the effect`);
    } else if (isSignificant && !isPositive) {
      nowWhat.push(`Do not roll out the ${winningVariant.name.toLowerCase()} variant`);
      nowWhat.push(`Investigate root causes of the negative impact`);
      nowWhat.push(`Design alternative approaches to test`);
    } else {
      nowWhat.push(`Consider extending test duration for more data`);
      nowWhat.push(`Investigate practical significance vs statistical significance`);
      nowWhat.push(`Test more differentiated variants`);
    }
    
    // Generate dynamic header content
    const headerTitle = isSignificant && isPositive ? 
      `${winningVariant.name} ${getActionVerb(experiment.primaryMetric)} ${metricName} +${magnitude.toFixed(0)}${config.unit}` :
      isSignificant && !isPositive ?
      `${winningVariant.name} ${getActionVerb(experiment.primaryMetric, true)} ${metricName} -${magnitude.toFixed(0)}${config.unit}` :
      "No meaningful change detected";
    
    // Generate dynamic lead-in sentence
    const leadInText = isSignificant ? 
      `${winningVariant.name} shows ${isPositive ? '+' : ''}${magnitude.toFixed(1)}${config.unit} ${metricName} compared with ${controlVariant.name}.` :
      `No statistically significant difference detected between test variants and ${controlVariant.name}.`;

    // Generate dynamic statistical details
    const statDetails = {
      testType: `2 × 2 ${experiment.primaryMetric === 'conversion_rate' ? 'χ²' : 't'} test`,
      pValue: isSignificant ? Math.random() * 0.01 : 0.05 + Math.random() * 0.15,
      effectSize: Math.abs(liftAmount / 100),
      effectSizeLabel: getEffectSizeLabel(Math.abs(liftAmount / 100)),
      sampleSize: Math.floor(200000 + Math.random() * 150000),
      seasonalityControls: false,
      testDate: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    };

    return {
      whatHappened,
      soWhat,
      nowWhat,
      headerTitle,
      leadInText,
      statDetails
    };
  }

  // Helper function to categorize effect size
  function getEffectSizeLabel(effectSize: number): string {
    const absEffect = Math.abs(effectSize);
    if (absEffect < 0.2) return 'small';
    if (absEffect < 0.5) return 'medium';
    return 'large';
  }

  // Helper function to get action verbs based on metric type
  function getActionVerb(metric: string, isNegative: boolean = false) {
    const verbs = {
      'retention_d7': isNegative ? 'reduces' : 'boosts',
      'session_length': isNegative ? 'shortens' : 'extends', 
      'conversion_rate': isNegative ? 'lowers' : 'increases',
      'revenue_per_user': isNegative ? 'decreases' : 'grows',
      'engagement_score': isNegative ? 'weakens' : 'strengthens'
    };
    return verbs[metric as keyof typeof verbs] || (isNegative ? 'decreases' : 'improves');
  }

  // Helper function to generate key numbers based on experiment status
  function generateKeyNumbers(experiment: any) {
    const keyNumbers = [];
    
    if (experiment.status === 'running') {
      // Generate realistic running experiment metrics
      const delta = (Math.random() * 8 - 2).toFixed(1); // -2 to +6 range
      const significance = Math.random() < 0.3 ? (Math.random() * 0.05).toFixed(3) : (0.05 + Math.random() * 0.2).toFixed(2);
      const power = Math.floor(Math.random() * 40 + 50); // 50-90% range
      
      keyNumbers.push(
        { label: "Delta", value: `${parseFloat(delta) > 0 ? '+' : ''}${delta}pp`, color: parseFloat(delta) > 0 ? "green" : parseFloat(delta) < 0 ? "red" : null },
        { label: "Significance", value: `p ${significance}`, color: null },
        { label: "Power", value: `${power}%`, color: null }
      );
    } else if (experiment.status === 'completed') {
      // Generate final results
      const finalDelta = (Math.random() * 10 - 1).toFixed(1); // -1 to +9 range
      const finalP = Math.random() < 0.7 ? (Math.random() * 0.05).toFixed(3) : (0.05 + Math.random() * 0.1).toFixed(2);
      const isSignificant = parseFloat(finalP) < 0.05;
      
      keyNumbers.push(
        { label: "Final Delta", value: `${parseFloat(finalDelta) > 0 ? '+' : ''}${finalDelta}pp`, color: parseFloat(finalDelta) > 0 ? "green" : "red" },
        { label: "Significance", value: `p ${finalP}${isSignificant ? ' ✓' : ''}`, color: isSignificant ? "green" : null }
      );
    }
    
    return keyNumbers;
  }

  // Create a new experiment
  app.post('/api/experiments', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const experimentData = insertExperimentSchema.parse({
        ...req.body,
        userId
      });
      
      // Generate initial key numbers
      (experimentData as any).keyNumbers = generateKeyNumbers(experimentData);
      
      const experiment = await storage.createExperiment(experimentData);
      
      // Broadcast real-time update
      broadcastUpdate({
        type: 'experiment_created',
        experiment
      });
      
      res.json(experiment);
    } catch (error: any) {
      console.error('Error creating experiment:', error);
      res.status(400).json({ error: error.message || 'Failed to create experiment' });
    }
  });

  // Get a specific experiment
  app.get('/api/experiments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      res.json(experiment);
    } catch (error: any) {
      console.error('Error fetching experiment:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch experiment' });
    }
  });

  // Get experiment summary for mid-experiment results
  app.get('/api/experiments/:id/summary', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      const startDate = experiment.startDate || new Date();
      const now = new Date();
      const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const plannedDays = experiment.duration || 14;
      
      // Generate realistic mid-experiment data
      const progressPercent = Math.min((elapsedDays / plannedDays) * 100, 100);
      const delta = (Math.random() * 8 - 2).toFixed(1); // -2 to +6 range
      const pValue = Math.random() < 0.3 ? (Math.random() * 0.05).toFixed(3) : (0.05 + Math.random() * 0.2).toFixed(2);
      const power = Math.floor(Math.random() * 40 + 50); // 50-90% range
      const isSignificant = parseFloat(pValue) < 0.05;
      const isNegative = parseFloat(delta) < -3 && parseFloat(pValue) < 0.1;
      
      // Determine winner variant
      const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
      const winnerVariant = variants.length > 1 ? (parseFloat(delta) > 0 ? variants[1]?.name || 'Variant B' : 'Control') : null;
      
      // Generate banner warning for negative trends
      let bannerWarning = null;
      if (isNegative) {
        bannerWarning = `Potential negative impact on ${experiment.primaryMetric} – consider pausing.`;
      }
      
      // Determine available actions
      const actions = [];
      if (power >= 70 && parseFloat(delta) > 0) {
        actions.push('ramp');
      }
      if (parseFloat(delta) < 0 && parseFloat(pValue) < 0.05) {
        actions.push('stop_early');
      }
      actions.push('pause', 'duplicate');
      
      res.json({
        elapsedDays,
        plannedDays,
        progressPercent: Math.round(progressPercent),
        winnerVariant,
        bannerWarning,
        actions,
        keyMetrics: {
          delta: `${parseFloat(delta) > 0 ? '+' : ''}${delta}pp`,
          pValue: parseFloat(pValue),
          power: power,
          isSignificant
        }
      });
    } catch (error: any) {
      console.error('Error fetching experiment summary:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch experiment summary' });
    }
  });

  // Get experiment KPIs and metrics data
  app.get('/api/experiments/:id/kpis', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const metric = req.query.metric as string;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      // Generate realistic KPI data
      const variants = Array.isArray(experiment.variants) ? experiment.variants : [
        { name: 'Control', allocation: 50 },
        { name: 'Variant B', allocation: 50 }
      ];
      
      const kpiData = variants.map((variant, index) => {
        const isControl = index === 0;
        const baseValue = isControl ? 42 : 42 + (Math.random() * 8 - 2);
        const delta = isControl ? 0 : baseValue - 42;
        const pValue = Math.random() < 0.3 ? Math.random() * 0.05 : 0.05 + Math.random() * 0.2;
        const power = Math.floor(Math.random() * 40 + 50);
        
        return {
          variant: variant.name,
          value: `${baseValue.toFixed(0)}%`,
          delta: isControl ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}pp`,
          pValue: isControl ? '—' : pValue.toFixed(3),
          power: isControl ? '—' : `${power}%`,
          color: isControl ? null : (delta > 0 ? 'green' : 'red')
        };
      });
      
      // Generate cumulative series data for charts
      const days = Math.min(experiment.duration || 14, 10);
      const cumulativeSeries = Array.from({ length: days }, (_, i) => ({
        day: i + 1,
        delta: (Math.random() * 6 - 1).toFixed(1),
        confidence_low: (Math.random() * 3 - 2).toFixed(1),
        confidence_high: (Math.random() * 3 + 1).toFixed(1)
      }));
      
      res.json({
        kpiTable: kpiData,
        cumulativeSeries,
        metric: metric || experiment.primaryMetric
      });
    } catch (error: any) {
      console.error('Error fetching experiment KPIs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch experiment KPIs' });
    }
  });

  // Get experiment power analysis
  app.get('/api/experiments/:id/power', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      // Generate realistic power analysis data
      const currentPower = Math.floor(Math.random() * 40 + 50); // 50-90%
      const samplesRemaining = Math.floor(Math.random() * 10000 + 5000);
      const etaDays = Math.floor(samplesRemaining / 2000); // Rough estimate
      
      // Generate power curve data
      const powerCurve = Array.from({ length: 10 }, (_, i) => ({
        sampleSize: (i + 1) * 2000,
        power: Math.min(30 + (i * 8) + Math.random() * 10, 95)
      }));
      
      res.json({
        currentPower,
        samplesRemaining,
        etaDays,
        powerCurve,
        currentSampleSize: 8000 + Math.floor(Math.random() * 4000)
      });
    } catch (error: any) {
      console.error('Error fetching experiment power analysis:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch power analysis' });
    }
  });

  // Handle experiment actions (pause, ramp, stop early, etc.)
  app.post('/api/experiments/:id/action', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { action } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      let updates: any = {};
      
      switch (action) {
        case 'start':
          updates.status = 'running';
          updates.startDate = new Date();
          break;
        case 'pause':
          updates.status = 'paused';
          break;
        case 'resume':
          updates.status = 'running';
          // Don't update startDate on resume to preserve experiment timeline
          break;
        case 'ramp':
          // Update variants to 100% for winning variant
          const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
          if (variants.length > 1) {
            variants[1].allocation = 100;
            variants[0].allocation = 0;
            updates.variants = variants;
          }
          break;
        case 'stop':
        case 'stop_early':
          updates.status = 'completed';
          updates.endDate = new Date();
          break;
        case 'delete':
          // Delete the experiment
          await storage.deleteExperiment(id);
          return res.json({ success: true, deleted: true });
          break;
        case 'duplicate':
          // Create a new experiment based on current one
          const duplicateData = insertExperimentSchema.parse({
            userId: experiment.userId,
            name: `${experiment.name} (Copy)`,
            hypothesis: experiment.hypothesis,
            variants: experiment.variants,
            audience: experiment.audience,
            primaryMetric: experiment.primaryMetric,
            secondaryMetrics: experiment.secondaryMetrics,
            duration: experiment.duration,
            observationWindow: experiment.observationWindow,
            status: 'draft'
          });
          
          const newExperiment = await storage.createExperiment(duplicateData);
          return res.json({ success: true, newExperiment });
        default:
          return res.status(400).json({ error: 'Invalid action' });
      }
      
      const updatedExperiment = await storage.updateExperiment(id, updates);
      
      // Broadcast real-time update
      broadcastUpdate({
        type: 'experiment_updated',
        experiment: updatedExperiment
      });
      
      res.json({ success: true, experiment: updatedExperiment });
    } catch (error: any) {
      console.error('Error performing experiment action:', error);
      res.status(500).json({ error: error.message || 'Failed to perform action' });
    }
  });

  // Update an experiment
  app.patch('/api/experiments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const updates = req.body;
      
      // Check if experiment can be completed based on backend criteria
      if (updates.status === 'running') {
        const experiment = await storage.getExperiment(id);
        if (experiment) {
          // Simulate completion readiness based on start date (e.g., needs to run for at least 24 hours)
          const startDate = experiment.startDate || new Date();
          const now = new Date();
          const hoursRunning = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
          
          // Set canComplete to true if experiment has been running for at least 1 hour (for demo purposes)
          updates.canComplete = hoursRunning >= 1;
          updates.startDate = experiment.startDate || now;
        }
      }
      
      // Generate new key numbers if status is changing
      if (updates.status) {
        const currentExperiment = await storage.getExperiment(id);
        if (currentExperiment && currentExperiment.status !== updates.status) {
          updates.keyNumbers = generateKeyNumbers({ ...currentExperiment, status: updates.status });
        }
      }
      
      const experiment = await storage.updateExperiment(id, updates);
      
      // Broadcast real-time update
      broadcastUpdate({
        type: 'experiment_updated',
        experiment
      });
      
      res.json(experiment);
    } catch (error: any) {
      console.error('Error updating experiment:', error);
      res.status(500).json({ error: error.message || 'Failed to update experiment' });
    }
  });

  // Delete an experiment
  app.delete('/api/experiments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      await storage.deleteExperiment(id);
      
      // Broadcast real-time update
      broadcastUpdate({
        type: 'experiment_deleted',
        experimentId: id
      });
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting experiment:', error);
      res.status(500).json({ error: error.message || 'Failed to delete experiment' });
    }
  });

  // Simulate completion readiness check for experiments
  app.post('/api/experiments/:id/check-completion', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid experiment ID' });
      }
      
      const experiment = await storage.getExperiment(id);
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }
      
      if (experiment.status !== 'running') {
        return res.status(400).json({ error: 'Experiment is not running' });
      }
      
      // Simulate backend analysis determining if experiment can be completed
      // In real scenario, this would check statistical significance, minimum sample size, etc.
      const startDate = experiment.startDate || new Date();
      const now = new Date();
      const hoursRunning = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      
      // For demo: experiment can be completed after 30 seconds of running
      const canComplete = hoursRunning >= (30 / 3600); // 30 seconds in hours
      
      // Since canComplete is removed from schema, we'll just return the status
      res.json({ canComplete, message: canComplete ? 'Experiment ready for completion' : 'Not enough data yet' });
      
    } catch (error: any) {
      console.error('Error checking experiment completion:', error);
      res.status(500).json({ error: error.message || 'Failed to check completion status' });
    }
  });

  // Get experiment results
  app.get('/api/experiments/:id/results', async (req, res) => {
    try {
      const experimentId = parseInt(req.params.id);
      const experiment = await storage.getExperiment(experimentId);
      
      if (!experiment) {
        return res.status(404).json({ error: 'Experiment not found' });
      }

      if (experiment.status !== 'completed') {
        return res.status(400).json({ error: 'Experiment not completed yet' });
      }

      // Check if results already exist in database and have new format
      if (experiment.results && typeof experiment.results === 'object') {
        const results = experiment.results as any;
        if (results.interpretation && 
            typeof results.interpretation === 'object' && 
            results.interpretation.headerTitle) {
          return res.json(experiment.results);
        }
      }

      // Generate and store results if not exists
      const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
      const controlVariant = variants[0];
      const testVariants = variants.slice(1);
      
      // Simulate statistical significance
      const isSignificant = Math.random() > 0.3; // 70% chance of significance
      const winningVariant = isSignificant && testVariants.length > 0 ? 
        testVariants[Math.floor(Math.random() * testVariants.length)] : 
        controlVariant;

      // Generate metrics based on primary metric type
      const metricConfigs = {
        'retention_d7': { unit: 'pp', baseline: 45.2, maxLift: 15.0 },
        'session_length': { unit: '%', baseline: 8.5, maxLift: 25.0 },
        'conversion_rate': { unit: 'pp', baseline: 3.1, maxLift: 0.8 },
        'revenue_per_user': { unit: '%', baseline: 12.50, maxLift: 30.0 },
        'engagement_score': { unit: '%', baseline: 6.8, maxLift: 20.0 }
      };

      const config = metricConfigs[experiment.primaryMetric as keyof typeof metricConfigs] || metricConfigs['retention_d7'];
      const liftDirection = Math.random() > 0.2 ? 1 : -1; // 80% chance of positive lift
      const liftAmount = (5 + Math.random() * config.maxLift) * liftDirection;
      const absoluteLift = config.unit === 'pp' ? liftAmount : (config.baseline * liftAmount / 100);

      const interpretation = generateDynamicInterpretation(experiment, winningVariant, controlVariant, liftAmount, config, isSignificant);
      console.log('Generated interpretation:', JSON.stringify(interpretation, null, 2));

      const results = {
        summary: {
          outcome: isSignificant ? (Math.abs(liftAmount) > 5 ? 'winner' : 'no_diff') : 'no_diff',
          winningVariant: winningVariant.name,
          primaryMetricDelta: Math.abs(absoluteLift),
          primaryMetricLift: Math.abs(liftAmount),
          pValue: isSignificant ? Math.random() * 0.01 : 0.05 + Math.random() * 0.15,
          confidence: isSignificant ? 95 + Math.random() * 4 : 50 + Math.random() * 40,
          effectSize: Math.abs(liftAmount / 100),
          sampleSize: Math.floor(200000 + Math.random() * 150000),
          testType: 'chi_square'
        },
        metrics: variants.map(variant => ({
          group: variant.name,
          value: variant.name === winningVariant.name ? 
            config.baseline + absoluteLift : config.baseline,
          absoluteChange: variant.name === winningVariant.name ? absoluteLift : 0,
          relativeChange: variant.name === winningVariant.name ? liftAmount : 0,
          sampleSize: Math.floor((200000 + Math.random() * 150000) * variant.allocation / 100)
        })),
        chartData: {
          labels: variants.map(v => v.name),
          datasets: [{
            data: variants.map(variant => 
              variant.name === winningVariant.name ? 
                config.baseline + absoluteLift : config.baseline
            ),
            backgroundColor: variants.map(variant => 
              variant.name === winningVariant.name ? '#377DFF' : '#D1D5DB'
            )
          }]
        },
        interpretation,
        sqlQuery: `-- Experiment Results Query
SELECT 
  variant_name,
  COUNT(*) as users,
  AVG(${experiment.primaryMetric}) as metric_value,
  STDDEV(${experiment.primaryMetric}) as std_dev
FROM experiment_events 
WHERE experiment_id = ${experimentId}
  AND date_created BETWEEN '${experiment.startDate}' AND '${experiment.endDate}'
GROUP BY variant_name;`,
        pythonScript: `# Experiment Analysis Script
import pandas as pd
import scipy.stats as stats

# Load experiment data
df = pd.read_sql('''
  SELECT variant_name, ${experiment.primaryMetric}
  FROM experiment_events 
  WHERE experiment_id = ${experimentId}
''', connection)

# Statistical analysis
control = df[df.variant_name == '${controlVariant.name}']['${experiment.primaryMetric}']
variant = df[df.variant_name == '${winningVariant.name}']['${experiment.primaryMetric}']

statistic, p_value = stats.ttest_ind(variant, control)
print(f'T-statistic: {statistic:.4f}')
print(f'P-value: {p_value:.6f}')
print(f'Significant: {p_value < 0.05}')`
      };

      // Store results in experiment database record
      await storage.updateExperiment(experimentId, { results });

      res.json(results);
    } catch (error: any) {
      console.error('Error fetching experiment results:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch results' });
    }
  });

  // AI Hypothesis Scoring System
  app.post('/api/ai/hypothesis-score', async (req, res) => {
    try {
      const { text } = req.body;
      
      if (!text || text.trim().length === 0) {
        return res.json({ 
          quality_score: 0, 
          missing: ["Population", "Action", "Metric", "Direction", "Timeframe"],
          suggestions: []
        });
      }
      
      // Analyze hypothesis components using pattern matching
      const components_found = [];
      const missing = [];
      
      // Check for Population (who)
      const hasPopulation = /(users?|players?|customers?|people|cohort|segment|heavy|light|new|existing|premium|free)/i.test(text);
      if (hasPopulation) {
        components_found.push("Population");
      } else {
        missing.push("Population");
      }
      
      // Check for Action/Change (what)
      const hasAction = /(feature|mechanic|booster|content|design|ui|flow|experience|offer|price|reward)/i.test(text);
      if (hasAction) {
        components_found.push("Action");
      } else {
        missing.push("Action");
      }
      
      // Check for Metric (measure)
      const hasMetric = /(retention|conversion|revenue|engagement|ltv|arpu|dau|mau|session|time|rate|clicks|purchases)/i.test(text);
      if (hasMetric) {
        components_found.push("Metric");
      } else {
        missing.push("Metric");
      }
      
      // Check for Direction (increase/decrease)
      const hasDirection = /(increase|decrease|higher|lower|more|less|improve|reduce|boost|lift|grow|drop)/i.test(text);
      if (hasDirection) {
        components_found.push("Direction");
      } else {
        missing.push("Direction");
      }
      
      // Check for Timeframe
      const hasTimeframe = /(d1|d7|d30|day|week|month|quarter|within|after|by)/i.test(text);
      if (hasTimeframe) {
        components_found.push("Timeframe");
      } else {
        missing.push("Timeframe");
      }
      
      const quality_score = components_found.length / 5;
      
      // Generate context-aware suggestions based on missing components
      const suggestions = [];
      if (missing.includes("Population")) {
        suggestions.push("Heavy users who receive the new feature will have higher D7 retention than control.");
      }
      if (missing.includes("Metric")) {
        suggestions.push("New booster increases average session length by ≥ 15% within 7 days.");
      }
      if (missing.includes("Direction") || missing.includes("Timeframe")) {
        suggestions.push("Premium content users will convert at 20% higher rate this month.");
      }
      
      // If no specific missing components, provide general improvements
      if (suggestions.length === 0) {
        suggestions.push(
          "Players offered the enhanced tutorial will complete onboarding 25% faster within first session.",
          "Daily active users exposed to new rewards system will increase session time by 10% over 2 weeks.",
          "High-value cohort receiving personalized offers will convert 30% more than control group."
        );
      }
      
      const analysis = {
        components_found,
        quality_score,
        missing,
        suggestions: suggestions.slice(0, 3)
      };

      // Ensure quality_score is between 0 and 1
      analysis.quality_score = Math.max(0, Math.min(1, analysis.quality_score));
      
      // Limit suggestions to 3
      if (analysis.suggestions) {
        analysis.suggestions = analysis.suggestions.slice(0, 3);
      }

      res.json(analysis);
      
    } catch (error: any) {
      console.error('Error analyzing hypothesis:', error);
      
      // Fallback response on error
      res.json({
        quality_score: 0.2,
        missing: ["Population", "Action", "Metric", "Direction", "Timeframe"],
        suggestions: [
          "Players who receive the new feature will have higher D7 retention than control.",
          "New booster increases average session length by ≥ 5% within 7 days.",
          "Heavy users offered premium content will convert at 15% higher rate this month."
        ]
      });
    }
  });

  // Configuration endpoints
  app.get('/api/config/metrics', async (req, res) => {
    try {
      const primaryMetrics = [
        { value: "retention_rate", label: "Retention Rate" },
        { value: "conversion_rate", label: "Conversion Rate" },
        { value: "revenue_per_user", label: "Revenue Per User" },
        { value: "session_duration", label: "Session Duration" },
        { value: "engagement_score", label: "Engagement Score" },
        { value: "dau", label: "Daily Active Users" },
        { value: "ltv", label: "Lifetime Value" },
      ];

      const secondaryMetrics = [
        { value: "session_count", label: "Session Count" },
        { value: "time_to_first_action", label: "Time to First Action" },
        { value: "feature_adoption", label: "Feature Adoption" },
        { value: "churn_rate", label: "Churn Rate" },
        { value: "purchase_frequency", label: "Purchase Frequency" },
        { value: "social_shares", label: "Social Shares" },
        { value: "nps_score", label: "NPS Score" },
        { value: "support_tickets", label: "Support Tickets" },
      ];

      res.json({ primaryMetrics, secondaryMetrics });
    } catch (error: any) {
      console.error('Error fetching metrics config:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch metrics' });
    }
  });

  // Cohort Management - Get cohorts from database
  app.get('/api/cohorts', async (req, res) => {
    try {
      const userId = 1; // Default user for demo
      const userCohorts = await storage.getUserCohorts(userId);
      res.json(userCohorts);
    } catch (error: any) {
      console.error('Error fetching cohorts:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch cohorts' });
    }
  });

  // Create cohort with file upload - using multer middleware
  app.post('/api/cohorts/upload', upload.single('csvFile'), async (req, res) => {
    try {
      const { name, userIdColumn, groupColumn, controlValue, variantValue } = req.body;
      const file = req.file;
      
      if (!name || !file || !userIdColumn) {
        return res.status(400).json({ error: 'Name, CSV file, and user ID column are required' });
      }
      
      // Read and parse the uploaded CSV file
      const csvContent = fs.readFileSync(file.path, 'utf8');
      const analysisResult = parseCsvData(csvContent, userIdColumn, groupColumn, controlValue, variantValue);
      
      // Convert file content to base64 bytes for storage
      const fileBuffer = fs.readFileSync(file.path);
      const fileBytes = fileBuffer.toString('base64');
      
      // Create cohort record in database
      const cohortData = {
        userId: 1, // Default user for demo
        name,
        fileName: file.originalname,
        fileBytes: fileBytes,
        userIdColumn,
        groupColumn: groupColumn || null,
        controlValue: controlValue || null,
        variantValue: variantValue || null,
        size: analysisResult.totalUsers,
        controlCount: analysisResult.controlCount,
        variantCount: analysisResult.variantCount,
        hasGroupAssignments: analysisResult.hasGroupAssignments
      };
      
      const newCohort = await storage.createCohort(cohortData);
      
      // Clean up temporary file since we've stored the content as bytes
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      res.json({
        id: newCohort.id.toString(),
        name: newCohort.name,
        size: newCohort.size,
        controlCount: newCohort.controlCount,
        variantCount: newCohort.variantCount,
        hasGroupAssignments: newCohort.hasGroupAssignments
      });
    } catch (error: any) {
      console.error('Error creating cohort:', error);
      
      // Clean up temporary file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ error: error.message || 'Failed to create cohort' });
    }
  });

  // Download cohort file endpoint
  app.get('/api/cohorts/:id/download', async (req, res) => {
    try {
      const cohortId = parseInt(req.params.id);
      
      if (isNaN(cohortId)) {
        return res.status(400).json({ error: 'Invalid cohort ID' });
      }

      const cohort = await storage.getCohort(cohortId);
      if (!cohort) {
        return res.status(404).json({ error: 'Cohort not found' });
      }

      // Convert base64 bytes back to file content
      const fileBuffer = Buffer.from(cohort.fileBytes, 'base64');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${cohort.fileName}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('Error downloading cohort file:', error);
      res.status(500).json({ error: error.message || 'Failed to download cohort file' });
    }
  });

  // Delete cohort endpoint
  app.delete('/api/cohorts/:id', async (req, res) => {
    try {
      const cohortId = parseInt(req.params.id);
      
      if (isNaN(cohortId)) {
        return res.status(400).json({ error: 'Invalid cohort ID' });
      }

      // Note: File content is stored as bytes in database, no physical file to delete

      await storage.deleteCohort(cohortId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting cohort:', error);
      res.status(500).json({ error: error.message || 'Failed to delete cohort' });
    }
  });

  // Interactive Slack endpoints
  app.post('/slack/commands', async (req, res) => {
    const body = req.body;
    console.log('Received Slack command:', body.command, 'from user:', body.user_id);

    if (body.command === '/analyse') {
      // Try to open modal with a short timeout
      try {
        const modalPromise = handleAnalyseCommand(body);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('timeout')), 1500);
        });
        
        await Promise.race([modalPromise, timeoutPromise]);
        
        // Modal opened successfully - send minimal response
        res.status(200).json({ text: '' });
        
      } catch (error) {
        console.error('Modal failed, sending fallback:', error);
        
        // Send rich fallback with analytics options
        res.status(200).json({
          response_type: 'ephemeral',
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Analytics Assistant*\n\nAsk me any analytics question:'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '*Quick Questions:*\n• What are our conversion rates?\n• How is user engagement trending?\n• What drives revenue growth?\n• Which cohorts show best retention?'
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: 'Just mention @Analytics Assistant with your question'
                }
              ]
            }
          ]
        });
      }
    } else {
      res.status(200).json({
        response_type: 'ephemeral',
        text: 'Command not recognized. Use /analyse to ask analytics questions.'
      });
    }
  });

  app.post('/slack/interactions', async (req, res) => {
    try {
      const payload = JSON.parse(req.body.payload);
      console.log('Received Slack interaction:', payload.type, 'from user:', payload.user?.id);

      await handleInteractiveAction(payload);
      res.status(200).json({ text: '' }); // Proper JSON response
    } catch (error) {
      console.error('Slack interaction error:', error);
      res.status(200).json({ text: 'An error occurred while processing your interaction' });
    }
  });

  // Modal preview endpoint for testing
  app.get('/api/slack/modal-preview', async (req, res) => {
    try {
      const preview = await getModalPreview();
      res.json(preview);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate modal preview' });
    }
  });

  // Test message endpoint
  app.post('/api/slack/test-message', async (req, res) => {
    try {
      const { channel, message } = req.body;
      const result = await sendTestMessage(channel, message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Failed to send test message' });
    }
  });

  // In-memory connector state store
  const connectorState: Record<string, boolean> = {
    firebase: false,
    launchdarkly: false,
    optimizely: false,
    split: false
  };

  // Initialize default RC features in database if they don't exist
  async function initializeDefaultFeatures() {
    try {
      const existingFeatures = await db.select().from(rcFeatures).limit(1);
      if (existingFeatures.length === 0) {
        const defaultFeatures = [
          {
            featureCode: 'checkout_flow_v2',
            rcKeyPath: 'features.checkout.version',
            type: 'string' as const,
            defaultValue: 'v1',
            status: 'active' as const,
            provider: 'firebase',
          },
          {
            featureCode: 'show_premium_offers',
            rcKeyPath: 'features.premium.enabled',
            type: 'bool' as const,
            defaultValue: 'false',
            status: 'active' as const,
            provider: 'launchdarkly',
          },
          {
            featureCode: 'discount_percentage',
            rcKeyPath: 'promotions.discount.rate',
            type: 'int' as const,
            defaultValue: '10',
            status: 'active' as const,
            provider: 'firebase',
          }
        ];
        
        await db.insert(rcFeatures).values(defaultFeatures);
        console.log('Default RC features initialized');
      }
    } catch (error) {
      console.error('Error initializing default features:', error);
    }
  }
  
  initializeDefaultFeatures();

  // Remote Config endpoints
  app.get('/api/connectors', async (req, res) => {
    try {
      res.json(connectorState);
    } catch (error: any) {
      console.error('Error fetching connectors:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch connectors' });
    }
  });

  app.post('/api/connectors/:providerId/connect', async (req, res) => {
    try {
      const { providerId } = req.params;
      const { apiKey, projectId, environment } = req.body;

      if (providerId === 'launchdarkly') {
        // Actually test LaunchDarkly API connection
        const token = process.env.LAUNCHDARKLY_API_TOKEN?.trim();
        
        if (!token) {
          return res.status(500).json({
            success: false,
            error: "LaunchDarkly API token not configured in server environment"
          });
        }
        
        if (!projectId) {
          return res.status(400).json({
            success: false,
            error: "Missing projectId (LD project key) from client payload"
          });
        }

        try {
          // Test API connection by making project-specific request
          const response = await axios.get(`https://app.launchdarkly.com/api/v2/projects/${encodeURIComponent(projectId)}`, {
            headers: {
              Authorization: token,  // LaunchDarkly doesn't use 'Bearer' prefix
              "Content-Type": "application/json",
              "LD-API-Version": "beta",
              "X-LaunchDarkly-User-Agent": "BlockHeadsExperimentDashboard/1.0"
            },
            timeout: 10_000
          });

          // if we got here, creds + project key are valid
          connectorState[providerId] = true;
          res.json({
            success: true,
            providerId: "launchdarkly",
            projectId,
            environment: environment || 'production',
            message: "Successfully connected to LaunchDarkly"
          });
        } catch (err: unknown) {
          const { response } = err as any;

          let reason = "Unknown error";
          if (response?.status === 401) reason = "Token invalid or expired";
          else if (response?.status === 403)
            reason = "Token lacks read access to this project";
          else if (response?.status === 404)
            reason = `Project key "${projectId}" not found`;
          else if (err instanceof Error) reason = err.message;

          console.error('LaunchDarkly connection test failed:', err);
          res.status(502).json({
            success: false,
            error: `LaunchDarkly connection failed: ${reason}`,
            details: response?.data ?? null
          });
        }
      } else {
        // For other providers, simulate connection for demo
        setTimeout(() => {
          connectorState[providerId] = true;
          res.json({ 
            success: true, 
            providerId, 
            projectId,
            environment,
            message: `Successfully connected to ${providerId}` 
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error connecting provider:', error);
      res.status(500).json({ error: error.message || 'Failed to connect provider' });
    }
  });

  app.post('/api/connectors/:providerId/disconnect', async (req, res) => {
    try {
      const { providerId } = req.params;
      
      // Update the connector state to disconnected
      connectorState[providerId] = false;
      
      res.json({ 
        success: true, 
        providerId,
        message: `Successfully disconnected from ${providerId}` 
      });
    } catch (error: any) {
      console.error('Error disconnecting provider:', error);
      res.status(500).json({ error: error.message || 'Failed to disconnect provider' });
    }
  });

  app.get('/api/connectors/:providerId/manage', async (req, res) => {
    try {
      const { providerId } = req.params;
      
      // Return management information for the provider
      const isConnected = connectorState[providerId] || false;
      
      res.json({ 
        success: true, 
        providerId,
        isConnected,
        managementUrl: `https://app.${providerId}.com`,
        message: `Management interface for ${providerId}` 
      });
    } catch (error: any) {
      console.error('Error getting provider management info:', error);
      res.status(500).json({ error: error.message || 'Failed to get management info' });
    }
  });

  app.get('/api/rc-registry', async (req, res) => {
    try {
      const features = await db.select().from(rcFeatures);
      
      // Format for frontend compatibility
      const formattedFeatures = features.map(feature => ({
        id: feature.id,
        featureCode: feature.featureCode,
        rcKeyPath: feature.rcKeyPath,
        type: feature.type,
        defaultValue: feature.defaultValue,
        status: feature.status,
        provider: feature.provider,
        lastUpdated: feature.createdAt ? feature.createdAt.toLocaleDateString() + ' ago' : 'Unknown'
      }));
      
      res.json(formattedFeatures);
    } catch (error: any) {
      console.error('Error fetching RC registry:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch RC registry' });
    }
  });

  app.post('/api/rc-registry', async (req, res) => {
    try {
      const { featureCode, rcKeyPath, type, defaultValue, provider } = req.body;

      // Validate required fields
      if (!featureCode || !rcKeyPath || !type || !defaultValue || !provider) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      // Validate feature code format
      if (!/^[a-z_][a-z0-9_]*$/.test(featureCode)) {
        return res.status(400).json({ error: 'Feature code must be lowercase with underscores only' });
      }

      // Validate type
      if (!['bool', 'string', 'int', 'json'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be bool, string, int, or json' });
      }

      // Validate request body using Zod schema
      const validatedData = insertRcFeatureSchema.parse({
        featureCode,
        rcKeyPath,
        type,
        defaultValue,
        status: 'active',
        provider
      });
      
      // Insert new feature into database
      const [newFeature] = await db.insert(rcFeatures).values(validatedData).returning();
      
      // Format response for frontend compatibility
      const formattedFeature = {
        id: newFeature.id,
        featureCode: newFeature.featureCode,
        rcKeyPath: newFeature.rcKeyPath,
        type: newFeature.type,
        defaultValue: newFeature.defaultValue,
        status: newFeature.status,
        provider: newFeature.provider,
        lastUpdated: 'just now'
      };

      res.status(201).json({
        success: true,
        feature: formattedFeature,
        message: 'Remote config feature created successfully'
      });
    } catch (error: any) {
      console.error('Error creating RC feature:', error);
      res.status(500).json({ error: error.message || 'Failed to create RC feature' });
    }
  });

  app.put('/api/rc-registry/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { featureCode, rcKeyPath, type, defaultValue, provider } = req.body;

      // Validate required fields
      if (!rcKeyPath || !type || !defaultValue || !provider) {
        return res.status(400).json({ error: 'RC key path, type, default value, and provider are required' });
      }

      // Validate type
      if (!['bool', 'string', 'int', 'json'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Must be bool, string, int, or json' });
      }

      // Check if feature exists
      const [existingFeature] = await db.select().from(rcFeatures).where(eq(rcFeatures.id, parseInt(id)));
      if (!existingFeature) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      // Update feature in database (keep original featureCode, don't allow changing it)
      const [updatedFeature] = await db
        .update(rcFeatures)
        .set({
          rcKeyPath,
          type,
          defaultValue,
          provider,
          // Update timestamp would be automatically handled if we had an updatedAt field
        })
        .where(eq(rcFeatures.id, parseInt(id)))
        .returning();

      // Format response for frontend compatibility
      const formattedFeature = {
        id: updatedFeature.id,
        featureCode: updatedFeature.featureCode,
        rcKeyPath: updatedFeature.rcKeyPath,
        type: updatedFeature.type,
        defaultValue: updatedFeature.defaultValue,
        status: updatedFeature.status,
        provider: updatedFeature.provider,
        lastUpdated: 'just now'
      };

      res.json({
        success: true,
        feature: formattedFeature,
        message: 'Remote config feature updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating RC feature:', error);
      res.status(500).json({ error: error.message || 'Failed to update RC feature' });
    }
  });

  app.delete('/api/rc-registry/:id', async (req, res) => {
    try {
      const { id } = req.params;

      // Check if feature exists
      const [existingFeature] = await db.select().from(rcFeatures).where(eq(rcFeatures.id, parseInt(id)));
      if (!existingFeature) {
        return res.status(404).json({ error: 'Feature not found' });
      }

      // Delete feature from database
      await db.delete(rcFeatures).where(eq(rcFeatures.id, parseInt(id)));

      res.json({
        success: true,
        message: 'Remote config feature deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting RC feature:', error);
      res.status(500).json({ error: error.message || 'Failed to delete RC feature' });
    }
  });

  app.post('/api/rc-registry/deploy', async (req, res) => {
    try {
      const { experimentId, providerId, featureId, targetValue, environment, flagKey, winnerKey, traffic = 1, projectKey = 'default' } = req.body;
      
      console.log('Deploy endpoint received:', {
        experimentId, providerId, featureId, targetValue, environment, flagKey, winnerKey, traffic, projectKey
      });

      if (providerId === 'launchdarkly') {
        // Check for LaunchDarkly API token
        const ldToken = process.env.LAUNCHDARKLY_API_TOKEN;
        if (!ldToken) {
          return res.status(400).json({ 
            error: 'LaunchDarkly API token not configured. Please set LAUNCHDARKLY_API_TOKEN environment variable.' 
          });
        }

        try {
          // Extract winner key from targetValue (payload)
          let actualWinnerKey = winnerKey;
          
          // If targetValue is a string (like "basic" or "ultra-strong"), use it directly
          if (typeof targetValue === 'string') {
            actualWinnerKey = targetValue.replace(/"/g, ''); // Remove quotes if present
          }
          // If targetValue is an object with variant property
          else if (targetValue && typeof targetValue === 'object' && targetValue.variant) {
            actualWinnerKey = targetValue.variant;
          }
          
          console.log(`Using winner key: "${actualWinnerKey}" from targetValue:`, targetValue);
          
          // Use real LaunchDarkly API
          const result = await launchDarklyRollout(
            ldToken,
            projectKey,
            environment,
            flagKey,
            actualWinnerKey,
            traffic
          );

          res.json({
            success: true,
            deploymentId: `ld_${result.ldVersion}`,
            experimentId,
            providerId,
            featureId,
            targetValue,
            environment,
            ldVersion: result.ldVersion,
            message: `Feature successfully deployed to LaunchDarkly (version ${result.ldVersion})`
          });
        } catch (ldError: any) {
          console.error('LaunchDarkly deployment failed:', ldError);
          res.status(500).json({ 
            error: `LaunchDarkly deployment failed: ${ldError.message}`,
            details: ldError.response?.data || ldError.message
          });
        }
      } else {
        // For other providers, simulate deployment
        setTimeout(() => {
          res.json({
            success: true,
            deploymentId: `deploy_${Date.now()}`,
            experimentId,
            providerId,
            featureId,
            targetValue,
            environment,
            message: `Feature successfully deployed to ${providerId}`
          });
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error deploying to RC:', error);
      res.status(500).json({ error: error.message || 'Failed to deploy to Remote Config' });
    }
  });

  return httpServer;
}
