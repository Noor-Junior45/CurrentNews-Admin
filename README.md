## 📰 Current News Live

**Independent Ledger & Live Alerts** — a self-publishing news PWA with real-time posts, an admin dashboard, automated email alerts, and a dynamic RSS feed.

🔗 **Live:** [currentnews.blog](https://currentnews.blog)


![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)

---

## Overview

Current News Live is a lightweight, installable news platform where an admin writes and publishes dispatches directly from a browser-based dashboard, and readers browse, save, and subscribe to breaking news alerts — no CMS, no backend server to babysit. Posts live in Firestore, alerts go out over email via Resend, and the whole thing installs like a native app on mobile.

## ✨ Features

- 📱 **Installable PWA** — offline-ready, add-to-home-screen support
- 📝 **Admin dashboard** — rich text editor for publishing, editing, and managing posts
- 📬 **Automated breaking news alerts** — subscriber emails sent via the Resend transactional API
- 📡 **Dynamic RSS feed** — generated live from Firestore data at `/rss.xml`
- 🔥 **Firebase / Firestore backend** — no separate database to manage
- ❤️ **Liked posts view** — readers can save articles for later
- 🌗 **Light/dark theme toggle**
- 💰 **Google AdSense Certified Compliance** — Dynamic route guarding, automated `adsbygoogle-noablate` protection, and standard labeled in-article and in-feed ad units
- 🏛️ **E-E-A-T Editorial Standard Pages** — Dedicated About Us (`/about`), Fact-Checking & Editorial Policy (`/editorial-policy`), and Newsroom Contact (`/contact`) pages
- 📊 **Google Analytics & Web Vitals** tracking
- ⚙️ **SEO & Crawler Pre-Rendering** — Server pre-renders full articles, JSON-LD Schema.org `NewsArticle` and `NewsMediaOrganization` data for search and AdSense review bots
- ⚡ **Serverless on Vercel** — mail, RSS, sitemap, and `ads.txt` run as Vercel functions in production

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Routing | React Router 7 |
| Data | Firebase (Firestore) |
| Email | Resend transactional API |
| Rich text | React Quill |
| Animation | Motion (Framer Motion) |
| Hosting | Vercel (static build + serverless functions) |
| Local dev server | Express (via `tsx`) |

## 🏗 Architecture note: local dev vs. production

This project runs differently depending on environment, which matters if you're debugging:

- **Local development** (`npm run dev`) spins up an Express server (`server.ts`) via `tsx`, which handles the mail endpoint, RSS feed, and `ads.txt` alongside the Vite dev middleware.
- **Production (Vercel)** does **not** run a persistent Node server. Vercel serves the static Vite build and auto-detects serverless functions placed under `/api`. The mail, RSS, and ads routes are implemented as Vercel functions (`api/mail/send-alert.ts`, `api/rss.xml.ts`, `api/ads.txt.ts`) so they work identically in both environments.

If you add a new backend route, remember to add it in the Vercel-function style under `/api`, not just inside `server.ts`, or it will 404 in production.

## 🚀 Getting Started

```bash
git clone https://github.com/Noor-Junior45/CurrentNews.git
cd CurrentNews
npm install
cp .env.example .env   # then fill in the values below
npm run dev
```

The app will be running at `http://localhost:3000`.

## 🔑 Environment Variables

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API key for AI-assisted features | Yes |
| `APP_URL` | Base URL of the deployed app | Yes |
| `RESEND_API_KEY` | Resend API key for sending email alerts | Yes |
| `RESEND_SENDER_EMAIL` | Verified sender email on a domain confirmed in Resend | Yes |
| `RESEND_SENDER_NAME` | Display name for outgoing alert emails | Yes |
| `VITE_ADSENSE_CLIENT` | Google AdSense client ID | Optional |
| `VITE_ADSENSE_SLOT_LEADERBOARD` | AdSense slot ID (leaderboard placement) | Optional |
| `VITE_ADSENSE_SLOT_SIDEBAR` | AdSense slot ID (sidebar placement) | Optional |
| `VITE_ADSENSE_SLOT_FOOTER` | AdSense slot ID (footer placement) | Optional |

> Firebase config is read from `firebase-applet-config.json`, not environment variables.

> **Resend setup:** verify your sending domain under Resend → Domains before going live. Until it's verified, Resend only allows sending to the email address on your own Resend account — the admin dashboard's test-mail console will flag this with a fix-it link if it happens.

**Important:** when deploying to Vercel, set these in **Project → Settings → Environment Variables** — a local `.env` file alone will not reach the production build.

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start local dev server (Vite + Express, via `tsx`) |
| `npm run build` | Build production assets |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm run clean` | Remove build output |

## 🌐 Deployment

Deployed on **Vercel** — pushing to `main` triggers an automatic deployment. The build serves the static Vite output plus the serverless functions under `/api`. See the architecture note above before adding new backend routes.

## 🗺 Roadmap

- [ ] Push notifications for breaking news
- [ ] Category-based subscriber alert preferences
- [ ] Search across published dispatches
- [ ] Author bylines and multi-admin support

## 📄 License

This project is currently unlicensed / all rights reserved. Add a license here if you intend to open source it.

---

Built by [Noor-Junior45](https://github.com/Noor-Junior45)
