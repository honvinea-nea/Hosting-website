# Backend

Node.js HTTP API and PostgreSQL persistence for the Classic Eleven storefront/admin starter.

## Requirements

- Node.js 20+
- PostgreSQL 14+ (Supabase PostgreSQL is supported)

## Configure (recommended wizard)

Install dependencies, then run the setup wizard. It asks for your real database URL and admin email/name, lets you choose your own admin password and generates a valid authenticator secret, and writes a private `backend/.env` file:

```bash
npm ci
npm run setup
```

Save the password you chose and add the generated Base32 authenticator secret to Google Authenticator, Microsoft Authenticator, or another TOTP app. The password is printed only once. Never share or commit `backend/.env`.

For manual configuration, copy `.env.example` to `.env` and fill every required value. Generate the encryption key using:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use a unique administrator password of at least 12 characters. Keep `.env` private.

## Run without PostgreSQL (local demo)

If you do not have a PostgreSQL/Supabase database yet, run:

```bash
npm install
npm run local
```

This starts an embedded PostgreSQL-compatible database inside the project (`backend/.data`, ignored by git), applies the migrations, creates the `admin@gmail.com` administrator on first run, and starts the API on <http://localhost:3000>. Data is kept between restarts. Open <http://localhost:3000/admin/login.html> and sign in with `admin@gmail.com` / `admin123`.

`npm run local` is for local development only. To use a hosted database instead, configure `DATABASE_URL` in `backend/.env` and use `npm start`.

## Install and run

```bash
npm ci
npm run setup
npm test
npm run db:migrate
npm run admin:bootstrap
npm start
```

The server listens on `PORT` (default `3000`) and serves the frontend directory at the repository root. `/health` performs a database readiness check.

## Scripts

- `npm start` — start the server
- `npm test` — run security unit tests
- `npm run db:migrate` — apply ordered SQL migrations
- `npm run db:reset -- --yes` — delete all application data (schema and role definitions stay intact) and create the `admin@gmail.com` administrator with role `admin`
- `npm run local` — run the embedded local database and the API together (no external PostgreSQL needed)
- `npm run admin:bootstrap` — provision the initial admin account

## Operational notes

- The API requires `DATABASE_URL` at startup.
- In production, `PGSSLMODE=require` and an explicit `ALLOWED_ORIGINS` are mandatory.
- Apply migrations using a trusted deployment job before switching application traffic.
- Configure HTTPS, backups, monitoring, and secret rotation at the hosting layer.
- The frontend's commerce operations are not yet fully backed by API endpoints; see the root README's known limitations.
