/**
 * Backend API for LiveChat HubSpot integration
 *
 * - HubSpot OAuth flow
 * - /api/hubspot/search - search contacts by name
 * - /api/hubspot/properties - list contact properties
 * - /api/config - get/set configured properties per license
 */
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_, res) => {
  res.json({ status: 'ok' });
});

// Placeholder - implement HubSpot OAuth and search
app.get('/api/hubspot/search', (_req, res) => {
  res.json({ results: [] });
});

app.get('/api/hubspot/properties', (_req, res) => {
  res.json({ properties: [] });
});

// Update visitor name/email in LiveChat via Agent Chat API update_customer
// Requires: customers:rw scope, agent access token
app.post('/api/livechat/update-customer', (req, res) => {
  const { customerId, name, email } = req.body ?? {};
  if (!customerId || (!name && !email)) {
    return res.status(400).json({ error: 'customerId and at least one of name/email required' });
  }
  // TODO: Get agent access token (from App Authorization), then:
  // POST https://api.livechatinc.com/v3.6/agent/action/update_customer
  // Body: { id: customerId, name, email }
  res.status(501).json({ error: 'Not implemented: add LiveChat agent token and call update_customer API' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
