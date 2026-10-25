# FarmBridge AI

FarmBridge AI is a responsive React + TypeScript web app with a Node.js API and SQLite-backed accounts. Passwords are stored as salted scrypt hashes; authenticated sessions use opaque, random, HttpOnly cookies whose hashes are stored in SQLite.

## Run locally

1. Install Node.js 22 or newer.
2. Install packages with `npm.cmd install`.
3. Optionally copy `.env.example` to `.env`. The defaults support local development and do not require a hosted authentication account.
4. Start both the API and Vite development server with `npm.cmd run dev`.
5. Open `http://127.0.0.1:5173`.

The API listens on `127.0.0.1:3001`; Vite proxies `/api` requests to it. Registration creates a local account and session immediately. The SQLite database is created at `data/farmbridge.sqlite`; it is excluded from version control. Keep a protected backup of this file if you deploy and need account persistence.

To run the built app, set `APP_ORIGIN` to the exact HTTPS site origin, set `NODE_ENV=production`, run `npm.cmd run build`, then start the combined API/static server with `npm.cmd run server`.

## Raspberry Pi with Cloudflare Tunnel

The ZIP-and-unzip approach is fine if you transfer the source and lockfile, but do not include `node_modules`, `.env`, `data`, or `dist`. Install dependencies and build on the Pi so the native SQLite package is compiled/downloaded for the Pi's CPU architecture. Use 64-bit Raspberry Pi OS and a Node.js version supported by `package.json` (Node.js 22 or newer).

1. Unzip the project to a persistent folder on the Pi, for example `~/farmbridge`.
2. In that folder run `npm ci` and then `npm run build`.
3. Create a private `.env` file in the project root with `NODE_ENV=production`, `PORT=3001`, `HOST=127.0.0.1`, `DATABASE_PATH=./data/farmbridge.sqlite`, and `APP_ORIGIN=https://<your-cloudflare-hostname>`. Set the file permission to owner-only (`chmod 600 .env`). The app uses the exact `APP_ORIGIN` to validate browser requests. Production mode also enables the `Secure` session-cookie flag.
4. Start the app with `npm run server`. It serves the built frontend and API on `127.0.0.1:3001`; do not expose this port directly through the router/firewall.
5. Install `cloudflared` on the Pi and create a Cloudflare Tunnel to `http://127.0.0.1:3001`. Cloudflare provides a public **URL/hostname**, not a public key. Use that exact HTTPS origin as `APP_ORIGIN`.
6. For a temporary Quick Tunnel, its `trycloudflare.com` URL can change when the tunnel restarts. Keep the tunnel process running and set `APP_ORIGIN` to its current URL; restart the app after setting the value. For a stable deployment, use a named Cloudflare Tunnel with a domain you control so `APP_ORIGIN` remains fixed.
7. Run both the app and `cloudflared` as supervised services (for example, separate `systemd` units) so they start after reboots. Back up `data/farmbridge.sqlite` securely and test restore before relying on it.

Do not run `npm run dev` on the public deployment; it starts Vite's development server. Never put SMTP credentials or other secrets in the frontend or a shared ZIP. Add SMTP values only to the Pi's private `.env` if password-reset mail is needed.

## Configuration

`APP_ORIGIN` must match the browser origin exactly. It defaults to `http://127.0.0.1:5173`. Set `PORT` to change the API port; update the Vite proxy in `vite.config.ts` if you change the default API port. Set `DATABASE_PATH` to choose the SQLite file path.

Forgot-password emails require SMTP configuration. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in the server environment. Without SMTP, the recovery form explains that password recovery has not been configured; it does not display reset tokens or send a fake success response. With SMTP configured, the server sends a single-use link that expires after 30 minutes. Responses do not reveal whether an email address is registered.

## Security notes

- User-selected roles are restricted to farmer, buyer, retailer, restaurant, processor, and NGO. There is no administrator option in registration or profile editing.
- Sessions expire after seven days and are invalidated on logout and password reset. Cookies use `HttpOnly` and `SameSite=Lax`; they are marked `Secure` when `NODE_ENV=production`.
- State-changing API routes require the configured same-origin `Origin`. Passwords and reset tokens are never returned by API routes; reset tokens are stored only as hashes.
- This SQLite-backed setup is suitable for local development and a single application instance. For public production use, deploy behind HTTPS, protect/backup the database file, configure SMTP and `APP_ORIGIN`, apply operational rate limiting/monitoring, and review the deployment's filesystem and reverse-proxy settings. Do not expose the database file.
- Administrator assignment is an operational action, not a self-service feature. A trusted operator can update the user's `role` directly in the protected SQLite database; never expose this capability to unauthenticated clients.

## Verification

- `npm.cmd run build` runs TypeScript checks and the production Vite build.
- `npm.cmd test` runs the API authentication tests.
- `npm.cmd run dev` starts the local API and frontend together.

The application includes the public landing page, English/Telugu UI, account registration and sign-in, persistent sessions, logout, role-aware dashboard routing, profile editing, and an SMTP-backed password recovery flow.
