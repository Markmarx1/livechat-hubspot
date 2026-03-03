# Launch Steps — Get the App Running

Follow these steps to deploy and run your LiveChat + HubSpot app.

---

## Step 1: Deploy via Developer Console

1. Go to [platform.text.com/console](https://platform.text.com/console/)
2. Open your **HubSpot Contact Lookup** app
3. Go to the **Deployment** tab
4. Click **Connect** and choose **Vercel** (or Netlify)
5. Authorize with your Vercel account when prompted
6. Select **Create new project** (or link an existing one)
7. Connect it to your `livechat-hubspot` repository
8. Use these build settings (Vercel usually auto-detects Vite):
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Root directory:** `/` (leave default)
9. Click **Deploy**

Wait for the build to finish. You’ll get a URL like `https://livechat-hubspot-xxx.vercel.app`.

---

## Step 2: Set Widget URL in Your App

1. In the Developer Console, go to **Building blocks**
2. Open the **Agent App Widgets** block
3. Set **Widget source URL** to your deployed URL, e.g.:
   ```
   https://livechat-hubspot-xxx.vercel.app
   ```
4. Save

---

## Step 3: Install the App on Your License

1. Go to the **Private installation** tab
2. Click **Install app**
3. Confirm the installation

---

## Step 4: Test in LiveChat

1. Open the [LiveChat Agent App](https://my.livechatinc.com/)
2. Start or open a chat
3. Open the **Details** panel (right sidebar)
4. You should see the HubSpot Contact Lookup widget

---

## What Works Right Now

| Feature | Status |
|---------|--------|
| Widget appears in LiveChat | ✅ |
| Search UI | ✅ |
| HubSpot search | ❌ (returns empty; backend not implemented) |
| Update customer | ❌ (backend not implemented) |

The app will show the UI and search box. Search and “update customer” will fail until the backend is implemented (see [DEPLOYMENT.md](./DEPLOYMENT.md) Phase B).

---

## Troubleshooting

**Widget doesn’t appear**
- Ensure the Widget source URL is HTTPS
- Check that the app is installed (Private installation tab)
- Refresh the LiveChat Agent App

**Build fails**
- Ensure `npm run build` works locally
- Check Vercel build logs for errors
