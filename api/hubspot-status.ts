import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const connected = !!process.env.HUBSPOT_ACCESS_TOKEN;
  return res.status(200).json({ connected });
}
