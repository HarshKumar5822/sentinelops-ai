# Stop Rebooting Everything: How We Built an Incident Response Agent That Remembers Its Past Outages

*By Harsh Kumar*

---

It’s 2:15 a.m., your phone is buzzing with PagerDuty alerts, and the checkout microservice is throwing 500 errors. You rub your eyes, open your terminal, and prompt an AI chatbot with the error log: `DB Connection Timeout`. 

The stateless LLM responds instantly with a smooth, authoritative answer: *"Upgrading your database instance and restarting the primary node is recommended."*

You follow its advice. You trigger a reboot. Production goes completely dark for five minutes, users drop off, and guess what? The database comes right back up and instantly runs out of connections again within sixty seconds. 

Why? Because the real culprit wasn't a weak database server—it was a subtle session leak in a newly deployed worker process that exhausted the connection pool. And the worst part? Your team spent three hours debugging and fixing this exact same issue two months ago, documented it in a Notion post-mortem, and completely forgot about it.

This exact frustration is why we built **SentinelOps AI**—an open-source, memory-augmented incident-response agent that watches production telemetry, triages alerts in real time using Groq's ultra-fast LLM inference, and gets measurably smarter with every incident your team resolves.

---

## The Core Problem: Stateless AI Has Amnesia

Modern LLMs are remarkably smart at writing code, but in live DevOps and Site Reliability Engineering (SRE), stateless AI models suffer from severe amnesia:

1. **Zero Context of Past Failures**: A stateless LLM treats every alert as if it's the first day of creation. It doesn't know your network topology, your past deploy blunders, or your specific database connection limits.
2. **Generic Triage Recommendations**: When faced with high CPU or connection exhaustion, standard models default to safe, generic suggestions: *reboot, scale up, or clear cache*. In complex systems, these generic fixes often mask the root cause or make outages worse.
3. **No Closed-Loop Learning**: When your team spends an hour discovering a unique fix (e.g., clearing a specific Redis key or restarting a secondary worker queue), that knowledge vanishes into a static document or Slack thread. The AI doesn't learn from it.

We wanted an agent that works more like a seasoned Senior SRE: someone who sees an alert pattern and says, *"Wait, we saw this exact memory leak in service B back in July—run script X to flush the queue."*

---

## Enter SentinelOps AI: The Three-Stage Memory Loop

Built around the principles of **Hindsight memory architecture**, SentinelOps AI relies on a three-stage learning loop: **Retain**, **Recall**, and **Reflect**.

```
  ┌────────────────┐       ┌─────────────────┐       ┌──────────────────┐
  │ 1. RECALL      │       │ 2. TRIAGE       │       │ 3. RETAIN        │
  │ Search memory  │ ────► │ LLM (Groq) fuses│ ────► │ Store post-mortem│
  │ for past fixes │       │ alert + memories│       │ as new memory    │
  └────────────────┘       └─────────────────┘       └──────────────────┘
                                                               │
                                                               ▼
                                                     ┌──────────────────┐
                                                     │ 4. REFLECT       │
                                                     │ Synthesize auto- │
                                                     │ runbook patterns │
                                                     └──────────────────┘
```

### 1. Recall (Context Matching at Machine Speed)
When a metric crosses a critical threshold—say, `Memory Usage > 92%` combined with `p95 Latency > 1400ms` on the `auth-service`—SentinelOps immediately queries its memory bank. Using a combination of vector/keyword similarity (TF-IDF cosine scoring), recency weighting, and historical success rates, it extracts the most relevant past post-mortems, architecture facts, and proven runbooks in milliseconds.

### 2. Triage (Memory-Grounded Reasoning via Groq)
Rather than throwing a raw prompt at an LLM, SentinelOps feeds both the live telemetry payload and the recalled memories into **Groq** (`openai/gpt-oss-120b` or `llama-3.3-70b-versatile`). The model compares the current telemetry footprint against past incident signatures.

If the similarity is high, the agent doesn't guess—it presents the exact, validated runbook that worked previously, alongside an honest confidence score (e.g., `94% match with Incident #104`).

### 3. Retain & Reflect (Growing the Brain)
When an SRE resolves an outage in SentinelOps, the platform automatically drafts a post-mortem containing the symptoms, root cause, exact terminal steps, and Mean Time to Resolution (MTTR). Once confirmed, this post-mortem is **retained** as an episodic memory. 

Over time, the **Reflect** engine runs background synthesis to consolidate recurring individual post-mortems into automated, high-confidence runbooks.

---

## Live Benchmarking: Stateless vs. Memory-Augmented AI

To validate this approach, we integrated a live **Side-by-Side Triage Benchmark** into SentinelOps AI. We ran identical failure scenarios through a standard stateless LLM and our memory-grounded agent.

Here is what the data showed:

| Metric | Stateless LLM | SentinelOps AI (With Memory) |
| :--- | :--- | :--- |
| **Repeat Failure Recognition** | ❌ 0% (Treats as new every time) | ✅ **90%+ Confidence** after 1 post-mortem |
| **Suggested Action** | Generic (*Reboot / Scale Instance*) | Exact Targeted Runbook (*e.g., Flush ORM pool*) |
| **Average MTTR** | ~45 minutes | **~4 minutes** |
| **Hallucination Rate** | High under ambiguous logs | Low (Grounded by past post-mortems) |

### The "Disk Full" Chaos Test
You can test this yourself using the built-in **War Room Chaos Injector**:
1. **Inject Failure**: Trigger a `Disk Partition Full` fault on `storage-worker`.
2. **First Triage**: The agent has never seen this failure before. Confidence sits around 50–54%. It suggests generic troubleshooting steps. The resolution takes ~12 minutes.
3. **Retain Memory**: The post-mortem is stored with the resolution step: `sudo logrotate -f /var/log/app.log && rm -rf /tmp/cache_*`.
4. **Inject Failure Again**: Trigger the exact same fault 10 minutes later. 
5. **Second Triage**: The agent instantly recalls the past incident, confidence jumps to **97%**, and it presents the 1-click execution script. MTTR drops to under 3 minutes.

---

## Architecture Breakdown: Built for Speed & Reliability

When production is burning, speed matters. We chose **Groq** as our primary AI inference provider because of its ultra-low latency processing, allowing our agent to reason over long telemetry contexts in fractions of a second.

```
                   ┌─────────────────────────────────────────┐
                   │               FRONTEND                  │
                   │ Glassmorphism UI · Live Telemetry Charts│
                   │ War Room · Incidents · Copilot · Lab    │
                   └────────────────────┬────────────────────┘
                                        │ REST API / JSON
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │             BACKEND (Node.js)           │
                   │  ┌───────────────────────────────────┐  │
                   │  │ Store & Telemetry Engine          │  │
                   │  └─────────────────┬─────────────────┘  │
                   │                    │                    │
                   │  ┌─────────────────▼─────────────────┐  │
                   │  │ Memory Engine (Recall/Retain)     │  │
                   │  └─────────────────┬─────────────────┘  │
                   │                    │                    │
                   │  ┌─────────────────▼─────────────────┐  │
                   │  │ AI Service (Groq API + Fallback)  │  │
                   │  └───────────────────────────────────┘  │
                   └────────────────────┬────────────────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                 ▼
             ┌──────────────────┐               ┌──────────────────┐
             │    Groq Cloud    │               │ Local Fallback   │
             │ (gpt-oss-120b)   │               │ Engine (Offline) │
             └──────────────────┘               └──────────────────┘
```

### Key Technical Highlights:
- **Resilient Fallback Engine**: If internet access drops or Groq hits rate limits, SentinelOps seamlessly switches to its built-in deterministic local engine. The UI reflects the state (`Groq ✔` vs `AI: Offline (Local)`), ensuring zero disruption during an outage.
- **Interactive War Room**: Streamed metrics across 7 microservices (CPU, RAM, p95 Latency, Error Rates, Saturation) with real-time dynamic charts updated every 1.5 seconds.
- **RESTful Agent Webhooks**: Integrate directly with PagerDuty, Alertmanager, or custom webhooks via `POST /api/agent/triage` to get immediate, memory-grounded action plans.

---

## What We Learned Building SentinelOps AI

1. **Prompt Engineering Is Not Enough**: You cannot prompt-engineer your way out of missing context. No matter how clever your system prompt is, an LLM without domain memory will make assumptions.
2. **Context Quality > Context Quantity**: Feeding 50 pages of raw logs into a prompt degrades reasoning performance. Feeding 3 highly relevant, structured past post-mortems produces dramatically better results.
3. **Closing the SRE Feedback Loop**: SRE teams write post-mortems that usually end up gathering digital dust in wiki pages. By turning post-mortems into active memory objects, documentation instantly transforms into automated operational intelligence.

---

## Try It Out

SentinelOps AI is fully open-source and ready to run locally in under 60 seconds.

- **GitHub Repository**: [HarshKumar5822/sentinelops-ai](https://github.com/HarshKumar5822/sentinelops-ai)
- **Built for**: The *AI Agents That Learn Using Hindsight* Hackathon
- **Stack**: Vanilla JS & CSS Frontend (Sky-Blue Glassmorphism UI), Node.js Express Backend, Groq API (`gpt-oss-120b` / `llama-3.3-70b-versatile`).

Whether you are managing complex microservices or just tired of generic AI advice during late-night outages, SentinelOps AI proves that **an AI agent that remembers is an AI agent you can actually trust in production.**
