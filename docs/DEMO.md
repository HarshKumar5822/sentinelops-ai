# Demo script (about 2½ minutes)

**Hook (10 s).** “At 2 a.m. a stateless AI told us to reboot the production database. SentinelOps AI remembers what actually fixed it last time.”

## Setup before recording
- `npm start`, open `http://localhost:8787`, confirm the badge reads **Groq · …**
- Lab → *Regenerate demo data* for a clean, seeded memory bank
- Browser at 100% zoom, window ~1400 px wide

## Beats

| Time | Do | Say |
|---|---|---|
| 0:10 | War Room, point at live charts | “Seven services, streaming telemetry. Everything here is generated live.” |
| 0:25 | **Inject fault → Connection pool exhaustion** | “Auth service just went critical: 250 of 250 connections, but only 12% CPU.” |
| 0:40 | Incidents → **Run triage** | “Left: an LLM with no memory. Right: the same LLM with Hindsight-style memory.” |
| 0:55 | Point at the recalled memories and the risk boxes | “The stateless agent says reboot and upgrade: five minutes of downtime, and the leak returns. The memory agent recalls two earlier post-mortems and a proven runbook.” |
| 1:10 | **Execute runbook** → confetti | “Resolved in about 4 minutes. That's 40 minutes of downtime avoided.” |
| 1:25 | Inject **Disk full** → triage | “Now something it has never seen. It tells me it has no matching memory, and its confidence drops.” |
| 1:40 | Execute (fails) → **Resolve manually** → **✦ Draft with AI** → retain | “The plan fails and costs us 12 minutes. I resolve it, let Groq draft the post-mortem, and retain it.” |
| 1:55 | Inject **Disk full** again → triage → execute | “Same failure, second time: recognised at ~97%, fixed in five minutes.” |
| 2:10 | Analytics (learning curve + MTTR) → flip the **Memory** switch | “Confidence climbs and MTTR falls as memory grows. Switch memory off and it's a generic chatbot again.” |
| 2:25 | `Ctrl+K`, close | “Command palette, live badges, mobile dock. Built by Harsh Kumar.” |

## Talking points for judges

- **Memory is the product.** Every screen reads or writes it: triage, chat, runbooks, analytics, benchmark.
- **Honest AI.** The memory agent reports when it has *no* match instead of bluffing; the stateless card uses the same model without memory, so the difference is memory alone.
- **Real integration path.** `POST /api/agent/triage` accepts a PagerDuty-style alert; the Hindsight bridge mirrors post-mortems to a real bank.
- **Measurable value.** MTTR, downtime cost avoided, recall hit-rate, Benchmark accuracy.
- **Engineering.** Modular frontend/backend, 12 automated tests (the AI routes run against a mock Groq), model fallback, retries, input validation, rate limiting.

## Content deliverables checklist

- [ ] Article (problem → memory design → learning curve → results)
- [ ] Social post with the before/after screenshot (triage side by side)
- [ ] Demo video (this script)
- [ ] GitHub repo link + live demo link
