import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireLiveChatAuth } from './_lib/livechat-auth.js';

const HUBSPOT_API = 'https://api.hubapi.com';
const LIVECHAT_GET_CUSTOMER = 'https://api.livechatinc.com/v3.6/agent/action/get_customer';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;
const GA_KEYS = ['ga_client_id', 'ga_session_id'] as const;
const TRACKING_KEYS = [...UTM_KEYS, ...GA_KEYS] as const;
type TrackingKey = (typeof TRACKING_KEYS)[number];

function safeJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

// Pulls utm_* and ga_* values out of a LiveChat customer's session_fields array.
// session_fields is shaped like [{ "utm_source": "google" }, { "ga_client_id": "..." }, ...]
async function readTrackingFromLiveChat(customerId: string): Promise<Partial<Record<TrackingKey, string>>> {
  const accountId = process.env.LIVECHAT_ACCOUNT_ID;
  const token = process.env.LIVECHAT_ACCESS_TOKEN;
  if (!accountId || !token) return {};

  const basicAuth = Buffer.from(`${accountId}:${token}`).toString('base64');
  try {
    const res = await fetch(LIVECHAT_GET_CUSTOMER, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({ id: customerId }),
    });
    if (!res.ok) return {};
    const data = (await res.json()) as { session_fields?: Record<string, string>[] };
    const tracking: Partial<Record<TrackingKey, string>> = {};
    for (const field of data.session_fields || []) {
      for (const key of TRACKING_KEYS) {
        const val = field[key];
        if (typeof val === 'string' && val.trim() && !tracking[key]) {
          tracking[key] = val.trim();
        }
      }
    }
    return tracking;
  } catch {
    return {};
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const auth = await requireLiveChatAuth(req, res);
    if (!auth) return;

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      return res.status(503).json({
        error: 'HubSpot not connected',
        message: 'Add HUBSPOT_ACCESS_TOKEN to your Vercel environment variables.',
      });
    }

    const body = safeJsonBody(req.body);
    const { firstName, lastName, email, bankAffiliate, customerId } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      bankAffiliate?: string;
      customerId?: string;
    };

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'firstName, lastName, and email are required' });
    }

    const properties: Record<string, string> = {
      firstname: firstName.trim(),
      lastname: lastName.trim(),
      email: email.trim(),
    };

    if (bankAffiliate?.trim()) {
      properties.bank_affiliate = bankAffiliate.trim();
    }

    if (customerId?.trim()) {
      const tracking = await readTrackingFromLiveChat(customerId.trim());
      for (const [key, val] of Object.entries(tracking)) {
        if (val) properties[key] = val;
      }
    }

    const createRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ properties }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      if (createRes.status === 401) {
        return res.status(503).json({
          error: 'HubSpot token invalid',
          message: 'Check your HUBSPOT_ACCESS_TOKEN.',
        });
      }
      if (createRes.status === 409) {
        return res.status(409).json({
          error: 'Contact already exists',
          message: 'A contact with this email already exists in HubSpot.',
        });
      }
      throw new Error(`HubSpot API error: ${createRes.status} ${err}`);
    }

    const data = (await createRes.json()) as {
      id: string;
      properties: Record<string, string | number | undefined>;
    };

    const p = data.properties || {};
    const name = [p.firstname || '', p.lastname || ''].filter(Boolean).join(' ') || 'Unknown';

    return res.status(201).json({
      id: data.id,
      name,
      email: (p.email as string) || '',
      properties: p,
    });
  } catch (err) {
    console.error('HubSpot create contact error:', err);
    return res.status(500).json({
      error: 'Failed to create contact',
      message: err instanceof Error ? err.message : 'Function invocation failed',
    });
  }
}
