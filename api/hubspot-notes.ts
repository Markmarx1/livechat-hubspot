import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API = 'https://api.hubapi.com';

function safeJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  if (typeof body === 'string') {
    try { return JSON.parse(body) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

export interface HubSpotNote {
  id: string;
  body: string;
  timestamp: string;
  pinned?: boolean;
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
        message: 'Add HUBSPOT_ACCESS_TOKEN to your Vercel environment variables.',
      });
    }

    const body = safeJsonBody(req.body);
    const contactId = (req.method === 'GET' ? req.query.contactId : body.contactId) as string | undefined;
    const pinnedNoteId = (req.method === 'GET' ? req.query.pinnedNoteId : body.pinnedNoteId) as string | undefined;

    if (!contactId || typeof contactId !== 'string' || !contactId.trim()) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const assocRes = await fetch(
      `${HUBSPOT_API}/crm/v4/associations/contacts/notes/batch/read`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: [{ id: contactId.trim() }] }),
      }
    );

    if (!assocRes.ok) {
      const err = await assocRes.text();
      if (assocRes.status === 401) {
        return res.status(503).json({
          error: 'HubSpot token invalid',
          message: 'Check your HUBSPOT_ACCESS_TOKEN.',
        });
      }
      throw new Error(`HubSpot associations error: ${assocRes.status} ${err}`);
    }

    const assocData = (await assocRes.json()) as {
      results?: Array<{
        from?: { id?: string };
        to?: Array<{ toObjectId?: string; id?: string }>;
      }>;
    };

    const noteIds: string[] = [];
    const assocResults = assocData.results || [];
    for (const r of assocResults) {
      if (r.from?.id === contactId.trim()) {
        for (const t of r.to || []) {
          const id = t.toObjectId ?? t.id;
          if (id) noteIds.push(id);
        }
        break;
      }
    }

    const pinnedId = pinnedNoteId?.trim() || undefined;
    if (pinnedId && !noteIds.includes(pinnedId)) {
      noteIds.push(pinnedId);
    }

    if (noteIds.length === 0) {
      return res.status(200).json({ pinned: null, recent: [] });
    }

    const batchRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes/batch/read`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        properties: ['hs_note_body', 'hs_timestamp'],
        inputs: noteIds.map((id) => ({ id })),
      }),
    });

    if (!batchRes.ok) {
      const err = await batchRes.text();
      throw new Error(`HubSpot notes batch error: ${batchRes.status} ${err}`);
    }

    const batchData = (await batchRes.json()) as {
      results?: Array<{
        id: string;
        properties: { hs_note_body?: string; hs_timestamp?: string };
      }>;
    };

    const allNotes: HubSpotNote[] = (batchData.results || []).map((n) => ({
      id: n.id,
      body: (n.properties?.hs_note_body as string) || '',
      timestamp: (n.properties?.hs_timestamp as string) || '',
      pinned: n.id === pinnedId,
    }));

    const sorted = allNotes
      .filter((n) => n.body.trim())
      .sort((a, b) => {
        const ta = new Date(a.timestamp).getTime();
        const tb = new Date(b.timestamp).getTime();
        return tb - ta;
      });

    const pinned = pinnedId ? sorted.find((n) => n.id === pinnedId) ?? null : null;
    const recent = sorted
      .filter((n) => n.id !== pinnedId)
      .slice(0, 2)
      .map((n) => ({ ...n, pinned: false }));

    return res.status(200).json({ pinned, recent });
  } catch (err) {
    console.error('HubSpot notes error:', err);
    return res.status(500).json({
      error: 'Failed to fetch notes',
      message: err instanceof Error ? err.message : 'Function invocation failed',
    });
  }
}
