/**
 * One-time script to register the chat_deactivated webhook with LiveChat.
 *
 * Usage:
 *   npx tsx scripts/register-webhook.ts
 *
 * Requires LIVECHAT_ACCOUNT_ID and LIVECHAT_ACCESS_TOKEN in .env
 * Set WEBHOOK_URL to your deployed Vercel URL (defaults to VITE_API_BASE_URL).
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually to avoid adding dotenv as a dependency
try {
  const envFile = readFileSync(resolve(__dirname, '..', '.env'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found, rely on existing env vars */ }

const CONFIG_API = 'https://api.livechatinc.com/v3.6/configuration/action';

async function main() {
  const accountId = process.env.LIVECHAT_ACCOUNT_ID;
  const token = process.env.LIVECHAT_ACCESS_TOKEN;
  const baseUrl = process.env.WEBHOOK_URL || process.env.VITE_API_BASE_URL;

  if (!accountId || !token) {
    console.error('Missing LIVECHAT_ACCOUNT_ID or LIVECHAT_ACCESS_TOKEN in .env');
    process.exit(1);
  }
  if (!baseUrl) {
    console.error('Missing WEBHOOK_URL or VITE_API_BASE_URL in .env');
    process.exit(1);
  }

  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/livechat/webhook`;
  const basicAuth = Buffer.from(`${accountId}:${token}`).toString('base64');
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${basicAuth}`,
  };

  // First, list existing webhooks to avoid duplicates
  console.log('Checking existing webhooks...');
  const listRes = await fetch(`${CONFIG_API}/list_webhooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  if (listRes.ok) {
    const existing = await listRes.json();
    const webhooks = existing || [];
    const duplicate = webhooks.find(
      (w: { url?: string; action?: string }) =>
        w.url === webhookUrl && w.action === 'chat_deactivated'
    );
    if (duplicate) {
      console.log('Webhook already registered:');
      console.log(JSON.stringify(duplicate, null, 2));
      return;
    }
  }

  // Register the webhook
  console.log(`Registering webhook: ${webhookUrl}`);
  const res = await fetch(`${CONFIG_API}/register_webhook`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      url: webhookUrl,
      action: 'chat_deactivated',
      secret_key: process.env.LIVECHAT_WEBHOOK_SECRET || undefined,
      owner_client_id: '0a418ea7727e9cdf83bede40816c5d95',
    }),
  });

  const data = await res.text();
  if (!res.ok) {
    console.error(`Failed to register webhook (${res.status}):`);
    console.error(data);
    process.exit(1);
  }

  console.log('Webhook registered successfully!');
  console.log(data);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
