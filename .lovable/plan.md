

# Vibey PWA — UI Scaffold

## Overview
Build the Vibey admin control panel and chat interface as an installable PWA, styled with the **Vibe Ventures aesthetic** (near-black bg `hsl(0 0% 6%)`, warm off-white foreground, blue accent `hsl(200 80% 60%)`, Space Grotesk + Space Mono typography, tight 0.25rem radius, minimal/editorial feel) — replacing the original Vibey mint-glow look.

## Design System
- **Palette**: Vibe Ventures dark — charcoal black bg, warm cream text, cyan-blue accent
- **Typography**: Space Grotesk (body/sans) + Space Mono (labels/headings/mono), imported from Google Fonts
- **Utilities**: `text-label` (mono, uppercase, tracked), prose styles for markdown rendering, glow utilities adapted to blue accent
- **Border radius**: 0.25rem (sharp, editorial)

## Pages & Routing

### 1. Admin Shell (`/` — layout with `<Outlet>`)
- Sidebar (collapsible icon mode) with Vibey avatar + "VIBEY" header
- **Talk to Vibey** — top-level chat link
- **Agent group**: Soul, Identity, Memory, Media Library, Interfaces
- **Social group**: Relationships, Conversations, Group Chats
- Footer: "View Site" link
- Header bar with sidebar trigger + "VIBEY CONTROL" label

### 2. Chat Interface (`/` — index route)
- Empty state: Vibey avatar, "Talk to Vibey" heading, Telegram link
- Chat bubbles (user right, Vibey left with avatar), input bar with send button
- Mock data only — no Supabase calls yet

### 3. Admin Sub-pages (stub/placeholder for each)
- `/soul` — Soul Editor (markdown textarea placeholder)
- `/identity` — Identity Editor (name, personality fields placeholder)
- `/memory` — Memory Viewer (card list placeholder)
- `/media` — Media Library (grid placeholder)
- `/interfaces` — Interfaces Editor (toggles placeholder)
- `/relationships` — Relationships Browser (table placeholder)
- `/conversations` — Conversations Viewer (list placeholder)
- `/groups` — Group Chat Manager (list placeholder)

Each page gets a heading + description + empty state UI, styled consistently. No real data yet.

## PWA Setup
- Add `manifest.json` (name: "Vibey", icons, `display: standalone`, theme color matching the dark palette)
- **No service worker / no vite-plugin-pwa** — just manifest for installability
- Mobile meta tags in `index.html` (viewport, theme-color, apple-mobile-web-app)

## Dependencies to Add
- `framer-motion` (for subtle page transitions, matching Vibe Ventures feel)

## What's NOT in this phase
- Supabase data connections (next phase)
- Authentication / login
- Public landing page
- Real edge function calls for chat

