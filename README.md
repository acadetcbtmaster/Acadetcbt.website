# Acadet CBT MASTER — Modern Computer-Based Testing & Exam Simulator

[![Deploy to GitHub Pages](https://github.com/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/)
[![CI Verification](https://github.com/actions/workflows/ci.yml/badge.svg)](https://github.com/)
[![Node.js](https://img.shields.io/badge/Node.js-22-blue.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-blue.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4-blue.svg)](https://tailwindcss.com/)

**Acadet CBT MASTER** is a full-featured, responsive Computer-Based Testing (CBT) simulator and academic study suite designed for post-UTME, university examinations, and pre-JAMB preparation. It includes past questions, AI-assisted study material question generation, timed mock exams, real-time leaderboards, offline PWA support, and payment subscription workflows.

---

## 🚀 Key Features

- ⏱️ **Timed Mock CBT Simulator**: Authentic examination interface with real-time countdown, question grid, flagging, and automatic submission.
- 🎯 **Targeted Practice Mode**: Subject-specific and topic-specific practice with instant answer explanations.
- 🤖 **Gemini AI Exam Generator**: Convert raw lecture notes and textbooks into syllabus-accurate mock CBT questions.
- 🏆 **National Leaderboards**: Real-time scoring, ranking, and performance metrics across departments and universities.
- 🎓 **Dedicated Pre-JAMB Academy**: Isolated high-yield UTME preparatory suite for prospective university candidates.
- 📱 **Progressive Web App (PWA)**: Installable on Android, iOS, and Desktop with offline caching.
- 💳 **Multi-Gateway Payment Integration**: Seamless subscription plans via Squad and KoraPay with automated instant access provisioning.

---

## 🌐 Deploying & Hosting on GitHub Pages

There are two reliable ways to host this application on GitHub Pages:

---

### Method 1: Instant 1-Click Hosting from `/docs` (Easiest & Fastest)

The repository comes pre-bundled with a production-ready `/docs` directory containing the built application, relative assets, and SPA route restoration handlers.

1. Push this repository to your GitHub account:
   ```bash
   git add .
   git commit -m "Update application for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
   git push -u origin main
   ```
2. Open your repository on **GitHub.com**.
3. Go to **Settings** > **Pages** (in the left sidebar).
4. Under **Build and deployment** > **Source**, keep it as **Deploy from a branch**.
5. Under **Branch**, select `main` and change `/ (root)` to **/docs**.
6. Click **Save**.
7. In about 30 seconds, GitHub Pages will deploy your app at:
   ```
   https://<YOUR_GITHUB_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/
   ```

To update the `/docs` build after making code changes locally:
```bash
npm run build:docs
git add docs
git commit -m "Rebuild docs for GitHub Pages"
git push
```

---

### Method 2: Automated Deployment via GitHub Actions

If you prefer GitHub to automatically build the application on every push:

1. In your repository on **GitHub.com**, go to **Settings** > **Pages**.
2. Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. Go to the **Actions** tab in your repository — you will see the `Deploy to GitHub Pages` workflow run automatically.
4. Once completed, your live site URL will be displayed.

---

### 🔧 Troubleshooting Common GitHub Issues

#### 1. "remote origin already exists"
If you get this error when adding your GitHub repository:
```bash
git remote set-url origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
```

#### 2. "Authentication failed" or "Support for password authentication was removed"
GitHub requires a Personal Access Token (PAT) instead of your GitHub account password:
1. On GitHub.com, click your profile picture (top right) > **Settings**.
2. Scroll to the bottom and click **Developer settings** > **Personal access tokens** > **Tokens (classic)**.
3. Click **Generate new token** > **Generate new token (classic)**.
4. Give it a note (e.g. `CBT Deploy`), check the **`repo`** scope, and click **Generate token**.
5. Copy the token (starts with `ghp_...`).
6. When `git push` prompts for your Password, paste this token.

#### 3. Blank Screen or Missing Assets on GitHub Pages
- This repository has `base: './'` preconfigured in `vite.config.ts`, ensuring assets load properly on both custom domains and repository subpaths (`https://<username>.github.io/<repo>/`).
- Deep links (like `/founder` or `/practice`) are preserved on page reload via `public/404.html` and the router script in `index.html`.

---

## ☁️ Full-Stack Hosting (Express Server + API)

For production deployments that need the backend API routes (e.g., Paystack/Squad webhooks, server-side Gemini AI generation):

### Option A: Railway (One-Click)

The repository includes `railway.json` and `Procfile` configured out of the box:
1. Create an account on [Railway.app](https://railway.app/).
2. Click **New Project** > **Deploy from GitHub repo** > Select this repository.
3. Add the environment variables from `.env.example` in Railway's **Variables** tab.
4. Railway automatically detects the build and start commands (`npm run build` & `npm run start`).

### Option B: Render, Fly.io, or Cloud Run

- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Port**: `3000` (or dynamic `process.env.PORT`)

---

## 💻 Local Development Setup

### 1. Prerequisites

- **Node.js**: Version 22.x or higher
- **npm**: Version 10.x or higher

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git
cd <YOUR_REPOSITORY_NAME>

# Install dependencies
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:
- `GEMINI_API_KEY`: For AI mock exam generation (from [Google AI Studio](https://aistudio.google.com/))
- `SUPABASE_URL` & `SUPABASE_ANON_KEY`: For cloud database synchronization
- `SQUAD_PUBLIC_KEY` & `SQUAD_SECRET_KEY`: For payment processing (optional for local testing)

### 4. Start Development Server

```bash
npm run dev
```

The application will start on `http://localhost:3000`.

---

## 📦 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Express + Vite development server on port 3000 |
| `npm run build` | Builds client static assets and bundles `server.ts` into `dist/server.cjs` |
| `npm run build:pages` | Builds the client SPA specifically for GitHub Pages with relative assets (`--base=./`) |
| `npm run build:client` | Builds standard client SPA static files to `dist/` |
| `npm run start` | Runs the compiled production server (`dist/server.cjs`) |
| `npm run lint` | Runs TypeScript static type checking without emitting files |
| `npm run clean` | Cleans the `dist` directory and output bundles |

---

## 🛡️ License

This project is licensed under the MIT License.
