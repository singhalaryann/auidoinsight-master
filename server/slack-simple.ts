import { WebClient } from '@slack/web-api';
import { storage } from './storage';
import { classifyIntent } from './openai';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function handleSlackMessage(text: string, userId: string, channelId: string): Promise<void> {
  try {
    // Clean the message text
    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    if (cleanText.length === 0) {
      try {
        await slack.chat.postMessage({
          channel: channelId,
          text: 'Ask me an analytics question! For example: "What are our conversion rates?" or "How is user engagement trending?"'
        });
      } catch (channelError) {
        console.log(`Cannot respond in channel ${channelId} - bot may not be invited to this channel`);
      }
      return;
    }

    console.log(`Processing Slack message: "${cleanText}" in channel ${channelId}`);

    // Process the question using existing logic
    const intent = await classifyIntent(cleanText);
    
    // Save question to database
    const question = await storage.createQuestion({
      userId: 1, // Default user for Slack
      text: cleanText,
      source: 'slack',
      intent: intent as any
    });

    // Update user profile with new weights
    const currentProfile = await storage.getUserProfile(1);
    const currentWeights = (currentProfile?.pillars as any) || {
      engagement: 0.7,
      retention: 0.7,
      monetization: 0.3,
      store: 0.3,
      ua: 0.3,
      techHealth: 0.5,
      social: 0.3
    };

    const newWeights = { ...currentWeights };
    const decayFactor = 0.99;
    const boostFactor = 0.2;

    // Apply exponential decay to all pillars
    Object.keys(newWeights).forEach(pillar => {
      newWeights[pillar as keyof typeof newWeights] *= decayFactor;
    });

    // Boost mentioned pillars
    intent.pillars.forEach(pillar => {
      if (pillar in newWeights) {
        newWeights[pillar as keyof typeof newWeights] += boostFactor * intent.confidence;
      }
    });

    await storage.updateUserProfile(1, newWeights);

    // Send simple response to Slack using the event channel
    try {
      await slack.chat.postMessage({
        channel: channelId,
        text: `Analyzed your question: "${cleanText}"\n\nAI classified this as: ${intent.primaryPillar} (${Math.round(intent.confidence * 100)}% confidence)\n\nYour analytics dashboard has been updated with focus on: ${intent.pillars.join(', ')}`
      });
      console.log(`Successfully processed Slack message and updated analytics`);
    } catch (responseError: any) {
      console.log(`Processing completed but cannot respond in channel ${channelId}: ${responseError.message}`);
      console.log(`Question "${cleanText}" was still processed and saved to database successfully`);
    }

  } catch (error) {
    console.error('Error handling Slack message:', error);
    
    // Only try to send error response if it's not a channel access issue
    if (error instanceof Error && !error.message.includes('channel_not_found')) {
      try {
        await slack.chat.postMessage({
          channel: channelId,
          text: `Sorry, I encountered an error processing your question. Please try again or rephrase your question.`
        });
      } catch (slackError) {
        console.error('Error sending Slack error message:', slackError);
      }
    }
  }
}

export async function handleSlackSlashCommand(
  command: string,
  text: string,
  userId: string,
  channelId: string
): Promise<{ response_type: string; text: string }> {
  try {
    if (!text || text.trim() === '') {
      return {
        response_type: 'ephemeral',
        text: 'Please ask a question! Example: /ask What\'s our user retention this week?'
      };
    }

    // Process the question
    await handleSlackMessage(text, userId, channelId);
    
    return {
      response_type: 'in_channel',
      text: `🔍 Processing your question: "${text}"\nI'll analyze this and update your analytics dashboard shortly.`
    };
  } catch (error) {
    console.error('Error handling slash command:', error);
    return {
      response_type: 'ephemeral',
      text: 'Sorry, I encountered an error processing your question. Please try again.'
    };
  }
}