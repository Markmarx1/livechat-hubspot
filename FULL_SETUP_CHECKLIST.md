# Full Setup Checklist — Get Fully Operational

Use this checklist to get your LiveChat + HubSpot app fully working.

---

## ✅ Already Done

- [x] App deployed to Vercel
- [x] Widget showing in LiveChat sidebar
- [x] App Authorization configured (customers:rw scope)
- [x] GitHub repo linked

---

## 1. HubSpot (Contact Search)

- [ ] Create [HubSpot Private App](https://developers.hubspot.com/docs/api/private-apps) with `crm.objects.contacts.read` scope
- [ ] Add `HUBSPOT_ACCESS_TOKEN` to Vercel → Settings → Environment Variables
- [ ] Redeploy

**Details:** [CONFIGURE_HUBSPOT.md](./CONFIGURE_HUBSPOT.md)

---

## 2. LiveChat (Update Visitor Name/Email)

- [ ] In [Developer Console](https://platform.text.com/console/) → **Tools** → **Personal Access Tokens**
- [ ] Create token with **`customers:rw`** scope
- [ ] Copy **Account ID** and **Access token**
- [ ] Add to Vercel:
  - `LIVECHAT_ACCOUNT_ID` = your Account ID
  - `LIVECHAT_ACCESS_TOKEN` = your PAT
- [ ] Redeploy

**Details:** [CONFIGURE_LIVECHAT.md](./CONFIGURE_LIVECHAT.md)

---

## 3. Redeploy & Test

- [ ] Vercel → Deployments → Redeploy latest
- [ ] Open LiveChat, start a chat
- [ ] Search for a HubSpot contact
- [ ] Click a contact — visitor name/email should update in LiveChat

---

## Summary: Vercel Environment Variables

| Variable | Purpose |
|----------|---------|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Private App token (contact search) |
| `LIVECHAT_ACCOUNT_ID` | Your LiveChat Account ID (for PAT) |
| `LIVECHAT_ACCESS_TOKEN` | LiveChat Personal Access Token (update_customer) |
