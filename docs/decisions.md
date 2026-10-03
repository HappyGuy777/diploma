# Decision log

Format: date, decision, why, alternatives considered.

## Made so far
- Mattermost is the UI, no custom chat system (saves time; focus on memory and model layer).
- Bot is a separate service, not a Mattermost plugin (core stays independent; no Go; no plugin license limits).
- Core (src/core) must not depend on Mattermost or on any AI provider.
- TypeScript on Node.js, strict mode (matches existing JavaScript and React skills).
- Conversations are stored in a provider-neutral message format.

## Decided in M1
- SQLite via Node's built-in node:sqlite (Node v22.22.1 supports it, no extra package). It is experimental, so it is hidden behind the ConversationStore interface; fallback is better-sqlite3.
- One Mattermost DM channel = one conversation (id is "mattermost:<channel_id>"); the core only sees an opaque conversation id. Can be changed later (for example per thread).
- Bot text commands use a "!" prefix (for example !new), because Mattermost intercepts messages starting with "/" as slash commands. Real slash commands can be added later.

## Pending
- First AI provider and model.
