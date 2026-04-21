import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API = 'https://api.hubapi.com';

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

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      return res.status(503).json({
        error: 'HubSpot not connected',
        message: 'Add HUBSPOT_ACCESS_TOKEN to your Vercel environment variables.',
      });
    }

    const body = safeJsonBody(req.body);
    const { firstName, lastName, email, bankAffiliate } = body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      bankAffiliate?: string;
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
