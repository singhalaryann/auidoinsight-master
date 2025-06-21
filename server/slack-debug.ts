import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function debugSlackIntegration(): Promise<any> {
  const debug: any = {
    botToken: !!process.env.SLACK_BOT_TOKEN,
    signingSecret: !!process.env.SLACK_SIGNING_SECRET,
    channelId: process.env.SLACK_CHANNEL_ID,
    botInfo: null,
    channelInfo: null,
    permissions: null,
    errors: []
  };

  try {
    // Test bot authentication
    const authTest = await slack.auth.test();
    debug.botInfo = {
      botId: authTest.bot_id,
      userId: authTest.user_id,
      teamId: authTest.team_id,
      teamName: authTest.team
    };
  } catch (error: any) {
    debug.errors.push(`Auth test failed: ${error.message}`);
  }

  try {
    // Test channel access
    if (process.env.SLACK_CHANNEL_ID) {
      const channelInfo = await slack.conversations.info({
        channel: process.env.SLACK_CHANNEL_ID
      });
      debug.channelInfo = {
        id: channelInfo.channel?.id,
        name: channelInfo.channel?.name,
        isMember: channelInfo.channel?.is_member
      };
    }
  } catch (error: any) {
    debug.errors.push(`Channel access failed: ${error.message}`);
  }

  try {
    // List channels the bot has access to
    const channels = await slack.conversations.list({
      types: 'public_channel,private_channel',
      limit: 10
    });
    debug.permissions = {
      accessibleChannels: channels.channels?.map(c => ({
        id: c.id,
        name: c.name,
        isMember: c.is_member
      }))
    };
  } catch (error: any) {
    debug.errors.push(`Permissions check failed: ${error.message}`);
  }

  return debug;
}

export async function testSlackMessage(channelId: string, message: string): Promise<any> {
  try {
    const result = await slack.chat.postMessage({
      channel: channelId,
      text: message
    });
    return { success: true, timestamp: result.ts };
  } catch (error: any) {
    return { success: false, error: error.message, code: error.code };
  }
}