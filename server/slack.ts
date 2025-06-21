import { WebClient, type ChatPostMessageArguments, type ConversationsHistoryResponse } from "@slack/web-api";
import { storage } from "./storage";
import { classifyIntent, generateAnalysisSetup } from "./openai";
import type { PillarWeights, AnalyticsPillar, IntentClassification } from "@shared/schema";

if (!process.env.SLACK_BOT_TOKEN) {
  console.warn("SLACK_BOT_TOKEN environment variable not set");
}

if (!process.env.SLACK_CHANNEL_ID) {
  console.warn("SLACK_CHANNEL_ID environment variable not set");
}

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function sendSlackMessage(
  message: ChatPostMessageArguments
): Promise<string | undefined> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error("Slack bot token not configured");
    }

    const response = await slack.chat.postMessage(message);
    return response.ts;
  } catch (error: any) {
    console.error('Error sending Slack message:', error);
    
    // Provide more detailed error information
    if (error.code === 'slack_webapi_platform_error') {
      const errorData = error.data;
      switch (errorData?.error) {
        case 'account_inactive':
          throw new Error('Slack account is inactive. Please verify your Slack workspace is active and the bot token is valid.');
        case 'invalid_auth':
          throw new Error('Invalid Slack bot token. Please verify your SLACK_BOT_TOKEN is correct.');
        case 'channel_not_found':
          throw new Error('Slack channel not found. Please verify your SLACK_CHANNEL_ID is correct.');
        case 'not_in_channel':
          throw new Error('Bot is not in the specified channel. Please add the bot to the channel.');
        case 'token_revoked':
          throw new Error('Slack bot token has been revoked. Please generate a new token.');
        case 'app_missing_action_url':
          throw new Error('Slack app configuration is incomplete. Please check your app settings.');
        default:
          throw new Error(`Slack API error: ${errorData?.error || 'Unknown error'}`);
      }
    }
    
    throw error;
  }
}

export async function sendDashboardLink(question: string, dashboardUrl: string): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Analytics Question Processed* :chart_with_upwards_trend:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: `Question: "${question}"`
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
            url: dashboardUrl,
            action_id: 'view_dashboard'
          }
        ]
      }
    ]
  });
}

export async function sendInsightSummary(pillar: string, insight: string): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${pillar.charAt(0).toUpperCase() + pillar.slice(1)} Insight* :bulb:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: insight
        }
      }
    ]
  });
}

export async function sendAnalyticsResponse(
  question: string,
  intent: any,
  dashboardUrl: string
): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  const pillarsText = intent.pillars
    .map((p: string) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`)
    .join('\n');

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Analytics Question Processed* :chart_with_upwards_trend:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Question:* "${question}"`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Primary Focus:*\n${intent.primaryPillar}`
          },
          {
            type: 'mrkdwn',
            text: `*AI Confidence:*\n${Math.round(intent.confidence * 100)}%`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Analytics Pillars:*\n${pillarsText}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Updated Dashboard'
            },
            url: dashboardUrl,
            action_id: 'view_dashboard',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Ask Another Question'
            },
            action_id: 'ask_question',
            value: 'new_question'
          }
        ]
      }
    ]
  });
}

export async function sendWelcomeMessage(): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Welcome to Analytics Dashboard Bot* :robot_face:'
        }
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: 'I can help you explore your analytics by answering questions and dynamically updating your dashboard!'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*How to use:*\n• Ask natural language questions about your data\n• Use slash commands: `/analytics` or `/dashboard`\n• Type "help" for more information'
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Example questions:*\n• "What\'s driving churn this week?"\n• "Show me engagement metrics"\n• "How is revenue performing?"\n• "User acquisition trends"'
        }
      }
    ]
  });
}

export async function readSlackHistory(
  channelId: string,
  messageLimit: number = 100
): Promise<ConversationsHistoryResponse> {
  try {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error("Slack bot token not configured");
    }

    return await slack.conversations.history({
      channel: channelId,
      limit: messageLimit,
    });
  } catch (error) {
    console.error('Error reading Slack history:', error);
    throw error;
  }
}

/**
 * Process a question from Slack using the same logic as the dashboard
 * @param question - The user's question
 * @param userId - The user ID (defaults to 1)
 * @param dashboardUrl - URL to the dashboard for linking
 * @returns Promise resolving to the processed question data
 */
export async function processSlackQuestion(
  question: string,
  userId: number = 1,
  dashboardUrl: string
): Promise<{ questionId?: number; intent?: IntentClassification; updatedWeights?: PillarWeights; needsClarification?: boolean; clarificationQuestions?: any[] }> {
  try {
    // Step 1: Use the same analysis-setup endpoint as the web interface
    const analysisSetup = await generateAnalysisSetup(question);
    
    if (analysisSetup.type === "needs_clarification" && analysisSetup.clarificationQuestions) {
      // Send clarifying questions to Slack
      await sendSlackClarifyingQuestions(question, analysisSetup.clarificationQuestions, dashboardUrl);
      
      // Store the question with pending status and clarification questions
      const savedQuestion = await storage.createQuestion({
        userId,
        text: question,
        source: 'slack',
        intent: { pillars: [], confidence: 0, primaryPillar: 'engagement' as AnalyticsPillar },
        status: 'waiting-for-answers',
        clarifyingQuestions: analysisSetup.clarificationQuestions
      });
      
      return {
        questionId: savedQuestion.id,
        needsClarification: true,
        clarificationQuestions: analysisSetup.clarificationQuestions
      };
    }
    
    // Question doesn't need clarification, process directly using web flow
    return await submitSlackQuestionDirectly(question, userId, dashboardUrl);
    
  } catch (error) {
    console.error('Error processing Slack question:', error);
    await sendSlackErrorMessage(question, error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

export async function submitSlackQuestionDirectly(
  question: string,
  userId: number = 1,
  dashboardUrl: string,
  clarifyingQuestions?: any[]
): Promise<{ questionId: number; intent: IntentClassification; updatedWeights: PillarWeights }> {
  // Use the same endpoint as the web interface - POST /api/questions
  const questionData = {
    text: question,
    source: 'slack',
    clarifyingQuestions: clarifyingQuestions || []
  };

  // Make API call to the same endpoint the web uses
  const response = await fetch(`http://localhost:5000/api/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(questionData)
  });

  if (!response.ok) {
    throw new Error(`Failed to submit question: ${response.statusText}`);
  }

  const result = await response.json();
  
  // Get updated profile to get new weights
  const profile = await storage.getUserProfile(userId);
  const updatedWeights = profile?.pillars as PillarWeights;

  // Send success response to Slack
  if (result.intent) {
    await sendSlackQuestionResponse(question, result.intent, updatedWeights || {} as PillarWeights, dashboardUrl);
  }

  return {
    questionId: result.id,
    intent: result.intent || { pillars: [], confidence: 0, primaryPillar: 'engagement' as AnalyticsPillar },
    updatedWeights: updatedWeights || {} as PillarWeights
  };
}

/**
 * Send a structured response to Slack after processing a question
 */
export async function sendSlackQuestionResponse(
  question: string,
  intent: IntentClassification,
  updatedWeights: PillarWeights,
  dashboardUrl: string
): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  // Format pillar weights for display
  const topPillars = Object.entries(updatedWeights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([pillar, weight]) => `• ${pillar.charAt(0).toUpperCase() + pillar.slice(1)}: ${Math.round(weight * 100)}%`)
    .join('\n');

  const pillarsText = intent.pillars
    .map((p: string) => `• ${p.charAt(0).toUpperCase() + p.slice(1)}`)
    .join('\n');

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Question Processed Successfully* :white_check_mark:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your Question:* "${question}"`
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Primary Focus:*\n${intent.primaryPillar.charAt(0).toUpperCase() + intent.primaryPillar.slice(1)}`
          },
          {
            type: 'mrkdwn',
            text: `*AI Confidence:*\n${Math.round(intent.confidence * 100)}%`
          }
        ]
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Affected Analytics Areas:*\n${pillarsText}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your Updated Focus Areas:*\n${topPillars}`
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
            url: dashboardUrl,
            action_id: 'view_dashboard',
            style: 'primary'
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Ask Another Question'
            },
            action_id: 'ask_question',
            value: 'new_question'
          }
        ]
      }
    ]
  });
}

/**
 * Send clarifying questions to Slack
 */
export async function sendSlackClarifyingQuestions(
  originalQuestion: string,
  clarifyingQuestions: any[],
  dashboardUrl: string
): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    throw new Error("Slack channel ID not configured");
  }

  const questionsText = clarifyingQuestions
    .map((q, index) => `${index + 1}. ${q.question}\n   _Example: ${q.placeholder}_`)
    .join('\n\n');

  await sendSlackMessage({
    channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Need More Details* :thinking_face:`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Your Question:* "${originalQuestion}"`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `To provide the most accurate analysis, please help clarify:\n\n${questionsText}`
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Please respond with your answers, and I'll process your question with the additional context.`
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
            url: dashboardUrl,
            action_id: 'view_dashboard'
          }
        ]
      }
    ]
  });
}

/**
 * Send an error message to Slack when question processing fails
 */
export async function sendSlackErrorMessage(question: string, errorMessage: string): Promise<void> {
  const channel = process.env.SLACK_CHANNEL_ID;
  
  if (!channel) {
    console.error("Cannot send error message - Slack channel ID not configured");
    return;
  }

  try {
    await sendSlackMessage({
      channel,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error Processing Question* :warning:`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Your Question:* "${question}"`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Error:* ${errorMessage}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Please try rephrasing your question or contact support if the issue persists.`
          }
        }
      ]
    });
  } catch (slackError) {
    console.error('Failed to send error message to Slack:', slackError);
  }
}

/**
 * Diagnose Slack connection issues
 */
export async function diagnoseSlackConnection(): Promise<{
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}> {
  try {
    // Check if required environment variables are set
    if (!process.env.SLACK_BOT_TOKEN) {
      return {
        status: 'error',
        message: 'SLACK_BOT_TOKEN environment variable is not set'
      };
    }

    if (!process.env.SLACK_CHANNEL_ID) {
      return {
        status: 'error',
        message: 'SLACK_CHANNEL_ID environment variable is not set'
      };
    }

    // Test the auth
    const authTest = await slack.auth.test();
    
    if (!authTest.ok) {
      return {
        status: 'error',
        message: 'Slack authentication failed',
        details: authTest
      };
    }

    // Try to get channel info to check if bot is in the channel
    try {
      const channelInfo = await slack.conversations.info({
        channel: process.env.SLACK_CHANNEL_ID
      });
      
      if (!channelInfo.ok) {
        return {
          status: 'error',
          message: 'Cannot access the specified channel',
          details: channelInfo
        };
      }
    } catch (channelError: any) {
      if (channelError.data?.error === 'not_in_channel') {
        return {
          status: 'warning',
          message: 'Bot is not in the specified channel. Please add the bot to the channel.',
          details: {
            error: 'not_in_channel',
            solution: 'Add the bot to the channel by typing @BotName in the channel or using /invite @BotName'
          }
        };
      }
      return {
        status: 'error',
        message: 'Channel access error',
        details: channelError.data || channelError.message
      };
    }

    return {
      status: 'success',
      message: 'Slack connection is working properly',
      details: {
        team: authTest.team,
        user: authTest.user,
        bot_id: authTest.bot_id
      }
    };

  } catch (error: any) {
    let errorMessage = 'Unknown error occurred';
    
    if (error.code === 'slack_webapi_platform_error') {
      const errorData = error.data;
      switch (errorData?.error) {
        case 'account_inactive':
          errorMessage = 'Slack account is inactive. The workspace may be suspended or the bot token is from an inactive workspace.';
          break;
        case 'invalid_auth':
          errorMessage = 'Invalid Slack bot token. Please verify your SLACK_BOT_TOKEN is correct and has not expired.';
          break;
        case 'token_revoked':
          errorMessage = 'Slack bot token has been revoked. Please generate a new token from your Slack app settings.';
          break;
        default:
          errorMessage = `Slack API error: ${errorData?.error || 'Unknown error'}`;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      status: 'error',
      message: errorMessage,
      details: error.data || error
    };
  }
}

/**
 * Process clarification answers from Slack message
 */
export async function processClarificationAnswers(
  message: string,
  userId: number = 1,
  dashboardUrl: string
): Promise<boolean> {
  try {
    // Find the most recent question waiting for answers from this user
    const questions = await storage.getUserQuestions(userId, 10);
    const pendingQuestion = questions.find(q => q.status === 'waiting-for-answers' && q.source === 'slack');
    
    if (!pendingQuestion || !pendingQuestion.clarifyingQuestions) {
      return false; // No pending clarification questions
    }

    // Parse the user's message to extract answers
    const clarifyingQuestions = Array.isArray(pendingQuestion.clarifyingQuestions) ? 
      pendingQuestion.clarifyingQuestions : [];
    const answers = parseAnswersFromMessage(message, clarifyingQuestions);
    
    if (answers.length === 0) {
      return false; // No valid answers found
    }

    // Submit the original question with clarification answers using the web API
    const enhancedQuestion = `${pendingQuestion.text}\n\nAdditional context: ${answers.join('. ')}`;
    
    await submitSlackQuestionDirectly(enhancedQuestion, userId, dashboardUrl, answers);
    
    // Update the original question status
    await storage.updateQuestionStatus(pendingQuestion.id, 'completed');
    
    return true;
  } catch (error) {
    console.error('Error processing clarification answers:', error);
    return false;
  }
}

/**
 * Parse answers from user message
 */
function parseAnswersFromMessage(message: string, clarifyingQuestions: any[]): string[] {
  const answers: string[] = [];
  const lines = message.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Simple parsing - treat each line as an answer if it's substantial
  for (const line of lines) {
    if (line.length > 5 && !line.startsWith('@') && !line.includes('http')) {
      answers.push(line);
    }
  }
  
  return answers;
}

/**
 * Handle Slack slash command processing
 * @param text - The command text (e.g., "What's our retention rate?")
 * @param userId - User ID from Slack
 * @param channelId - Channel ID where command was invoked
 * @param dashboardUrl - URL to dashboard
 */
export async function handleSlackCommand(
  text: string,
  userId: string,
  channelId: string, 
  dashboardUrl: string
): Promise<{ response_type: string; text?: string; blocks?: any[] }> {
  try {
    // Parse the question from the command text
    const question = text.trim();
    
    if (!question) {
      return {
        response_type: 'ephemeral',
        text: 'Please provide a question after the /ask command. Example: /ask How is user retention performing?'
      };
    }

    // Process the question (using default user ID 1 for now)
    const result = await processSlackQuestion(question, 1, dashboardUrl);
    
    // Return different responses based on whether clarification is needed
    if (result.needsClarification) {
      return {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:mag: Analyzing your question: "${question}"`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `I've sent you some clarifying questions to provide the most accurate analysis. Please respond with more details.`
            }
          }
        ]
      };
    }
    
    // Return immediate acknowledgment for processed questions
    if (result.intent) {
      return {
        response_type: 'in_channel',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:thinking_face: Processing your question: "${question}"`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `AI identified this as a *${result.intent.primaryPillar}* question with ${Math.round(result.intent.confidence * 100)}% confidence. Your dashboard is being updated...`
            }
          }
        ]
      };
    }

    return {
      response_type: 'ephemeral',
      text: 'Question processed successfully.'
    };
  } catch (error) {
    console.error('Error handling Slack command:', error);
    
    return {
      response_type: 'ephemeral',
      text: `Sorry, I encountered an error processing your question: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
