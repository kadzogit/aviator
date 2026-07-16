# ✈ Aviator — Full Stack Crash Game (Enhanced)

**Betika-style Aviator game** built with React + Firebase + Vercel + IntaSend/NestLink payments.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project (Firestore + Auth enabled)
- Vercel account (for deployment)
- IntaSend account (for card/B2C payments)
- NestLink account (for M-PESA STK push)

### Install Dependencies
```bash
npm run install:all
```

### Local Development
```bash
# Frontend game (port 5173)
npm run dev:frontend

# Admin dashboard (port 3001)
npm run dev:admin
```

---

## 🔧 Environment Variables (Vercel)

Set these in your Vercel project settings under **Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY_BASE64` | Base64-encoded private key (see below) |
| `INTASEND_PUBLISHABLE_KEY` | IntaSend public key |
| `INTASEND_SECRET_KEY` | IntaSend secret key |
| `INTASEND_WEBHOOK_SECRET` | IntaSend webhook challenge secret |
| `INTASEND_TEST_MODE` | `true` for sandbox, `false` for live |
| `NESTLINK_API_KEY` | NestLink M-PESA API key |
| `NESTLINK_BASE_URL` | NestLink base URL |

### Encode Firebase private key
```bash
cat your-service-account.json | base64 | tr -d '\n'
# Paste the result as FIREBASE_PRIVATE_KEY_BASE64
```

---

## 🏗 Project Structure

```
aviator-full-project/
├── frontend/                    # React game UI (Vite)
│   ├── index.html               # Entry HTML with Google Fonts + IntaSend SDK
│   └── src/
│       ├── main.jsx             # App entry + provider tree (FIXED)
│       ├── App.jsx              # Routing placeholder
│       ├── index.css            # Betika dark theme CSS
│       ├── components/
│       │   ├── GameCanvas.jsx   # Phase 4: canvas, plane, curve, crash, counters
│       │   ├── BettingPanel.jsx # Dual-slot betting + auto-cashout
│       │   ├── LeftPanel.jsx    # All Bets / Previous / Top / Chat
│       │   └── WalletModal.jsx  # Deposit/Withdraw (M-PESA + Card)
│       ├── pages/
│       │   ├── Game.jsx         # Main game page (Betika layout)
│       │   ├── Landing.jsx      # Landing page
│       │   ├── Login.jsx        # Login
│       │   └── Register.jsx     # Registration
│       ├── hooks/
│       │   └── useGame.js       # Game logic + queue multiplier support
│       ├── context/
│       │   ├── AuthContext.jsx  # Firebase auth + profile
│       │   └── GameContext.jsx  # Game state context
│       └── lib/
│           └── firebase.js      # Firebase client config
│
├── admin/                       # Admin dashboard (separate Vite app)
│   ├── index.html
│   ├── admin-main.jsx
│   ├── AdminApp.jsx             # Full Phase 5 admin dashboard
│   ├── package.json
│   └── vite.config.js
│
├── api/                         # Vercel serverless functions
│   ├── deposit.js               # M-PESA + Card deposit
│   ├── withdraw.js              # Withdrawal request
│   ├── payment-status.js        # Poll payment status
│   ├── ipn.js                   # IntaSend IPN webhook (FIXED)
│   ├── nestlink-status.js       # NestLink status
│   ├── webhook.js               # Webhook handler
│   └── admin/
│       ├── process-withdrawal.js # Approve/Decline (FIXED)
│       └── users.js              # List users (FIXED for superadmin)
│
├── lib/                         # Shared server utilities
│   ├── firebase.js              # Firebase Admin SDK
│   ├── nestlink.js              # NestLink M-PESA client
│   └── adminlogger.js           # Admin action logger
│
├── firestore.rules              # Security rules (superadmin + banned support)
├── firestore.indexes.json       # Composite indexes (adminLogs + announcements added)
├── firebase.json                # Firebase config
├── vercel.json                  # Vercel deployment config
└── package.json                 # Root dependencies (firebase-admin, intasend-node)
```

---

## 🎮 Phase 4 — Visuals

| # | Feature | Implementation |
|---|---|---|
| 13 | **Smooth Curve** | Bezier path via `buildSmoothPath()` in GameCanvas |
| 14 | **Plane Image** | Loads from CDN URL, falls back to ✈ emoji |
| 15 | **Betika Shading** | Gradient fill + sunburst rays + star field |
| 16 | **Crash Animation** | Plane spins + explosion particles + "FLEW AWAY!" overlay |
| 17 | **Live Counters** | Active player count + total stake on canvas overlay |

---

## 🛡 Phase 5 — Admin Controls

| # | Feature | Location in Admin |
|---|---|---|
| 18 | **Super Admin Controls** | Game Controls tab — settings, maintenance mode |
| 19 | **Force Crash** | Force crash at 1.01x or custom multiplier instantly |
| 20 | **Queue Multipliers** | Pre-set crash values for upcoming rounds |
| 21 | **User Controls** | Ban/unban, role change, balance edit, mode force, demo reset |

### Additional Admin Features
- **Overview Dashboard** — 12 live stat cards, country breakdown, round history
- **Withdrawals** — Approve/decline with M-PESA B2C payout
- **Transactions** — Filter by type, date range, search
- **Rounds** — Stats (avg/max/min), filter by multiplier range
- **Bets** — Full bet history with player search
- **Admin Logs** — Full audit trail of all admin actions
- **Announcements** — Broadcast messages to all players

---

## 🚀 Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from project root
vercel --prod
```

### Deploy Admin Dashboard (separate)
```bash
cd admin
npm install
npm run build
# Deploy admin/dist/ to a separate Vercel project or subdomain
vercel --prod
```

---

## 🔒 Firebase Setup

### Deploy Security Rules
```bash
firebase deploy --only firestore:rules
```

### Deploy Indexes
```bash
firebase deploy --only firestore:indexes
```

### Create Super Admin
1. Go to Firebase Console → Firestore → `users` collection
2. Find your admin user document
3. Set field: `role` = `"superadmin"`

---

## 💳 Payment Flow

### Deposits (M-PESA STK Push)
1. User enters amount + phone → `/api/deposit`
2. NestLink sends STK push to user's phone
3. User confirms → NestLink confirms
4. `/api/payment-status` polls → credits balance

### Withdrawals (Admin-Approved B2C)
1. User requests withdrawal → `pending` transaction created
2. Admin reviews in dashboard → clicks Approve
3. `/api/admin/process-withdrawal` → IntaSend B2C → M-PESA to user

---

## 🌍 Supported Countries

| Country | Currency | Payment Method |
|---|---|---|
| 🇰🇪 Kenya | KES | M-PESA (Safaricom) |
| 🇹🇿 Tanzania | TZS | M-PESA (Vodacom) |
| 🇺🇬 Uganda | UGX | MTN Mobile Money |

---

## 🐛 Known Fixes in This Version

1. **Duplicate AuthProvider** — Fixed in `main.jsx` (single provider tree)
2. **Duplicate import in `ipn.js`** — Removed duplicate `getFirestore` import
3. **`process-withdrawal.js` broken imports** — Fixed to use proper Firebase Admin init
4. **`superadmin` role blocked** — Fixed in `users.js` and `process-withdrawal.js`
5. **Queue multipliers not consumed** — `startNewRound()` now reads `gameSettings/config`
6. **Maintenance mode** — `startNewRound()` checks and respects maintenance flag
