import type { VercelRequest, VercelResponse } from '@vercel/node';

// LiveChat OAuth token introspection. A valid response means the bearer
// token is real and was issued to a specific client_id / organization.
type LiveChatTokenInfo = {
  client_id: string;
  organization_id: string;
  account_id?: string;
  expires_in?: number;
  scope?: string;
};

const INFO_URL = 'https://accounts.livechat.com/v2/info';

// Small in-memory cache so we don't slam /v2/info on every API call from a
// warm function instance. Cold starts get a fresh cache; that's fine.
type CacheEntry = { info: LiveChatTokenInfo; expiresAt: number };
const tokenCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

async function introspectToken(token: string): Promise<LiveChatTokenInfo | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.info;

  const res = await fetch(INFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;

  const info = (await res.json()) as LiveChatTokenInfo;
  console.log('[livechat-auth] verified token — organization_id:', info.organization_id);
  tokenCache.set(token, { info, expiresAt: Date.now() + CACHE_TTL_MS });
  return info;
}

export type LiveChatAuthOk = {
  ok: true;
  token: string;
  organizationId: string;
  accountId?: string;
};

/**
 * Require a valid LiveChat OAuth access_token issued to THIS app.
 *
 * - Reads `Authorization: Bearer <token>`.
 * - Calls LiveChat's /v2/info to verify the token is real.
 * - Confirms the token was issued to LIVECHAT_CLIENT_ID (so a token from
 *   any other LiveChat app doesn't grant access here).
 * - If LIVECHAT_ALLOWED_ORGANIZATION_ID is set, also confirms the agent
 *   belongs to that organization.
 *
 * Returns the auth result on success, or sends a 401/403/500 response and
 * returns null on failure — caller should `return` immediately when null.
 */
export async function requireLiveChatAuth(
  req: VercelRequest,
  res: VercelResponse,
): Promise<LiveChatAuthOk | null> {
  const expectedClientId = process.env.LIVECHAT_CLIENT_ID;
  if (!expectedClientId) {
    res.status(500).json({
      error: 'Server misconfigured',
      message: 'LIVECHAT_CLIENT_ID is not set',
    });
    return null;
  }

  const authHeader = req.headers['authorization'] ?? '';
  const headerStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = headerStr.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    res.status(401).json({ error: 'Missing LiveChat token' });
    return null;
  }

  const info = await introspectToken(token);
  if (!info) {
    res.status(401).json({ error: 'Invalid LiveChat token' });
    return null;
  }

  if (info.client_id !== expectedClientId) {
    res.status(403).json({ error: 'Token issued to a different app' });
    return null;
  }

  const allowedOrg = process.env.LIVECHAT_ALLOWED_ORGANIZATION_ID;
  if (allowedOrg && info.organization_id !== allowedOrg) {
    res.status(403).json({ error: 'Organization not allowed' });
    return null;
  }

  return {
    ok: true,
    token,
    organizationId: info.organization_id,
    accountId: info.account_id,
  };
}
