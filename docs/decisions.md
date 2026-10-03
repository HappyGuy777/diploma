# Decision log

Format: date, decision, why, alternatives considered.

## Made so far
- Mattermost is the UI, no custom chat system (saves time; focus on memory and model layer).
- Bot is a separate service, not a Mattermost plugin (core stays independent; no Go; no plugin license limits).
- Core (src/core) must not depend on Mattermost or on any AI provider.
- TypeScript on Node.js, strict mode (matches existing JavaScript and React skills).
- Conversations are stored in a provider-neutral message format.

## Pending
- SQLite library (node:sqlite vs better-sqlite3).
- How a Mattermost conversation maps to our conversation (per DM channel vs per thread).
- First AI provider and model.
