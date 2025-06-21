import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

// Test endpoint to demonstrate modal structure without requiring valid trigger_id
export async function getModalPreview() {
  return {
    primary_modal: {
      type: 'modal',
      callback_id: 'question_submit',
      title: { type: 'plain_text', text: 'Analytics Question' },
      submit: { type: 'plain_text', text: 'Analyze' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'input',
          block_id: 'q',
          element: {
            type: 'plain_text_input',
            action_id: 'input',
            multiline: true,
            placeholder: { type: 'plain_text', text: 'e.g. What are our conversion rates this month?' },
          },
          label: { type: 'plain_text', text: 'Your analytics question' },
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: '*Quick start options:*' },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '📈 Conversion Rates' },
              action_id: 'preset_conversion',
              value: 'What are our current conversion rates and how do they compare to last month?',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '👥 User Engagement' },
              action_id: 'preset_engagement', 
              value: 'How is user engagement trending over the past 30 days?',
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '💰 Revenue Analytics' },
              action_id: 'preset_revenue',
              value: 'What is our revenue breakdown by user segment this quarter?',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '🔄 Retention Analysis' },
              action_id: 'preset_retention',
              value: 'What are our user retention rates and what factors influence them?',
            },
          ],
        },
      ],
    },
    clarification_modal_example: {
      type: 'modal',
      callback_id: 'clarify_submit',
      title: { type: 'plain_text', text: 'Clarify Your Question' },
      submit: { type: 'plain_text', text: 'Run Analysis' },
      close: { type: 'plain_text', text: 'Cancel' },
      blocks: [
        {
          type: 'section',
          text: { 
            type: 'mrkdwn', 
            text: '*Your question:* How is retention trending?\n\n*I need a bit more context:*' 
          },
        },
        {
          type: 'input',
          block_id: 'clarify_0',
          element: {
            type: 'static_select',
            action_id: 'select',
            placeholder: { type: 'plain_text', text: 'Choose retention type' },
            options: [
              { text: { type: 'plain_text', text: 'Daily retention' }, value: 'daily' },
              { text: { type: 'plain_text', text: 'Weekly retention' }, value: 'weekly' },
              { text: { type: 'plain_text', text: 'Monthly retention' }, value: 'monthly' },
            ],
          },
          label: { type: 'plain_text', text: 'Which retention period?' },
        },
        {
          type: 'input',
          block_id: 'clarify_1',
          element: {
            type: 'datepicker',
            action_id: 'date',
            placeholder: { type: 'plain_text', text: 'Select start date' },
          },
          label: { type: 'plain_text', text: 'Analysis start date' },
        },
      ],
    },
    interaction_flow: {
      step1: "User types /analyse",
      step2: "Primary modal opens with text input + quick-start buttons",
      step3: "User enters question or clicks preset button",
      step4: "Modal submits to /slack/interactions endpoint",
      step5: "AI analyzes question for clarity",
      step6a: "If clear: Save question, update dashboard, send confirmation",
      step6b: "If unclear: Push clarification modal with dynamic inputs",
      step7: "Clarification modal submits enhanced question",
      step8: "Final processing and confirmation sent to user"
    }
  };
}

export async function sendTestMessage(channelOrUser: string, message: string) {
  try {
    const result = await slack.chat.postMessage({
      channel: channelOrUser,
      text: message,
    });
    return { success: true, timestamp: result.ts };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}