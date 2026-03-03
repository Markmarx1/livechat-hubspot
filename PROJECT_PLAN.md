# LiveChat + HubSpot Integration — Project Plan

A private LiveChat app that lets agents look up HubSpot contacts by name and **update the visitor's name and email** in LiveChat as customer properties. **Read-only** HubSpot access with configurable contact properties.

---

## 1. Overview

### 1.1 Goals

| Goal | Description |
|------|-------------|
| **HubSpot connection** | OAuth 2.0 link to HubSpot (read-only) |
| **Contact search** | Search by name → list of contacts with name and email |
| **Update customer properties** | On selection, set the visitor's **name** and **email** in LiveChat (customer properties) via `update_customer` API |
| **Configurable properties** | Admin can choose which HubSpot contact properties to show |
| **Read-only** | No HubSpot write operations |

### 1.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LiveChat Agent App                             │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  HubSpot Contact Lookup Widget (Details)                     │ │
│  │  - Search input                                              │ │
│  │  - Contact list (name, email + configurable properties)      │ │
│  │  - On select → POST /api/livechat/update-customer            │ │
│  │    (updates visitor name & email in LiveChat)                │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                                    │
         │ OAuth / API                         │ HTTPS
         ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│  Backend (Node.js)   │            │  HubSpot API         │
│  - HubSpot OAuth     │◄──────────►│  - Search contacts  │
│  - Token storage     │            │  - List properties   │
│  - Proxy for API     │            │  (read-only scopes)  │
└─────────────────────┘            └─────────────────────┘
```

---

## 2. Technical Stack

| Component | Technology |
|-----------|------------|
| **Widget (frontend)** | React + TypeScript, `@livechat/agent-app-sdk` |
| **Backend** | Node.js (Express or Fastify) |
| **HubSpot** | OAuth 2.0, REST API (read-only scopes) |
| **Hosting** | See Section 6 |

---

## 3. Implementation Phases

### Phase 1: LiveChat App Setup

1. **Developer Console**
   - Sign in at [platform.text.com/console](https://platform.text.com/console/)
   - Create new app → name it (e.g. "HubSpot Contact Lookup")
   - Add **Agent App Widgets** building block
   - Choose **Details** or **Message Box** placement (Details recommended for sidebar)
   - Set Widget source URL (placeholder until deployed)

2. **Scopes**
   - **`customers:rw`** — required for `update_customer` (set visitor name/email)
   - Add **App Authorization** block (Server-side app) for backend to call Agent Chat API

3. **Private installation**
   - Use **Private installation** tab to install on your license
   - No marketplace publish needed for private app

### Phase 2: HubSpot Integration

1. **HubSpot Developer App**
   - Create app at [developers.hubspot.com](https://developers.hubspot.com/)
   - OAuth 2.0 redirect URL: `https://your-backend.com/auth/hubspot/callback`
   - **Read-only scopes:**
     - `crm.objects.contacts.read` — search and read contacts
     - `crm.schemas.contacts.read` — list contact properties

2. **Backend OAuth flow**
   - `/auth/hubspot` — redirect to HubSpot OAuth
   - `/auth/hubspot/callback` — exchange code for tokens, store per LiveChat license
   - Store `access_token` and `refresh_token` (e.g. DB or encrypted storage)

3. **HubSpot API usage**
   - **Search contacts:** `POST /crm/v3/objects/contacts/search`
     - Filter by `firstname`, `lastname`, or `email` (name search)
     - Properties: configurable list (default: `firstname`, `lastname`, `email`)
   - **List properties:** `GET /crm/v3/properties/contacts`
     - Used for Settings widget to let admins pick which properties to show

### Phase 3: Widget Development

1. **Widget structure**
   - Search input (debounced)
   - Loading state
   - Contact list (name, email + configured properties)
   - On select → call backend `POST /api/livechat/update-customer` with `{ customerId, name, email }`
   - Backend calls LiveChat Agent Chat API `update_customer` to set visitor properties

2. **Agent App SDK**
   - Use `createDetailsWidget()`
   - `widget.getCustomerProfile()` — returns current visitor's `id` (required for update_customer)
   - If no chat open / no profile, show "Open a chat to update customer"
   - **LiveChat `update_customer` API:** `POST https://api.livechatinc.com/v3.6/agent/action/update_customer` with `{ id, name, email }` — updates the visitor's name and email in LiveChat (Customer Details, etc.)

3. **Settings widget**
   - Add **Settings** placement for configuration
   - Fetch HubSpot properties via backend
   - Multi-select for which properties to display in search results
   - Store config per LiveChat license (e.g. in backend DB or LiveChat properties)

### Phase 4: Backend API

| Endpoint | Purpose |
|----------|---------|
| `GET /api/hubspot/properties` | List contact properties (for config) |
| `POST /api/hubspot/search` | Search contacts by name (requires auth) |
| `POST /api/livechat/update-customer` | Update visitor name/email via LiveChat `update_customer` API |
| `GET /api/config` | Get configured properties for current license |
| `PUT /api/config` | Save configured properties |

Backend must:
- Resolve LiveChat license/installation from request (e.g. via token or installation ID)
- Use stored HubSpot tokens for that license
- Use stored LiveChat agent access token (from App Authorization) to call `update_customer`
- Refresh tokens when expired

---

## 4. Security & Permissions

### HubSpot (Read-Only)

- Use only: `crm.objects.contacts.read`, `crm.schemas.contacts.read`
- No write scopes (`crm.objects.contacts.write`, etc.)
- Validate all backend calls use read-only endpoints

### LiveChat

- Private app: only your license can install
- Widget runs in iframe; backend handles sensitive tokens
- Never expose HubSpot or LiveChat tokens to the widget
- `update_customer` requires `customers:rw` scope

---

## 5. Hosting & Deployment Plan

### 5.1 Hosting Options

| Option | Pros | Cons |
|--------|------|------|
| **Vercel** | Simple, free tier, auto HTTPS | Serverless; need separate OAuth/DB handling |
| **Netlify** | Easy static + functions, HTTPS | Similar to Vercel |
| **Railway / Render** | Full Node app, DB support | Paid for production |
| **AWS / GCP** | Full control | More setup |
| **Self-hosted** | Full control | Must provide HTTPS, maintenance |

### 5.2 Recommended: Vercel + Supabase (or similar)

1. **Frontend (widget)**
   - Deploy React app to Vercel
   - URL: `https://livechat-hubspot-widget.vercel.app`
   - Set as Widget source URL in Developer Console

2. **Backend (API + OAuth)**
   - Deploy Node.js API to Vercel Serverless Functions
   - Same project or separate: `/api/*` routes
   - Store HubSpot tokens in Supabase (or Vercel KV, etc.)

3. **Environment variables**
   - `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`
   - `LIVECHAT_*` if using LiveChat auth
   - `DATABASE_URL` or `SUPABASE_URL` for token storage

### 5.3 Deployment Checklist

- [ ] Widget served over **HTTPS**
- [ ] Backend OAuth callback URL matches HubSpot app config
- [ ] CORS allows LiveChat domain (`*.livechatinc.com`, `*.text.com`)
- [ ] `X-Frame-Options` and CSP allow embedding in LiveChat iframe
- [ ] Environment variables set in hosting platform

### 5.4 Publishing as Private App

1. **Developer Console**
   - Complete app configuration (icon, description)
   - Add all building blocks (Widget, optional App Authorization)
   - Set Widget source URL to production URL

2. **Private installation**
   - Go to **Private installation** tab
   - Click **Install app**
   - App appears in your LiveChat license only

3. **No marketplace**
   - Private apps stay on your license
   - No review process
   - Can add to other licenses manually if needed (e.g. via direct install link)

---

## 6. Repository Structure

```
livechat-hubspot/
├── README.md
├── PROJECT_PLAN.md          # This document
├── package.json
├── .env.example
├── src/
│   ├── widget/              # React widget (runs in LiveChat iframe)
│   │   ├── index.html
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── ContactList.tsx
│   │   │   └── ContactItem.tsx
│   │   └── hooks/
│   │       └── useHubSpotSearch.ts
│   ├── settings/            # Settings widget (optional)
│   │   └── ...
│   └── server/              # Backend API
│       ├── index.ts
│       ├── routes/
│       │   ├── auth.ts      # HubSpot OAuth
│       │   ├── hubspot.ts   # Search, properties
│       │   └── config.ts
│       └── lib/
│           ├── hubspot.ts
│           └── storage.ts
├── public/
└── vercel.json              # If using Vercel
```

---

## 7. Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Phase 1: LiveChat setup | 0.5 day | Console config, sample widget |
| Phase 2: HubSpot OAuth + API | 1–2 days | Backend, token storage |
| Phase 3: Widget UI | 1–2 days | Search, list, putMessage |
| Phase 4: Settings + config | 1 day | Property picker, persistence |
| Phase 5: Hosting + deploy | 0.5–1 day | Vercel, env, testing |
| **Total** | **4–6 days** | Solo developer |

---

## 8. References

- [Text Platform Docs](https://platform.text.com/docs/)
- [Agent App SDK](https://platform.text.com/docs/extending-agent-app/products-sdk/agent-app-sdk)
- [Building LiveChat Apps](https://platform.text.com/docs/guides/livechat-apps/)
- [HubSpot Contacts API](https://developers.hubspot.com/docs/api/crm/contacts)
- [HubSpot Search Contacts](https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/search/post-crm-v3-objects-contacts-search)
- [HubSpot OAuth](https://developers.hubspot.com/docs/api/oauth-quickstart-guide)
- [LiveChat Agent Chat API — update_customer](https://platform.text.com/docs/messaging/agent-chat-api#update-customer)
