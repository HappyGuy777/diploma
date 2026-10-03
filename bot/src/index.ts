import { config } from './config.js';
import { MattermostClient } from './adapters/mattermost/client.js';
import { SqliteConversationStore } from './core/conversation/sqliteStore.js';

const mm = new MattermostClient(config.mattermostUrl, config.botToken);
const store = new SqliteConversationStore(config.databasePath);

async function main() {
  const me = await mm.getMe();
  console.log(`Logged in as ${me.username} (${me.id})`);

  mm.listen(async ({ post, channelType }) => {
    if (post.user_id === me.id) return; // ignore the bot's own messages (avoids loops)
    if (channelType !== 'D') return; // react to direct messages only
    const text = post.message.trim();
    if (!text) return;

    // The Mattermost adapter decides what a "conversation" is: one per DM channel.
    // The core only sees this opaque id.
    const conversationId = `mattermost:${post.channel_id}`;

    try {
      if (text.toLowerCase() === '!new') {
        store.clear(conversationId);
        await mm.createPost(post.channel_id, 'Started a new conversation.', post.root_id);
        return;
      }

      store.addMessage({ conversationId, role: 'user', content: text });

      // Still the echo "model" for now; a real AI provider replaces this in the next step
      const reply = `Echo: ${text}`;
      store.addMessage({ conversationId, role: 'assistant', content: reply, modelId: 'echo' });

      const count = store.getMessages(conversationId).length;
      await mm.createPost(
        post.channel_id,
        `${reply}\n(messages stored in this conversation: ${count})`,
        post.root_id,
      );
    } catch (err) {
      console.error('Failed to handle message', err);
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
