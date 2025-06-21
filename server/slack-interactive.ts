import { WebClient } from '@slack/web-api';
import crypto from 'crypto';
import { storage } from './storage';
import { classifyIntent, generateClarifyingQuestions } from './openai';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Verify Slack request signature
export function verifySlackSignature(body: string, signature: string, timestamp: string): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret || !signature || !timestamp) return false;

  const hmac = crypto.createHmac('sha256', signingSecret);
  const [version, hash] = signature.split('=');
  if (!version || !hash) return false;
  
  hmac.update(`${version}:${timestamp}:${body}`);
  const expectedHash = hmac.digest('hex');
  
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

// Handle slash command: /analyse
export async function handleAnalyseCommand(body: any) {
  try {
    // Add timeout to prevent operation_timeout errors
    const modalPromise = slack.views.open({
      trigger_id: body.trigger_id,
      view: buildQuestionInputModal(''),
    });

    // Race against a 2.5 second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Modal opening timed out')), 2500);
    });

    await Promise.race([modalPromise, timeoutPromise]);
    console.log('Modal opened successfully for user:', body.user_id);
  } catch (error: any) {
    console.error('Error opening modal:', error.message);
    // Don't throw - let the command handler send fallback response
    throw new Error('Modal_Failed: ' + error.message);
  }
}

// Handle interactive actions (buttons, modals)
export async function handleInteractiveAction(payload: any) {
  const { type, action_id, trigger_id, view, user } = payload;

  if (action_id?.startsWith('preset_')) {
    // Quick-start button pressed
    const presetText = payload.actions[0].value;
    await slack.views.update({
      view_id: view.id,
      view: buildQuestionInputModal(presetText),
    });
    return;
  }

  if (payload.callback_id === 'question_submit') {
    // Question submitted from first modal
    const question = payload.view.state.values.q.input.value;
    if (!question?.trim()) return;

    try {
      const intent = await classifyIntent(question);
      
      // For now, save all questions directly without clarification
      // The clarification flow can be enabled later when generateClarifyingQuestions is properly configured
      await saveQuestion(question, intent);
      await showConfirmation(user.id, question, intent);
      
    } catch (error) {
      console.error('Error processing question:', error);
      await slack.chat.postEphemeral({
        channel: user.id,
        user: user.id,
        text: 'Sorry, I encountered an error processing your question. Please try again.',
      });
    }
    return;
  }

  if (payload.callback_id === 'clarify_submit') {
    // Clarification submitted
    const originalQuestion = payload.view.private_metadata;
    const answers = collectClarifyAnswers(payload.view);
    const enhancedQuestion = `${originalQuestion}\n\nAdditional context: ${answers.join(', ')}`;

    try {
      const intent = await classifyIntent(enhancedQuestion);
      await saveQuestion(enhancedQuestion, intent);
      await showConfirmation(user.id, enhancedQuestion, intent);
    } catch (error) {
      console.error('Error processing clarified question:', error);
      await slack.chat.postEphemeral({
        channel: user.id,
        user: user.id,
        text: 'Sorry, I encountered an error processing your clarified question. Please try again.',
      });
    }
    return;
  }
}

// Helper functions
function buildQuestionInputModal(prefill: string) {
  return {
    type: 'modal' as const,
    callback_id: 'question_submit',
    title: { type: 'plain_text' as const, text: 'Analytics Question' },
    submit: { type: 'plain_text' as const, text: 'Analyze' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    blocks: [
      {
        type: 'input' as const,
        block_id: 'q',
        element: {
          type: 'plain_text_input' as const,
          action_id: 'input',
          multiline: true,
          placeholder: { type: 'plain_text' as const, text: 'e.g. What are our conversion rates this month?' },
          initial_value: prefill,
        },
        label: { type: 'plain_text' as const, text: 'Your analytics question' },
      },
      {
        type: 'section' as const,
        text: { type: 'mrkdwn' as const, text: '*Quick start options:*' },
      },
      {
        type: 'actions' as const,
        elements: [
          {
            type: 'button' as const,
            text: { type: 'plain_text' as const, text: '📈 Conversion Rates' },
            action_id: 'preset_conversion',
            value: 'What are our current conversion rates and how do they compare to last month?',
          },
          {
            type: 'button' as const,
            text: { type: 'plain_text' as const, text: '👥 User Engagement' },
            action_id: 'preset_engagement',
            value: 'How is user engagement trending over the past 30 days?',
          },
        ],
      },
      {
        type: 'actions' as const,
        elements: [
          {
            type: 'button' as const,
            text: { type: 'plain_text' as const, text: '💰 Revenue Analytics' },
            action_id: 'preset_revenue',
            value: 'What is our revenue breakdown by user segment this quarter?',
          },
          {
            type: 'button' as const,
            text: { type: 'plain_text' as const, text: '🔄 Retention Analysis' },
            action_id: 'preset_retention',
            value: 'What are our user retention rates and what factors influence them?',
          },
        ],
      },
    ],
  };
}

function buildClarifyModal(originalQuestion: string, clarifyingQuestions: any[]) {
  const blocks: any[] = [
    {
      type: 'section',
      text: { 
        type: 'mrkdwn', 
        text: `*Your question:* ${originalQuestion}\n\n*I need a bit more context to give you the best insights:*` 
      },
    },
  ];

  // Add clarifying questions as input blocks
  clarifyingQuestions.forEach((cq, index) => {
    if (cq.type === 'select' && cq.options) {
      blocks.push({
        type: 'input',
        block_id: `clarify_${index}`,
        element: {
          type: 'static_select',
          action_id: 'select',
          placeholder: { type: 'plain_text', text: 'Choose an option' },
          options: cq.options.map((opt: string) => ({
            text: { type: 'plain_text', text: opt },
            value: opt,
          })),
        },
        label: { type: 'plain_text', text: cq.question },
      });
    } else if (cq.type === 'date') {
      blocks.push({
        type: 'input',
        block_id: `clarify_${index}`,
        element: {
          type: 'datepicker',
          action_id: 'date',
          placeholder: { type: 'plain_text', text: 'Select a date' },
        },
        label: { type: 'plain_text', text: cq.question },
      });
    } else {
      blocks.push({
        type: 'input',
        block_id: `clarify_${index}`,
        element: {
          type: 'plain_text_input',
          action_id: 'text',
          placeholder: { type: 'plain_text', text: 'Enter your answer...' },
        },
        label: { type: 'plain_text', text: cq.question },
      });
    }
  });

  return {
    type: 'modal' as const,
    callback_id: 'clarify_submit',
    private_metadata: originalQuestion,
    title: { type: 'plain_text' as const, text: 'Clarify Your Question' },
    submit: { type: 'plain_text' as const, text: 'Run Analysis' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    blocks,
  };
}

function collectClarifyAnswers(view: any): string[] {
  const answers: string[] = [];
  const values = view.state.values;
  
  Object.keys(values).forEach(blockId => {
    if (blockId.startsWith('clarify_')) {
      const block = values[blockId];
      const actionId = Object.keys(block)[0];
      const value = block[actionId].selected_option?.value || 
                   block[actionId].selected_date || 
                   block[actionId].value;
      if (value) {
        answers.push(value);
      }
    }
  });
  
  return answers;
}

async function saveQuestion(text: string, intent: any) {
  // Save to database
  const question = await storage.createQuestion({
    userId: 1, // Default Slack user
    text,
    source: 'slack',
    intent: intent as any,
  });

  // Update user profile weights
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
  
  // Apply decay
  Object.keys(newWeights).forEach(key => {
    newWeights[key] *= decayFactor;
  });

  // Boost relevant pillars
  intent.pillars.forEach((pillar: string) => {
    if (newWeights[pillar] !== undefined) {
      newWeights[pillar] += 0.1;
    }
  });

  await storage.updateUserProfile(1, newWeights);
  
  return question;
}

async function showConfirmation(userId: string, question: string, intent: any) {
  await slack.chat.postMessage({
    channel: userId,
    text: `✅ *Question analyzed successfully!*\n\n*Your question:* ${question}\n\n*AI Classification:* ${intent.primaryPillar} (${Math.round(intent.confidence * 100)}% confidence)\n\n*Focus areas identified:* ${intent.pillars.join(', ')}\n\nYour analytics dashboard has been updated with these insights. Visit your dashboard to see the full analysis.`,
  });
}