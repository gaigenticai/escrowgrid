# EscrowGrid Admin Console

React + TypeScript + Vite admin UI for the TAAS backend. This console lets operators and
institution admins manage institutions, API keys, asset templates, assets, positions, and policies.

## Local development

1. Install dependencies:

   ```bash
   cd admin-console
   npm install
   ```

2. Start the dev server (Vite):

   ```bash
   npm run dev
   ```

3. Point the console at your API:

   - By default the UI talks to `http://localhost:4000`.
   - To override, set `VITE_API_URL`:

     ```bash
     VITE_API_URL="https://your-api-host" npm run dev
     ```

4. Authenticate with an API key:

   - The console uses the same API key model as the backend.
   - Use a root key to manage institutions and institution keys.
   - Use institution `admin` keys for day‑to‑day tenant operations.

## Production build

To build a static bundle:

```bash
cd admin-console
npm install
npm run build
```

The output goes to `admin-console/dist` and can be served by any static web server.

This repo includes a production Dockerfile that builds the app and serves it via nginx:

```bash
docker build -t escrowgrid-admin ./admin-console
docker run --rm -p 8080:80 escrowgrid-admin
```

In the root of the repo, `docker compose up --build` will also build and run the admin console
next to the API and Postgres for local or demo environments.

## Security and deployment notes

- Always serve the admin console over HTTPS.
- Treat admin API keys as sensitive credentials:
  - Do not hard‑code keys in the image or commit them to version control.
  - Prefer short‑lived institution `admin` keys; avoid exposing the root key in browsers.
- In production, run the console behind your SSO/VPN or an internal identity provider and
  restrict access to operations and support staff.

