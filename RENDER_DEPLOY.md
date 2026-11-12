# Deploying Acadet CBT on Render

This repository is configured for deployment on **Render** using a **Render Web Service** (Node.js serving both `/api/*` and the Vite React frontend) and **Render Managed PostgreSQL**.

---

## Option A: One-Click Blueprint Deployment (`render.yaml`)

1. Push this repository to **GitHub**.
2. In your Render Dashboard, click **New +** -> **Blueprint**.
3. Select your GitHub repository. Render reads `render.yaml` automatically and creates:
   - **`acadet-cbt-db`**: Render Managed PostgreSQL (`acadet_cbt`).
   - **`acadet-cbt`**: Node Web Service with `DATABASE_URL` linked internally and `JWT_SECRET` generated automatically.
4. Set any optional secrets when prompted (or later in **Environment**):
   - `ADMIN_EMAIL` & `ADMIN_PASSWORD` (to bootstrap a `super_admin` user on initial seed).
   - `OBJECT_STORAGE_ENDPOINT`, `OBJECT_STORAGE_REGION`, `OBJECT_STORAGE_BUCKET`, `OBJECT_STORAGE_ACCESS_KEY_ID`, `OBJECT_STORAGE_SECRET_ACCESS_KEY` (for S3 / Cloudflare R2 / Backblaze B2 study material uploads & downloads).
   - `GEMINI_API_KEY` (for AI-assisted question drafting inside the Admin Console).

---

## Option B: Manual Render Setup

1. **Create PostgreSQL**:
   - Render Dashboard -> **New +** -> **PostgreSQL**.
   - Copy the **Internal Database URL** (if your Web Service is in the same region) or **External Database URL**.
2. **Create Web Service**:
   - Render Dashboard -> **New +** -> **Web Service** -> Connect your GitHub repo.
   - **Runtime**: `Node`
   - **Build Command**: `npm ci --include=dev && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
3. **Environment Variables**:
   - `NODE_ENV=production`
   - `DATABASE_URL=<your Render PostgreSQL connection string>`
   - `JWT_SECRET=<random 32+ character secret>`
   - Optional: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `OBJECT_STORAGE_*`, `GEMINI_API_KEY`

---

## Database Migrations & Seeding

- On startup, `server.ts` automatically executes pending SQL migrations from `migrations/` and seeds starter UTME subjects, questions, and announcements if the `subjects` table is empty.
- You can also run them manually anytime via Render Shell:
  - `npm run db:migrate`
  - `npm run db:seed`
