import dotenv from 'dotenv';

// Loads variables from bot/.env into process.env (quiet: no startup log line)
dotenv.config({ quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing environment variable: ${name} (check bot/.env)`);
  }
  return value.trim();
}

export const config = {
  // Remove trailing slashes so we can safely append paths
  mattermostUrl: required('MATTERMOST_URL').replace(/\/+$/, ''),
  botToken: required('MATTERMOST_BOT_TOKEN'),
};
