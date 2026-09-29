# 🛡️ SentinelOps AI

**An incident-response agent that remembers.** SentinelOps AI watches your services, triages alerts with real LLM reasoning (Groq), and gets measurably better every time you resolve an incident, because every post-mortem is retained as long-term memory and recalled the next time the same failure appears.

> Built for the **“AI Agents That Learn Using Hindsight”** hackathon.
> **Created by Harsh Kumar**

---

## Table of contents

1. [What problem does it solve?](#what-problem-does-it-solve)
2. [Feature tour](#feature-tour)
3. [AI features (Groq)](#ai-features-groq)
4. [How memory works](#how-memory-works)
5. [Project structure](#project-structure)
6. [Quick start](#quick-start)
7. [Configuration](#configuration)
8. [Using the app (60-second demo)](#using-the-app-60-second-demo)
9. [Optional: real Hindsight bridge](#optional-real-hindsight-bridge)
10. [Run modes & scripts](#run-modes--scripts)
11. [Troubleshooting](#troubleshooting)
12. [Security notes](#security-notes)
13. [Docs](#docs)
14. [Hackathon checklist](#hackathon-checklist)

---

## What problem does it solve?

When production breaks at 2 a.m., a stateless AI assistant treats every alert as brand new. Ask it about a database with 250/250 connections but only 12% CPU and it will confidently tell you to *upgrade the instance and reboot the primary*: 5 minutes of downtime that doesn't even fix the leaked ORM sessions.

SentinelOps AI keeps a memory bank of your past incidents, runbooks and architecture facts. When an alert fires it **recalls** the closest past incidents, **reasons** over them with an LLM, proposes the runbook that already worked, and **retains** the new post-mortem when you're done. The result you can see in the app:

| | Stateless LLM | SentinelOps (with memory) |
|---|---|---|
| Recognises a repeat failure | ❌ never | ✅ 90%+ confidence after one post-mortem |
| Proposed fix | Generic (reboot / scale up) | The runbook that worked last time |
| MTTR | ~45 min | ~4 min |

---

## Feature tour

The app has **8 modules**. Everything is generated and updated at runtime (no hard-coded charts or numbers).

| Module | What it does |
|---|---|
| **War Room** | Live telemetry for 7 services (CPU, memory, p95 latency, 5xx, saturation) streaming every 1.5 s, a live multi-axis line chart, a live log stream, pie / bar / line charts, and a **fault injector** (or *Auto-chaos* for random failures). |
| **Incidents** | List + detail view. Run **triage** to see a *stateless LLM* and the *memory agent* side by side, execute either plan with a live terminal, resolve manually and retain the post-mortem, generate an **AI incident report**. |
| **Copilot** | Chat with your memory. Ask “how did we fix the connection leak?”, “what patterns have you learned?”, or teach it: `remember that …`. |
| **Memory Explorer** | Browse episodic memories, facts, reflections and runbooks. Run a **recall test** (see what gets retrieved and its relevance %), retain new memories, forget old ones, run **reflection**. |
| **Runbooks** | Runbooks are created automatically from post-mortems. Success-rate rings, editable steps, one-click “inject test”. |
| **Analytics** | MTTR vs. stateless baseline (line), agent confidence learning curve (line), downtime cost avoided (bar), root-cause distribution (doughnut), memory growth (line), service × failure heatmap. |
| **Benchmark** | Runs every failure type through both agents and reports accuracy. Teach the agent, run again, watch accuracy rise. |
| **Lab & Docs** | AI/backend status, sync, settings, import/export, reset, and an explanation of how Hindsight memory is used. |

**Interactive UI**

- 🎨 Sky-blue + white design system, blue animations throughout (sonar pulses, spring transitions, ripple buttons, count-up numbers, animated rings, confetti on a memory-assisted fix)
- 🧭 **Smart navigation**: sliding sky-blue pill, hover follower, collapsible sidebar with tooltips, live badges (open incidents, memory count), grouped sections, number-key shortcuts (`1`–`8`), and a floating dock on mobile
- ⌘ **Command palette** (`Ctrl/⌘ + K`): jump anywhere, inject a fault, toggle memory, run the benchmark…
- 📱 Fully responsive, keyboard accessible, respects *reduced motion*

---

## AI features (Groq)

The backend calls the [Groq](https://groq.com) API (OpenAI-compatible). Your key lives **only** in `backend/.env`.

| AI feature | Where | What the model does |
|---|---|---|
| **Stateless triage** | Incidents → Run triage | Diagnoses from the alert alone, with **no memory**: the “before” in the before/after story. |
| **Memory-grounded triage** | Incidents → Run triage | Receives the recalled memories and reuses the proven runbook; reports which memories it used and an honest confidence. |
| **Copilot chat** | Copilot | Answers grounded in recalled memories; cites memory titles. |
| **Post-mortem drafting** | Resolve dialog → *✦ Draft with AI* | Writes root cause + resolution steps that then get retained to memory. |
| **AI incident report** | Incident → *✦ AI report* | Status-page update, executive summary, customer impact, next steps. |
| **Webhook triage** | `POST /api/agent/triage` | Send a raw alert from PagerDuty / Alertmanager, get a memory-grounded plan back. |

**Graceful fallback:** if the backend or Groq is unavailable, every feature keeps working with the built-in local engine, and the top-bar badge tells you which mode you're in (`Groq · gpt-oss-120b` vs `AI: offline (local)`).

Default models come from the hackathon guide: `openai/gpt-oss-120b`, with automatic fallback to `llama-3.3-70b-versatile` (both configurable). `qwen/qwen3-32b` also works. The client retries on 429/5xx and strips `<think>` blocks and code fences from replies.

---

## How memory works

SentinelOps mirrors Hindsight's three operations:

| Operation | Implementation |
|---|---|
| **retain** | Resolving an incident stores an *episodic* post-mortem (symptoms, logs, root cause, resolution, MTTR) and creates a *runbook* if the pattern is new. Notes can also be retained from chat or the Memory Explorer. |
| **recall** | TF-IDF cosine similarity between the alert and every memory, plus small boosts for same service, recency and *reinforcement* (memories that keep helping rank higher). The top hits **vote** on which known failure pattern this is. |
| **reflect** | After each resolution, repeated incidents are consolidated into *reflections* (“seen 5 times, average MTTR 6 min, best action …”). `POST /api/memory/reflect` asks Groq to synthesise recalled memories. |

**The learning loop you can watch:** inject **Disk full**. The agent has never seen it (confidence ~54%, generic plan, the plan fails, 12 minutes lost). Resolve it and retain the post-mortem. Inject **Disk full** again → recognised at ~97%, fixed in ~5 minutes, confetti. The Analytics charts update live.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the maths and data flow.

---

## Project structure

```
sentinelops-ai/
├── README.md                  ← you are here
├── LICENSE
├── package.json               ← convenience scripts (setup / start / dev / test)
├── .gitignore
│
├── frontend/                  ← static app, no build step
│   ├── index.html
│   ├── css/
│   │   └── styles.css         ← sky-blue + white design system, animations
│   └── js/
│       ├── core.js            ← utilities, fault catalogue, app state
│       ├── memory.js          ← retain / recall / reflect engine
│       ├── incidents.js       ← triage, seeding, live telemetry
│       ├── api.js             ← backend client: Groq features, sync, Hindsight mirror
│       ├── ui.js              ← charts, nav, command palette, confetti
│       ├── pages.js           ← the 8 screens
│       ├── actions.js         ← click / keyboard handlers
│       └── main.js            ← router + boot
│
├── backend/                   ← Node.js + Express API
│   ├── package.json
│   ├── .env.example           ← copy to .env and add your Groq key
│   ├── src/
│   │   ├── server.js          ← app factory, static hosting, routes
│   │   ├── config.js          ← environment configuration
│   │   ├── routes/            ← health · ai · memory · state · hindsight
│   │   ├── services/          ← groq · prompts · memory · store · hindsight · jsonUtil
│   │   └── middleware/        ← rateLimit · errorHandler
│   ├── data/                  ← db.json (synced state; git-ignored)
│   └── test/                  ← node:test suite (unit + API with a mock Groq)
│
└── docs/
    ├── ARCHITECTURE.md        ← data flow, memory maths, extending
    ├── API.md                 ← REST reference with curl examples
    └── DEMO.md                ← demo-video script + talking points
```

---

## Quick start

### Prerequisites

- **Node.js 18 or newer** (`node -v`). Download from <https://nodejs.org> if needed.
- A free **Groq API key**: <https://console.groq.com/keys> *(optional: the app runs without it, using the local engine)*

### 1. Install

```bash
cd sentinelops-ai
npm run setup          # same as: cd backend && npm install
```

### 2. Add your Groq key

```bash
cd backend
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

Open `backend/.env` and paste your key:

```env
GROQ_API_KEY=gsk_your_key_here
```

> 🔒 Keep the key in `.env` only. Never paste it into the frontend, the chat, or GitHub. `.env` is git-ignored.

### 3. Run

```bash
cd ..                  # back to the project root
npm start
```

You should see:

```
🛡️  SentinelOps AI is running
→ App        http://localhost:8787
→ AI         Groq ✔ (openai/gpt-oss-120b)
```

### 4. Open the app

Go to **<http://localhost:8787>**. The backend serves the frontend, so there's nothing else to start.

Check the top bar: it should read **`Groq · gpt-oss-120b`** with a pulsing blue dot. If it says `AI: add Groq key` or `AI: offline (local)`, see [Troubleshooting](#troubleshooting).

> **No key yet?** Skip step 2. Everything works with the local engine; the AI badge will simply say so.

---

## Configuration

All settings live in `backend/.env` (see `backend/.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Server port |
| `CORS_ORIGIN` | `*` | Allowed origins (comma-separated) if you host the frontend elsewhere |
| `RATE_LIMIT_PER_MIN` | `60` | Per-IP limit on `/api` (protects your Groq quota) |
| `GROQ_API_KEY` | *(empty)* | Your Groq key. Empty → AI routes return a helpful 503 |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Primary model |
| `GROQ_FALLBACK_MODEL` | `llama-3.3-70b-versatile` | Used if the primary fails or is rate-limited |
| `AI_TIMEOUT_MS` | `30000` | Per-request timeout |
| `HINDSIGHT_ENABLED` | `false` | Mirror memories to real Hindsight |
| `HINDSIGHT_BASE_URL` | `http://localhost:8888` | Hindsight server (Cloud: `https://api.hindsight.vectorize.io`) |
| `HINDSIGHT_API_KEY` | *(empty)* | Needed for Hindsight Cloud |
| `HINDSIGHT_BANK_ID` | `sentinelops-ai` | Memory bank to use |

In the app, **Lab & Docs** has more settings (on-call name, telemetry speed, auto-sync).

---

## Using the app (60-second demo)

1. **War Room** → watch the live charts move. Click a service tile to switch the live chart.
2. Click **⚡ Inject random fault** (or `Ctrl+K` → *Inject a random fault*).
3. In **Incidents**, click **Run triage**. Compare the two cards:
   - *Stateless LLM*: generic advice, low confidence, flagged risk.
   - *Hindsight memory agent*: recalled memories with relevance %, a proven runbook, high confidence.
4. Click **Execute runbook** → watch the terminal, the confetti and the MTTR.
5. Inject one of the **unknown** failures (Disk full, Runaway regex, TLS expiry, Queue lag). The memory agent says it has no match. Click **Resolve manually** (try **✦ Draft with AI**), retain the post-mortem, then inject it again and see it recognised.
6. Open **Analytics** and **Benchmark** to see the learning curve, and flip the **Memory** switch in the top bar to see the before/after everywhere.

**Keyboard shortcuts**

| Key | Action |
|---|---|
| `Ctrl/⌘ + K` | Command palette |
| `1` … `8` | Jump to a module |
| `Esc` | Close dialogs |
| `Enter` in Copilot | Send |

---

## Optional: real Hindsight bridge

The local engine is enough for the demo, but you can mirror memory to a real [Hindsight](https://github.com/vectorize-io/hindsight) instance, which the hackathon requires you to demonstrate.

**Option A: Hindsight Cloud** ([ui.hindsight.vectorize.io](https://ui.hindsight.vectorize.io); the hackathon promo code `MEMHACK99` gives $50 in credits, added in the billing section after you register):

```env
HINDSIGHT_ENABLED=true
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_key
HINDSIGHT_BANK_ID=sentinelops-ai
```

**Option B: self-hosted** (see the Hindsight README for the Docker command; the API listens on `http://localhost:8888`):

```env
HINDSIGHT_ENABLED=true
HINDSIGHT_BASE_URL=http://localhost:8888
```

Restart the backend. **Lab & Docs → AI & backend** will show *“Hindsight bridge ✔ mirroring memories”*. From then on:

- every resolved post-mortem and every memory retained via the API is also **retained** in Hindsight;
- during triage and Copilot chat, Hindsight **recall** results are added to the context sent to Groq.

The bridge uses the official `@vectorize-io/hindsight-client`. It is deliberately non-fatal: if Hindsight is unreachable, the app carries on with local memory. *Please verify it against your own Hindsight instance*: it has been written against the client's published API but was not run against a live server in development.

---

## Run modes & scripts

| Command | What it does |
|---|---|
| `npm run setup` | Install backend dependencies |
| `npm start` | Start backend + serve the frontend at `http://localhost:8787` |
| `npm run dev` | Same, with auto-restart on file changes |
| `npm test` | Backend tests (12 tests, including the AI routes against a mock Groq server) |

**Frontend only (offline mode):** open `frontend/index.html` in a browser or serve it with `npx serve frontend`. It works fully with the local engine, and will auto-connect to a backend on `http://localhost:8787` if one is running. (An internet connection is needed for the Chart.js and font CDNs.)

**Data:** the app saves to your browser's `localStorage`. With the backend running and *Auto-sync* on, a snapshot is also saved to `backend/data/db.json`. Use **Lab → Pull from server** on another browser to load it.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Badge says **`AI: offline (local)`** | The backend isn't running or isn't reachable. Run `npm start` and open `http://localhost:8787`. If the frontend is hosted elsewhere, set the URL in **Lab → Backend URL** and `CORS_ORIGIN` in `.env`. |
| Badge says **`AI: add Groq key`** | The backend is up but `GROQ_API_KEY` is empty. Add it to `backend/.env` and restart. |
| Toast: *“Groq rejected the API key”* | The key is wrong or revoked. Create a new one at console.groq.com/keys. |
| Toast: *rate limited* / 429 | Groq free-tier limit. Wait a moment; the backend already retries and falls back to `GROQ_FALLBACK_MODEL`. |
| *model not found* | Model names change. Check <https://console.groq.com/docs/models> and update `GROQ_MODEL` / `GROQ_FALLBACK_MODEL`. |
| `EADDRINUSE` | Port 8787 is taken. Set `PORT=8788` in `.env`. |
| Charts blank / fonts missing | Your network blocks `cdnjs.cloudflare.com` or Google Fonts. Allow them, or vendor the files. |
| Want a clean slate | **Lab → Erase everything** (or clear the site's localStorage) and refresh. Delete `backend/data/db.json` to reset the server copy. |

---

## Security notes

- The Groq key is read **server-side only**; it is never sent to the browser.
- `/api` is rate-limited per IP; request bodies are size-limited; every AI input is truncated and validated before it reaches the model.
- Memories are passed to the model as **data**, and the prompts tell it to ignore instructions found inside them (basic prompt-injection hygiene).
- `CORS_ORIGIN=*` is convenient for local use. Restrict it before deploying publicly.
- There is no authentication. Do not expose the backend to the internet without adding it.

---

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): data flow, memory engine, diagnosis voting, how to extend
- [`docs/API.md`](docs/API.md): every endpoint with `curl` examples
- [`docs/DEMO.md`](docs/DEMO.md): demo-video script and judging talking points

---

## Hackathon checklist

| Criterion | Where to look |
|---|---|
| **Innovation (30%)** | Side-by-side stateless vs memory triage; learned runbooks; auto-reflection; webhook triage endpoint |
| **Use of Hindsight memory (25%)** | retain / recall / reflect at the core; the *Disk full* learning loop; Benchmark; optional real Hindsight bridge |
| **Technical implementation (20%)** | Modular frontend/backend, tested API, graceful fallbacks, input validation, retries and model fallback |
| **User experience (15%)** | Interactive nav, command palette, live telemetry, animations, mobile dock, accessible |
| **Real-world impact (10%)** | Drop-in webhook (`/api/agent/triage`) for PagerDuty/Alertmanager; measurable MTTR and downtime-cost avoided |

---

**Created by Harsh Kumar** · MIT License
