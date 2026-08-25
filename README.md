# Simply Rustic — WhatsApp Catering Shop

A WhatsApp ordering bot (built on [whatsapp-web.js](https://wwebjs.dev/)) plus an admin
dashboard for managing your catering menu, services and incoming orders.

> **⚠️ Read before linking a number.** `whatsapp-web.js` is an unofficial client — it
> automates a real WhatsApp Web session, which is against WhatsApp's Terms of Service.
> WhatsApp actively detects and bans numbers used this way, sometimes immediately and with
> very little usage. **Only ever link a disposable/burner number you can afford to lose —
> never your personal or business number.** For a real production deployment, use the
> official [WhatsApp Business Platform (Cloud API)](https://developers.facebook.com/docs/whatsapp)
> instead, which requires Meta business verification but carries no ban risk.
>
> Separately: the first time any device links, WhatsApp replays the account's message
> history to sync it. This codebase guards against treating that replay as new messages
> (see `src/whatsapp/client.js`), but it's a reminder of how easily an unofficial client can
> end up auto-messaging every past contact at once if that guard is ever removed.

## What's included

- **Admin dashboard** (Express + EJS) at `/` — manage menu categories/items (with photos),
  catering services, and view/update order status. Protected by a login.
- **WhatsApp bot** — greets customers, lets them browse the menu by category, add items to
  a cart, check out, or enquire about a catering service. Every order/enquiry is saved to
  the database and forwarded to your own WhatsApp number.
- **SQLite database** via Prisma — zero config, single file, easy to back up.

Both the dashboard and the bot run in the same Node process and share the same database.

## Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:
- `SESSION_SECRET` — any long random string.
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — credentials for the first dashboard login (only
  used the first time you seed the database).
- `ADMIN_WHATSAPP_NUMBER` — your own WhatsApp number (digits only, country code, no `+`,
  e.g. `27821234567`) so the bot can forward new orders/enquiries to you.
- `BUSINESS_NAME`, `CURRENCY_SYMBOL` — cosmetic, shown in the dashboard and bot replies.

Then create the database and seed an admin user + sample menu/services:

```bash
npm run prisma:migrate
npm run seed
```

Start the app:

```bash
npm run dev      # with auto-reload
# or
npm start
```

Open `http://localhost:3000`, log in, then go to **WhatsApp** in the sidebar and scan the
QR code with WhatsApp on your phone (Settings → Linked devices → Link a device). Once
connected the bot is live — message the connected number from another phone to try it:
send `hi` to start.

The WhatsApp login session is saved to `.wwebjs_auth/` so you don't need to re-scan on
every restart (this folder is gitignored — never commit it, it's equivalent to being
logged into your WhatsApp account).

## Using the dashboard

- **Menu**: add categories, then add items with a name, description, price, photo and
  availability toggle. Unavailable items are hidden from the bot automatically.
- **Services**: list catering services (weddings, corporate events, etc.) with an optional
  price. Customers "enquire" about a service via the bot; the enquiry becomes an order you
  can track and update.
- **Orders**: every checkout or service enquiry shows up here with the customer's WhatsApp
  number, items/service, total and any notes they sent. Change the status dropdown to move
  an order through Pending → Confirmed → Preparing → Completed (or Cancelled).

## Deploying to a VPS

1. Provision a small Linux VPS (1 vCPU / 1GB RAM is enough) and install Node.js 18+.
2. Install the system libraries Chromium needs to run headless (Debian/Ubuntu):
   ```bash
   sudo apt-get update && sudo apt-get install -y \
     ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
     libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 \
     libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
     libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
     libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release \
     wget xdg-utils
   ```
3. Clone this repo on the server, `npm install`, copy `.env.example` to `.env` and fill it
   in (use a strong `SESSION_SECRET` and admin password).
4. `npm run prisma:deploy` (applies migrations without prompting) then `npm run seed`.
5. Run the app under a process manager so it survives reboots/crashes and keeps the
   WhatsApp session alive, e.g. [PM2](https://pm2.keymetrics.io/):
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name simply-rustic
   pm2 save
   pm2 startup   # follow the printed instructions to enable on boot
   ```
6. Put the dashboard behind a reverse proxy (nginx/Caddy) with HTTPS if you expose it to
   the internet, since it handles a login and menu photo uploads.
7. Visit `https://your-domain/whatsapp` once to scan the QR code from the server. After
   that, `.wwebjs_auth/` on the VPS keeps you logged in across restarts — back that folder
   up along with `prisma/dev.db` if you ever migrate servers.

### Notes on running WhatsApp Web on a server

- `whatsapp-web.js` automates a real WhatsApp Web session via a headless Chromium
  (Puppeteer). It is not an official WhatsApp Business API — it's fine for a small
  single-number shop, but keep in mind WhatsApp can rate-limit or ban numbers used for
  high-volume/automated messaging that looks spammy. Don't blast unsolicited messages.
- Only one active session per WhatsApp number/device at a time. If you need multiple
  staff to see conversations, they can still use WhatsApp normally on the linked phone —
  the bot only auto-replies to customer-initiated chats.

## Project structure

```
prisma/schema.prisma     Database schema (categories, menu items, services, customers, orders, chat sessions)
prisma/seed.js           Creates the first admin user + sample menu/services
src/app.js               Express app: sessions, flash messages, routes, view engine
src/index.js             Entry point: boots the dashboard + WhatsApp client together
src/routes/              Dashboard routes (auth, menu, services, orders)
src/views/                EJS templates for the dashboard
src/whatsapp/client.js    whatsapp-web.js client setup (QR, connection state)
src/whatsapp/messageHandler.js  The bot's conversation logic (menu browsing, cart, checkout, service enquiries)
src/whatsapp/session.js   Per-customer conversation state, persisted in the ChatSession table
public/                  Static assets (CSS, uploaded menu photos)
```
