# BI Tool MVP

A Metabase-style BI tool: connect a database, build queries visually, turn
results into dashboards, push results to Google Sheets, and ask
natural-language questions over your data. Built to run at **$0 cost** with
**no credit card on any service** — worst case is a service pausing or
throttling, never a bill.

## Architecture in one paragraph

Query execution always happens on the connected (customer) database, never
on our infrastructure. The browser sends a structured query (JSON, never raw
SQL) to a Supabase Edge Function, which validates it against the live schema
of the target database, generates parameterized SQL, connects as a
**read-only** user with a 30s statement timeout, and returns capped results.
Everything else (auth, saved queries, dashboards, caching, embeddings) lives
in Supabase Postgres, scoped per-user with Row Level Security.

## Accounts you need to create (all free, no card)

1. **Supabase** project — https://supabase.com (Auth + Postgres + Edge
   Functions + pgvector).
2. **Neon** project — https://neon.tech — this plays the role of a
   customer's database for the demo. Create it separately from Supabase; it
   is never the app's own metadata DB.
3. **Google Cloud project without billing enabled** — for a Sheets API OAuth
   client (frontend-only OAuth token flow, no server-side refresh token
   stored).
4. **Google AI Studio** API key for Gemini — https://aistudio.google.com —
   free tier is rate-limited and prompts may be used by Google, so only ever
   point AI features at sample/demo data.

## 1. Supabase setup

```bash
# from the supabase/ directory, after installing the Supabase CLI
supabase login
supabase link --project-ref <your-project-ref>
supabase db push               # applies migrations in supabase/migrations
```

Set Edge Function secrets (Project Settings → Edge Functions, or via CLI):

```bash
supabase secrets set \
  CONNECTION_ENCRYPTION_KEY="$(openssl rand -base64 32)" \
  GEMINI_API_KEY="<your Gemini API key>"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
injected automatically into Edge Functions by Supabase — you don't set
those yourself.

Deploy the functions:

```bash
supabase functions deploy create-connection test-connection list-schema \
  run-query save-query push-to-sheet index-schema ai-nl-to-sql ai-semantic-search
```

## 2. Frontend setup

```bash
cd frontend
cp .env.example .env
# fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (Project Settings → API)
# and VITE_GOOGLE_CLIENT_ID (see step 4)
npm install
npm run dev
```

## 3. Neon demo database

1. Create a Neon project — this is the "customer" database, separate from
   the Supabase project above.
2. Load the sample dataset and a read-only role:

   ```bash
   # edit the password in the script first
   psql "$NEON_DEMO_DATABASE_URL" -f supabase/seed/demo_saas_schema.sql
   ```
3. In the app, go to **Connections → Add connection** and use the
   `bi_tool_reader` role's credentials — exercising the real
   encrypt/store/read-only path rather than hardcoding a connection.

Neon free tier scales to zero when idle (cold start on first query after
being idle) and has a monthly compute allowance consumed only while awake.
Before a live demo, run one query a few minutes early to wake it. Avoid
leaving auto-refreshing dashboards open, which keeps it awake unnecessarily.

## 4. Google Sheets OAuth client

1. In a Google Cloud project **without billing enabled**, enable the
   Google Sheets API.
2. Create an OAuth 2.0 Client ID (type: Web application). Add your frontend
   origin (e.g. `http://localhost:5173`, and your deployed URL) to
   **Authorized JavaScript origins**. No redirect URI is needed — the
   frontend uses Google Identity Services' token client, which returns an
   access token directly to the browser.
3. Put the client ID in `frontend/.env` as `VITE_GOOGLE_CLIENT_ID`.

Sheets sync is **one-way** in this MVP: query results overwrite the linked
sheet. Two-way sync (reading edits back) is a later milestone — see the
build order below.

## 5. Frontend hosting

Either works, both free, no card:

- **Firebase Hosting (Spark plan)**: `firebase deploy --only hosting` after
  `npm run build`.
- **Cloudflare Pages**: connect the repo, build command `npm run build`,
  output directory `dist`, root directory `frontend`.

## Guardrails already built in

- DB credentials encrypted at rest (AES-GCM, `CONNECTION_ENCRYPTION_KEY`).
- Every customer-DB connection is opened with
  `default_transaction_read_only = on`, so even a role with write access
  can't mutate anything through this app.
- No raw SQL ever comes from the client. The query builder and AI search
  both produce a structured query; SQL is generated server-side from a
  live `information_schema` allowlist, with parameterized values.
- 30s statement timeout, row cap (5,000), and a per-user daily query cap on
  every query execution.
- Dashboard results are cached in `query_cache`, refreshed only on demand —
  not on every dashboard view.
- Row Level Security on every metadata table, scoped to `user_id`.

## Build order (matches how this was built)

1. Auth (Supabase)
2. Add-connection flow (encrypted credentials, read-only test connection)
3. Query builder → server-side SQL generation → results, with timeouts/caps
4. Charts and dashboards, with result caching
5. Push results to Google Sheets (one-way)
6. AI search: natural language → SQL (validated path) + pgvector semantic
   search over saved tables
7. Two-way Sheets sync (not yet built)

## Known free-tier behaviors

- **Supabase free**: pauses after ~1 week of inactivity (unpause from the
  dashboard, nothing lost or billed).
- **Neon free**: scales to zero when idle; supports branching, useful for
  resetting demo data between runs.
- **Gemini free tier**: rate-limited; sample data only.

Free-tier limits change — verify current numbers on each provider's pricing
page before relying on them.

## What's not built yet (future, paid-tier territory)

- **Static outbound IPs.** Real customer databases usually allowlist IPs;
  serverless functions have no fixed IP. Likely the first thing that costs
  money once real customers connect real databases.
- **Two-way Google Sheets sync** — needs conflict handling and write-back
  rules; the MVP is push-only.
