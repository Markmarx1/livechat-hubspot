# How to Configure LiveChat (Update Customer)

To enable **updating visitor name and email** when you select a HubSpot contact, you need a LiveChat Personal Access Token (PAT).

---

## Step 1: Create a Personal Access Token

1. Log in to [Developer Console](https://platform.text.com/console/) with your LiveChat credentials
2. Go to **Tools** → **Personal Access Tokens** (or **Settings** → **Authorization** → **Personal Access Tokens**)
3. Click **Create new token** (or **+**)
4. **Name:** e.g. "HubSpot Contact Lookup"
5. **Scopes:** Select **`customers:rw`** (required for update_customer)
6. Click **Create**
7. **Copy both values immediately** (you won't see the token again):
   - **Account ID** — you'll need this as the username
   - **Access token** — you'll need this as the password

---

## Step 2: Add to Vercel

1. Go to [vercel.com](https://vercel.com) → your **livechat-hubspot** project
2. **Settings** → **Environment Variables**
3. Add two variables:

   | Name | Value | Environment |
   |------|-------|-------------|
   | `LIVECHAT_ACCOUNT_ID` | Your Account ID from Step 1 | Production |
   | `LIVECHAT_ACCESS_TOKEN` | Your PAT from Step 1 | Production |

4. Save

---

## Step 3: Redeploy

1. **Deployments** → **⋯** on latest → **Redeploy**
2. Wait for the build to finish

---

## Step 4: Test

1. Open LiveChat Agent App and start a chat
2. In the HubSpot Contact Lookup widget, search for a contact
3. Click a contact to update the visitor
4. The visitor's name and email in LiveChat should update

---

## Troubleshooting

**"LiveChat not configured"**
- Ensure both `LIVECHAT_ACCOUNT_ID` and `LIVECHAT_ACCESS_TOKEN` are set
- Redeploy after adding variables

**"LiveChat token invalid"**
- Verify Account ID and token are correct (no extra spaces)
- Ensure the PAT has the `customers:rw` scope
- Create a new PAT if needed
