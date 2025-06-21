# Slack Analytics Assistant Setup Guide

## 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App"
3. Choose "From an app manifest"
4. Select your workspace
5. Paste the contents of `slack-app-manifest.yaml`
6. Review and create the app

## 2. Configure Request URLs

After deploying your Replit app, update these URLs in your Slack app settings:

### Event Subscriptions
- **Request URL**: `https://your-app-name.replit.app/api/slack/events`
- **Challenge**: Will be automatically verified by the endpoint

### Slash Commands
For each command (/ask, /analytics, /dashboard):
- **Request URL**: `https://your-app-name.replit.app/api/slack/commands`

### Interactivity & Shortcuts
- **Request URL**: `https://your-app-name.replit.app/api/slack/interactive`

## 3. Get Required Tokens

### Bot User OAuth Token
1. Go to "OAuth & Permissions" in your Slack app
2. Click "Install to Workspace"
3. Copy the "Bot User OAuth Token" (starts with `xoxb-`)
4. Add as `SLACK_BOT_TOKEN` environment variable

### Signing Secret
1. Go to "Basic Information" in your Slack app
2. Copy the "Signing Secret"
3. Add as `SLACK_SIGNING_SECRET` environment variable

### Channel ID (Optional)
1. Go to your target Slack channel
2. Right-click channel name → "Copy link"
3. Extract channel ID from URL (starts with `C`)
4. Add as `SLACK_CHANNEL_ID` environment variable

## 4. Environment Variables Setup

Add these to your Replit environment:

```bash
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C1234567890  # Optional
OPENAI_API_KEY=your-openai-key
```

## 5. Test the Integration

### Test Slash Commands
```
/ask What's our user retention this week?
/analytics How is engagement performing?
/dashboard Show me monetization trends
```

### Test Bot Mentions
```
@Analytics Assistant What's driving churn this month?
```

### Test Clarification Flow
```
@Analytics Assistant How are players doing?
```
The bot should ask clarifying questions, then process your detailed responses.

## 6. Features Available

### Direct Questions
- Clear analytics questions get processed immediately
- AI classifies intent and updates dashboard
- Results saved to database with pillar weight updates

### Clarification Flow
- Ambiguous questions trigger clarifying questions
- Users provide detailed answers
- Enhanced questions processed and saved

### Multi-Step Conversations
- Bot remembers context for follow-up questions
- Handles clarification responses automatically
- Seamless transition from questions to answers

## 7. Troubleshooting

### "Sorry, I couldn't process that request"
- Check environment variables are set
- Verify Request URLs in Slack app settings
- Check app logs for specific errors

### Bot not responding to mentions
- Ensure bot is added to the channel
- Check Event Subscriptions are enabled
- Verify bot has required permissions

### Slash commands not working
- Confirm Request URL is correct
- Check if command is properly registered
- Verify bot token has `commands` scope

## 8. Permissions Required

The bot needs these scopes (already included in manifest):
- `app_mentions:read` - Respond to @mentions
- `chat:write` - Send messages
- `commands` - Handle slash commands
- `channels:history` - Read channel messages
- `im:history` - Read direct messages
- `users:read` - Get user information

## 9. Security Notes

- All webhooks are verified using Slack signing secret
- Bot tokens are securely stored in environment variables
- No sensitive data is logged or exposed
- All API calls use HTTPS encryption

## 10. Support

If you encounter issues:
1. Check the app logs in Replit console
2. Verify all environment variables are set
3. Test endpoints manually using curl
4. Review Slack app event logs in API dashboard