import { config } from './config.js';
import { MattermostClient } from './adapters/mattermost/client.js';

const mm = new MattermostClient(config.mattermostUrl, config.botToken);

async function main() {
  const me = await mm.getMe();
  console.log(`Logged in as ${me.username} (${me.id})`);

  mm.listen(async ({ post, channelType }) => {
    if (post.user_id === me.id) return; // ignore the bot's own messages (avoids loops)
    if (channelType !== 'D') return; // M0: react to direct messages only
    if (!post.message.trim()) return; // ignore empty messages

    try {
      // Echo: reply with the same text, staying in the same thread if there is one
      await mm.createPost(post.channel_id, `Echo: ${post.message}`, post.root_id);
    } catch (err) {
      console.error('Failed to reply', err);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
