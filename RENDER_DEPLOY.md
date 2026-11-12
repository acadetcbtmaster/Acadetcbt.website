# Deploying Acadet CBT on Render

This repository is configured for deployment on **Render** using a **Render Web Service** (Node.js serving both `/api/*` and the Vite React frontend) and **Render Managed PostgreSQL**, with **Paystack** for course registration payments.

---

## Option A: One-Click Blueprint Deployment (`render.yaml`)

1. Push this repository to **GitHub**.
2. In your Render Dashboard, click **New +** -> **Blueprint**.
3. Select your GitHub repository. Render reads `render.yaml` automatically and creates:
   - **`acadet-cbt-db`**: Render Managed PostgreSQL (`acadet_cbt`).
   - **`acadet-cbt`**: Node Web Service with `DATABASE_URL` linked internally and `JWT_SECRET` generated automatically.
4. Set required/optional secrets when prompted (or in **Environment**):
   - `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CALLBACK_URL`, `PAYSTACK_WEBHOOK_SECRET`
   - `ADMIN_EMAIL` & `ADMIN_PASSWORD` (to bootstrap a `super_admin` user on startup).
   - `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` (for S3 / Cloudflare R2 / Backblaze B2 study material uploads & downloads).
   - `GEMINI_API_KEY` (for AI-assisted question drafting inside the Admin Console).

---

## Option B: Manual Render Setup

1. **Create PostgreSQL**:
   - Render Dashboard -> **New +** -> **PostgreSQL**.
   - Copy the **Internal Database URL** (when Web Service is in the same region) or **External Database URL**.
2. **Create Web Service**:
   - Render Dashboard -> **New +** -> **Web Service** -> Connect your GitHub repo.
   - **Runtime**: `Node`
   - **Build Command**: `npm install --include=dev && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
3. **Environment Variables**:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your Render PostgreSQL connection string>`
   - `JWT_SECRET=<random 32+ character secret>`
   - `PAYSTACK_SECRET_KEY=sk_live_...` (or `sk_test_...` for test mode)
   - `PAYSTACK_PUBLIC_KEY=pk_live_...`
   - `PAYSTACK_CALLBACK_URL=https://<your-render-service>.onrender.com`
   - `PAYSTACK_WEBHOOK_SECRET=<Paystack webhook secret>`
   - Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `OBJECT_STORAGE_*`, `GEMINI_API_KEY`

---

## Paystack Webhook Configuration

In your Paystack Dashboard -> **Settings -> API Keys & Webhooks**:
- **Callback URL**: `https://<your-render-service>.onrender.com`
- **Webhook URL**: `https://<your-render-service>.onrender.com/api/webhooks/paystack`

---

## Database Migrations & Seeding

- On startup, `server.ts` automatically executes pending SQL migrations from `migrations/` (`0001_initial_schema.sql`, `0002_course_registration_payments.sql`) and seeds starter courses (`CSC 101`, `BIO 101`, `MTH 101`, `ENG 101`, `PHY 101`, `CHM 101`), questions, and announcements if empty.
- You can also run them manually anytime via Render Shell:
  - `npm run db:migrate`
  - `npm run db:seed`
