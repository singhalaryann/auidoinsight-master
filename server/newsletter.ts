import { storage } from './storage';
import { sendEmail } from './sendgrid';
import { sendSlackMessage } from './slack';
import { classifyIntent, generateInsight } from './openai';
import type { User, Question, PillarWeights, AnalyticsPillar } from '../shared/schema';

interface NewsletterInsight {
  id: string;
  pillar: AnalyticsPillar;
  title: string;
  summary: string;
  trend: 'up' | 'down' | 'stable';
  recommendation: string;
  supportingQuestions: string[];
}

interface NewsletterContent {
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  totalQuestions: number;
  topPillars: { pillar: AnalyticsPillar; weight: number; percentage: number }[];
  insights: NewsletterInsight[];
  actionItems: string[];
  nextWeekFocus: string[];
}

export class NewsletterEngine {
  
  async generateWeeklyNewsletter(userId: number): Promise<NewsletterContent> {
    // Get user's questions from the past week
    const weeklyQuestions = await this.getWeeklyQuestions(userId);
    const userProfile = await storage.getUserProfile(userId);
    
    if (!userProfile || weeklyQuestions.length === 0) {
      throw new Error('Insufficient data for newsletter generation');
    }

    // Extract pillar weights from the pillars JSON field
    const pillarWeights = userProfile.pillars as PillarWeights;
    
    // Analyze question patterns and pillar focus
    const pillarAnalysis = this.analyzePillarTrends(weeklyQuestions, pillarWeights);
    
    // Generate insights for top pillars
    const insights = await this.generateInsights(pillarAnalysis.topPillars, weeklyQuestions);
    
    // Create actionable recommendations
    const actionItems = this.generateActionItems(insights, pillarAnalysis);
    
    // Suggest next week focus areas
    const nextWeekFocus = this.suggestNextWeekFocus(pillarAnalysis, pillarWeights);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekEnd = new Date();

    return {
      userId,
      weekStartDate: weekStart.toISOString().split('T')[0],
      weekEndDate: weekEnd.toISOString().split('T')[0],
      totalQuestions: weeklyQuestions.length,
      topPillars: pillarAnalysis.topPillars,
      insights,
      actionItems,
      nextWeekFocus
    };
  }

  private async getWeeklyQuestions(userId: number): Promise<Question[]> {
    const allQuestions = await storage.getUserQuestions(userId, 50);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return allQuestions.filter(q => {
      const questionDate = q.timestamp ? new Date(q.timestamp) : new Date();
      return questionDate >= oneWeekAgo;
    });
  }

  private analyzePillarTrends(questions: Question[], currentWeights: PillarWeights) {
    const pillarCounts: Record<string, number> = {};
    const pillarQuestions: Record<string, string[]> = {};
    
    // Count questions per pillar based on intent classification
    questions.forEach(q => {
      const intent = q.intent as { primaryPillar?: string; pillars?: string[]; confidence?: number };
      if (intent?.primaryPillar) {
        pillarCounts[intent.primaryPillar] = (pillarCounts[intent.primaryPillar] || 0) + 1;
        if (!pillarQuestions[intent.primaryPillar]) {
          pillarQuestions[intent.primaryPillar] = [];
        }
        pillarQuestions[intent.primaryPillar].push(q.text);
      }
    });

    // Calculate top pillars by activity
    const topPillars = Object.entries(pillarCounts)
      .map(([pillar, count]) => ({
        pillar: pillar as AnalyticsPillar,
        weight: currentWeights[pillar as keyof PillarWeights] || 0,
        percentage: Math.round((count / questions.length) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);

    return { topPillars, pillarQuestions };
  }

  private async generateInsights(topPillars: any[], questions: Question[]): Promise<NewsletterInsight[]> {
    const insights: NewsletterInsight[] = [];
    
    for (const pillarData of topPillars) {
      const pillarQuestions = questions.filter(q => {
        const intent = q.intent as { primaryPillar?: string; pillars?: string[]; confidence?: number };
        return intent?.primaryPillar === pillarData.pillar;
      });
      
      // Determine trend based on question frequency and timing
      const trend = this.calculateTrend(pillarQuestions);
      
      // Generate AI insight if available, otherwise use pattern-based insight
      let aiInsight = '';
      try {
        aiInsight = await generateInsight(pillarData.pillar, { questions: pillarQuestions });
      } catch (error) {
        console.log('AI insight generation failed, using pattern-based insight');
      }
      
      const insight: NewsletterInsight = {
        id: `${pillarData.pillar}-${Date.now()}`,
        pillar: pillarData.pillar,
        title: this.generateInsightTitle(pillarData.pillar, pillarData.percentage, trend),
        summary: aiInsight || this.generatePatternBasedSummary(pillarData.pillar, pillarQuestions),
        trend,
        recommendation: this.generateRecommendation(pillarData.pillar, trend, pillarData.percentage),
        supportingQuestions: pillarQuestions.slice(0, 3).map(q => q.text)
      };
      
      insights.push(insight);
    }
    
    return insights;
  }

  private calculateTrend(questions: Question[]): 'up' | 'down' | 'stable' {
    if (questions.length < 2) return 'stable';
    
    const halfPoint = Math.floor(questions.length / 2);
    const firstHalf = questions.slice(0, halfPoint);
    const secondHalf = questions.slice(halfPoint);
    
    if (secondHalf.length > firstHalf.length * 1.2) return 'up';
    if (secondHalf.length < firstHalf.length * 0.8) return 'down';
    return 'stable';
  }

  private generateInsightTitle(pillar: AnalyticsPillar, percentage: number, trend: string): string {
    const trendText = trend === 'up' ? '📈 Rising' : trend === 'down' ? '📉 Declining' : '📊 Steady';
    const pillarName = pillar.charAt(0).toUpperCase() + pillar.slice(1);
    return `${trendText} ${pillarName} Focus (${percentage}% of questions)`;
  }

  private generatePatternBasedSummary(pillar: AnalyticsPillar, questions: Question[]): string {
    const patterns = {
      engagement: `${questions.length} engagement-focused questions this week suggest active user behavior monitoring. Key areas include user interaction patterns and feature adoption.`,
      retention: `${questions.length} retention queries indicate focus on user lifecycle management. Analysis covers cohort performance and churn prevention strategies. Consider exploring: "What are our 7-day retention cohorts showing?", "How do weekly retention rates compare to monthly?", "Which user segments have the strongest weekly retention?"`,
      monetization: `${questions.length} revenue-related questions show strong commercial focus. Areas include conversion optimization and revenue stream analysis.`,
      store: `${questions.length} app store questions indicate distribution channel optimization. Focus on store performance and visibility metrics.`,
      ua: `${questions.length} acquisition questions suggest growth strategy evaluation. Areas include channel effectiveness and cost optimization.`,
      techHealth: `${questions.length} technical questions indicate infrastructure monitoring needs. Focus on performance, reliability, and system health.`,
      social: `${questions.length} social media questions show community engagement focus. Areas include social metrics and brand presence analysis.`
    };
    
    return patterns[pillar] || `${questions.length} questions analyzed for ${pillar} insights.`;
  }

  private generateRecommendation(pillar: AnalyticsPillar, trend: string, percentage: number): string {
    const recommendations = {
      engagement: {
        up: 'Implement advanced engagement tracking and A/B testing for feature optimization.',
        down: 'Review engagement measurement strategy and establish baseline metrics.',
        stable: 'Maintain current engagement analysis while exploring new interaction patterns.'
      },
      retention: {
        up: 'Develop comprehensive cohort analysis dashboard and predictive churn models.',
        down: 'Focus on fundamental retention metrics and user lifecycle mapping.',
        stable: 'Enhance retention tracking with behavioral segmentation analysis.'
      },
      monetization: {
        up: 'Optimize pricing strategies and implement advanced revenue attribution.',
        down: 'Establish core revenue tracking and conversion funnel analysis.',
        stable: 'Expand monetization analysis with customer lifetime value modeling.'
      }
    };
    
    const pillarRecs = recommendations[pillar as keyof typeof recommendations];
    return pillarRecs?.[trend as keyof typeof pillarRecs] || 
           `Continue monitoring ${pillar} metrics and expand analysis scope.`;
  }

  private generateActionItems(insights: NewsletterInsight[], pillarAnalysis: any): string[] {
    const actionItems: string[] = [];
    
    // Top pillar action
    if (pillarAnalysis.topPillars.length > 0) {
      const topPillar = pillarAnalysis.topPillars[0];
      actionItems.push(`Focus on ${topPillar.pillar} optimization (${topPillar.percentage}% of weekly focus)`);
    }
    
    // Trend-based actions
    insights.forEach(insight => {
      if (insight.trend === 'up') {
        actionItems.push(`Scale ${insight.pillar} analysis infrastructure`);
      } else if (insight.trend === 'down') {
        actionItems.push(`Reinvigorate ${insight.pillar} monitoring strategy`);
      }
    });
    
    // Balance recommendation
    if (pillarAnalysis.topPillars.length > 0 && pillarAnalysis.topPillars[0].percentage > 60) {
      actionItems.push('Consider diversifying analytics focus across multiple pillars');
    }
    
    return actionItems.slice(0, 3); // Limit to 3 actionable items
  }

  private suggestNextWeekFocus(pillarAnalysis: any, currentWeights: PillarWeights): string[] {
    const suggestions: string[] = [];
    
    // Suggest underexplored pillars
    const allPillars = Object.keys(currentWeights) as AnalyticsPillar[];
    const activePillars = pillarAnalysis.topPillars.map((p: any) => p.pillar);
    const underexploredPillars = allPillars.filter(p => !activePillars.includes(p));
    
    if (underexploredPillars.length > 0) {
      suggestions.push(`Explore ${underexploredPillars[0]} metrics for balanced analytics`);
    }
    
    // Suggest advanced analysis for top pillar
    if (pillarAnalysis.topPillars.length > 0) {
      const topPillar = pillarAnalysis.topPillars[0].pillar;
      suggestions.push(`Implement advanced ${topPillar} segmentation analysis`);
    }
    
    // Suggest cross-pillar analysis
    if (pillarAnalysis.topPillars.length >= 2) {
      const pillar1 = pillarAnalysis.topPillars[0].pillar;
      const pillar2 = pillarAnalysis.topPillars[1].pillar;
      suggestions.push(`Analyze correlation between ${pillar1} and ${pillar2} metrics`);
    }
    
    return suggestions.slice(0, 2);
  }

  async sendNewsletterEmail(content: NewsletterContent, user: User): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log('SendGrid not configured, skipping email newsletter');
      return false;
    }

    const html = this.generateEmailHTML(content, user);
    
    try {
      return await sendEmail(process.env.SENDGRID_API_KEY, {
        to: user.username, // Assuming username is email
        from: 'noreply@dashboards-that-listen.com',
        subject: `Your Weekly Analytics Insights - ${content.weekStartDate}`,
        html
      });
    } catch (error) {
      console.error('Newsletter email failed:', error);
      return false;
    }
  }

  async sendNewsletterSlack(content: NewsletterContent, user: User): Promise<boolean> {
    try {
      const message = this.generateSlackMessage(content, user);
      await sendSlackMessage(message);
      return true;
    } catch (error) {
      console.error('Newsletter Slack message failed:', error);
      return false;
    }
  }

  private generateEmailHTML(content: NewsletterContent, user: User): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px; text-align: center; }
            .insight { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 4px; }
            .trend-up { border-left-color: #28a745; }
            .trend-down { border-left-color: #dc3545; }
            .trend-stable { border-left-color: #ffc107; }
            .action-item { background: #e3f2fd; padding: 15px; margin: 10px 0; border-radius: 4px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📊 Your Weekly Analytics Insights</h1>
                <p>${content.weekStartDate} to ${content.weekEndDate}</p>
                <p>Hi ${user.name}, here's your personalized analytics summary</p>
            </div>
            
            <h2>📈 This Week's Activity</h2>
            <p><strong>${content.totalQuestions} questions asked</strong> across your analytics pillars</p>
            
            <h3>Top Focus Areas:</h3>
            ${content.topPillars.map(pillar => `
                <div style="display: inline-block; background: #667eea; color: white; padding: 8px 12px; margin: 4px; border-radius: 16px; font-size: 14px;">
                    ${pillar.pillar.toUpperCase()} ${pillar.percentage}%
                </div>
            `).join('')}
            
            <h2>🔍 Key Insights</h2>
            ${content.insights.map(insight => `
                <div class="insight trend-${insight.trend}">
                    <h3>${insight.title}</h3>
                    <p>${insight.summary}</p>
                    <p><strong>Recommendation:</strong> ${insight.recommendation}</p>
                    ${insight.supportingQuestions.length > 0 ? `
                        <p><em>Based on questions: "${insight.supportingQuestions.join('", "')}"</em></p>
                    ` : ''}
                </div>
            `).join('')}
            
            <h2>🎯 Action Items</h2>
            ${content.actionItems.map(item => `
                <div class="action-item">✓ ${item}</div>
            `).join('')}
            
            <h2>🚀 Next Week Focus</h2>
            ${content.nextWeekFocus.map(focus => `
                <div class="action-item">💡 ${focus}</div>
            `).join('')}
            
            <div class="footer">
                <p>Keep asking questions to shape your analytics experience!</p>
                <p>This newsletter was generated from your actual usage patterns.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  private generateSlackMessage(content: NewsletterContent, user: User) {
    return {
      channel: process.env.SLACK_CHANNEL_ID!,
      text: `Weekly Analytics Insights for ${user.name}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📊 Weekly Analytics Insights'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${content.weekStartDate}* to *${content.weekEndDate}*\n*${content.totalQuestions} questions* asked this week`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🎯 Top Focus Areas:*\n${content.topPillars.map(p => `• *${p.pillar.toUpperCase()}* (${p.percentage}%)`).join('\n')}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*🔍 Key Insights:*\n${content.insights.slice(0, 2).map(i => `• ${i.title}\n  _${i.recommendation}_`).join('\n\n')}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*✅ Action Items:*\n${content.actionItems.map(item => `• ${item}`).join('\n')}`
          }
        }
      ]
    };
  }
}

export const newsletterEngine = new NewsletterEngine();