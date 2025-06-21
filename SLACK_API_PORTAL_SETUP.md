# Slack API Portal Configuration for Interactive Modals

## Current Issue
The `/analyse` command returns text instead of opening an interactive modal. This requires specific configuration in the Slack API portal.

## Required Configuration Steps

### 1. Update App Manifest
1. Go to https://api.slack.com/apps
2. Select your "Analytics Assistant" app
3. Go to **App Manifest** in the left sidebar
4. Replace the entire manifest with the updated one from `slack-app-manifest.yaml`
5. Click **Save Changes**

### 2. Configure Slash Commands
1. Go to **Slash Commands** in the left sidebar
2. Delete any existing `/ask` or `/analytics` commands
3. Click **Create New Command**
4. Configure:
   - **Command**: `/analyse`
   - **Request URL**: `https://your-replit-domain.replit.app/slack/commands`
   - **Short Description**: `Open interactive analytics question wizard`
   - **Usage Hint**: `Opens a modal with guided assistance`
5. Click **Save**

### 3. Enable Interactivity
1. Go to **Interactivity & Shortcuts** in the left sidebar
2. Turn on **Interactivity**
3. Set **Request URL**: `https://your-replit-domain.replit.app/slack/interactions`
4. Click **Save Changes**

### 4. Update OAuth Scopes
Ensure these scopes are enabled in **OAuth & Permissions**:
- `chat:write`
- `commands`
- `users:read`
- `channels:read`
- `groups:read`
- `im:write`

### 5. Reinstall the App
1. Go to **Install App** in the left sidebar
2. Click **Reinstall to Workspace**
3. Authorize the new permissions

## Verification Steps

### Test the Configuration
1. In your Slack workspace, type `/analyse`
2. You should see a modal open instead of a text response
3. The modal should contain:
   - Text input for questions
   - Quick-start buttons
   - Proper submit/cancel buttons

### If Still Getting Text Response
The text fallback indicates one of these issues:
- Interactivity not enabled in app settings
- Wrong request URL in interactivity settings
- App not reinstalled after manifest changes
- Bot token doesn't have required permissions

## Troubleshooting Common Issues

### "Command not found"
- Slash command not properly configured
- Wrong request URL
- App not installed in workspace

### "Invalid trigger_id" in logs
- Normal in development testing
- In production, this indicates timing issues (trigger_id expires in 3 seconds)

### Modal doesn't open
- Interactivity settings not configured
- Request URL incorrect or unreachable
- Missing OAuth scopes

## Production Deployment Checklist

- [ ] App manifest updated with correct endpoints
- [ ] Slash command `/analyse` configured
- [ ] Interactivity enabled with correct URL
- [ ] OAuth scopes include required permissions
- [ ] App reinstalled in workspace
- [ ] Bot invited to test channel
- [ ] Command tested in real Slack workspace

## Your Current Endpoints
Based on your setup:
- **Commands**: `https://audio-insight-dashboard-AviralChandra1.replit.app/slack/commands`
- **Interactions**: `https://audio-insight-dashboard-AviralChandra1.replit.app/slack/interactions`
- **Events**: `https://audio-insight-dashboard-AviralChandra1.replit.app/api/slack/events`

Make sure these URLs are exactly as shown in your Slack app configuration.