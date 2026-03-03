import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API = 'https://api.hubapi.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const query = (req.method === 'GET' ? req.query.q : req.body?.q) as string | undefined;
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const searchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query.trim(),
        properties: ['firstname', 'lastname', 'email'],
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
      results?: Array<{ properties: { firstname?: string; lastname?: string; email?: string } }>;
    };

    const results = (data.results || []).map((r) => {
      const p = r.properties || {};
      const first = p.firstname || '';
      const last = p.lastname || '';
      const name = [first, last].filter(Boolean).join(' ') || 'Unknown';
      return {
        name,
        email: p.email || '',
      };
    });

    return res.status(200).json({ results });
  } catch (e) {
    console.error('HubSpot search error:', e);
    return res.status(500).json({
      error: 'Search failed',
      message: e instanceof Error ? e.message : 'Unknown error',
    });
  }
}
