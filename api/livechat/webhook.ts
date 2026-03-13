import type { VercelRequest, VercelResponse } from '@vercel/node';

const LIVECHAT_API = 'https://api.livechatinc.com/v3.6/agent/action';
const HUBSPOT_API = 'https://api.hubapi.com';
const APP_CLIENT_ID = '0a418ea7727e9cdf83bede40816c5d95';

interface ChatEvent {
  type: string;
  text?: string;
  author_id?: string;
}

interface ChatThread {
  events?: ChatEvent[];
  created_at?: string;
}

interface ChatUser {
  id: string;
  name?: string;
  email?: string;
  type: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook secret if configured
  const webhookSecret = process.env.LIVECHAT_WEBHOOK_SECRET;
  if (webhookSecret) {
    const headerSecret = req.headers['x-livechat-webhook-secret'] as string | undefined;
    if (headerSecret !== webhookSecret) {
      return res.status(403).json({ error: 'Invalid webhook secret' });
    }
  }

  const accountId = process.env.LIVECHAT_ACCOUNT_ID;
  const token = process.env.LIVECHAT_ACCESS_TOKEN;
  const hubspotToken = process.env.HUBSPOT_ACCESS_TOKEN;

  if (!accountId || !token || !hubspotToken) {
    console.error('Missing required env vars for webhook handler');
    return res.status(503).json({ error: 'Not configured' });
  }

  const basicAuth = Buffer.from(`${accountId}:${token}`).toString('base64');
  const lcHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${basicAuth}`,
  };
  const hsHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${hubspotToken}`,
  };

  try {
    const payload = req.body;
    const action = payload?.action;

    // Only handle chat_deactivated (chat ended)
    if (action !== 'chat_deactivated') {
      return res.status(200).json({ ok: true, skipped: action });
    }

    const chatId = payload?.payload?.chat_id;
    if (!chatId) {
      return res.status(200).json({ ok: true, skipped: 'no chat_id' });
    }

    // 1. Fetch the full chat (transcript + properties + users)
    const chatRes = await fetch(`${LIVECHAT_API}/get_chat`, {
      method: 'POST',
      headers: lcHeaders,
      body: JSON.stringify({ chat_id: chatId }),
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      console.error(`get_chat failed for ${chatId}:`, err);
      return res.status(200).json({ ok: false, error: 'get_chat failed' });
    }

    const chat = await chatRes.json();

    // 2. Find the HubSpot contact ID (from chat properties or by email)
    let hubspotContactId: string | undefined;

    // Check chat properties first
    const appProps = chat.properties?.[APP_CLIENT_ID];
    if (appProps?.contact_id) {
      hubspotContactId = String(appProps.contact_id);
    }

    // Only proceed if a HubSpot contact was explicitly linked during the chat
    if (!hubspotContactId) {
      return res.status(200).json({ ok: true, skipped: 'no hubspot contact linked' });
    }

    // Get customer info
    const users: ChatUser[] = chat.users || [];
    const customer = users.find((u: ChatUser) => u.type === 'customer');
    const customerEmail = customer?.email;
    const customerName = customer?.name || customerEmail || 'Visitor';

    // 3. Build the transcript from chat threads
    const threads: ChatThread[] = chat.threads || chat.thread ? [chat.thread] : [];
    const agentMap = new Map<string, string>();
    for (const u of users) {
      if (u.type === 'agent') {
        agentMap.set(u.id, u.name || u.id);
      }
    }

    const lines: string[] = [];
    const chatDate = threads[0]?.created_at
      ? new Date(threads[0].created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })
      : new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });

    lines.push(`<strong>LiveChat Transcript — ${chatDate}</strong>`);
    lines.push(`<em>Chat ID: ${chatId}</em>`);
    lines.push('<br/>');

    for (const thread of threads) {
      for (const event of thread.events || []) {
        if (event.type !== 'message' || !event.text) continue;

        // Skip internal hubspot_contact markers
        if (event.text.startsWith('[hubspot_contact:')) continue;

        const authorId = event.author_id || '';
        let authorName: string;
        if (authorId === customer?.id) {
          authorName = customerName;
        } else {
          authorName = agentMap.get(authorId) || 'Agent';
        }

        lines.push(`<strong>${authorName}:</strong> ${escapeHtml(event.text)}`);
      }
    }

    if (lines.length <= 3) {
      // No actual messages — skip
      return res.status(200).json({ ok: true, skipped: 'empty transcript' });
    }

    const noteBody = lines.join('<br/>');

    // 4. Create the note in HubSpot
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
    // Always return 200 to avoid LiveChat retrying
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
