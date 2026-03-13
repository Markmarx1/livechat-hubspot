import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook secret via header or body.
  const webhookSecret = process.env.LIVECHAT_WEBHOOK_SECRET;
  if (webhookSecret) {
    const secret = req.headers['x-webhook-secret'] ?? req.headers['x_webhook_secret'] ?? req.body?.secret_key;
    if (secret !== webhookSecret) {
      console.warn('Webhook secret mismatch');
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }
  }

  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!hubspotToken) {
    console.error('Missing HUBSPOT_ACCESS_TOKEN');
    return res.status(503).json({ error: 'Not configured' });
  }

  try {
    const payload = req.body;

    // Log the full payload so we can see what the workflow sends
    console.log('Webhook payload:', JSON.stringify(payload));

    return res.status(200).json({ ok: true, received: payload });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(200).json({ ok: false, error: 'internal error' });
  }
}
