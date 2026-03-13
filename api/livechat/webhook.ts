import type { VercelRequest, VercelResponse } from '@vercel/node';

const HUBSPOT_API = 'https://api.hubapi.com';

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

  const hsHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${hubspotToken}`,
  };

  try {
    const payload = req.body;
    const chatId = payload?.chat_id;

    // The workflow sends the full chat data in payload.thread (from the LiveChat API step)
    const chatData = payload?.thread;
    if (!chatData) {
      console.log('No chat data in payload');
      return res.status(200).json({ ok: true, skipped: 'no chat data' });
    }

    // Find the HubSpot contact ID from the customer's session_fields
    const customers = chatData.Customers || {};
    let hubspotContactId: string | undefined;
    let customerName = 'Visitor';
    let customerId: string | undefined;

    for (const [id, customer] of Object.entries(customers)) {
      const c = customer as { name?: string; email?: string; session_fields?: Record<string, string>[] };
      const sessionFields = c.session_fields || [];
      for (const field of sessionFields) {
        if (field.hubspot_contact_id) {
          hubspotContactId = String(field.hubspot_contact_id);
        }
      }
      customerName = c.name || c.email || 'Visitor';
      customerId = id;
    }

    if (!hubspotContactId) {
      console.log('No hubspot_contact_id in session_fields — skipping');
      return res.status(200).json({ ok: true, skipped: 'no hubspot contact linked' });
    }

    // Build agent name lookup
    const agents = chatData.Agents || {};
    const agentMap = new Map<string, string>();
    for (const [id, agent] of Object.entries(agents)) {
      const a = agent as { name?: string };
      agentMap.set(id, a.name || id);
    }

    // Build the transcript from thread events
    const thread = chatData.thread;
    const events = thread?.events || [];
    const chatDate = thread?.created_at
      ? new Date(thread.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
      : new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    const lines: string[] = [];
    lines.push(`<strong>LiveChat Transcript — ${chatDate}</strong>`);
    if (chatId) lines.push(`<em>Chat ID: ${chatId}</em>`);
    lines.push('<br/>');

    for (const event of events) {
      // Only include visible messages (skip system messages, rich messages without text)
      if (event.type !== 'message' || !event.text) continue;
      // Skip agent-only system notifications
      if (event.visibility === 'agents' && event.system_message_type) continue;
      // Skip internal hubspot_contact markers
      if (event.text.startsWith('[hubspot_contact:')) continue;

      const authorId = event.author_id || '';
      let authorName: string;
      if (authorId === customerId) {
        authorName = customerName;
      } else {
        authorName = agentMap.get(authorId) || 'Agent';
      }

      lines.push(`<strong>${escapeHtml(authorName)}:</strong> ${escapeHtml(event.text)}`);
    }

    if (lines.length <= 3) {
      console.log('No messages in transcript — skipping');
      return res.status(200).json({ ok: true, skipped: 'empty transcript' });
    }

    const noteBody = lines.join('<br/>');

    // Create the note in HubSpot
    const noteRes = await fetch(`${HUBSPOT_API}/crm/v3/objects/notes`, {
      method: 'POST',
      headers: hsHeaders,
      body: JSON.stringify({
        properties: {
          hs_timestamp: new Date().toISOString(),
          hs_note_body: noteBody,
        },
        associations: [{
          to: { id: hubspotContactId },
          types: [{
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: 202, // note-to-contact
          }],
        }],
      }),
    });

    if (!noteRes.ok) {
      const err = await noteRes.text();
      console.error(`HubSpot create note failed for contact ${hubspotContactId}:`, err);
      return res.status(200).json({ ok: false, error: 'create note failed' });
    }

    const note = await noteRes.json();
    console.log(`Transcript saved as HubSpot note ${note.id} for contact ${hubspotContactId} (chat ${chatId})`);
    return res.status(200).json({ ok: true, noteId: note.id });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(200).json({ ok: false, error: 'internal error' });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
