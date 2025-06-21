# Interactive Slack Analytics Setup Guide

## Overview
The new Slack integration provides an interactive modal-based flow for analytics questions with guided assistance and clarification steps.

## Features
- **Interactive Modal Flow**: Opens a rich modal interface with quick-start options
- **Guided Question Entry**: Pre-filled buttons for common analytics questions
- **Smart Clarification**: AI-powered follow-up questions when context is needed
- **Real-time Processing**: Questions are analyzed and saved to your dashboard immediately

## Setup Steps

### 1. Update Your Slack App
1. Go to https://api.slack.com/apps
2. Select your Analytics Assistant app
3. Update the app manifest with the new configuration (use `slack-app-manifest.yaml`)
4. Save changes and reinstall the app to your workspace

### 2. Configure Endpoints
The app now uses these endpoints:
- **Slash Commands**: `/slack/commands` (handles `/analyse` command)
- **Interactivity**: `/slack/interactions` (handles modal submissions and button clicks)
- **Events**: `/slack/events` (handles mentions and direct messages)

### 3. Test the Integration
1. In any Slack channel where the bot is invited, type: `/analyse`
2. This opens an interactive modal with:
   - Text input for your analytics question
   - Quick-start buttons for common questions
   - Submit button to analyze

### 4. Quick Start Options
The modal includes preset questions:
- **Conversion Rates**: "What are our current conversion rates and how do they compare to last month?"
- **User Engagement**: "How is user engagement trending over the past 30 days?"
- **Revenue Analytics**: "What is our revenue breakdown by user segment this quarter?"
- **Retention Analysis**: "What are our user retention rates and what factors influence them?"

### 5. Clarification Flow
When your question needs more context, the system will:
1. Analyze your question with AI
2. Generate clarifying questions
3. Present a second modal with dropdowns, date pickers, or text inputs
4. Combine your answers with the original question
5. Process the enhanced question and update your dashboard

## Usage Examples

### Basic Usage
```
/analyse
[Modal opens]
Type: "What are our conversion rates?"
Click: Analyze
[Question processed and dashboard updated]
```

### With Clarification
```
/analyse
[Modal opens]
Type: "How is retention trending?"
Click: Analyze
[Clarification modal opens]
Select: "Weekly retention"
Select: "Last 30 days"
Click: Run Analysis
[Enhanced question processed]
```

## Technical Details

### Modal Components
- **Plain Text Input**: For free-form questions
- **Action Buttons**: Quick-start presets that populate the input
- **Static Select**: For dropdown options in clarification
- **Date Picker**: For time period selection
- **Multi-line Text**: For additional context

### Processing Flow
1. Slash command triggers modal
2. User input analyzed by OpenAI
3. Clarification generated if needed
4. Final question saved to database
5. User profile weights updated
6. Confirmation sent to user

### Error Handling
- Invalid signatures rejected
- Processing errors send friendly messages
- Failed API calls logged but don't break flow
- Modal validation prevents empty submissions

## Troubleshooting

### Modal Not Opening
- Check bot permissions in channel
- Verify slash command is properly configured
- Ensure interactive endpoints are accessible

### Clarification Not Working
- Verify OpenAI API key is configured
- Check clarification generation logic
- Review modal payload structure

### Questions Not Saving
- Check database connection
- Verify storage interface is working
- Review question schema validation

## Next Steps
After setup is complete:
1. Test the `/analyse` command in your Slack workspace
2. Try different question types to test clarification flow
3. Verify questions appear in your analytics dashboard
4. Monitor logs for any processing issues