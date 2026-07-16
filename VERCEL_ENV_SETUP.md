# Vercel Environment Variables — Setup Guide

Everything below goes in **Vercel → your project → Settings → Environment
Variables**. A ready-to-copy template is also in `.env.example` at the repo
root.

Set every variable on **Production**, **Preview**, *and* **Development** (or
mirror production values into a test IntaSend/NestLink account for preview
deploys) unless noted otherwise.

---

## 1. Firebase Admin SDK

Used by `lib/firebase.js` (shared by most `/api` functions) and directly by
`api/ipn.js` / `api/admin/process-withdrawal.js`.

| Variable | Where to get it |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase Console → Project Settings → General → "Project ID" |
| `FIREBASE_CLIENT_EMAIL` | Firebase Console → Project Settings → Service Accounts → Generate new private key → open the downloaded JSON → `client_email` field |
| `FIREBASE_PRIVATE_KEY_BASE64` | The same JSON's `private_key` field, **base64-encoded** (see below) |

**Why base64?** Vercel's environment variable editor can mangle the raw PEM
key's `\n` newlines, which breaks Firebase auth in confusing ways. Base64
avoids that entirely. Encode it locally:

```bash
# macOS / Linux
node -e "console.log(Buffer.from(require('./serviceAccountKey.json').private_key).toString('base64'))"

# or, if you already have the raw key in a file:
base64 -i private_key.pem | tr -d '\n'
```

Paste the single resulting line as `FIREBASE_PRIVATE_KEY_BASE64`.

> `lib/firebase.js` now accepts **either** `FIREBASE_PRIVATE_KEY_BASE64`
> (preferred) or the raw `FIREBASE_PRIVATE_KEY` (with literal `\n`s) as a
> fallback — use whichever you're already set up with, just make sure it's
> the *same* one every function expects. `api/ipn.js` and
> `api/admin/process-withdrawal.js` specifically only read the `_BASE64`
> form, so if you deposit/withdraw features are in use, set that one.

**Never** commit the service-account JSON to git — only paste the values
into Vercel's env var UI.

### Frontend Firebase config (not a secret, not a Vercel env var)

`frontend/src/lib/firebase.js` has the **client-side web app config**
(`apiKey`, `authDomain`, etc.) hardcoded. This is normal and safe for
Firebase web apps — that config identifies your project to the browser
SDK, it is not a credential, and your Firestore security rules (not this
config) are what actually protect your data. You don't need to move it
into Vercel env vars, but if you'd rather keep it out of source control,
you can swap it for `import.meta.env.VITE_FIREBASE_*` vars and add those
as Vercel env vars too (Vite only exposes vars prefixed `VITE_` to the
browser bundle).

---

## 2. IntaSend (card payments)

Used by `api/deposit.js`, `api/ipn.js`, `api/admin/process-withdrawal.js`.

| Variable | Where to get it |
|---|---|
| `INTASEND_PUBLISHABLE_KEY` | intasend.com dashboard → API & Keys |
| `INTASEND_SECRET_KEY` | Same page — keep this one Production-only / never expose client-side |
| `INTASEND_TEST_MODE` | `"true"` for IntaSend's sandbox, `"false"` for live charges |
| `INTASEND_WEBHOOK_SECRET` | IntaSend dashboard → Webhooks → the "Challenge" value you configure there |

After deploying, register your IPN/webhook URL in the IntaSend dashboard as:

```
https://<your-app>.vercel.app/api/ipn
```

**Note:** `WalletModal.jsx` (frontend) also has an IntaSend **publishable**
key hardcoded for the client-side popup checkout
(`ISPubKey_live_...`). Publishable keys are meant to be public/embeddable
(same model as Stripe's), so this is fine as-is — but if you rotate keys,
update it there too, since it isn't read from an env var.

---

## 3. NestLink (M-PESA STK Push)

Used by `lib/nestlink.js`, called from `api/deposit.js` for M-PESA deposits.

| Variable | Where to get it |
|---|---|
| `NESTLINK_API_KEY` | Your NestLink account dashboard → API secret |

---

## 4. App URL

| Variable | Notes |
|---|---|
| `APP_URL` | Your production URL, e.g. `https://aviator.yourdomain.com`. Used for IntaSend's card-checkout redirect/host URL. Has a hardcoded fallback in `api/deposit.js` (`https://aviator-full-project.vercel.app`) but you should set your own so card redirects come back to the right place. |

---

## Quick checklist

```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY_BASE64
INTASEND_PUBLISHABLE_KEY
INTASEND_SECRET_KEY
INTASEND_TEST_MODE
INTASEND_WEBHOOK_SECRET
NESTLINK_API_KEY
APP_URL
```

9 variables total. Add them all under **Settings → Environment Variables**,
redeploy, and every `/api/*` function will have what it needs.

## Not affected / not needed here

- **Admin app** (`/admin`) — separate Vite app, deployed independently; not
  part of this Vercel project's env vars unless you also deploy it here.
- **Firebase Cloud Functions** (`/functions`) — deployed via the Firebase
  CLI (`firebase deploy --only functions`), not Vercel. Its own config (if
  any) is managed separately with `firebase functions:config` or its own
  `.env`, not covered by this guide.
