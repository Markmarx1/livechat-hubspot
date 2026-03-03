# Deployment & Testing Guide

Step-by-step next steps for deploying and testing the LiveChat + HubSpot integration.

---

## Current State

| Component | Status |
|-----------|--------|
| Widget UI | ✅ Built (search, contact list, standalone mode) |
| Backend scaffold | ✅ Placeholder endpoints |
| HubSpot OAuth | ❌ Not implemented |
| HubSpot search | ❌ Returns empty |
| LiveChat update_customer | ❌ Returns 501 |
| Settings / config | ❌ Not implemented |

---

## Phase A: Test Locally (Now)

### 1. Run the app locally

```bash
npm install
npm run dev:all
```

- **Widget:** https://localhost:5173 (or 5174 if 5173 is in use)
- **Backend:** http://localhost:3001

### 2. Test standalone mode

Open the widget URL in your browser. You should see:
- "HubSpot Contact Lookup" with "Dev mode" subtitle
- Search box (returns no results yet)
- "Open a chat to update the visitor's name and email" hint

### 3. Configure LiveChat Developer Console

1. Go to [platform.text.com/console](https://platform.text.com/console/)
2. **Create new app** → name it "HubSpot Contact Lookup"
3. Add **Agent App Widgets** building block
4. **Widget placement:** Details (sidebar)
5. **Widget source URL:** `https://localhost:5173` (or your actual port)
6. Add **App Authorization** block (Server-side app) — save Client ID and Client Secret
7. **Scopes:** Add `customers:rw` for update_customer
8. **Private installation** → Install app on your license

### 4. Test inside LiveChat

1. Open LiveChat Agent App
2. Start or open a chat
3. Open the **Details** panel — the widget should appear
4. You’ll see the UI; search and update won’t work until the backend is implemented

---

## Phase B: Implement Backend (Before Production)

### 1. HubSpot setup

1. Create app at [developers.hubspot.com](https://developers.hubspot.com/) → Apps → Create app
2. **Auth** tab:
   - Redirect URL: `http://localhost:3001/auth/hubspot/callback` (dev) or `https://your-domain.com/auth/hubspot/callback` (prod)
   - Scopes: `crm.objects.contacts.read`, `crm.schemas.contacts.read`
3. Copy **Client ID** and **Client Secret**

### 2. Implement backend endpoints

| Endpoint | Implementation |
|----------|----------------|
| `GET /auth/hubspot` | Redirect to HubSpot OAuth |
| `GET /auth/hubspot/callback` | Exchange code for tokens, store per license |
| `POST /api/hubspot/search` | Use stored token, call `POST /crm/v3/objects/contacts/search` |
| `GET /api/hubspot/properties` | Use stored token, call `GET /crm/v3/properties/contacts` |
| `POST /api/livechat/update-customer` | Use LiveChat agent token, call `update_customer` API |

### 3. Token storage

- **HubSpot:** Store `access_token` and `refresh_token` per LiveChat license (e.g. Supabase, Vercel KV)
- **LiveChat:** Use App Authorization (Client ID + Secret) with authorization code grant to get agent tokens

### 4. Wire widget to backend

- Set `VITE_API_BASE_URL` to your backend URL (e.g. `http://localhost:3001` for dev)
- Widget already calls `/api/hubspot/search` and `/api/livechat/update-customer`

---

## Phase C: Deploy to Production

### Option 1: Vercel (recommended)

1. **Connect repo:** [vercel.com](https://vercel.com) → Import `Markmarx1/livechat-hubspot`
2. **Build settings:**
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
3. **Backend:** Add API routes in `/api` (Vercel serverless) or deploy backend separately (e.g. Railway, Render)
4. **Environment variables:**
   - `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`
   - `HUBSPOT_REDIRECT_URI` = `https://your-app.vercel.app/auth/hubspot/callback`
   - `LIVECHAT_CLIENT_ID`, `LIVECHAT_CLIENT_SECRET` (from App Authorization)
   - `VITE_API_BASE_URL` = `https://your-app.vercel.app` (for widget API calls)

### Option 2: Netlify

1. Connect repo, build command: `npm run build`, publish directory: `dist`
2. Deploy backend separately (Netlify Functions or external service)

### Option 3: Full-stack (Railway, Render)

1. Deploy Node.js app with both static (widget) and API
2. Serve `dist/` for `/` and API routes for `/api/*`

### Post-deploy checklist

- [ ] Widget URL is HTTPS
- [ ] HubSpot redirect URI matches production URL
- [ ] LiveChat Widget source URL points to production
- [ ] CORS allows LiveChat domains (`*.livechatinc.com`, `*.text.com`)
- [ ] No `X-Frame-Options: DENY` (widget must load in iframe)

---

## Phase D: End-to-End Testing

1. **Connect HubSpot:** Open app Settings (or a connect flow), complete HubSpot OAuth
2. **Open a chat** in LiveChat with a test visitor
3. **Search** for a contact by name in the widget
4. **Select** a contact → visitor name/email in LiveChat should update
5. **Verify** in LiveChat Customer Details that name and email changed

---

## Quick Reference

| URL | Purpose |
|-----|---------|
| [Text Platform Console](https://platform.text.com/console/) | Create/manage LiveChat app |
| [HubSpot Developer](https://developers.hubspot.com/) | Create HubSpot app, OAuth |
| [LiveChat update_customer](https://platform.text.com/docs/messaging/agent-chat-api#update-customer) | API docs |
