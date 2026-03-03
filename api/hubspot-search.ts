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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      return res.status(503).json({
        error: 'HubSpot not connected',
        message: 'Add HUBSPOT_ACCESS_TOKEN to your Vercel environment variables. See CONFIGURE_HUBSPOT.md',
      });
    }

    const body = safeJsonBody(req.body);
    const query = (req.method === 'GET' ? req.query.q : body.q) as string | undefined;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const properties = [
      'firstname',
      'lastname',
      'email',
      'customer_first_name',
      'customer_last_name',
      'addepar_contact_link',
      'date_of_birth',
      'security_question_1',
      'security_answer_1',
      'security_question_2',
      'security_answer_2',
      'total_assets',
      'future_opportunity',
      'future_opportunity_notes',
    ];

    const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query.trim(),
        properties,
        limit: 20,
      }),
    });

    if (!searchRes.ok) {
      const err = await searchRes.text();
      if (searchRes.status === 401) {
        return res.status(503).json({
          error: 'HubSpot token invalid',
          message: 'Check your HUBSPOT_ACCESS_TOKEN in Vercel.',
        });
      }
      throw new Error(`HubSpot API error: ${searchRes.status} ${err}`);
    }

    const data = (await searchRes.json()) as {
      results?: Array<{ properties: Record<string, string | number | undefined> }>;
    };

    const results = (data.results || []).map((r) => {
      const p = r.properties || {};
      const first = (p.customer_first_name || p.firstname || '') as string;
      const last = (p.customer_last_name || p.lastname || '') as string;
      const name = [first, last].filter(Boolean).join(' ') || 'Unknown';
      return {
        name,
        email: (p.email as string) || '',
        properties: p,
      };
    });

    return res.status(200).json({ results });
  } catch (err) {
    console.error('HubSpot search error:', err);
    return res.status(500).json({
      error: 'Search failed',
      message: err instanceof Error ? err.message : 'Function invocation failed',
    });
  }
}
