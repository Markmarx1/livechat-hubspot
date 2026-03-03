import type { VercelRequest, VercelResponse } from '@vercel/node';

const LIVECHAT_API = 'https://api.livechatinc.com/v3.6/agent/action/update_customer';

function safeJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const accountId = process.env.LIVECHAT_ACCOUNT_ID;
    const token = process.env.LIVECHAT_ACCESS_TOKEN;

    if (!accountId || !token) {
      return res.status(503).json({
        error: 'LiveChat not configured',
        message: 'Add LIVECHAT_ACCOUNT_ID and LIVECHAT_ACCESS_TOKEN (Personal Access Token) to Vercel. See CONFIGURE_LIVECHAT.md',
      });
    }

    const body = safeJsonBody(req.body);
    const { customerId, name, email } = body as {
      customerId?: string;
      name?: string;
      email?: string;
    };

    if (!customerId || (!name && !email)) {
      return res.status(400).json({
        error: 'customerId and at least one of name or email is required',
      });
    }

    const basicAuth = Buffer.from(`${accountId}:${token}`).toString('base64');

    const payload: Record<string, string> = { id: customerId };
    if (name) payload.name = name;
    if (email) payload.email = email;

    const updateRes = await fetch(LIVECHAT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(payload),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      if (updateRes.status === 401) {
        return res.status(503).json({
          error: 'LiveChat token invalid',
          message: 'Check LIVECHAT_ACCOUNT_ID and LIVECHAT_ACCESS_TOKEN. Ensure PAT has customers:rw scope.',
        });
      }
      throw new Error(`LiveChat API error: ${updateRes.status} ${errText}`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('LiveChat update_customer error:', err);
    return res.status(500).json({
      error: 'Failed to update customer',
      message: err instanceof Error ? err.message : 'Function invocation failed',
    });
  }
}
