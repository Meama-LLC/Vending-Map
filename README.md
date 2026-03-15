# MEAMA PULSE — Dropper Network Dashboard

Real-time dashboard showing 197 dropper machines across Tbilisi, powered by Supabase + Vercel.

## Setup

### 1. Supabase Setup

Run the SQL in `supabase-setup.sql` in your Supabase SQL Editor. This:
- Enables Realtime on `vending_orders` (for live transaction updates)
- Adds read-only RLS policies for the public dashboard
- Creates indexes for fast queries

### 2. Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000

### 3. Deploy to Vercel

**Option A — GitHub (recommended):**
1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import the repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
4. Deploy

**Option B — Vercel CLI:**
```bash
npm i -g vercel
vercel --prod
```
Set the env vars when prompted.

## How It Works

- **Data source**: `vending_orders` table in Supabase
- **Machine locations**: Geocoded from the Excel master list (embedded in `lib/droppers.js`)
- **Status logic**: Derived from today's transaction activity:
  - 🟢 **Active** — 5+ transactions, recent activity
  - 🟡 **Low Activity** — less than 5 transactions today
  - 🔵 **Inactive** — no transactions in 2+ hours
  - 🔴 **No Sales** — zero transactions today
- **Real-time**: Supabase Realtime subscription on `vending_orders` INSERT events
- **Auto-refresh**: Full data reload every 30 seconds
- **Map**: Leaflet + CartoDB tiles with purple dark theme

## Files

```
├── app/
│   ├── layout.js        — Root layout with fonts + Leaflet CSS
│   ├── page.js          — Main page (loads Dashboard)
│   └── globals.css      — Base styles
├── components/
│   └── Dashboard.js     — Full dashboard (map, panels, real-time)
├── lib/
│   ├── supabase.js      — Supabase client
│   └── droppers.js      — 206 geocoded dropper locations
├── supabase-setup.sql   — Run this in Supabase SQL Editor
├── .env.local           — Your Supabase credentials
└── package.json
```
