# How to Connect HubSpot

Follow these steps to connect your LiveChat app to HubSpot so you can search contacts.

---

## Step 1: Create a HubSpot Private App

1. Log in to [HubSpot](https://www.hubspot.com/) and go to **Settings** (gear icon)
2. In the left sidebar, go to **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Name it (e.g. "LiveChat Contact Lookup")
5. Under **Scopes**, add these **read-only** scopes:
   - `crm.objects.contacts.read` — Search and read contacts
   - `crm.schemas.contacts.read` — List contact properties (optional, for future config)
6. Click **Create app**
7. Copy the **Access token** (you won't see it again)

---

## Step 2: Add the Token to Vercel

1. Go to [vercel.com](https://vercel.com) and open your **livechat-hubspot** project
2. Go to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `HUBSPOT_ACCESS_TOKEN`
   - **Value:** Paste your HubSpot access token
   - **Environment:** Production (and Preview if you want)
4. Click **Save**

---

## Step 3: Redeploy

1. In Vercel, go to the **Deployments** tab
2. Click the **⋯** menu on the latest deployment
3. Click **Redeploy**
4. Wait for the build to finish

---

## Step 4: Test

1. Open LiveChat Agent App and start a chat
2. Open the **Details** panel — your HubSpot Contact Lookup widget should appear
3. Type a name in the search box and click **Search**
4. Contacts from your HubSpot CRM should appear

---

## Troubleshooting

**"HubSpot not connected"**
- Ensure `HUBSPOT_ACCESS_TOKEN` is set in Vercel
- Redeploy after adding the variable

**"HubSpot token invalid"**
- Create a new token in HubSpot (Private Apps)
- Update the variable in Vercel and redeploy

**No results when searching**
- Ensure you have contacts in HubSpot
- Try searching by first name, last name, or email
