import WebSocket from 'ws';

// The parts of a Mattermost post that we use
export type Post = {
  id: string;
  user_id: string;
  channel_id: string;
  root_id: string;
  message: string;
};

export type IncomingMessage = {
  post: Post;
  channelType: string; // 'D' = direct message, 'O' = public channel, 'P' = private channel
};

export class MattermostClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  // Small helper for REST calls: adds the bot token and checks for errors
  private async api<T>(path: string, init: { method?: string; body?: string } = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      method: init.method ?? 'GET',
      ...(init.body !== undefined ? { body: init.body } : {}),
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      throw new Error(`Mattermost API ${res.status} on ${path}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  // Who am I? Used to learn the bot's own user id
  async getMe(): Promise<{ id: string; username: string }> {
    return this.api('/users/me');
  }

  // Post a message into a channel (or into a thread if rootId is set)
  async createPost(channelId: string, message: string, rootId = ''): Promise<void> {
    await this.api('/posts', {
      method: 'POST',
      body: JSON.stringify({ channel_id: channelId, message, root_id: rootId }),
    });
  }

  // Listen to new posts through the WebSocket and reconnect if the connection drops
  listen(onMessage: (msg: IncomingMessage) => void): void {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/v4/websocket';

    const connect = () => {
      const ws = new WebSocket(wsUrl);

      ws.on('open', () => {
        // Mattermost expects an authentication message right after connecting
        ws.send(
          JSON.stringify({
            seq: 1,
            action: 'authentication_challenge',
            data: { token: this.token },
          }),
        );
        console.log('WebSocket connected');
      });

      ws.on('message', (raw) => {
        let event: any;
        try {
          event = JSON.parse(raw.toString());
        } catch {
          return; // ignore anything that is not JSON
        }
        if (event.event !== 'posted') return; // we only care about new posts

        try {
          // For 'posted' events the post itself arrives as a JSON string inside data.post
          const post = JSON.parse(event.data.post) as Post;
          onMessage({ post, channelType: event.data.channel_type });
        } catch (err) {
          console.error('Failed to handle posted event', err);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket closed, reconnecting in 3s');
        setTimeout(connect, 3000);
      });

      ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
      });
    };

    connect();
  }
}
